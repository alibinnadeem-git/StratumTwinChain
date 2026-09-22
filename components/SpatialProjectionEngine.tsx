'use client';

import {useEffect} from 'react';
import {enrichSpatialProjection} from '@/lib/spatial-projection';
import {DEFAULT_ELECTRICAL_MODEL_REGISTRY,ELECTRICAL_MODEL_REGISTRY_STORAGE_KEY,normalizeElectricalModelRegistry} from '@/lib/electrical-model-registry';
import {enrichPowerIntelligence} from '@/lib/power-intelligence';

const STORAGE_KEY='stratum_compiled_graph';
const REGISTRY_EVENT='stratum:model-registry-updated';

export default function SpatialProjectionEngine(){
 useEffect(()=>{
  let applying=false;
  const apply=()=>{
   if(applying)return;
   try{
    const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return;
    const graph=JSON.parse(raw);if(!graph||!Array.isArray(graph.entities))return;
    const storedRegistry=localStorage.getItem(ELECTRICAL_MODEL_REGISTRY_STORAGE_KEY);
    const registry=storedRegistry?normalizeElectricalModelRegistry(JSON.parse(storedRegistry)):DEFAULT_ELECTRICAL_MODEL_REGISTRY;
    const spatial=enrichSpatialProjection(graph,registry);
    const enriched=enrichPowerIntelligence(spatial);
    const next=JSON.stringify(enriched);
    if(next===raw)return;
    applying=true;
    localStorage.setItem(STORAGE_KEY,next);
    window.dispatchEvent(new Event('stratum:graph-updated'));
   }catch{
    // Source graph is preserved if projection enrichment cannot be evaluated.
   }finally{applying=false}
  };
  apply();
  window.addEventListener('stratum:graph-updated',apply);
  window.addEventListener(REGISTRY_EVENT,apply);
  window.addEventListener('storage',apply);
  return()=>{window.removeEventListener('stratum:graph-updated',apply);window.removeEventListener(REGISTRY_EVENT,apply);window.removeEventListener('storage',apply)};
 },[]);
 return null;
}
