'use client';

import {ChangeEvent,useEffect,useMemo,useRef,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {
 getEvidenceFile,
 listQueuedInspections,
 persistEvidenceBlob,
 queueInspection,
 removeEvidenceBlob,
 syncQueuedInspection,
 updateQueueError,
 type OfflineEvidenceMeta,
 type QueuedInspection,
} from '@/lib/field-offline-queue';

type ResolvedAsset={id:string;asset_code:string;asset_type:string;name:string;serial_number:string|null;location_label:string|null;status:string;project_id:string;project_code:string;project_name:string;site_name:string;system_name:string|null;administratively_archived?:boolean};
type Draft={locationConfirmed:boolean;checklist:boolean;measurements:string;notes:string;crewReference:string;reviewerReference:string;evidence:OfflineEvidenceMeta[];submitted:boolean;queued:boolean;requestId?:string;recordId?:string;canonicalHash?:string};

const empty:Draft={locationConfirmed:false,checklist:false,measurements:'',notes:'',crewReference:'',reviewerReference:'',evidence:[],submitted:false,queued:false};
const uuid=(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

export default function InspectionSession(){
 const q=useSearchParams().get('q')||'';const router=useRouter();
 const [asset,setAsset]=useState<ResolvedAsset|null>(null);const [source,setSource]=useState('');
 const [draft,setDraft]=useState<Draft>(empty);const [message,setMessage]=useState(q?'Resolving asset…':'No asset identifier supplied.');const [busy,setBusy]=useState(false);
 const [online,setOnline]=useState(true),[queuedCount,setQueuedCount]=useState(0);
 const filesRef=useRef<Map<string,File>>(new Map());
 const key=asset?`stratum-inspection:${asset.id}`:'';

 async function refreshQueue(){try{setQueuedCount((await listQueuedInspections()).length)}catch{setQueuedCount(0)}}

 useEffect(()=>{
  setOnline(navigator.onLine);void refreshQueue();
  const onOnline=()=>{setOnline(true);void syncAll()};const onOffline=()=>setOnline(false);
  window.addEventListener('online',onOnline);window.addEventListener('offline',onOffline);
  return()=>{window.removeEventListener('online',onOnline);window.removeEventListener('offline',onOffline)};
 },[]);

 useEffect(()=>{if(!q)return;(async()=>{try{const r=await fetch(`/api/assets/resolve?q=${encodeURIComponent(q)}`,{cache:'no-store',credentials:'same-origin'});const j=await r.json();if(!r.ok)throw new Error(j.error||'Asset lookup failed');setAsset(j.asset);setSource(j.source);setMessage(j.asset?.administratively_archived?'Asset is administratively archived. New inspection submission is blocked until restore.':'Asset identified. Complete the inspection steps below.');}catch(e){setMessage(e instanceof Error?e.message:'Asset lookup failed');}})()},[q]);

 useEffect(()=>{if(!key)return;try{const raw=localStorage.getItem(key);if(raw){const saved=JSON.parse(raw);setDraft({...empty,...saved,crewReference:saved.crewReference||saved.technician||'',reviewerReference:saved.reviewerReference||saved.supervisor||'',evidence:saved.evidence||saved.photos||[],submitted:Boolean(saved.submitted),queued:Boolean(saved.queued)});}}catch{}},[key]);
 useEffect(()=>{if(!key)return;localStorage.setItem(key,JSON.stringify(draft));},[key,draft]);

 const complete=useMemo(()=>!!asset&&!asset.administratively_archived&&draft.locationConfirmed&&draft.checklist&&!!draft.measurements.trim()&&draft.evidence.length>0,[asset,draft]);
 const submitDisabled=!complete||busy||draft.submitted||draft.queued;

 async function addEvidence(e:ChangeEvent<HTMLInputElement>){
  const files=Array.from(e.target.files||[]);if(!files.length||!asset)return;setBusy(true);
  try{
   const out:OfflineEvidenceMeta[]=[];
   for(const f of files){
    const d=await crypto.subtle.digest('SHA-256',await f.arrayBuffer());const sha256=Array.from(new Uint8Array(d)).map(b=>b.toString(16).padStart(2,'0')).join('');
    const meta={name:f.name,sha256,type:f.type||'application/octet-stream',size:f.size};
    await persistEvidenceBlob(asset.id,meta,f);filesRef.current.set(sha256,f);out.push(meta);
   }
   setDraft(v=>({...v,evidence:[...v.evidence.filter(x=>!out.some(o=>o.sha256===x.sha256)),...out]}));
   setMessage('Evidence fingerprinted and persisted locally for safe retry/offline sync. Local persistence is not server evidence, approval, or Verified state.');
  }catch(error){setMessage(error instanceof Error?error.message:'Evidence could not be persisted locally.');}
  finally{setBusy(false);e.target.value='';}
 }

 async function removeEvidence(sha256:string){
  if(asset)await removeEvidenceBlob(asset.id,sha256).catch(()=>{});filesRef.current.delete(sha256);setDraft(v=>({...v,evidence:v.evidence.filter(x=>x.sha256!==sha256)}));
 }

 function payload(){return{locationConfirmed:draft.locationConfirmed,checklistPassed:draft.checklist,measurements:draft.measurements,notes:draft.notes,crewReference:draft.crewReference||null,reviewerReference:draft.reviewerReference||null,evidence:draft.evidence,fieldSubmissionMode:online?'ONLINE':'QUEUED_OFFLINE',truthBoundary:'FIELD_DRAFT_OR_QUEUE_IS_NOT_VERIFIED_STATE'}}

 async function ensureEvidenceAvailable(){
  if(!asset)throw new Error('Asset is not resolved.');
  for(const meta of draft.evidence){if(filesRef.current.has(meta.sha256))continue;const file=await getEvidenceFile(asset.id,meta);if(!file)throw new Error(`Evidence file ${meta.name} is missing from offline storage. Reselect it before submission.`);filesRef.current.set(meta.sha256,file);}
 }

 async function submit(){
  if(!asset||!complete)return;setBusy(true);
  try{
   if(source==='live'&&uuid(asset.id)&&uuid(asset.project_id)){
    await ensureEvidenceAvailable();
    const requestId=draft.requestId||crypto.randomUUID();
    const item:QueuedInspection={requestId,assetId:asset.id,projectId:asset.project_id,payload:payload(),evidence:draft.evidence,createdAt:new Date().toISOString(),lastError:null};
    await queueInspection(item);setDraft(v=>({...v,queued:true,requestId}));await refreshQueue();
    if(!navigator.onLine){setOnline(false);setMessage('UNSYNCED: inspection is safely queued on this device. No lifecycle record, evidence record, DIR, approval, or Verified state has been created yet.');return;}
    setMessage('Synchronizing inspection and evidence…');
    try{
     const result=await syncQueuedInspection(item);setDraft(v=>({...v,queued:false,submitted:true,recordId:result.recordId,canonicalHash:result.canonicalHash,requestId}));await refreshQueue();
     setMessage(`Inspection and evidence synchronized. Lifecycle candidate ${result.canonicalHash?`${result.canonicalHash.slice(0,18)}…`:'recorded'}; approval/finality remain separate.`);
    }catch(error){
     const text=error instanceof Error?error.message:'Inspection synchronization failed';await updateQueueError(requestId,text).catch(()=>{});setMessage(`UNSYNCED: ${text}. The queue remains on this device for idempotent retry; nothing is presented as Verified.`);
    }
   }else{
    setMessage('Reference asset inspection completed locally only. No tenant lifecycle record, DIR or Verified state was created.');setDraft(v=>({...v,submitted:true}));
   }
  }catch(error){setMessage(error instanceof Error?error.message:'Inspection could not be queued.');}
  finally{setBusy(false)}
 }

 async function syncAll(){
  if(typeof navigator!=='undefined'&&!navigator.onLine){setOnline(false);setMessage('Device is offline. Queued inspections remain UNSYNCED.');return;}
  setBusy(true);let synced=0,failed=0;
  try{
   const items=await listQueuedInspections();
   for(const item of items){
    try{
     const result=await syncQueuedInspection(item);synced++;
     if(item.requestId===draft.requestId)setDraft(v=>({...v,queued:false,submitted:true,recordId:result.recordId,canonicalHash:result.canonicalHash}));
    }catch(error){failed++;await updateQueueError(item.requestId,error instanceof Error?error.message:'Sync failed').catch(()=>{});}
   }
   await refreshQueue();setMessage(failed?`${synced} queued inspection(s) synchronized; ${failed} remain UNSYNCED and require retry/attention.`:`${synced} queued inspection(s) synchronized. Approval and finality remain separate.`);
  }catch(error){setMessage(error instanceof Error?error.message:'Queued inspections could not be synchronized.');}
  finally{setBusy(false)}
 }

 if(!q)return <div className="card"><h2>No asset selected</h2><p className="muted">Scan an asset first.</p><button type="button" onClick={()=>router.push('/scan')}>Open field scanner</button></div>;
 return <div className="grid two" style={{alignItems:'start'}}>
  <div className="card"><div className="section-head"><div><div className="eyebrow">Field inspection session</div><h2>{asset?.name||'Resolving asset'}</h2></div><span className={online?'proof':'pending'}>{online?'ONLINE':'OFFLINE'}</span></div><p className="subtitle">{asset?`${asset.asset_code} · ${asset.site_name} · ${asset.location_label||'Location pending'}`:message}</p>{asset&&<div className="timeline">
   <label className="event"><input type="checkbox" checked={draft.locationConfirmed} onChange={e=>setDraft(v=>({...v,locationConfirmed:e.target.checked}))}/><div><strong>Confirm site & location</strong><small>{asset.site_name} · {asset.location_label||'Location pending'}</small></div></label>
   <label className="event"><input type="checkbox" checked={draft.checklist} onChange={e=>setDraft(v=>({...v,checklist:e.target.checked}))}/><div><strong>Inspection checklist passed</strong><small>Visual condition, labeling, clearances, mounting and workmanship reviewed.</small></div></label>
   <div className="event"><div style={{width:'100%'}}><strong>Measurements</strong><textarea value={draft.measurements} onChange={e=>setDraft(v=>({...v,measurements:e.target.value}))} placeholder="Voltage, current, torque, IR values, test results…" style={{width:'100%',minHeight:90,marginTop:8}}/></div></div>
   <div className="event"><div style={{width:'100%'}}><strong>Installation / inspection evidence</strong><input type="file" multiple accept="image/*,.pdf" onChange={addEvidence}/><small>{draft.evidence.length?`${draft.evidence.length} evidence file(s) fingerprinted and persisted locally`:'At least one evidence file is required.'}</small>{draft.evidence.map(x=><div key={x.sha256} style={{display:'flex',gap:8,justifyContent:'space-between',alignItems:'center',marginTop:7,fontSize:12}}><span style={{overflow:'hidden',textOverflow:'ellipsis'}}>{x.name}</span><button type="button" onClick={()=>void removeEvidence(x.sha256)}>Remove</button></div>)}</div></div>
   <div className="event"><div style={{width:'100%'}}><strong>Crew / technician reference (optional)</strong><input value={draft.crewReference} onChange={e=>setDraft(v=>({...v,crewReference:e.target.value}))} placeholder="Crew, badge or field reference" style={{width:'100%',marginTop:8}}/><small>The server records the authenticated performer. This free-text reference is not a signature or identity proof.</small></div></div>
   <div className="event"><div style={{width:'100%'}}><strong>Supervisor / inspector reference (optional)</strong><input value={draft.reviewerReference} onChange={e=>setDraft(v=>({...v,reviewerReference:e.target.value}))} placeholder="Supervisor / inspector field reference" style={{width:'100%',marginTop:8}}/><small>This is context only. Approval requires the separate authorized approval workflow.</small></div></div>
   <div className="event"><div style={{width:'100%'}}><strong>Notes</strong><textarea value={draft.notes} onChange={e=>setDraft(v=>({...v,notes:e.target.value}))} placeholder="Exceptions, observations, corrective actions…" style={{width:'100%',minHeight:70,marginTop:8}}/></div></div>
  </div>}</div>
  <div className="card"><div className="eyebrow">Workflow status</div><h2>{draft.submitted?'Synchronized to tenant':draft.queued?'UNSYNCED · queued on device':'Ready when required field steps pass'}</h2><div className="workflow-steps">{[['Asset identified',!!asset],['Location confirmed',draft.locationConfirmed],['Checklist complete',draft.checklist],['Measurements recorded',!!draft.measurements.trim()],['Evidence persisted locally',draft.evidence.length>0],['Lifecycle candidate ready',complete]].map(([t,ok],i)=><div className={`workflow-step ${ok?'done':''}`} key={String(t)}><i>{ok?'✓':i+1}</i><div><strong>{String(t)}</strong><span>{ok?'Complete':'Required'}</span></div></div>)}</div><button type="button" onClick={submit} disabled={submitDisabled} style={{width:'100%',marginTop:16,opacity:submitDisabled?0.55:1}}>{busy?'Working…':draft.submitted?'Synchronized':draft.queued?'Queued — sync required':online?'Submit inspection & create lifecycle candidate':'Queue inspection for sync'}</button>{queuedCount>0&&<button type="button" onClick={()=>void syncAll()} disabled={busy||!online} style={{width:'100%',marginTop:8,opacity:busy||!online?0.55:1}}>Sync queued inspections ({queuedCount})</button>}<div className="notice" style={{marginTop:12}}><strong>{draft.queued?'UNSYNCED':draft.submitted?'SYNCHRONIZED':'STATUS'}</strong><span>{message}</span></div><p className="muted">Queued/local field data is not submitted evidence, approval, a DIR, PoVI finality, or Verified state. Those states only arise through their separate governed server workflows.</p>{asset&&<div className="button-row" style={{marginTop:12}}><button type="button" onClick={()=>router.push(`/assets/${encodeURIComponent(asset.id)}`)}>Open passport</button>{draft.submitted&&<button type="button" onClick={()=>router.push(`/assets/${encodeURIComponent(asset.id)}/attestations`)}>Human attestations</button>}<button type="button" onClick={()=>router.push('/scan')}>Scan another</button></div>}</div>
 </div>;
}
