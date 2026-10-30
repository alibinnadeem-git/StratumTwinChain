'use client';

import {useEffect} from 'react';
import {DEFAULT_ELECTRICAL_MODEL_REGISTRY,ELECTRICAL_MODEL_REGISTRY_STORAGE_KEY,normalizeElectricalModelRegistry} from '@/lib/electrical-model-registry';
import {readPrimarySpatialGraph,writePrimarySpatialGraphIfUnchanged} from '@/lib/spatial-browser-recovery';
import {projectGraphOffThread} from '@/lib/graph-assembly-client';
import {graphSignature} from '@/lib/graph-signature';
import {reportSpatialDiag,startSpatialDiagTimer} from '@/lib/spatial-diagnostics';

const REGISTRY_EVENT='stratum:model-registry-updated';
const DEBOUNCE_MS=250;
const CONTENTION_BACKOFF_MS=700;
// One projection pass at a time across mounts. The Import and Spatial pages both mount this engine; a pass
// still running when Import unmounts (Render Spatial Environment) used to keep going and write the ~39 MB
// golden-fixture graph while the Spatial page's first pass did the same, so each made the other contended.
// Now a new pass waits for the previous one, and a pass whose page has unmounted stops before writing.
let passInFlight:Promise<void>=Promise.resolve();

function projectionCounts(graph:any):Record<string,number>{
 const summary=graph?.spatialProjection&&typeof graph.spatialProjection==='object'?graph.spatialProjection:{};
 const num=(value:unknown)=>{const n=Number(value);return Number.isFinite(n)?n:0};
 return{
  entities:Array.isArray(graph?.entities)?graph.entities.length:0,
  links:Array.isArray(graph?.links)?graph.links.length:0,
  cadMetricFrames:num(summary.cadMetricFrames),
  sldFrames:num(summary.sldFrames),
  sldLinks:num(summary.sldLinks),
  sldVectorLinks:num(summary.sldVectorLinks),
 };
}

export default function SpatialProjectionEngine(){
 useEffect(()=>{
  let active=true;
  let applying=false;
  // Signature of the graph we last wrote. Our own write dispatches graph-updated, which would retrigger
  // projection and re-serialize the whole graph to the worker only to find no change. Skipping that
  // self-echo removes the redundant pass (the Phase 0 thrash). Cleared on registry/storage changes so
  // those always re-project.
  let lastAppliedSignature:string|null=null;
  const apply=async()=>{
   if(!active||applying)return;
   applying=true;
   const previousPass=passInFlight;let releasePass=()=>{};
   passInFlight=new Promise<void>(resolve=>{releasePass=resolve});
   const elapsed=startSpatialDiagTimer();
   const stopIfUnmounted=()=>{if(active)return false;reportSpatialDiag({stage:'project',level:'info',code:'PROJECT_CANCELLED_UNMOUNTED',message:'Page unmounted; the next page\'s engine projects instead',durationMs:Math.round(elapsed())});return true};
   try{
    await previousPass;
    if(!active)return;
    const graph=await readPrimarySpatialGraph();if(!graph||!Array.isArray(graph.entities))return;
    if(stopIfUnmounted())return;
    const storedRegistry=localStorage.getItem(ELECTRICAL_MODEL_REGISTRY_STORAGE_KEY);
    const registry=storedRegistry?normalizeElectricalModelRegistry(JSON.parse(storedRegistry)):DEFAULT_ELECTRICAL_MODEL_REGISTRY;
    const before=graphSignature(graph);
    if(before===lastAppliedSignature){
     reportSpatialDiag({stage:'project',level:'info',code:'PROJECT_SKIPPED_SELF_ECHO',message:'Graph unchanged since our last projection; skipped redundant pass',counts:{entities:graph.entities.length}});
     return;
    }
    reportSpatialDiag({stage:'project',level:'info',code:'PROJECT_START',counts:{entities:graph.entities.length}});
    const enriched=await projectGraphOffThread(graph as any,registry);
    if(stopIfUnmounted())return;
    if(graphSignature(enriched)===before){
     reportSpatialDiag({stage:'project',level:'info',code:'PROJECT_NO_OP',message:'Projection produced no change',counts:projectionCounts(enriched),durationMs:Math.round(elapsed())});
     return;
    }
    // Projection is async, so another panel (a title-block confirmation, room proposal, ...)
    // may have written the graph meanwhile. Never overwrite that newer graph with one projected
    // from a stale read: write only if it is unchanged, otherwise re-project from the latest.
    if(!await writePrimarySpatialGraphIfUnchanged(enriched as any,before)){
     reportSpatialDiag({stage:'project',level:'warn',code:'PROJECT_WRITE_CONTENDED',message:'Graph changed during projection; re-projecting after writers settle',durationMs:Math.round(elapsed())});
     // Another writer (e.g. server hydration) landed mid-projection. Back off longer than the normal
     // debounce so the retry re-reads a settled graph instead of immediately losing the race again.
     refresh(CONTENTION_BACKOFF_MS);return;
    }
    lastAppliedSignature=graphSignature(enriched);
    reportSpatialDiag({stage:'project',level:'info',code:'PROJECT_APPLIED',message:'Projection enrichment written',counts:projectionCounts(enriched),durationMs:Math.round(elapsed())});
    window.dispatchEvent(new Event('stratum:graph-updated'));
   }catch(error){
    if(!active)return;
    // Source graph is preserved if projection enrichment cannot be evaluated — but the failure
    // is no longer silent: without this the entire render falls back to un-projected geometry.
    reportSpatialDiag({stage:'project',level:'error',code:'PROJECT_FAILED',message:error instanceof Error?error.message:'Projection enrichment failed',durationMs:Math.round(elapsed()),data:{error:error instanceof Error?error.message:String(error)}});
   }finally{applying=false;releasePass()}
  };
  // Debounce so a burst of graph-updated events (including derived writes from other
  // reactive panels) coalesces into a single projection pass instead of a cascade storm.
  let timer:ReturnType<typeof setTimeout>|null=null;
  const refresh=(delay:number=DEBOUNCE_MS)=>{if(!active)return;if(timer)clearTimeout(timer);timer=setTimeout(()=>void apply(),delay)};
  // A registry or external-storage change can alter the projection even when the graph is unchanged,
  // so clear the self-echo guard to force a re-project.
  const refreshExternal=()=>{lastAppliedSignature=null;refresh()};
  // Event handlers ignore the event object (refresh takes an optional delay, not an Event).
  const onGraphUpdated=()=>refresh();
  void apply();
  window.addEventListener('stratum:graph-updated',onGraphUpdated);
  window.addEventListener(REGISTRY_EVENT,refreshExternal);
  window.addEventListener('storage',refreshExternal);
  return()=>{active=false;if(timer)clearTimeout(timer);window.removeEventListener('stratum:graph-updated',onGraphUpdated);window.removeEventListener(REGISTRY_EVENT,refreshExternal);window.removeEventListener('storage',refreshExternal)};
 },[]);
 return null;
}
