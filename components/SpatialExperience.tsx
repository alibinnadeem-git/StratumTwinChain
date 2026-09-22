"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import CompiledGraphViewer from "@/components/CompiledGraphViewer";
import {type RegisteredSpatialAsset} from "@/lib/spatial-asset-link";
import {restoreBestSpatialGraph} from "@/lib/spatial-browser-recovery";

type ExperienceState={
  ready:boolean;
  hasImportedModel:boolean;
  sourceCount:number;
};

function inspectCompiledGraph():ExperienceState{
  try{
    const raw=localStorage.getItem("stratum_compiled_graph");
    if(!raw)return{ready:true,hasImportedModel:false,sourceCount:0};
    const graph=JSON.parse(raw);
    const entities=Array.isArray(graph?.entities)?graph.entities:[];
    const sources=Array.isArray(graph?.sources)?graph.sources:[];
    return{ready:true,hasImportedModel:entities.length>0,sourceCount:sources.length};
  }catch{
    return{ready:true,hasImportedModel:false,sourceCount:0};
  }
}

export default function SpatialExperience({assets}:{assets:RegisteredSpatialAsset[]}){
  const [state,setState]=useState<ExperienceState>({ready:false,hasImportedModel:false,sourceCount:0});

  useEffect(()=>{
    let active=true;
    const refresh=()=>{if(active)setState(inspectCompiledGraph())};
    const hydrate=async()=>{
      const initial=inspectCompiledGraph();
      if(initial.hasImportedModel){if(active)setState(initial);return}
      await restoreBestSpatialGraph();
      refresh();
    };
    void hydrate();
    window.addEventListener("stratum:graph-updated",refresh);
    window.addEventListener("storage",refresh);
    return()=>{
      active=false;
      window.removeEventListener("stratum:graph-updated",refresh);
      window.removeEventListener("storage",refresh);
    };
  },[]);

  if(!state.ready)return <section className="card" aria-live="polite">
    <div className="eyebrow">Spatial workspace</div>
    <h2>Preparing the project workspace…</h2>
  </section>;

  if(state.hasImportedModel)return <section id="spatial-model" aria-label="Imported project spatial model">
    <div className="notice" style={{marginBottom:12,borderColor:"#2d7252"}}>
      <strong>PROJECT MODEL</strong>
      <span>This view is generated from your compiled engineering sources. Click equipment to inspect its registered asset, activity, QR identity and DIR state.</span>
    </div>
    <CompiledGraphViewer registeredAssets={assets}/>
  </section>;

  return <section className="card" aria-label="Spatial source required" style={{marginBottom:18}}>
    <div className="eyebrow">{state.sourceCount?"Compilation needs attention":"Start with project sources"}</div>
    <h2 style={{margin:"4px 0"}}>{state.sourceCount?"No spatial objects were produced yet":"Import before viewing Spatial"}</h2>
    <p className="subtitle" style={{margin:"6px 0 12px"}}>
      {state.sourceCount
        ?state.sourceCount+" source file(s) are recorded, but no usable L1–L4 spatial objects exist yet. Review extraction and unresolved items before opening a model."
        :"Upload PDF, CAD, BIM, image or 3D project sources first. STRATUM will not show a demonstration building in place of your project."}
    </p>
    <div className="button-row"><Link className="action" href="/compiler">{state.sourceCount?"Review source extraction":"Import engineering sources"}</Link></div>
  </section>;
}
