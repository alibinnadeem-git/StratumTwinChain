'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import type {CoordinationSnapshot} from '@/lib/coordination-intelligence';
import {readPrimarySpatialGraph} from '@/lib/spatial-browser-recovery';

type Graph={coordinationIntelligence?:CoordinationSnapshot};
type ServerFinding={
 id:string;source_finding_id:string;finding_type:string;title:string;detail:string;confidence:number;human_control_level:'H2'|'H3';
 disposition_action:string|null;disposition_reason:string|null;disposition_occurred_at:string|null;
};
type ActionRequest={id:string;finding_id:string;action_type:string;title:string;status:string;created_at:string};
type ServerState={schemaReady:boolean;latest:{id:string;spatial_revision:number;finding_count:number}|null;findings:ServerFinding[];actionRequests:ActionRequest[]};

const PROJECT_KEY='stratum_spatial_project_id';

export default function CoordinationFindingsPanel(){
 const [snapshot,setSnapshot]=useState<CoordinationSnapshot|null>(null);
 const [server,setServer]=useState<ServerState|null>(null);
 const [message,setMessage]=useState('');
 const [selectedFinding,setSelectedFinding]=useState('');
 const [reason,setReason]=useState('');
 const [actionType,setActionType]=useState('RFI');
 const [actionTitle,setActionTitle]=useState('');
 const [busy,setBusy]=useState(false);

 const refreshServer=useCallback(async()=>{
  const projectId=localStorage.getItem(PROJECT_KEY)||'';
  if(!projectId){setServer(null);setMessage('Select a server project in Server sync & review baseline to persist coordination findings.');return}
  try{
   const response=await fetch('/api/coordination/findings?projectId='+encodeURIComponent(projectId),{cache:'no-store'});
   const body=await response.json().catch(()=>({}));
   if(response.status===401){setServer(null);setMessage('Sign in to load tenant-scoped persisted coordination findings.');return}
   if(!response.ok)throw new Error(body?.error||'Unable to load coordination findings');
   setServer(body as ServerState);
   const findings=(body.findings||[]) as ServerFinding[];
   setSelectedFinding(current=>findings.some(item=>item.id===current)?current:(findings[0]?.id||''));
   setActionTitle(current=>current||findings[0]?.title||'');
   setMessage(body.latest?'Persisted with Spatial revision r'+body.latest.spatial_revision+'.':'No persisted coordination snapshot exists for this project yet.');
  }catch(error){setServer(null);setMessage(error instanceof Error?error.message:'Unable to load coordination findings.')}
 },[]);

 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{const graph=await readPrimarySpatialGraph() as Graph|null;if(active)setSnapshot(graph?.coordinationIntelligence||null)}
   catch{if(active)setSnapshot(null)}
  };
  const graphRefresh=()=>{void load()};
  const refresh=()=>{void load();void refreshServer()};
  void load();void refreshServer();
  window.addEventListener('stratum:graph-updated',graphRefresh);
  window.addEventListener('storage',refresh);
  window.addEventListener('stratum:coordination-snapshot-saved',refreshServer);
  return()=>{active=false;window.removeEventListener('stratum:graph-updated',graphRefresh);window.removeEventListener('storage',refresh);window.removeEventListener('stratum:coordination-snapshot-saved',refreshServer)};
 },[refreshServer]);

 const localFindings=useMemo(()=>snapshot?.findings||[],[snapshot]);
 const serverBySource=useMemo(()=>new Map((server?.findings||[]).map(item=>[item.source_finding_id,item])),[server]);
 const actionsByFinding=useMemo(()=>{
  const map=new Map<string,ActionRequest[]>();for(const item of server?.actionRequests||[]){const list=map.get(item.finding_id)||[];list.push(item);map.set(item.finding_id,list)}return map;
 },[server]);

 async function disposition(action:'ACKNOWLEDGE'|'DISMISS'|'REOPEN'|'ENGINEERING_REVIEW_REQUIRED'){
  if(!selectedFinding||busy)return;const cleaned=reason.trim();
  if(cleaned.length<5){setMessage('Enter a review reason of at least 5 characters.');return}
  setBusy(true);
  try{
   const response=await fetch('/api/coordination/findings',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({findingId:selectedFinding,action,reason:cleaned})});
   const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body?.error||'Unable to update coordination review');
   setReason('');await refreshServer();setMessage('Coordination disposition appended. Original source finding was not modified.');
  }catch(error){setMessage(error instanceof Error?error.message:'Unable to update coordination review.')}
  finally{setBusy(false)}
 }

 async function requestAction(){
  if(!selectedFinding||busy)return;const title=actionTitle.trim();
  if(title.length<3){setMessage('Enter an action title of at least 3 characters.');return}
  setBusy(true);
  try{
   const response=await fetch('/api/coordination/findings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({findingId:selectedFinding,actionType,title,context:{requestedFrom:'Spatial coordination review'}})});
   const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body?.error||'Unable to request downstream action');
   await refreshServer();setMessage(actionType+' request appended. It is a request, not an approved downstream record.');
  }catch(error){setMessage(error instanceof Error?error.message:'Unable to request downstream action.')}
  finally{setBusy(false)}
 }

 if(!snapshot||localFindings.length===0)return null;
 return <section className="card" aria-label="Coordination findings" style={{marginBottom:16}}>
  <div className="section-head">
   <div><div className="eyebrow">Cross-document coordination</div><h2 style={{margin:'3px 0'}}>Coordination findings</h2><p className="subtitle" style={{margin:0}}>STRATUM preserves explicit source conflicts instead of silently selecting a drawing, schedule, model, rating or revision.</p></div>
   <span className="pending">{localFindings.length+' REVIEW'}</span>
  </div>
  <div className="asset-summary-strip" style={{marginTop:12}}>
   <div><span>Total</span><strong>{snapshot.summary.findings}</strong></div>
   <div><span>Engineering review</span><strong>{snapshot.summary.high}</strong></div>
   <div><span>Coordination review</span><strong>{snapshot.summary.review}</strong></div>
  </div>
  <div className="spatial-review-list" style={{marginTop:12}}>{localFindings.slice(0,10).map(item=>{
   const persisted=serverBySource.get(item.id);
   return <div className="spatial-review-row" key={item.id}><div><strong>{item.title}</strong><small>{item.detail}</small><small>{persisted?'SERVER · '+(persisted.disposition_action||'OPEN'):'LOCAL · save Spatial review snapshot to persist'}</small></div><span>{item.findingType.replaceAll('_',' ')}</span></div>
  })}</div>

  <details className="secondary-details" style={{marginTop:10}}><summary>Review & downstream actions</summary>
   <p className="muted">{message||'Server review state is loading.'}</p>
   {server?.latest&&server.findings.length>0&&<div style={{display:'grid',gap:10}}>
    <label><span>Persisted finding</span><select aria-label="Persisted coordination finding" value={selectedFinding} onChange={event=>{const value=event.target.value;setSelectedFinding(value);const item=server.findings.find(row=>row.id===value);setActionTitle(item?.title||'')}}>{server.findings.map(item=><option key={item.id} value={item.id}>{item.human_control_level} · {item.finding_type.replaceAll('_',' ')} · {item.title}</option>)}</select></label>
    <label><span>Review reason</span><textarea aria-label="Coordination review reason" rows={3} minLength={5} maxLength={1000} value={reason} onChange={event=>setReason(event.target.value)} placeholder="Record why this finding is acknowledged, dismissed, reopened, or requires engineering review."/></label>
    <div className="button-row">
     <button type="button" className="ghost" disabled={busy} onClick={()=>disposition('ACKNOWLEDGE')}>Acknowledge</button>
     <button type="button" className="action" disabled={busy} onClick={()=>disposition('ENGINEERING_REVIEW_REQUIRED')}>Require engineering review</button>
     <button type="button" className="ghost" disabled={busy} onClick={()=>disposition('DISMISS')}>Dismiss with reason</button>
     <button type="button" className="ghost" disabled={busy} onClick={()=>disposition('REOPEN')}>Reopen</button>
    </div>
    <div className="card" style={{padding:12}}>
     <div className="eyebrow">Downstream request</div>
     <div className="grid two">
      <label>Action<select aria-label="Coordination downstream action" value={actionType} onChange={event=>setActionType(event.target.value)}><option>RFI</option><option>NCR</option><option>WORK_ORDER</option><option>CHANGE</option><option>ENGINEERING_REVIEW</option></select></label>
      <label>Title<input aria-label="Coordination action title" value={actionTitle} onChange={event=>setActionTitle(event.target.value)} maxLength={500}/></label>
     </div>
     <button className="action" type="button" disabled={busy} onClick={requestAction}>Request downstream action</button>
     {(actionsByFinding.get(selectedFinding)||[]).length>0&&<small style={{display:'block',marginTop:8}}>{(actionsByFinding.get(selectedFinding)||[]).map(item=>item.action_type+' · '+item.status).join(' · ')}</small>}
    </div>
   </div>}
  </details>
  <small className="spatial-review-boundary">Coordination findings are not geometric clash proof, code compliance, AHJ approval, or engineering approval. Downstream action requests are requests, not approved records.</small>
 </section>;
}
