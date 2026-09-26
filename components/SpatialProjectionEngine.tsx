'use client';

import {useEffect} from 'react';
import {enrichSpatialProjection} from '@/lib/spatial-projection';
import {DEFAULT_ELECTRICAL_MODEL_REGISTRY,ELECTRICAL_MODEL_REGISTRY_STORAGE_KEY,normalizeElectricalModelRegistry} from '@/lib/electrical-model-registry';
import {enrichPowerIntelligence} from '@/lib/power-intelligence';
import {enrichCoordinationIntelligence} from '@/lib/coordination-intelligence';
import {readPrimarySpatialGraph,writePrimarySpatialGraph} from '@/lib/spatial-browser-recovery';

const REGISTRY_EVENT='stratum:model-registry-updated';

export default function SpatialProjectionEngine(){
 useEffect(()=>{
  let active=true,applying=false,queued=false;
  const apply=async()=>{
   if(applying){queued=true;return}
   applying=true;
   try{
    do{
     queued=false;
     const graph=await readPrimarySpatialGraph();if(!graph||!Array.isArray(graph.entities))continue;
     const storedRegistry=localStorage.getItem(ELECTRICAL_MODEL_REGISTRY_STORAGE_KEY);
     const registry=storedRegistry?normalizeElectricalModelRegistry(JSON.parse(storedRegistry)):DEFAULT_ELECTRICAL_MODEL_REGISTRY;
     const spatial=enrichSpatialProjection(graph as any,registry);
     const power=enrichPowerIntelligence(spatial);
     const enriched=enrichCoordinationIntelligence(power as any);
     if(JSON.stringify(enriched)===JSON.stringify(graph))continue;
     await writePrimarySpatialGraph(enriched as any);
     if(active)window.dispatchEvent(new Event('stratum:graph-updated'));
    }while(active&&queued);
   }catch{
    // Source graph is preserved if projection enrichment cannot be evaluated.
   }finally{
    applying=false;
    if(active&&queued)void apply();
   }
  };
  const refresh=()=>{void apply()};
  void apply();
  window.addEventListener('stratum:graph-updated',refresh);
  window.addEventListener(REGISTRY_EVENT,refresh);
  window.addEventListener('storage',refresh);
  return()=>{active=false;window.removeEventListener('stratum:graph-updated',refresh);window.removeEventListener(REGISTRY_EVENT,refresh);window.removeEventListener('storage',refresh)};
 },[]);
 return null;
}
