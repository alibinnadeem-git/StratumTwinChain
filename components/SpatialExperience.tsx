"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import CompiledGraphViewer from "@/components/CompiledGraphViewer";
import {type RegisteredSpatialAsset} from "@/lib/spatial-asset-link";
import {readPrimarySpatialGraph,replaceCurrentSpatialGraph,restoreBestSpatialGraph} from "@/lib/spatial-browser-recovery";
import {stripLegacyAudiE4SourceReview} from "@/lib/audi-e4-source-review";
import {isIdentifiedProjectEquipment,isSourceGeometry,spatialUiCounts} from "@/lib/spatial-ui-counts";
import {SERVER_HYDRATION_EVENT,SERVER_HYDRATION_STATE_KEY} from "@/components/SpatialServerHydrator";

type ExperienceState={
  ready:boolean;
  hasImportedModel:boolean;
  sourceCount:number;
  sourceSheetOnly:boolean;
  lineCount:number;
  spatialRecordCount:number;
  equipmentCount:number;
  handoffVerified:boolean|null;
};

async function inspectCompiledGraph():Promise<ExperienceState>{
  try{
    const saved=await readPrimarySpatialGraph();
    if(!saved)return{ready:true,hasImportedModel:false,sourceCount:0,sourceSheetOnly:false,lineCount:0,spatialRecordCount:0,equipmentCount:0,handoffVerified:null};
    const graph=stripLegacyAudiE4SourceReview(saved);
    if(graph!==saved)await replaceCurrentSpatialGraph(graph);
    const entities=(Array.isArray(graph?.entities)?graph.entities:[]) as {kind?:string;layer?:string;meta?:Record<string,unknown>}[];
    const sources=Array.isArray(graph?.sources)?graph.sources:[];
    const projectComponents=entities.filter(isIdentifiedProjectEquipment);
    const sourceGeometry=entities.filter(isSourceGeometry);
    const counts=spatialUiCounts(entities);
    let handoffVerified:boolean|null=null;
    try{
      const raw=sessionStorage.getItem('stratum_spatial_render_handoff');
      if(raw){
        const handoff=JSON.parse(raw);
        handoffVerified=String(handoff.createdAt||'')===String(graph.createdAt||'')&&Number(handoff.entities||0)===entities.length&&Number(handoff.sources||0)===sources.length;
      }
    }catch{}
    return{ready:true,hasImportedModel:entities.length>0,sourceCount:sources.length,
      sourceSheetOnly:entities.length>0&&(graph.reviewState==='SOURCE_SHEET_ONLY'||(projectComponents.length===0&&sourceGeometry.length>0)),
      lineCount:counts.drawingLines,spatialRecordCount:counts.spatialRecords,equipmentCount:counts.identifiedEquipment,handoffVerified};
  }catch{
    return{ready:true,hasImportedModel:false,sourceCount:0,sourceSheetOnly:false,lineCount:0,spatialRecordCount:0,equipmentCount:0,handoffVerified:null};
  }
}

export default function SpatialExperience({assets,authenticated=false}:{assets:RegisteredSpatialAsset[];authenticated?:boolean}){
  const [state,setState]=useState<ExperienceState>({ready:false,hasImportedModel:false,sourceCount:0,sourceSheetOnly:false,lineCount:0,spatialRecordCount:0,equipmentCount:0,handoffVerified:null});
  const [serverPending,setServerPending]=useState(false);

  useEffect(()=>{
    let active=true;
    const refresh=async()=>{const next=await inspectCompiledGraph();if(active)setState(next)};
    const refreshEvent=()=>{void refresh()};
    const serverState=()=>{try{return JSON.parse(sessionStorage.getItem(SERVER_HYDRATION_STATE_KEY)||'{}')?.state||''}catch{return''}};
    const onServerHydration=(event:Event)=>{
      if(!active)return;
      const detail=(event as CustomEvent).detail||{};
      if(detail.state==='LOADING'){setServerPending(true);setState({ready:false,hasImportedModel:false,sourceCount:0,sourceSheetOnly:false,lineCount:0,spatialRecordCount:0,equipmentCount:0,handoffVerified:null});return}
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
    {state.handoffVerified===false&&<div className="notice" role="alert" style={{marginBottom:12}}><strong>RENDER HANDOFF MISMATCH</strong><span>The Spatial route did not load the exact revision handed off by Import. STRATUM is refusing to pretend the render succeeded. Return to Import and render the persisted revision again.</span><Link className="action" href="/import">Return to Import</Link></div>}
    {state.handoffVerified===true&&<div className="notice" role="status" style={{marginBottom:12,borderColor:'#2d7252'}}><strong>RENDER HANDOFF VERIFIED</strong><span>Spatial loaded the same persisted revision that Import handed off: {state.sourceCount} source{state.sourceCount===1?'':'s'} · {state.spatialRecordCount} spatial records.</span></div>}
    {state.sourceSheetOnly?<div className="notice" style={{marginBottom:12}} role="status">
      <strong>SOURCE DRAWING · {state.equipmentCount} IDENTIFIED EQUIPMENT · {state.spatialRecordCount} SPATIAL RECORDS</strong>
      <span>The source drawing is available, but no project equipment has been identified yet. Spatial records include retained drawing geometry and review evidence; they are not the same thing as equipment components. Import or review labeled equipment to create selectable project-equipment candidates.</span>
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
