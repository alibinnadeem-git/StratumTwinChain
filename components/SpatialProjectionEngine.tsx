'use client';

import {useEffect} from 'react';
import {DEFAULT_ELECTRICAL_MODEL_REGISTRY,ELECTRICAL_MODEL_REGISTRY_STORAGE_KEY,normalizeElectricalModelRegistry} from '@/lib/electrical-model-registry';
import {readPrimarySpatialGraph,writePrimarySpatialGraphIfUnchanged} from '@/lib/spatial-browser-recovery';
import {projectGraphOffThread} from '@/lib/graph-assembly-client';
import {graphSignature} from '@/lib/graph-signature';

const REGISTRY_EVENT='stratum:model-registry-updated';

export default function SpatialProjectionEngine(){
 useEffect(()=>{
  let applying=false;
  const apply=async()=>{
   if(applying)return;
   applying=true;
   try{
    const graph=await readPrimarySpatialGraph();if(!graph||!Array.isArray(graph.entities))return;
    const storedRegistry=localStorage.getItem(ELECTRICAL_MODEL_REGISTRY_STORAGE_KEY);
    const registry=storedRegistry?normalizeElectricalModelRegistry(JSON.parse(storedRegistry)):DEFAULT_ELECTRICAL_MODEL_REGISTRY;
    const before=graphSignature(graph);
    const enriched=await projectGraphOffThread(graph as any,registry);
    if(graphSignature(enriched)===before)return;
    // Projection is async, so another panel (a title-block confirmation, room proposal, ...)
    // may have written the graph meanwhile. Never overwrite that newer graph with one projected
    // from a stale read: write only if it is unchanged, otherwise re-project from the latest.
    if(!await writePrimarySpatialGraphIfUnchanged(enriched as any,before)){refresh();return}
    window.dispatchEvent(new Event('stratum:graph-updated'));
   }catch{
    // Source graph is preserved if projection enrichment cannot be evaluated.
   }finally{applying=false}
  };
  // Debounce so a burst of graph-updated events (including derived writes from other
  // reactive panels) coalesces into a single projection pass instead of a cascade storm.
  let timer:ReturnType<typeof setTimeout>|null=null;
  const refresh=()=>{if(timer)clearTimeout(timer);timer=setTimeout(()=>void apply(),250)};
  void apply();
  window.addEventListener('stratum:graph-updated',refresh);
  window.addEventListener(REGISTRY_EVENT,refresh);
  window.addEventListener('storage',refresh);
  return()=>{if(timer)clearTimeout(timer);window.removeEventListener('stratum:graph-updated',refresh);window.removeEventListener(REGISTRY_EVENT,refresh);window.removeEventListener('storage',refresh)};
 },[]);
 return null;
}
