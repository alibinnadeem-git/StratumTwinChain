'use client';

import {useEffect} from 'react';
import {readPrimarySpatialGraph,replaceCurrentSpatialGraph,type SpatialGraphLike} from '@/lib/spatial-browser-recovery';
import {readSelectedSpatialProjectId,writeSelectedSpatialProjectId} from '@/lib/spatial-project-selection';

export const SERVER_HYDRATION_EVENT='stratum:server-hydration';
export const SERVER_HYDRATION_VERSION='2';
export const SERVER_HYDRATION_STATE_KEY='stratum_spatial_server_hydration_v1';

type Project={id:string;project_code?:string;name?:string};
type CompilationResponse={
  schemaReady?:boolean;
  projects?:Project[];
  restorableProjectId?:string|null;
  latest?:{id?:string;revision?:number;graph_sha256?:string;graph_json?:unknown}|null;
};

type ZReviewDecision={
  id:string;
  compilation_id:string;
  entity_id:string;
  action:'ACCEPT_DESIGN_CHAIN'|'CLEAR_DESIGN_CHAIN';
  candidate_id?:string|null;
  reason?:string;
  graph_sha256?:string;
  decision_sha256?:string;
  occurred_at?:string;
};

function validRenderableGraph(value:unknown):value is SpatialGraphLike{
  if(!value||typeof value!=='object')return false;
  const graph=value as Partial<SpatialGraphLike>;
  return Array.isArray(graph.sources)&&Array.isArray(graph.entities)&&graph.entities.length>0;
}

function overlayZReviewDecisions(graph:SpatialGraphLike,decisions:ZReviewDecision[]){
  if(!decisions.length)return graph;
  const byEntity=new Map(decisions.map(decision=>[decision.entity_id,decision]));
  return{
    ...graph,
    entities:graph.entities.map((entity:any)=>{
      const decision=byEntity.get(String(entity.id||''));
      if(!decision)return entity;
      const meta={...(entity.meta||{})};
      for(const key of Object.keys(meta))if(key.startsWith('zReviewDecision'))delete meta[key];
      if(decision.action==='ACCEPT_DESIGN_CHAIN'&&decision.candidate_id){
        meta.zReviewDecisionStatus='ACCEPTED_DESIGN_CHAIN';
        meta.zReviewDecisionCandidateId=decision.candidate_id;
        meta.zReviewDecisionAt=decision.occurred_at||new Date().toISOString();
        meta.zReviewDecisionAuthority='SERVER_AUTHENTICATED_HUMAN_REVIEW';
        meta.zReviewDecisionId=decision.id;
        meta.zReviewDecisionSha256=decision.decision_sha256||'';
        meta.zReviewDecisionCompilationId=decision.compilation_id;
        meta.zReviewDecisionGraphSha256=decision.graph_sha256||'';
        meta.zReviewDecisionReason=decision.reason||'';
        meta.zReviewDecisionPhysicalTruth=false;
        meta.physicalElevationKnown=false;
        meta.elevationKnown=false;
        meta.physicalTruth=false;
        meta.reviewRequired=true;
      }
      return{...entity,meta};
    })
  } as SpatialGraphLike;
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
    projectId=readSelectedSpatialProjectId()
    if(!projects.some(project=>project.id===projectId)){
      const restorable=initial.restorableProjectId||'';
      projectId=projects.length===1?projects[0].id:projects.some(project=>project.id===restorable)?restorable:'';
    }
    if(!projectId){publish({state:'PROJECT_REQUIRED',projectCount:projects.length});return}
    writeSelectedSpatialProjectId(projectId)

    const response=await fetch('/api/spatial/compilations?projectId='+encodeURIComponent(projectId),{cache:'no-store',credentials:'same-origin'});
    if(!active)return;
    if(!response.ok){publish({state:'UNAVAILABLE',status:response.status});return}
    const body=await response.json() as CompilationResponse;
    const graph=body.latest?.graph_json;
    if(!validRenderableGraph(graph)){publish({state:'NO_SERVER_MODEL',projectId});return}

    let restoredGraph=graph;
    let zReviewDecisionCount=0;
    const compilationId=body.latest?.id||'';
    if(compilationId){
      try{
        const reviewResponse=await fetch('/api/spatial/z-reviews?projectId='+encodeURIComponent(projectId)+'&compilationId='+encodeURIComponent(compilationId),{cache:'no-store',credentials:'same-origin'});
        if(reviewResponse.ok){
          const reviewBody=await reviewResponse.json() as {decisions?:ZReviewDecision[]};
          const decisions=Array.isArray(reviewBody.decisions)?reviewBody.decisions:[];
          restoredGraph=overlayZReviewDecisions(graph,decisions);
          zReviewDecisionCount=decisions.length;
        }
      }catch{}
    }

    await replaceCurrentSpatialGraph(restoredGraph);
    if(!active)return;
    publish({state:'RESTORED',projectId,revision:body.latest?.revision||null,entities:restoredGraph.entities.length,zReviewDecisionCount});
   }catch(error){
    if(active)publish({state:'UNAVAILABLE',error:error instanceof Error?error.message:'Server Spatial hydration unavailable'});
   }
  };

  void hydrate();
  return()=>{active=false};
 },[]);

 return null;
}
