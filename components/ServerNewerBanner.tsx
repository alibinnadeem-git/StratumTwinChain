'use client';

import {useEffect,useState} from 'react';
import {replaceCurrentSpatialGraph} from '@/lib/spatial-browser-recovery';
import {SERVER_NEWER_EVENT,SERVER_NEWER_RESOLVED_EVENT,publishServerNewerResolved,readServerNewerNotice,writeLocalServerRevision,type ServerNewerDetail} from '@/lib/spatial-server-revision';

type LatestBody={latest?:{revision?:number;created_at?:string|null;graph_json?:unknown}|null};

export default function ServerNewerBanner(){
 const [notice,setNotice]=useState<ServerNewerDetail|null>(()=>readServerNewerNotice());
 const [armed,setArmed]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');

 useEffect(()=>{
  const onNewer=(event:Event)=>{setNotice((event as CustomEvent<ServerNewerDetail>).detail);setArmed(false);setMessage('');};
  const onResolved=(event:Event)=>{
   const detail=(event as CustomEvent<{projectId?:string}>).detail;
   if(!notice||!detail?.projectId||detail.projectId===notice.projectId){setNotice(null);setArmed(false);setMessage('');}
  };
  window.addEventListener(SERVER_NEWER_EVENT,onNewer);
  window.addEventListener(SERVER_NEWER_RESOLVED_EVENT,onResolved);
  return()=>{window.removeEventListener(SERVER_NEWER_EVENT,onNewer);window.removeEventListener(SERVER_NEWER_RESOLVED_EVENT,onResolved);};
 },[notice]);

 async function load(){
  if(!notice||busy)return;
  if(!armed){setArmed(true);return}
  setBusy(true);setMessage('');
  try{
   const response=await fetch('/api/spatial/compilations?projectId='+encodeURIComponent(notice.projectId),{cache:'no-store',credentials:'same-origin'});
   const body=await response.json().catch(()=>({})) as LatestBody;
   if(!response.ok)throw new Error('Unable to read the server snapshot.');
   const latest=body.latest;
   const actualRevision=typeof latest?.revision==='number'?latest.revision:null;
   const graph=latest?.graph_json as {sources?:unknown[];entities?:unknown[];links?:unknown[]}|null;
   if(!actualRevision||!graph||!Array.isArray(graph.sources)||!Array.isArray(graph.entities)||!Array.isArray(graph.links))throw new Error('The current server snapshot is malformed; browser data was not changed.');
   await replaceCurrentSpatialGraph({...graph,workingProjectId:notice.projectId} as Parameters<typeof replaceCurrentSpatialGraph>[0]);
   writeLocalServerRevision(notice.projectId,actualRevision);
   publishServerNewerResolved(notice.projectId,actualRevision);
   setMessage(`Loaded current server revision r${actualRevision}. This replaced only the browser review graph and created no verification state.`);
  }catch(error){setMessage(error instanceof Error?error.message:'Unable to load the server snapshot.');}
  finally{setBusy(false);setArmed(false);}
 }

 if(!notice)return null;
 const stored=notice.storedAt?new Date(notice.storedAt).toLocaleString():'unknown time';
 return <div className="notice" role="status" style={{marginTop:12,borderLeft:'3px solid var(--accent,#b98a2f)'}}>
  <strong>SPATIAL REVISION CONFLICT · SAVE BLOCKED</strong>
  <span>Server revision r{notice.revision} (stored {stored}) does not match this browser’s base {notice.localRevision===null?'(unknown)':`r${notice.localRevision}`}. Automatic saving is blocked so this session cannot silently supersede newer work.</span>
  <div className="button-row" style={{marginTop:8}}>
   <button type="button" className={armed?'action':'ghost'} onClick={()=>void load()} disabled={busy}>{armed?'Confirm load — replace working graph':`Load current server revision`}</button>
   <button type="button" onClick={()=>setNotice(null)} disabled={busy}>Dismiss warning</button>
  </div>
  {armed&&<p className="muted" style={{marginBottom:0}}>Loading replaces this browser working graph with the latest server revision. Keep/export local work first if it contains changes you need to reconcile.</p>}
  {message&&<p className="muted" style={{marginBottom:0}}>{message}</p>}
 </div>;
}
