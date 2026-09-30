'use client';

import {useEffect} from 'react';
import {readPrimarySpatialGraph,replaceCurrentSpatialGraph,type SpatialGraphLike} from '@/lib/spatial-browser-recovery';
import {readSelectedSpatialProjectId,writeSelectedSpatialProjectId} from '@/lib/spatial-project-selection';
import {publishServerNewer,readLocalServerRevision,writeLocalServerRevision} from '@/lib/spatial-server-revision';

export const SERVER_HYDRATION_EVENT='stratum:server-hydration';
export const SERVER_HYDRATION_VERSION='3';
export const SERVER_HYDRATION_STATE_KEY='stratum_spatial_server_hydration_v1';

type Project={id:string;project_code?:string;name?:string};
type CompilationResponse={
 schemaReady?:boolean;
 projects?:Project[];
 restorableProjectId?:string|null;
 latest?:{revision?:number;created_at?:string|null;graph_json?:unknown}|null;
};

function validRenderableGraph(value:unknown):value is SpatialGraphLike{
 if(!value||typeof value!=='object')return false;
 const graph=value as Partial<SpatialGraphLike>;
 return Array.isArray(graph.sources)&&Array.isArray(graph.entities)&&graph.entities.length>0;
}
function publish(detail:Record<string,unknown>){
 const payload={...detail,version:SERVER_HYDRATION_VERSION};
 try{sessionStorage.setItem(SERVER_HYDRATION_STATE_KEY,JSON.stringify(payload))}catch{}
 window.dispatchEvent(new CustomEvent(SERVER_HYDRATION_EVENT,{detail:payload}));
}

export default function SpatialServerHydrator(){
 useEffect(()=>{
  let active=true;
  const hydrate=async()=>{
   publish({state:'LOADING'});
   const current=await readPrimarySpatialGraph();
   const hasLocalWorkingGraph=Boolean(current);

   try{
    const lookup=await fetch('/api/spatial/compilations',{cache:'no-store',credentials:'same-origin'});
    if(!active)return;
    if(lookup.status===401||lookup.status===403){publish({state:hasLocalWorkingGraph?'BROWSER_MODEL_PRESENT':'SIGN_IN_REQUIRED'});return}
    if(!lookup.ok){publish({state:hasLocalWorkingGraph?'BROWSER_MODEL_PRESENT':'UNAVAILABLE',status:lookup.status});return}

    const initial=await lookup.json() as CompilationResponse;
    if(!initial.schemaReady){publish({state:hasLocalWorkingGraph?'BROWSER_MODEL_PRESENT':'SCHEMA_NOT_READY'});return}
    const projects=initial.projects||[];
    if(!projects.length){publish({state:hasLocalWorkingGraph?'BROWSER_MODEL_PRESENT':'PROJECT_REQUIRED'});return}

    let projectId=readSelectedSpatialProjectId();
    if(!projects.some(project=>project.id===projectId)){
     if(hasLocalWorkingGraph){
      publish({state:'BROWSER_MODEL_PRESENT',projectSelectionRequired:true});
      return;
     }
     const restorable=initial.restorableProjectId||'';
     projectId=projects.length===1?projects[0].id:projects.some(project=>project.id===restorable)?restorable:'';
    }
    if(!projectId){publish({state:hasLocalWorkingGraph?'BROWSER_MODEL_PRESENT':'PROJECT_REQUIRED',projectCount:projects.length});return}
    writeSelectedSpatialProjectId(projectId);

    const response=await fetch('/api/spatial/compilations?projectId='+encodeURIComponent(projectId),{cache:'no-store',credentials:'same-origin'});
    if(!active)return;
    if(!response.ok){publish({state:hasLocalWorkingGraph?'BROWSER_MODEL_PRESENT':'UNAVAILABLE',status:response.status});return}
    const body=await response.json() as CompilationResponse;
    const serverRevision=typeof body.latest?.revision==='number'?body.latest.revision:0;

    if(hasLocalWorkingGraph){
     let localRevision=readLocalServerRevision(projectId);
     if(localRevision===null&&serverRevision===0){writeLocalServerRevision(projectId,0);localRevision=0}
     if(localRevision===null||localRevision!==serverRevision){
      publishServerNewer({revision:serverRevision,localRevision,storedAt:body.latest?.created_at||null,projectId,reason:localRevision===null?'LOCAL_BASE_UNKNOWN':'REVISION_CONFLICT'});
      publish({state:'BROWSER_MODEL_PRESENT',projectId,revisionConflict:true,serverRevision,localRevision});
     }else publish({state:'BROWSER_MODEL_PRESENT',projectId,serverRevision});
     return;
    }

    const graph=body.latest?.graph_json;
    if(!validRenderableGraph(graph)){writeLocalServerRevision(projectId,serverRevision);publish({state:'NO_SERVER_MODEL',projectId});return}
    await replaceCurrentSpatialGraph(graph);
    if(!active)return;
    writeLocalServerRevision(projectId,serverRevision);
    publish({state:'RESTORED',projectId,revision:serverRevision,entities:graph.entities.length});
   }catch(error){
    if(active)publish({state:hasLocalWorkingGraph?'BROWSER_MODEL_PRESENT':'UNAVAILABLE',error:error instanceof Error?error.message:'Server Spatial hydration unavailable'});
   }
  };
  void hydrate();return()=>{active=false};
 },[]);
 return null;
}
