'use client';

import {useEffect,useRef} from 'react';
import {
  protectSpatialGraph,
  readPrimarySpatialGraph,
  restoreBestSpatialGraph,
} from '@/lib/spatial-browser-recovery';

export default function SpatialPersistenceGuard(){
  const last=useRef<Awaited<ReturnType<typeof readPrimarySpatialGraph>>>(null);

  useEffect(()=>{
    let active=true;

    const initialize=async()=>{
      const restored=await restoreBestSpatialGraph();
      if(!active)return;
      last.current=restored.graph;
      if(restored.graph)await protectSpatialGraph(restored.graph,null);
    };

    const capture=()=>{
      void (async()=>{
        const graph=await readPrimarySpatialGraph();
        if(!graph||!active)return;
        const previous=last.current;
        last.current=graph;
        await protectSpatialGraph(graph,previous&&JSON.stringify(previous)!==JSON.stringify(graph)?previous:null);
      })();
    };

    void initialize();
    window.addEventListener('stratum:graph-updated',capture);
    window.addEventListener('storage',capture);
    return()=>{
      active=false;
      window.removeEventListener('stratum:graph-updated',capture);
      window.removeEventListener('storage',capture);
    };
  },[]);

  return null;
}
