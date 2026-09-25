"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import CompiledGraphViewer from "@/components/CompiledGraphViewer";
import {type RegisteredSpatialAsset} from "@/lib/spatial-asset-link";
import {readPrimarySpatialGraph,replaceCurrentSpatialGraph,restoreBestSpatialGraph} from "@/lib/spatial-browser-recovery";
import {enrichAudiE4SourceReview} from "@/lib/audi-e4-source-review";
import {SERVER_HYDRATION_EVENT,SERVER_HYDRATION_STATE_KEY} from "@/components/SpatialServerHydrator";

type ExperienceState={
  ready:boolean;
  hasImportedModel:boolean;
  sourceCount:number;
  sourceSheetOnly:boolean;
  lineCount:number;
};

async function inspectCompiledGraph():Promise<ExperienceState>{
  try{
    const saved=await readPrimarySpatialGraph();
    if(!saved)return{ready:true,hasImportedModel:false,sourceCount:0,sourceSheetOnly:false,lineCount:0};
    const graph=enrichAudiE4SourceReview(saved);
    if(graph!==saved)await replaceCurrentSpatialGraph(graph)
    const entities=(Array.isArray(graph?.entities)?graph.entities:[]) as {kind?:string}[];
    const sources=Array.isArray(graph?.sources)?graph.sources:[];
    return{ready:true,hasImportedModel:entities.length>0,sourceCount:sources.length,
      sourceSheetOnly:entities.length>0&&(graph.reviewState==='SOURCE_SHEET_ONLY'||entities.every((entity:{kind?:string})=>entity.kind==='line')),
      lineCount:entities.filter((entity:{kind?:string})=>entity.kind==='line').length};
  }catch{
    return{ready:true,hasImportedModel:false,sourceCount:0,sourceSheetOnly:false,lineCount:0};
  }
}

export default function SpatialExperience({assets,authenticated=false}:{assets:RegisteredSpatialAsset[];authenticated?:boolean}){
  const [state,setState]=useState<ExperienceState>({ready:false,hasImportedModel:false,sourceCount:0,sourceSheetOnly:false,lineCount:0});
  const [serverPending,setServerPending]=useState(false);

  useEffect(()=>{
    let active=true;
    const refresh=async()=>{const next=await inspectCompiledGraph();if(active)setState(next)};
    const refreshEvent=()=>{void refresh()};
    const serverState=()=>{try{return JSON.parse(sessionStorage.getItem(SERVER_HYDRATION_STATE_KEY)||'{}')?.state||''}catch{return''}};
    const onServerHydration=(event:Event)=>{
      if(!active)return;
      const detail=(event as CustomEvent).detail||{};
      if(detail.state==='LOADING'){setServerPending(true);setState({ready:false,hasImportedModel:false,sourceCount:0,sourceSheetOnly:false,lineCount:0});return}
      setServerPending(false);
      void refresh();
    };
    const hydrate=async()=>{
      const initial=await inspectCompiledGraph();
      if(initial.hasImportedModel){if(active)setState(initial);return}
      await restoreBestSpatialGraph();
      const recovered=await inspectCompiledGraph();
      if(recovered.hasImportedModel){if(active)setState(recovered);return}
      const state=serverState();
      if(state==='LOADING'){if(active){setServerPending(true);setState({...recovered,ready:false})}return}
      if(authenticated&&!state){if(active){setServerPending(true);setState({...recovered,ready:false})}return}
      if(active){setServerPending(false);setState(recovered)};
    };
    void hydrate();
    window.addEventListener("stratum:graph-updated",refreshEvent);
    window.addEventListener("storage",refreshEvent);
    window.addEventListener(SERVER_HYDRATION_EVENT,onServerHydration);
    return()=>{
      active=false;
      window.removeEventListener("stratum:graph-updated",refreshEvent);
      window.removeEventListener("storage",refreshEvent);
      window.removeEventListener(SERVER_HYDRATION_EVENT,onServerHydration);
    };
  },[authenticated]);

  if(!state.ready)return <section className="card" aria-live="polite">
    <div className="eyebrow">Spatial workspace</div>
    <h2>{serverPending?'Restoring latest project model…':'Preparing the project workspace…'}</h2>
    <p className="muted">{serverPending?'Checking the tenant project for the latest saved Spatial revision before declaring the workspace empty.':'Recovering the latest browser-protected project model.'}</p>
  </section>;

  if(state.hasImportedModel)return <section id="spatial-model" aria-label="Imported project spatial model">
    {state.sourceSheetOnly?<div className="notice" style={{marginBottom:12}} role="status">
      <strong>SOURCE SHEET ONLY · 0 COMPONENTS</strong>
      <span>This saved project contains {state.lineCount} drawing line{state.lineCount===1?'':'s'}, but no identified equipment or 3D components. The lines show the source sheet; they are not clickable assets. Use “Recover earlier STRATUM model” above on the device where your earlier model was created, or import the model backup or a labeled equipment source.</span>
      <div className="button-row" style={{marginTop:10}}><Link className="ghost" href="/compiler">Import labeled equipment source</Link></div>
    </div>:<div className="notice" style={{marginBottom:12,borderColor:"#2d7252"}}>
      <strong>PROJECT MODEL</strong>
      <span>This view is generated from your compiled engineering sources. Click equipment to inspect its registered asset, activity, QR identity and DIR state.</span>
    </div>}
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
