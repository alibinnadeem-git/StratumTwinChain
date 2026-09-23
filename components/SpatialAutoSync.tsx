'use client';

import {useEffect,useRef} from 'react';
import {readCurrentSpatialGraph} from '@/lib/spatial-browser-recovery';

const PROJECT_KEY='stratum_spatial_project_id';
export const SERVER_SYNC_EVENT='stratum:server-sync';
export const SERVER_SYNC_REQUEST_EVENT='stratum:sync-request';

type Project={id:string};

function publish(detail:Record<string,unknown>){
  window.dispatchEvent(new CustomEvent(SERVER_SYNC_EVENT,{detail}));
}

export default function SpatialAutoSync(){
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const running=useRef(false);

  useEffect(()=>{
    let active=true;

    const sync=async()=>{
      if(!active||running.current)return;
      const graph=readCurrentSpatialGraph();
      if(!graph||!graph.entities.length)return;
      running.current=true;
      try{
        const lookup=await fetch('/api/spatial/compilations',{cache:'no-store',credentials:'same-origin'});
        if(!lookup.ok){
          publish({state:'UNAVAILABLE',status:lookup.status});
          return;
        }
        const body=await lookup.json();
        if(!body.schemaReady){publish({state:'SCHEMA_NOT_READY'});return;}
        const projects=(body.projects||[]) as Project[];
        if(!projects.length){publish({state:'PROJECT_REQUIRED'});return;}

        let projectId=localStorage.getItem(PROJECT_KEY)||'';
        if(!projects.some(project=>project.id===projectId)){
          projectId=projects.length===1?projects[0].id:'';
          if(projectId)localStorage.setItem(PROJECT_KEY,projectId);
        }
        if(!projectId){publish({state:'PROJECT_REQUIRED'});return;}

        const response=await fetch('/api/spatial/compilations',{
          method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',
          body:JSON.stringify({projectId,graph})
        });
        const saved=await response.json().catch(()=>({}));
        if(!response.ok){publish({state:'FAILED',status:response.status,error:saved?.error||'Spatial sync failed'});return;}
        publish({state:'SAVED',projectId,revision:saved.revision,idempotent:Boolean(saved.idempotent)});
      }catch(error){
        publish({state:'UNAVAILABLE',error:error instanceof Error?error.message:'Spatial sync unavailable'});
      }finally{
        running.current=false;
      }
    };

    const schedule=()=>{
      if(timer.current)clearTimeout(timer.current);
      timer.current=setTimeout(()=>void sync(),1800);
    };

    schedule();
    window.addEventListener('stratum:graph-updated',schedule);
    window.addEventListener('stratum:auth-changed',schedule);
    window.addEventListener(SERVER_SYNC_REQUEST_EVENT,schedule);
    window.addEventListener('online',schedule);
    return()=>{
      active=false;
      if(timer.current)clearTimeout(timer.current);
      window.removeEventListener('stratum:graph-updated',schedule);
      window.removeEventListener('stratum:auth-changed',schedule);
      window.removeEventListener(SERVER_SYNC_REQUEST_EVENT,schedule);
      window.removeEventListener('online',schedule);
    };
  },[]);

  return null;
}
