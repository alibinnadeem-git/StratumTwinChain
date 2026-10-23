import {assembleGraph,type GraphEntity,type GraphLink} from './graph-assembly';
import {compileGraph,enrichSpatialEntities,projectGraph,type CompileGraphInput,type CompileGraphResult} from './graph-enrichment';
import {reportSpatialDiag,startSpatialDiagTimer} from './spatial-diagnostics';

export type GraphAssembly={zoned:GraphEntity[];links:GraphLink[]};

// Runs a graph-worker task off the UI thread. If the browser has no Worker support, or the
// worker fails to start or crashes, it runs the provided synchronous fallback so the import
// always completes (with a brief freeze) rather than losing work.
// Small graphs run inline: worker startup and structured-clone cost more than the work itself.
const GRAPH_WORKER_MIN_ENTITIES=1000;
// A worker that never replies (hung, or lost without an error event) would leave the import
// awaiting forever with upload and cancel disabled. Past this deadline the worker is terminated
// and the task fails instead of falling back: rerunning the same work on the UI thread could
// freeze the tab for just as long. Each task on a real 28.7k-entity nine-page set takes under 0.5 s.
export const GRAPH_WORKER_HARD_TIMEOUT_MS=180000;

export class GraphWorkerError extends Error{
 readonly code:'GRAPH_WORKER_TIMEOUT'|'GRAPH_WORKER_CANCELLED';
 constructor(code:GraphWorkerError['code'],message:string){super(message);this.name='GraphWorkerError';this.code=code}
}
const cancelled=()=>new GraphWorkerError('GRAPH_WORKER_CANCELLED','Graph finalization was canceled. No partial result was accepted.');

async function runGraphWorkerTask<T>(message:Record<string,unknown>,fallback:()=>T,entityCount:number,signal?:AbortSignal):Promise<T>{
 const task=String(message.type||'unknown');
 const elapsed=startSpatialDiagTimer();
 if(signal?.aborted)throw cancelled();
 // Small graphs run inline by design (worker startup costs more than the work). This is not a
 // failure, but it is reported so the HUD distinguishes "ran inline" from "worker silently fell back".
 if(typeof Worker==='undefined'||entityCount<GRAPH_WORKER_MIN_ENTITIES){
  const reason=typeof Worker==='undefined'?'NO_WORKER_SUPPORT':'BELOW_WORKER_THRESHOLD';
  const result=fallback();
  reportSpatialDiag({stage:'worker',level:'info',code:'TASK_INLINE',message:`${task} ran inline (${reason})`,counts:{entityCount},durationMs:Math.round(elapsed()),data:{task,reason}});
  return result;
 }
 reportSpatialDiag({stage:'worker',level:'info',code:'TASK_START',message:`${task} dispatched to worker`,counts:{entityCount},data:{task}});
 let worker:Worker;
 try{worker=new Worker(new URL('../workers/graph-assembly.worker.ts',import.meta.url),{type:'module'});}
 catch(error){
  reportSpatialDiag({stage:'worker',level:'warn',code:'WORKER_UNAVAILABLE_FELL_BACK',message:`${task}: worker could not start; ran on the UI thread`,counts:{entityCount},durationMs:Math.round(elapsed()),data:{task,error:error instanceof Error?error.message:String(error)}});
  return fallback();
 }
 const requestId=crypto.randomUUID();
 let deadline:ReturnType<typeof setTimeout>|undefined,onAbort:(()=>void)|undefined;
 try{
  const result=await new Promise<T>((resolve,reject)=>{
   worker.onmessage=(event:MessageEvent)=>{
    const data=event.data||{};
    if(data.requestId!==requestId)return;
    if(data.type==='result')resolve(data as T);
    else if(data.type==='error')reject(new Error(String(data.message||'Graph worker task failed.')));
    // The graph worker only ever replies result/error. Anything else (e.g. heartbeats from an
    // unexpected worker) would never settle, hanging the import, so fall back instead.
    else reject(new Error(`Graph worker replied with unexpected message type: ${String(data.type)}`));
   };
   worker.onerror=(event:ErrorEvent)=>reject(new Error(event.message||'Graph worker crashed.'));
   worker.onmessageerror=()=>reject(new Error('Graph worker returned an untransferable result.'));
   deadline=setTimeout(()=>reject(new GraphWorkerError('GRAPH_WORKER_TIMEOUT',`Graph finalization did not finish within ${Math.round(GRAPH_WORKER_HARD_TIMEOUT_MS/60000)} minutes and was stopped. No partial result was accepted.`)),GRAPH_WORKER_HARD_TIMEOUT_MS);
   onAbort=()=>reject(cancelled());
   signal?.addEventListener('abort',onAbort,{once:true});
   worker.postMessage({...message,requestId});
  });
  reportSpatialDiag({stage:'worker',level:'info',code:'TASK_OK',message:`${task} completed in the worker`,counts:{entityCount},durationMs:Math.round(elapsed()),data:{task}});
  return result;
 }catch(error){
  if(error instanceof GraphWorkerError){
   reportSpatialDiag({stage:'worker',level:error.code==='GRAPH_WORKER_CANCELLED'?'warn':'error',code:error.code,message:error.message,counts:{entityCount},durationMs:Math.round(elapsed()),data:{task}});
   throw error;
  }
  // The worker crashed or replied unexpectedly: work still completes on the UI thread (with a
  // freeze), but this is exactly the silent fallback we must surface.
  reportSpatialDiag({stage:'worker',level:'warn',code:'WORKER_CRASHED_FELL_BACK',message:`${task}: ${error instanceof Error?error.message:'worker failed'}; ran on the UI thread`,counts:{entityCount},durationMs:Math.round(elapsed()),data:{task,error:error instanceof Error?error.message:String(error)}});
  return fallback();
 }finally{
  if(deadline!==undefined)clearTimeout(deadline);
  if(onAbort)signal?.removeEventListener('abort',onAbort);
  worker.terminate();
 }
}

export async function assembleGraphOffThread(entities:GraphEntity[]):Promise<GraphAssembly>{
 const result=await runGraphWorkerTask<{zoned:GraphEntity[];links:GraphLink[]}>(
  {type:'assemble',entities},
  ()=>assembleGraph(entities),
  entities.length,
 );
 return {zoned:result.zoned,links:result.links};
}

export async function enrichEntitiesOffThread(entities:GraphEntity[],signal?:AbortSignal):Promise<GraphEntity[]>{
 const result=await runGraphWorkerTask<{entities:GraphEntity[]}>(
  {type:'enrich',entities},
  ()=>({entities:enrichSpatialEntities(entities)}),
  entities.length,
  signal,
 );
 return result.entities;
}

export async function projectGraphOffThread<T>(graph:T,registry?:unknown):Promise<T>{
 const result=await runGraphWorkerTask<{graph:T}>(
  {type:'project',graph,registry},
  ()=>({graph:projectGraph(graph,registry) as T}),
  Array.isArray((graph as {entities?:unknown})?.entities)?(graph as {entities:unknown[]}).entities.length:0,
 );
 return result.graph;
}

export async function compileGraphOffThread(input:CompileGraphInput,signal?:AbortSignal):Promise<CompileGraphResult>{
 const result=await runGraphWorkerTask<CompileGraphResult>(
  {type:'compile',input},
  ()=>compileGraph(input),
  input.entities.length,
  signal,
 );
 return {zoned:result.zoned,links:result.links,coordinationIntelligence:result.coordinationIntelligence,electricalIntelligence:result.electricalIntelligence,reviewState:result.reviewState,stats:result.stats};
}
