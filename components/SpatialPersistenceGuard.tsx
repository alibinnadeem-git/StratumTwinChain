'use client';

import {useEffect,useRef} from 'react';
import {
  parseSpatialGraph,
  protectSpatialGraph,
  readIndexedCurrentSpatialGraph,
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

    const captureGraphUpdate=()=>{
      void (async()=>{
        const local=parseSpatialGraph(localStorage.getItem(SPATIAL_GRAPH_KEY));
        const indexed=await readIndexedCurrentSpatialGraph();
        if(!active)return;
        const differs=Boolean(local&&(!indexed||JSON.stringify(local)!==JSON.stringify(indexed)));
        // Explicit same-tab graph updates may promote a legacy compatibility writer.
        // Generic cross-tab storage events never receive that authority.
        const graph=differs?local:(indexed||local);
        if(!graph)return;
        const previous=last.current;
        if(differs&&local)await writePrimarySpatialGraph(local);
        else if(indexed)await writePrimarySpatialGraph(indexed);
        last.current=graph;
        await protectSpatialGraph(graph,previous&&JSON.stringify(previous)!==JSON.stringify(graph)?previous:null);
      })();
    };

    const reconcileStorageEvent=()=>{
      void (async()=>{
        const indexed=await readIndexedCurrentSpatialGraph();
        if(!indexed||!active)return;
        await writePrimarySpatialGraph(indexed);
        const previous=last.current;
        last.current=indexed;
        await protectSpatialGraph(indexed,previous&&JSON.stringify(previous)!==JSON.stringify(indexed)?previous:null);
      })();
    };

    void initialize();
    window.addEventListener('stratum:graph-updated',captureGraphUpdate);
    window.addEventListener('storage',reconcileStorageEvent);
    return()=>{
      active=false;
      window.removeEventListener('stratum:graph-updated',captureGraphUpdate);
      window.removeEventListener('storage',reconcileStorageEvent);
    };
  },[]);

  return null;
}
