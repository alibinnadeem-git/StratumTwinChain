'use client';

import {useEffect,useRef} from 'react';
import {readPrimarySpatialGraph} from '@/lib/spatial-browser-recovery';
import {readSelectedSpatialProjectId,writeSelectedSpatialProjectId} from '@/lib/spatial-project-selection';
import {publishServerNewer,readLocalServerRevision,writeLocalServerRevision} from '@/lib/spatial-server-revision';

export const SERVER_SYNC_EVENT='stratum:server-sync';
type Project={id:string};
type LatestResponse={latest?:{revision?:number;created_at?:string|null}|null};

function publish(detail:Record<string,unknown>){window.dispatchEvent(new CustomEvent(SERVER_SYNC_EVENT,{detail}))}

export default function SpatialAutoSync(){
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const running=useRef(false);

 useEffect(()=>{
  let active=true;
  const sync=async()=>{
   if(!active||running.current)return;
   const graph=await readPrimarySpatialGraph();
   if(!graph||!graph.entities.length)return;
   running.current=true;
   try{
    const lookup=await fetch('/api/spatial/compilations',{cache:'no-store',credentials:'same-origin'});
    if(!lookup.ok){publish({state:'UNAVAILABLE',status:lookup.status});return}
    const body=await lookup.json();
    if(!body.schemaReady){publish({state:'SCHEMA_NOT_READY'});return}
    const projects=(body.projects||[]) as Project[];
    if(!projects.length){publish({state:'PROJECT_REQUIRED'});return}

    let projectId=readSelectedSpatialProjectId();
    if(!projects.some(project=>project.id===projectId)){
     projectId=projects.length===1?projects[0].id:'';
     if(projectId)writeSelectedSpatialProjectId(projectId);
    }
    if(!projectId){publish({state:'PROJECT_REQUIRED'});return}
    const graphProjectId=typeof graph.workingProjectId==='string'?graph.workingProjectId:'';
    if(!graphProjectId){
     publish({state:'GRAPH_PROJECT_REQUIRED',projectId,error:'Automatic save blocked until the browser working graph is explicitly bound to this project.'});
     return;
    }
    if(graphProjectId!==projectId){
     publish({state:'PROJECT_MISMATCH',projectId,graphProjectId,error:'Automatic save blocked because the browser working graph belongs to a different project.'});
     return;
    }

    // Read the authoritative append-only head before every background save.
    const headResponse=await fetch('/api/spatial/compilations?projectId='+encodeURIComponent(projectId),{cache:'no-store',credentials:'same-origin'});
    const headBody=await headResponse.json().catch(()=>({})) as LatestResponse;
    if(!headResponse.ok){publish({state:'UNAVAILABLE',status:headResponse.status});return}
    const serverRevision=typeof headBody.latest?.revision==='number'?headBody.latest.revision:0;
    let localRevision=readLocalServerRevision(projectId);
    if(localRevision===null&&serverRevision===0){writeLocalServerRevision(projectId,0);localRevision=0}
    if(localRevision===null||localRevision!==serverRevision){
     publishServerNewer({revision:serverRevision,localRevision,storedAt:headBody.latest?.created_at||null,projectId,reason:localRevision===null?'LOCAL_BASE_UNKNOWN':'REVISION_CONFLICT'});
     publish({state:'CONFLICT',projectId,serverRevision,localRevision,error:'Automatic save blocked because this browser is not based on the current server revision.'});
     return;
    }

    const response=await fetch('/api/spatial/compilations',{
     method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',
     body:JSON.stringify({projectId,expectedRevision:localRevision,graph})
    });
    const saved=await response.json().catch(()=>({}));
    if(!response.ok){
     if(response.status===409&&saved?.code==='SPATIAL_REVISION_CONFLICT'){
      const revision=Number(saved.serverRevision)||0;
      publishServerNewer({revision,localRevision,storedAt:null,projectId,reason:'REVISION_CONFLICT'});
      publish({state:'CONFLICT',projectId,serverRevision:revision,localRevision,error:saved.error||'Spatial revision conflict'});
      return;
     }
     publish({state:'FAILED',status:response.status,error:saved?.error||'Spatial sync failed'});return;
    }
    if(typeof saved.revision==='number'&&saved.revision>=0)writeLocalServerRevision(projectId,saved.revision);
    publish({state:'SAVED',projectId,revision:saved.revision,idempotent:Boolean(saved.idempotent)});
   }catch(error){publish({state:'UNAVAILABLE',error:error instanceof Error?error.message:'Spatial sync unavailable'});}
   finally{running.current=false}
  };
  const schedule=()=>{if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>void sync(),1800)};
  schedule();window.addEventListener('stratum:graph-updated',schedule);
  return()=>{active=false;if(timer.current)clearTimeout(timer.current);window.removeEventListener('stratum:graph-updated',schedule)};
 },[]);
 return null;
}
