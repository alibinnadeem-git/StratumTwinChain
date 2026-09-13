'use client';
import {useEffect,useRef,useState} from 'react';

type ActivityEvent={id:string;event_type:string;status:string;occurred_at:string;payload?:{notes?:string;reportedState?:string}};
export default function AssetActivityPanel({assetId,projectId}:{assetId:string;projectId:string}){
 const [notes,setNotes]=useState(''),[eventType,setEventType]=useState('INSPECT'),[reportedState,setReportedState]=useState('IN_SERVICE');
 const [events,setEvents]=useState<ActivityEvent[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const pending=useRef<{key:string;requestId:string;occurredAt:string}|null>(null);
 useEffect(()=>{let cancelled=false;setEvents([]);setNotes('');setMessage('');pending.current=null;
  fetch(`/api/lifecycle?assetId=${encodeURIComponent(assetId)}`,{cache:'no-store'}).then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error||'History unavailable');if(!cancelled)setEvents(body.events);}).catch(error=>{if(!cancelled)setMessage(`Server history unavailable: ${error.message}`);});
  return()=>{cancelled=true;};
 },[assetId]);
 async function submit(){
  if(busy||!notes.trim())return;setBusy(true);
  const key=JSON.stringify({assetId,projectId,eventType,notes:notes.trim(),reportedState});
  if(pending.current?.key!==key)pending.current={key,requestId:crypto.randomUUID(),occurredAt:new Date().toISOString()};
  const request=pending.current;
  try{
   const response=await fetch('/api/lifecycle',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({requestId:request.requestId,occurredAt:request.occurredAt,assetId,projectId,eventType,payload:{notes:notes.trim(),reportedState}})});
   const body=await response.json();if(!response.ok)throw new Error(body.error||'Activity submission failed');
   setEvents(old=>[{id:body.id,event_type:body.event_type,status:body.status,occurred_at:body.occurred_at,payload:{notes:notes.trim(),reportedState}},...old.filter(item=>item.id!==body.id)]);
   setNotes('');pending.current=null;setMessage('Saved on the server for review. The reported condition has not changed the approved asset state.');
  }catch(error){setMessage(`${error instanceof Error?error.message:'Submission failed'}. Your note is retained; retry uses the same request identifier.`);}
  finally{setBusy(false);}
 }
 return <section aria-label="Registered asset activity" style={{display:'grid',gap:10,marginTop:16}}>
  <h3>Asset activity</h3>
  <label>Activity type<select disabled={busy} value={eventType} onChange={e=>setEventType(e.target.value)}><option value="INSPECT">Inspection</option><option value="MAINTAIN">Maintenance completed</option><option value="REPAIR">Repair completed</option></select></label>
  <label>Reported condition<select disabled={busy} value={reportedState} onChange={e=>setReportedState(e.target.value)}><option>IN_SERVICE</option><option>INSPECTION_DUE</option><option>OUT_OF_SERVICE</option><option>MAINTENANCE</option></select></label>
  <label>Activity notes<textarea disabled={busy} value={notes} onChange={e=>setNotes(e.target.value)} rows={4} maxLength={10000}/></label>
  <button disabled={busy||!notes.trim()} onClick={submit}>{busy?'Submitting…':'Submit activity for review'}</button>
  <p role="status">{message}</p>
  <ul>{events.map(event=><li key={event.id}><strong>{event.event_type} · {event.status}</strong><p>{event.payload?.notes||'Details were not retained by the previous record format.'}</p><small>{event.payload?.reportedState} · {new Date(event.occurred_at).toLocaleString()}</small></li>)}</ul>
 </section>;
}
