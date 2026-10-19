/// <reference lib="webworker" />
import {assembleGraph,type GraphEntity} from '../lib/graph-assembly';
import {compileGraph,enrichSpatialEntities,projectGraph,type CompileGraphInput} from '../lib/graph-enrichment';

// Off-thread post-parse pipeline. Zone assignment, link building, per-asset Z enrichment,
// equipment-identity reconciliation and coordination findings all scale with the full
// (accumulated) graph and froze the tab on reprocess/repeat imports. The main thread posts
// the merged entity list; the worker returns finished results.
const reply=(message:Record<string,unknown>)=>(self as unknown as Worker).postMessage(message);

self.onmessage=(event:MessageEvent)=>{
 const message=event.data||{};
 const requestId=message?.requestId;
 try{
  if(message?.type==='assemble'){
   const {zoned,links}=assembleGraph(Array.isArray(message.entities)?message.entities:[]);
   reply({type:'result',requestId,zoned,links});
   return;
  }
  if(message?.type==='enrich'){
   const entities=enrichSpatialEntities(Array.isArray(message.entities)?message.entities as GraphEntity[]:[]);
   reply({type:'result',requestId,entities});
   return;
  }
  if(message?.type==='compile'){
   const result=compileGraph(message.input as CompileGraphInput);
   reply({type:'result',requestId,...result});
   return;
  }
  if(message?.type==='project'){
   const graph=projectGraph(message.graph,message.registry);
   reply({type:'result',requestId,graph});
   return;
  }
 }catch(error){
  reply({type:'error',requestId,message:error instanceof Error?error.message:'Graph worker task failed.'});
 }
};
