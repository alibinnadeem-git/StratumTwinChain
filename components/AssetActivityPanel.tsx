'use client';

import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';

type ActivityEvent={
 id:string;
 project_id:string;
 event_type:string;
 status:string;
 occurred_at:string;
 payload?:{notes?:string;reportedState?:string};
 payload_sha256?:string|null;
 performed_by?:string|null;
 evidence_count?:number;
 approved_count?:number;
 approvals_required?:number;
 require_evidence?:boolean;
 can_approve?:boolean;
 separation_of_duties_blocked?:boolean;
 current_user_decision?:'APPROVED'|'REJECTED'|null;
 ledger_network?:string|null;
 ledger_tx_hash?:string|null;
 ledger_block_height?:string|null;
 anchored_at?:string|null;
};

function bytesToBase64(value:ArrayBuffer){
 const bytes=new Uint8Array(value);
 let binary='';
 for(const byte of bytes)binary+=String.fromCharCode(byte);
 return btoa(binary);
}

async function signApproval(payloadHash:string){
 const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']) as CryptoKeyPair;
 const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,new TextEncoder().encode(payloadHash));
 const publicKeyJwk=await crypto.subtle.exportKey('jwk',pair.publicKey);
 return{signature:bytesToBase64(signature),publicKeyJwk};
}

function dirProgress(event:ActivityEvent){
 const evidenceCount=Number(event.evidence_count||0);
 const approvedCount=Number(event.approved_count||0);
 const approvalsRequired=Math.max(1,Number(event.approvals_required||1));
 const evidenceReady=!event.require_evidence||evidenceCount>0;
 const approvalReady=approvedCount>=approvalsRequired;
 const finalized=Boolean(event.ledger_block_height&&event.ledger_tx_hash);
 return{evidenceCount,approvedCount,approvalsRequired,evidenceReady,approvalReady,finalized};
}

function nextStep(event:ActivityEvent){
 const progress=dirProgress(event);
 if(event.status==='REJECTED')return 'Rejected — submit a corrected lifecycle event.';
 if(progress.finalized)return 'Complete — the immutable record reached PoVI finality.';
 if(!progress.evidenceReady)return 'Next: add field evidence.';
 if(!progress.approvalReady)return `Next: independent approval (${progress.approvedCount}/${progress.approvalsRequired}).`;
 return 'Next: PoVI finalization.';
}

