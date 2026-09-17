"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import CompiledGraphViewer from "@/components/CompiledGraphViewer";
import TwinWorkspace,{type TwinAsset} from "@/components/TwinWorkspace";

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

export default function SpatialExperience({
  assets,
  referenceModelUrl,
}:{assets:TwinAsset[];referenceModelUrl?:string}){
  const [state,setState]=useState<ExperienceState>({ready:false,hasImportedModel:false,sourceCount:0});

  useEffect(()=>{
    const refresh=()=>setState(inspectCompiledGraph());
    refresh();
    window.addEventListener("stratum:graph-updated",refresh);
    window.addEventListener("storage",refresh);
    return()=>{
      window.removeEventListener("stratum:graph-updated",refresh);
      window.removeEventListener("storage",refresh);
    };
  },[]);

  if(!state.ready)return <section className="card" aria-live="polite">
    <div className="eyebrow">Spatial workspace</div>
    <h2>Preparing the viewer…</h2>
  </section>;

  if(state.hasImportedModel)return <section id="spatial-model" aria-label="Imported project spatial model">
    <div className="notice" style={{marginBottom:12,borderColor:"#2d7252"}}>
      <strong>IMPORTED PROJECT MODEL</strong>
      <span>This view is generated from your compiled engineering sources. Demonstration geometry is not mixed into project data.</span>
    </div>
    <CompiledGraphViewer registeredAssets={assets}/>
  </section>;

  return <section id="spatial-model" aria-label="Demonstration spatial workspace">
    <div className="card" style={{marginBottom:12,borderColor:state.sourceCount?"#8b6530":"#245069"}}>
      <div className="eyebrow">{state.sourceCount?"Compilation needs attention":"Reference workspace"}</div>
      <h2 style={{margin:"4px 0"}}>{state.sourceCount?"Uploaded sources produced no spatial objects":"Demonstration model"}</h2>
      <p className="subtitle" style={{margin:"6px 0 12px"}}>
        {state.sourceCount
          ?`${state.sourceCount} source file(s) were recorded, but no L1–L4 entities were compiled. The reference workspace below is for product demonstration only and was not generated from those files.`
          :"The reference workspace below demonstrates navigation, object selection and asset interaction. It is not project evidence or an imported model."}
      </p>
      <div className="button-row">
        <Link className="action" href="/compiler">{state.sourceCount?"Review source extraction":"Import engineering sources"}</Link>
      </div>
    </div>
    <div className="notice" style={{marginBottom:12}}>
      <strong>DEMONSTRATION DATA</strong>
      <span>Reference geometry is isolated from imported project sources and cannot be registered or finalized as project truth.</span>
    </div>
    <TwinWorkspace assets={assets} referenceModelUrl={referenceModelUrl}/>
  </section>;
}
