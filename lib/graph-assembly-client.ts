import {assembleGraph,type GraphEntity,type GraphLink} from './graph-assembly';
import {compileGraph,enrichSpatialEntities,projectGraph,type CompileGraphInput,type CompileGraphResult} from './graph-enrichment';

export type GraphAssembly={zoned:GraphEntity[];links:GraphLink[]};

// Runs a graph-worker task off the UI thread. If the browser has no Worker support, or the
// worker fails to start or crashes, it runs the provided synchronous fallback so the import
// always completes (with a brief freeze) rather than losing work.
async function runGraphWorkerTask<T>(message:Record<string,unknown>,fallback:()=>T):Promise<T>{
 if(typeof Worker==='undefined')return fallback();
 let worker:Worker;
 try{worker=new Worker(new URL('../workers/graph-assembly.worker.ts',import.meta.url),{type:'module'});}
 catch{return fallback();}
 const requestId=crypto.randomUUID();
 try{
  return await new Promise<T>((resolve,reject)=>{
   worker.onmessage=(event:MessageEvent)=>{
    const data=event.data||{};
    if(data.requestId!==requestId)return;
    if(data.type==='result')resolve(data as T);
    else if(data.type==='error')reject(new Error(String(data.message||'Graph worker task failed.')));
   };
   worker.onerror=(event:ErrorEvent)=>reject(new Error(event.message||'Graph worker crashed.'));
   worker.onmessageerror=()=>reject(new Error('Graph worker returned an untransferable result.'));
   worker.postMessage({...message,requestId});
  });
 }catch{
  return fallback();
 }finally{
  worker.terminate();
 }
}

export async function assembleGraphOffThread(entities:GraphEntity[]):Promise<GraphAssembly>{
 const result=await runGraphWorkerTask<{zoned:GraphEntity[];links:GraphLink[]}>(
  {type:'assemble',entities},
  ()=>assembleGraph(entities),
 );
 return {zoned:result.zoned,links:result.links};
}

export async function enrichEntitiesOffThread(entities:GraphEntity[]):Promise<GraphEntity[]>{
 const result=await runGraphWorkerTask<{entities:GraphEntity[]}>(
  {type:'enrich',entities},
  ()=>({entities:enrichSpatialEntities(entities)}),
 );
 return result.entities;
}

export async function projectGraphOffThread<T>(graph:T,registry?:unknown):Promise<T>{
 const result=await runGraphWorkerTask<{graph:T}>(
  {type:'project',graph,registry},
  ()=>({graph:projectGraph(graph,registry) as T}),
 );
 return result.graph;
}

export async function compileGraphOffThread(input:CompileGraphInput):Promise<CompileGraphResult>{
 const result=await runGraphWorkerTask<CompileGraphResult>(
  {type:'compile',input},
  ()=>compileGraph(input),
 );
 return {zoned:result.zoned,links:result.links,coordinationIntelligence:result.coordinationIntelligence,electricalIntelligence:result.electricalIntelligence,reviewState:result.reviewState,stats:result.stats};
}
