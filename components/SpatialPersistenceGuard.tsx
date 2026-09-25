'use client';

import {useEffect,useRef} from 'react';
import {
  parseSpatialGraph,
  protectSpatialGraph,
  readPrimarySpatialGraph,
  restoreBestSpatialGraph,
  writePrimarySpatialGraph,
  SPATIAL_GRAPH_KEY,
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
      const raw=localStorage.getItem(SPATIAL_GRAPH_KEY);
      const graph=parseSpatialGraph(raw);
      if(!graph)return;
      const previous=last.current;
      last.current=graph;
      void (async()=>{
        await writePrimarySpatialGraph(graph);
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
