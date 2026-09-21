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

 return <div className="inspection-simple">
  <section className="card">
   <div className="section-head"><div><div className="eyebrow">Inspection</div><h2>{asset?.name||'Resolving asset'}</h2><p className="subtitle">{asset?`${asset.asset_code} · ${asset.site_name} · ${asset.location_label||'Location pending'}`:message}</p></div><span className={online?'proof':'pending'}>{online?'ONLINE':'OFFLINE'}</span></div>

   {asset&&<div className="inspection-required">
    <label className={`inspection-step ${draft.locationConfirmed?'done':''}`}>
     <span>1</span><input type="checkbox" checked={draft.locationConfirmed} onChange={e=>setDraft(v=>({...v,locationConfirmed:e.target.checked}))}/>
     <div><strong>Confirm location</strong><small>{asset.site_name} · {asset.location_label||'Location pending'}</small></div>
    </label>
    <label className={`inspection-step ${draft.checklist?'done':''}`}>
     <span>2</span><input type="checkbox" checked={draft.checklist} onChange={e=>setDraft(v=>({...v,checklist:e.target.checked}))}/>
     <div><strong>Checklist passed</strong><small>Condition, labeling, clearances, mounting and workmanship reviewed.</small></div>
    </label>
    <label className={`inspection-step block ${draft.measurements.trim()?'done':''}`}>
     <span>3</span><div><strong>Measurements</strong><textarea value={draft.measurements} onChange={e=>setDraft(v=>({...v,measurements:e.target.value}))} placeholder="Voltage, current, torque, IR values, test results…"/></div>
    </label>
    <div className={`inspection-step block ${draft.evidence.length?'done':''}`}>
     <span>4</span><div><strong>Evidence</strong><input aria-label="Inspection evidence" type="file" multiple accept="image/*,.pdf" onChange={addEvidence}/><small>{draft.evidence.length?`${draft.evidence.length} evidence file(s) protected for sync`:'Add at least one photo or PDF.'}</small>{draft.evidence.map(x=><div className="inspection-file" key={x.sha256}><span>{x.name}</span><button type="button" onClick={()=>void removeEvidence(x.sha256)}>Remove</button></div>)}</div>
    </div>
   </div>}

   {asset&&<details className="secondary-details">
    <summary>Optional notes & references</summary>
    <div className="inspection-optional">
     <label>Crew / technician reference<input value={draft.crewReference} onChange={e=>setDraft(v=>({...v,crewReference:e.target.value}))} placeholder="Crew, badge or field reference"/></label>
     <label>Supervisor / inspector reference<input value={draft.reviewerReference} onChange={e=>setDraft(v=>({...v,reviewerReference:e.target.value}))} placeholder="Supervisor / inspector field reference"/></label>
     <label>Notes<textarea value={draft.notes} onChange={e=>setDraft(v=>({...v,notes:e.target.value}))} placeholder="Exceptions, observations, corrective actions…"/></label>
    </div>
   </details>}

   <button className="action inspection-submit" type="button" onClick={submit} disabled={submitDisabled}>{busy?'Working…':draft.submitted?'Synchronized':draft.queued?'Queued — sync required':online?'Submit inspection':'Queue for sync'}</button>
   <div className="notice" role="status"><strong>{draft.queued?'UNSYNCED':draft.submitted?'SYNCHRONIZED':'STATUS'}</strong><span>{message}</span></div>

   <details className="secondary-details">
    <summary>Progress & sync details</summary>
    <div className="workflow-steps">{[['Asset identified',!!asset],['Location confirmed',draft.locationConfirmed],['Checklist complete',draft.checklist],['Measurements recorded',!!draft.measurements.trim()],['Evidence protected',draft.evidence.length>0],['Ready to submit',complete]].map(([t,ok],i)=><div className={`workflow-step ${ok?'done':''}`} key={String(t)}><i>{ok?'✓':i+1}</i><div><strong>{String(t)}</strong><span>{ok?'Complete':'Required'}</span></div></div>)}</div>
    {queuedCount>0&&<button type="button" onClick={()=>void syncAll()} disabled={busy||!online} style={{width:'100%',marginTop:10}}>Sync queued inspections ({queuedCount})</button>}
    <p className="muted">Local or queued field data is not approval, a DIR, PoVI finality, or Verified state. Those states remain separate governed steps.</p>
   </details>

   {asset&&<div className="button-row inspection-footer"><button className="ghost" type="button" onClick={()=>router.push(`/assets/${encodeURIComponent(asset.id)}`)}>Passport</button>{draft.submitted&&<button className="ghost" type="button" onClick={()=>router.push(`/assets/${encodeURIComponent(asset.id)}/attestations`)}>Attestations</button>}<button className="ghost" type="button" onClick={()=>router.push('/scan')}>Scan another</button></div>}
  </section>
 </div>;
}
