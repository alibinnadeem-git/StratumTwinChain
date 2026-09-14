'use client';

import {useEffect,useMemo,useState} from 'react';

type EventOption={id:string;eventType:string;status:string;occurredAt:string|null};
type Attestation={
 id:string;lifecycle_event_id:string;attestation_type:string;attestor_capacity:string;statement:string;statement_sha256:string;observed_at:string;actor_user_id:string;authentication_assurance:string;cryptographically_signed:boolean;capacity_credential_ref:string|null;created_at:string;actor_name:string|null;lifecycle_event_type:string;lifecycle_event_status:string;
};
type LoadResponse={schemaReady:boolean;capacity:string|null;allowedAttestationTypes:string[];attestations:Attestation[];truthBoundary:string;error?:string};

const label=(value:string)=>value.replaceAll('_',' ').toLowerCase().replace(/\b\w/g,char=>char.toUpperCase());
const short=(value:string)=>value.length>28?`${value.slice(0,14)}…${value.slice(-10)}`:value;

export default function HumanAttestationPanel({assetId,events}:{assetId:string;events:EventOption[]}){
 const [data,setData]=useState<LoadResponse|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [eventId,setEventId]=useState(events[0]?.id||''),[type,setType]=useState(''),[statement,setStatement]=useState('');
 const selected=useMemo(()=>events.find(event=>event.id===eventId)||null,[events,eventId]);

 async function load(){
  try{
   const response=await fetch(`/api/attestations?assetId=${encodeURIComponent(assetId)}`,{cache:'no-store',credentials:'same-origin'});
   const body=await response.json();
   if(!response.ok)throw new Error(body.error||'Attestations could not be loaded');
   setData(body);
   setType(current=>current&&body.allowedAttestationTypes?.includes(current)?current:(body.allowedAttestationTypes?.[0]||''));
  }catch(error){setMessage(error instanceof Error?error.message:'Attestations could not be loaded');}
 }
 useEffect(()=>{void load()},[assetId]);

 async function submit(){
  if(!eventId||!type||statement.trim().length<5)return;
  setBusy(true);setMessage('Recording append-only human attestation…');
  try{
   const response=await fetch('/api/attestations',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({lifecycleEventId:eventId,attestationType:type,statement:statement.trim()})});
   const body=await response.json();
   if(!response.ok)throw new Error(body.error||'Attestation could not be recorded');
   setStatement('');setMessage(body.idempotent?'This identical attestation was already recorded.':'Human attestation recorded as evidence provenance. It did not approve or finalize the lifecycle event.');
   await load();
  }catch(error){setMessage(error instanceof Error?error.message:'Attestation could not be recorded');}
  finally{setBusy(false);}
 }

 const canWrite=Boolean(data?.schemaReady&&data.capacity&&data.allowedAttestationTypes.length&&events.length);
 return <section className="card" style={{marginTop:16}} aria-label="Human attestations">
  <div className="section-head"><div><div className="eyebrow">Human attestations</div><h2>Role-typed evidence statements</h2></div><span className={data?.schemaReady?'proof':'pending'}>{data?.schemaReady?'APPEND-ONLY':'SCHEMA PENDING'}</span></div>
  <p className="muted">An attestation records who asserted what against a lifecycle event. Session authentication establishes account provenance only; it is not a cryptographic personal signature, professional credential, lifecycle approval, PoVI vote, DIR finality, or physical truth.</p>
  {data?.capacity&&<div className="notice"><strong>YOUR ATTESTOR CAPACITY</strong><span>{label(data.capacity)} · derived from the signed-in membership role, not self-selected.</span></div>}
  {!data?.schemaReady&&<p className="muted">The human-attestation migration is not active in this environment yet. Existing asset and lifecycle state is unchanged.</p>}
  {data?.schemaReady&&events.length===0&&<p className="muted">Create a lifecycle event before recording an attestation.</p>}
  {data?.schemaReady&&!data.capacity&&<p className="muted">Your current membership role is read-only for human attestations.</p>}
  {canWrite&&<div style={{display:'grid',gap:10,marginTop:12}}>
   <label>Lifecycle event<select value={eventId} onChange={event=>setEventId(event.target.value)}>{events.map(event=><option key={event.id} value={event.id}>{event.eventType} · {event.status}{event.occurredAt?` · ${new Date(event.occurredAt).toLocaleDateString()}`:''}</option>)}</select></label>
   <label>Attestation type<select value={type} onChange={event=>setType(event.target.value)}>{data!.allowedAttestationTypes.map(item=><option key={item} value={item}>{label(item)}</option>)}</select></label>
   <label>Statement<textarea value={statement} onChange={event=>setStatement(event.target.value)} maxLength={2000} placeholder={selected?`Describe your ${label(type||'attestation')} for ${selected.eventType}.`:'Describe the evidence statement.'} style={{width:'100%',minHeight:100}}/></label>
   <button type="button" disabled={busy||statement.trim().length<5} onClick={submit}>{busy?'Recording…':'Record human attestation'}</button>
  </div>}
  {message&&<p role="status" className="muted">{message}</p>}
  <div className="vertical-timeline" style={{marginTop:14}}>{data?.attestations?.map(item=><div className="life-event" key={item.id}><i>✦</i><div><strong>{label(item.attestation_type)} · {label(item.attestor_capacity)}</strong><span>{item.actor_name||'Authenticated user'} · {new Date(item.observed_at).toLocaleString()} · lifecycle {item.lifecycle_event_type} ({item.lifecycle_event_status})</span><small>{item.statement}</small><small className="mono">Statement SHA-256 {short(item.statement_sha256)} · {item.cryptographically_signed?'cryptographic signature present':`${item.authentication_assurance} authentication provenance`}</small></div><b>ATTESTED</b></div>)}{data?.schemaReady&&!data.attestations.length&&<p className="muted">No human attestations recorded for this asset yet.</p>}</div>
 </section>;
}
