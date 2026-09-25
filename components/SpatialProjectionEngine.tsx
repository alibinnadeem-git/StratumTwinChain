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
  let applying=false;
  const apply=async()=>{
   if(applying)return;
   applying=true;
   try{
    const graph=await readPrimarySpatialGraph();if(!graph||!Array.isArray(graph.entities))return;
    const storedRegistry=localStorage.getItem(ELECTRICAL_MODEL_REGISTRY_STORAGE_KEY);
    const registry=storedRegistry?normalizeElectricalModelRegistry(JSON.parse(storedRegistry)):DEFAULT_ELECTRICAL_MODEL_REGISTRY;
    const spatial=enrichSpatialProjection(graph,registry);
    const power=enrichPowerIntelligence(spatial);
    const enriched=enrichCoordinationIntelligence(power);
    if(JSON.stringify(enriched)===JSON.stringify(graph))return;
    await writePrimarySpatialGraph(enriched);
    window.dispatchEvent(new Event('stratum:graph-updated'));
   }catch{
    // Source graph is preserved if projection enrichment cannot be evaluated.
   }finally{applying=false}
  };
  const refresh=()=>{void apply()};
  void apply();
  window.addEventListener('stratum:graph-updated',refresh);
  window.addEventListener(REGISTRY_EVENT,refresh);
  window.addEventListener('storage',refresh);
  return()=>{window.removeEventListener('stratum:graph-updated',refresh);window.removeEventListener(REGISTRY_EVENT,refresh);window.removeEventListener('storage',refresh)};
 },[]);
 return null;
}
