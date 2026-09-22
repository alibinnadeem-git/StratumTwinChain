'use client';

import {useEffect} from 'react';
import {protectSpatialGraph,readCurrentSpatialGraph,replaceCurrentSpatialGraph,type SpatialGraphLike} from '@/lib/spatial-browser-recovery';

const PROJECT_KEY='stratum_spatial_project_id';
export const SERVER_HYDRATION_EVENT='stratum:server-hydration';

type Project={id:string;project_code?:string;name?:string};
type CompilationResponse={
  schemaReady?:boolean;
  projects?:Project[];
  latest?:{revision?:number;graph_json?:unknown}|null;
};

function validRenderableGraph(value:unknown):value is SpatialGraphLike{
  if(!value||typeof value!=='object')return false;
  const graph=value as Partial<SpatialGraphLike>;
  return Array.isArray(graph.sources)&&Array.isArray(graph.entities)&&graph.entities.length>0;
}

function publish(detail:Record<string,unknown>){
  window.dispatchEvent(new CustomEvent(SERVER_HYDRATION_EVENT,{detail}));
}

export default function SpatialServerHydrator(){
 useEffect(()=>{
  let active=true;

  const hydrate=async()=>{
   const current=readCurrentSpatialGraph();
   if(current?.entities.length){publish({state:'BROWSER_MODEL_PRESENT'});return}

   try{
    const lookup=await fetch('/api/spatial/compilations',{cache:'no-store',credentials:'same-origin'});
    if(!active)return;
    if(lookup.status===401||lookup.status===403){publish({state:'SIGN_IN_REQUIRED'});return}
    if(!lookup.ok){publish({state:'UNAVAILABLE',status:lookup.status});return}

    const initial=await lookup.json() as CompilationResponse;
    if(!initial.schemaReady){publish({state:'SCHEMA_NOT_READY'});return}
    const projects=initial.projects||[];
    if(!projects.length){publish({state:'PROJECT_REQUIRED'});return}

    let projectId='';
    try{projectId=localStorage.getItem(PROJECT_KEY)||''}catch{}
    if(!projects.some(project=>project.id===projectId)){
      projectId=projects.length===1?projects[0].id:'';
    }
    if(!projectId){publish({state:'PROJECT_REQUIRED',projectCount:projects.length});return}
    try{localStorage.setItem(PROJECT_KEY,projectId)}catch{}

    const response=await fetch('/api/spatial/compilations?projectId='+encodeURIComponent(projectId),{cache:'no-store',credentials:'same-origin'});
    if(!active)return;
    if(!response.ok){publish({state:'UNAVAILABLE',status:response.status});return}
    const body=await response.json() as CompilationResponse;
    const graph=body.latest?.graph_json;
    if(!validRenderableGraph(graph)){publish({state:'NO_SERVER_MODEL',projectId});return}

    replaceCurrentSpatialGraph(graph);
    await protectSpatialGraph(graph,null);
    if(!active)return;
    publish({state:'RESTORED',projectId,revision:body.latest?.revision||null,entities:graph.entities.length});
   }catch(error){
    if(active)publish({state:'UNAVAILABLE',error:error instanceof Error?error.message:'Server Spatial hydration unavailable'});
   }
  };

  void hydrate();
  return()=>{active=false};
 },[]);

 return null;
}