export default function AssetActivityPanel({assetId,projectId}:{assetId:string;projectId:string}){
 const [notes,setNotes]=useState('');
 const [eventType,setEventType]=useState('INSPECT');
 const [reportedState,setReportedState]=useState('IN_SERVICE');
 const [events,setEvents]=useState<ActivityEvent[]>([]);
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const [approvalBusy,setApprovalBusy]=useState<string|null>(null);
 const pending=useRef<{key:string;requestId:string;occurredAt:string}|null>(null);

 async function loadHistory(){
  const response=await fetch(`/api/lifecycle?assetId=${encodeURIComponent(assetId)}`,{cache:'no-store'});
  const body=await response.json();
  if(!response.ok)throw new Error(body.error||'History unavailable');
  setEvents(body.events as ActivityEvent[]);
 }

 useEffect(()=>{
  let cancelled=false;
  setEvents([]);setNotes('');setMessage('');pending.current=null;
  fetch(`/api/lifecycle?assetId=${encodeURIComponent(assetId)}`,{cache:'no-store'})
   .then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error||'History unavailable');if(!cancelled)setEvents(body.events as ActivityEvent[]);})
   .catch(error=>{if(!cancelled)setMessage(`Server history unavailable: ${error.message}`);});
  return()=>{cancelled=true;};
 },[assetId]);

 async function submit(){
  if(busy||!notes.trim())return;
  setBusy(true);
  const key=JSON.stringify({assetId,projectId,eventType,notes:notes.trim(),reportedState});
  if(pending.current?.key!==key)pending.current={key,requestId:crypto.randomUUID(),occurredAt:new Date().toISOString()};
  const request=pending.current;
  try{
   const response=await fetch('/api/lifecycle',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({
     requestId:request.requestId,occurredAt:request.occurredAt,assetId,projectId,eventType,
     payload:{notes:notes.trim(),reportedState}
    })
   });
   const body=await response.json();
   if(!response.ok)throw new Error(body.error||'Activity submission failed');
   setNotes('');pending.current=null;
   await loadHistory();
   setMessage('Activity saved. It remains reviewable until evidence, approval and PoVI finality are complete.');
  }catch(error){
   setMessage(`${error instanceof Error?error.message:'Submission failed'}. Your note is retained; retry uses the same request identifier.`);
  }finally{setBusy(false);}
 }

 async function decide(event:ActivityEvent,decision:'APPROVED'|'REJECTED'){
  if(!event.payload_sha256||approvalBusy)return;
  setApprovalBusy(event.id);
  setMessage('');
  try{
   const {signature,publicKeyJwk}=await signApproval(event.payload_sha256);
   const response=await fetch('/api/approvals',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({lifecycleEventId:event.id,decision,signature,publicKeyJwk})
   });
   const body=await response.json();
   if(!response.ok)throw new Error(body.error||'Approval failed');
   await loadHistory();
   if(body.status==='APPROVAL_PENDING'){
    setMessage(`Approval recorded (${body.approvedCount}/${body.approvalsRequired}). DIR finality remains pending.`);
   }else if(body.status==='VERIFIED'){
    setMessage(`Approval threshold met and PoVI finalized DIR #${body.receipt?.blockHeight??'—'}.`);
   }else{
    setMessage(`Lifecycle event ${String(body.status||decision).toLowerCase()}.`);
   }
  }catch(error){
   setMessage(error instanceof Error?error.message:'Approval failed');
  }finally{setApprovalBusy(null);}
 }

 return <section aria-label="Registered asset activity" className="asset-activity">
  <div className="section-head">
   <div><div className="eyebrow">Lifecycle & DIR</div><h3 style={{margin:'2px 0'}}>Activity history</h3></div>
   <span className="muted">{events.length} record{events.length===1?'':'s'}</span>
  </div>

  <div className="dir-flow dir-flow-legend" aria-label="DIR lifecycle">
   <span className="dir-node done">1<span>Activity</span></span>
   <span className="dir-connector"/>
   <span className="dir-node">2<span>Evidence</span></span>
   <span className="dir-connector"/>
   <span className="dir-node">3<span>Approval</span></span>
   <span className="dir-connector"/>
   <span className="dir-node">4<span>PoVI DIR</span></span>
  </div>

  <details className="secondary-details">
   <summary>Record new activity</summary>
   <div style={{display:'grid',gap:10,marginTop:10}}>
    <label>Activity type<select disabled={busy} value={eventType} onChange={e=>setEventType(e.target.value)}><option value="INSPECT">Inspection</option><option value="MAINTAIN">Maintenance completed</option><option value="REPAIR">Repair completed</option></select></label>
    <label>Reported condition<select disabled={busy} value={reportedState} onChange={e=>setReportedState(e.target.value)}><option>IN_SERVICE</option><option>INSPECTION_DUE</option><option>OUT_OF_SERVICE</option><option>MAINTENANCE</option></select></label>
    <label>Activity notes<textarea disabled={busy} value={notes} onChange={e=>setNotes(e.target.value)} rows={3} maxLength={10000}/></label>
    <button disabled={busy||!notes.trim()} onClick={submit}>{busy?'Submitting…':'Submit for review'}</button>
    <p className="muted" style={{margin:0}}>A lifecycle note records what was reported. It does not become physical verification or a finalized DIR by itself.</p>
   </div>
  </details>

  <div className="button-row"><Link className="ghost" href={`/inspection?q=${encodeURIComponent(assetId)}`}>Add inspection evidence</Link><Link className="ghost" href="/dir">Open DIR Explorer</Link></div>
  {message&&<p role="status" className="notice" style={{margin:0}}>{message}</p>}

  <div className="activity-list">
   {events.map(event=>{
    const progress=dirProgress(event);
    const rejected=event.status==='REJECTED';
    return <article className="card activity-card" key={event.id}>
     <div className="section-head">
      <div><strong>{event.event_type}</strong><div className="muted">{new Date(event.occurred_at).toLocaleString()}</div></div>
      <span className={progress.finalized?'proof':rejected?'pending':'status-chip'}>{progress.finalized?`DIR #${event.ledger_block_height}`:event.status}</span>
     </div>

     <p className="activity-note">{event.payload?.notes||'No activity note recorded.'}</p>
     <div className="muted">{event.payload?.reportedState||'Condition not reported'}</div>

     <div className="dir-flow" aria-label={`DIR progress for ${event.event_type}`}>
      <span className="dir-node done">1<span>Activity</span></span>
      <span className={`dir-connector ${progress.evidenceReady?'done':''}`}/>
      <span className={`dir-node ${progress.evidenceReady?'done':event.require_evidence?'current':''}`}>2<span>{event.require_evidence?`Evidence ${progress.evidenceCount}`:'Evidence N/A'}</span></span>
      <span className={`dir-connector ${progress.approvalReady?'done':''}`}/>
      <span className={`dir-node ${progress.approvalReady?'done':progress.evidenceReady&&!rejected?'current':''}`}>3<span>{`Approval ${progress.approvedCount}/${progress.approvalsRequired}`}</span></span>
      <span className={`dir-connector ${progress.finalized?'done':''}`}/>
      <span className={`dir-node ${progress.finalized?'done':progress.approvalReady&&!rejected?'current':''}`}>4<span>{progress.finalized?'Finalized':'PoVI DIR'}</span></span>
     </div>

     <div className={`dir-next ${progress.finalized?'complete':rejected?'blocked':''}`}>{nextStep(event)}</div>

     {event.can_approve&&<div style={{marginTop:10}}>
      {!progress.evidenceReady?<div className="notice"><strong>EVIDENCE REQUIRED</strong><span>Add field evidence before this event can advance to approval and DIR finality.</span></div>:<div className="button-row">
       <button className="action" disabled={Boolean(approvalBusy)} onClick={()=>void decide(event,'APPROVED')}>{approvalBusy===event.id?'Signing…':'Approve & advance DIR'}</button>
       <button className="ghost" disabled={Boolean(approvalBusy)} onClick={()=>void decide(event,'REJECTED')}>Reject</button>
      </div>}
     </div>}

     {event.separation_of_duties_blocked&&event.status==='SUBMITTED'&&<p className="muted" style={{marginBottom:0}}>Independent approval required: the person who submitted this activity cannot approve the same lifecycle event.</p>}
     {event.current_user_decision&&<p className="muted" style={{marginBottom:0}}>Your decision: {event.current_user_decision}.</p>}
     {progress.finalized&&<details className="proof-details"><summary>DIR proof details</summary><div className="verify-grid"><span>Network</span><b>{event.ledger_network||'STRATUM Chain'}</b><span>Block</span><b>{event.ledger_block_height}</b><span>Transaction</span><b className="mono">{event.ledger_tx_hash}</b><span>Anchored</span><b>{event.anchored_at?new Date(event.anchored_at).toLocaleString():'—'}</b></div></details>}
    </article>;
   })}
   {!events.length&&<div className="empty"><strong>No lifecycle activity yet</strong><p className="muted">Record work only when something actually happened to this asset. Evidence and approval can then advance that record toward DIR finality.</p></div>}
  </div>
 </section>;
}
