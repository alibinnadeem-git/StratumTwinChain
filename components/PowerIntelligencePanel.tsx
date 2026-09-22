'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import type {PowerIntelligenceSnapshot} from '@/lib/power-intelligence';

type Graph={powerIntelligence?:PowerIntelligenceSnapshot};
type ServerFinding={
 id:string;source_finding_id:string;finding_type:string;title:string;detail:string;
 disposition_action:string|null;disposition_reason:string|null;disposition_occurred_at:string|null;
};
type ServerState={schemaReady:boolean;latest:{id:string;spatial_revision:number;finding_count:number;requirement_count:number}|null;findings:ServerFinding[]};
const STORAGE_KEY='stratum_compiled_graph';
const PROJECT_KEY='stratum_spatial_project_id';

export default function PowerIntelligencePanel(){
 const [snapshot,setSnapshot]=useState<PowerIntelligenceSnapshot|null>(null);
 const [server,setServer]=useState<ServerState|null>(null);
 const [serverMessage,setServerMessage]=useState('');
 const [selectedFinding,setSelectedFinding]=useState('');
 const [reason,setReason]=useState('');
 const [busy,setBusy]=useState(false);

 const refreshServer=useCallback(async()=>{
  const projectId=localStorage.getItem(PROJECT_KEY)||'';
  if(!projectId){setServer(null);setServerMessage('Select a server project in Server sync & review baseline to persist findings.');return}
  try{
   const response=await fetch('/api/power/findings?projectId='+encodeURIComponent(projectId),{cache:'no-store'});
   const body=await response.json().catch(()=>({}));
   if(response.status===401){setServer(null);setServerMessage('Sign in to load tenant-scoped persisted power findings.');return}
   if(!response.ok)throw new Error(body?.error||'Unable to load persisted power findings');
   setServer(body as ServerState);
   const findings=(body.findings||[]) as ServerFinding[];
   setSelectedFinding(current=>findings.some(item=>item.id===current)?current:(findings[0]?.id||''));
   setServerMessage(body.latest?'Persisted with Spatial revision r'+body.latest.spatial_revision+'.':'No persisted Expected Power snapshot exists for this project yet.');
  }catch(error){setServer(null);setServerMessage(error instanceof Error?error.message:'Unable to load persisted power findings.')}
 },[]);

 useEffect(()=>{
  const load=()=>{
   try{const graph=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null') as Graph|null;setSnapshot(graph?.powerIntelligence||null)}
   catch{setSnapshot(null)}
  };
  load();void refreshServer();
  const refresh=()=>{load();void refreshServer()};
  window.addEventListener('stratum:graph-updated',load);window.addEventListener('storage',refresh);window.addEventListener('stratum:power-snapshot-saved',refreshServer);
  return()=>{window.removeEventListener('stratum:graph-updated',load);window.removeEventListener('storage',refresh);window.removeEventListener('stratum:power-snapshot-saved',refreshServer)};
 },[refreshServer]);

 const findings=useMemo(()=>snapshot?.findings||[],[snapshot]);
 const serverBySource=useMemo(()=>new Map((server?.findings||[]).map(item=>[item.source_finding_id,item])),[server]);

 async function disposition(action:'ACKNOWLEDGE'|'DISMISS'|'REOPEN'|'ENGINEERING_REVIEW_REQUIRED'){
  if(!selectedFinding||busy)return;
  const cleaned=reason.trim();if(cleaned.length<5){setServerMessage('Enter a review reason of at least 5 characters.');return}
  setBusy(true);
  try{
   const response=await fetch('/api/power/findings',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({findingId:selectedFinding,action,reason:cleaned})});
   const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body?.error||'Unable to update finding review');
   setReason('');await refreshServer();setServerMessage('Review disposition appended. Original source finding was not modified.');
  }catch(error){setServerMessage(error instanceof Error?error.message:'Unable to update finding review.')}
  finally{setBusy(false)}
 }

 if(!snapshot||snapshot.requirements.length===0)return null;
 return <section className="card" aria-label="Expected power review" style={{marginBottom:16}}>
  <div className="section-head">
   <div><div className="eyebrow">Cross-discipline power intelligence</div><h2 style={{margin:'3px 0'}}>Expected power review</h2><p className="subtitle" style={{margin:0}}>Powered equipment discovered outside the electrical graph is reconciled against available electrical objects. Findings are advisory until qualified engineering review.</p></div>
   <span className={findings.length?'pending':'verified'}>{findings.length?findings.length+' REVIEW':'NO POWER FLAGS'}</span>
  </div>
  <div className="asset-summary-strip" style={{marginTop:12}}>
   <div><span>Expected loads</span><strong>{snapshot.summary.expected}</strong></div>
   <div><span>Matched</span><strong>{snapshot.summary.matched}</strong></div>
   <div><span>Missing</span><strong>{snapshot.summary.missing}</strong></div>
   <div><span>Conflicted</span><strong>{snapshot.summary.conflicted}</strong></div>
  </div>
  {findings.length>0&&<div className="spatial-review-list" style={{marginTop:12}}>{findings.slice(0,12).map(item=>{const persisted=serverBySource.get(item.id);return <div className="spatial-review-row" key={item.id}><div><strong>{item.title}</strong><small>{item.detail}</small><small>{persisted?'SERVER · '+(persisted.disposition_action||'OPEN'):'LOCAL · save Spatial review snapshot to persist'}</small></div><span>{item.findingType.replaceAll('_',' ')}</span></div>})}</div>}
  <details className="secondary-details" style={{marginTop:10}}><summary>Expected load evidence</summary><div className="activity-list" style={{marginTop:10}}>{snapshot.requirements.slice(0,20).map(item=><div className="card" key={item.id}><strong>{item.tag||item.equipmentClass.replaceAll('_',' ')}</strong><div className="muted">{item.sourceDiscipline} · {item.status} · {Math.round(item.confidence*100)}% confidence</div><small>{item.inputKw!==null?item.inputKw+' kW input':item.inputKva!==null?item.inputKva+' kVA input':item.connectedLoadEstimateKva!==null?item.connectedLoadEstimateKva+' kVA derived reference':'Electrical rating unresolved'} · {item.authorityClass.replaceAll('_',' ')}</small>{item.assumptions.length>0&&<p className="muted" style={{marginBottom:0}}>{item.assumptions.join(' ')}</p>}</div>)}</div></details>
  <details className="secondary-details" style={{marginTop:10}}><summary>Server finding review</summary>
   <p className="muted">{serverMessage||'Server review state is loading.'}</p>
   {server?.latest&&server.findings.length>0&&<div style={{display:'grid',gap:10}}>
    <label><span>Persisted finding</span><select aria-label="Persisted power finding" value={selectedFinding} onChange={event=>setSelectedFinding(event.target.value)}>{server.findings.map(item=><option key={item.id} value={item.id}>{item.finding_type.replaceAll('_',' ')} · {item.title}</option>)}</select></label>
    <textarea aria-label="Power finding review reason" rows={3} minLength={5} maxLength={1000} value={reason} onChange={event=>setReason(event.target.value)} placeholder="Record the engineering/coordination reason for this disposition."/>
    <div className="button-row">
     <button type="button" className="ghost" disabled={busy} onClick={()=>disposition('ACKNOWLEDGE')}>Acknowledge</button>
     <button type="button" className="action" disabled={busy} onClick={()=>disposition('ENGINEERING_REVIEW_REQUIRED')}>Require engineering review</button>
     <button type="button" className="ghost" disabled={busy} onClick={()=>disposition('DISMISS')}>Dismiss with reason</button>
     <button type="button" className="ghost" disabled={busy} onClick={()=>disposition('REOPEN')}>Reopen</button>
    </div>
   </div>}
  </details>
  <small className="spatial-review-boundary">Expected power is not a final load calculation, code-compliance determination, AHJ approval, or engineering approval.</small>
 </section>;
}
