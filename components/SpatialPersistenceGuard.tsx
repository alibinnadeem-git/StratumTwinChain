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
import {graphSignature} from '@/lib/graph-signature';

export default function SpatialPersistenceGuard(){
  const last=useRef<Awaited<ReturnType<typeof readPrimarySpatialGraph>>>(null);

  useEffect(()=>{
    // Safe import recovery must bypass the application-wide graph restore.
    if(window.location.pathname==='/compiler'&&new URLSearchParams(window.location.search).get('safe')==='1')return;
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
        // Promote the localStorage shadow only when it is genuinely newer
        // than the IndexedDB graph. A stale shadow left behind by an earlier
        // small graph must never override a newer chunked graph: doing so
        // reverted the workspace to the old graph after every large import.
        const localNewer=Boolean(local&&indexed&&(Date.parse(String(local.createdAt||''))||0)>(Date.parse(String(indexed.createdAt||''))||0));
        const differs=Boolean(local&&(!indexed||(graphSignature(local)!==graphSignature(indexed)&&localNewer)));
        // Explicit same-tab graph updates may promote a legacy compatibility writer.
        // Generic cross-tab storage events never receive that authority.
        const graph=differs?local:(indexed||local);
        if(!graph)return;
        const previous=last.current;
        if(differs&&local)await writePrimarySpatialGraph(local);
        else if(indexed)await writePrimarySpatialGraph(indexed);
        last.current=graph;
        await protectSpatialGraph(graph,previous&&graphSignature(previous)!==graphSignature(graph)?previous:null);
      })();
    };

    const reconcileStorageEvent=()=>{
      void (async()=>{
        const indexed=await readIndexedCurrentSpatialGraph();
        if(!indexed||!active)return;
        await writePrimarySpatialGraph(indexed);
        const previous=last.current;
        last.current=indexed;
        await protectSpatialGraph(indexed,previous&&graphSignature(previous)!==graphSignature(indexed)?previous:null);
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
