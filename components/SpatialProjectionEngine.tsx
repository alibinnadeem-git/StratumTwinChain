'use client';

import {useEffect} from 'react';
import {enrichSpatialProjection} from '@/lib/spatial-projection';

const STORAGE_KEY='stratum_compiled_graph';

export default function SpatialProjectionEngine(){
 useEffect(()=>{
  let applying=false;
  const apply=()=>{
   if(applying)return;
   try{
    const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return;
    const graph=JSON.parse(raw);if(!graph||!Array.isArray(graph.entities))return;
    const enriched=enrichSpatialProjection(graph);
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
  window.addEventListener('storage',apply);
  return()=>{window.removeEventListener('stratum:graph-updated',apply);window.removeEventListener('storage',apply)};
 },[]);
 return null;
}
