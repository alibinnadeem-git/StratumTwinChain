'use client';

import {useEffect,useMemo,useState} from 'react';
import {OEM_CAD_CANDIDATES} from '@/lib/oem-cad-candidates';
import styles from './OemCadVerificationWorkbench.module.css';

type Verification={
 id:string;candidate_id:string;manufacturer_name:string;sku:string;product_name:string;revision:string|null;
 source_file_name:string;source_byte_size:number;source_sha256:string;reuse_terms:string;notes:string|null;
 verification_status:'FILE_VERIFIED';verified_at:string;file_stored?:boolean;
};

async function digestFile(file:File){
 const bytes=await file.arrayBuffer();
 const hash=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(hash)).map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

export default function OemCadVerificationWorkbench(){
 const [records,setRecords]=useState<Verification[]>([]);
 const [candidateId,setCandidateId]=useState(OEM_CAD_CANDIDATES.find(item=>item.status!=='GLB_APPROVED')?.id||OEM_CAD_CANDIDATES[0]?.id||'');
 const [file,setFile]=useState<File|null>(null);
 const [revision,setRevision]=useState('');
 const [reuseTerms,setReuseTerms]=useState('');
 const [notes,setNotes]=useState('');
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const [authRequired,setAuthRequired]=useState(false);
 const selected=useMemo(()=>OEM_CAD_CANDIDATES.find(item=>item.id===candidateId)||null,[candidateId]);
 const latestByCandidate=useMemo(()=>{
  const map=new Map<string,Verification>();
  for(const record of records)if(!map.has(record.candidate_id))map.set(record.candidate_id,record);
  return map;
 },[records]);

 async function refresh(){
  try{
   const response=await fetch('/api/oem/cad-verifications',{cache:'no-store'});
   const body=await response.json().catch(()=>({}));
   if(response.status===401||response.status===403){setAuthRequired(true);setRecords([]);return}
   if(!response.ok)throw new Error(body?.error||'Unable to load OEM CAD verifications');
   setAuthRequired(false);
   setRecords(Array.isArray(body.records)?body.records:[]);
  }catch(error){setMessage(error instanceof Error?error.message:'Unable to load OEM CAD verifications')}
 }

 useEffect(()=>{void refresh()},[]);

 async function verify(){
  if(!selected||!file||busy)return;
  if(reuseTerms.trim().length<5){setMessage('Record the manufacturer/download reuse or redistribution terms before verification.');return}
  setBusy(true);setMessage('Hashing source file…');
  try{
   const clientSha=await digestFile(file);
   setMessage('Uploading source file for server verification…');
   const form=new FormData();
   form.set('candidateId',selected.id);
   form.set('file',file);
   form.set('sha256',clientSha);
   form.set('revision',revision.trim());
   form.set('reuseTerms',reuseTerms.trim());
   form.set('notes',notes.trim());
   const response=await fetch('/api/oem/cad-verifications',{method:'POST',body:form});
   const body=await response.json().catch(()=>({}));
   if(response.status===401||response.status===403){setAuthRequired(true);throw new Error('Sign in with an authorized STRATUM role to verify OEM CAD source files.')}
   if(!response.ok)throw new Error(body?.error||'Unable to verify OEM CAD source file');
   if(body.source_sha256!==clientSha)throw new Error('Server verification returned a different SHA-256 than the client digest.');
   setAuthRequired(false);
   setMessage(body.idempotent?'This exact source file was already verified; the existing immutable record was returned.':'FILE VERIFIED · SHA-256 '+clientSha);
   setFile(null);setRevision('');setReuseTerms('');setNotes('');
   const input=document.getElementById('oem-cad-source-file') as HTMLInputElement|null;if(input)input.value='';
   await refresh();
   window.dispatchEvent(new Event('stratum:oem-cad-verification-updated'));
  }catch(error){setMessage(error instanceof Error?error.message:'Unable to verify OEM CAD source file')}
  finally{setBusy(false)}
 }

 return <section className={styles.workbench} aria-label="OEM CAD file verification workbench">
  <div className={styles.head}>
   <div><span>CONTROLLED SOURCE INTAKE</span><h2>OEM CAD file verification workbench</h2><p>Upload the exact manufacturer CAD/download package. STRATUM hashes the bytes in the browser, verifies the same SHA-256 on the server, and stores an immutable tenant-scoped source record. This advances evidence to FILE VERIFIED only.</p></div>
   <strong>{records.length} stored verification{records.length===1?'':'s'}</strong>
  </div>

  <div className={styles.form}>
   <label>Exact OEM product<select aria-label="OEM CAD verification candidate" value={candidateId} onChange={event=>setCandidateId(event.target.value)}>{OEM_CAD_CANDIDATES.map(item=><option key={item.id} value={item.id}>{item.manufacturer} · {item.sku} · {item.product}</option>)}</select></label>
   <label>Manufacturer revision / file revision<input aria-label="OEM CAD source revision" value={revision} onChange={event=>setRevision(event.target.value)} maxLength={200} placeholder="Optional but recommended"/></label>
   <label className={styles.wide}>Source CAD or manufacturer archive<input id="oem-cad-source-file" aria-label="OEM CAD source file" type="file" accept=".step,.stp,.stl,.iges,.igs,.dwg,.dxf,.rfa,.rvt,.sat,.x_t,.x_b,.3dm,.obj,.gltf,.glb,.zip" onChange={event=>setFile(event.target.files?.[0]||null)}/></label>
   <label className={styles.wide}>Reuse / redistribution terms<textarea aria-label="OEM CAD reuse terms" rows={3} value={reuseTerms} onChange={event=>setReuseTerms(event.target.value)} maxLength={4000} placeholder="Record the manufacturer license, portal terms, permission, or restriction that applies to this exact download."/></label>
   <label className={styles.wide}>Verification notes<textarea aria-label="OEM CAD verification notes" rows={2} value={notes} onChange={event=>setNotes(event.target.value)} maxLength={4000} placeholder="Exact SKU/revision checks, drawing/package observations, exceptions…"/></label>
  </div>

  {selected&&<div className={styles.selected}>
   <div><span>Candidate</span><b>{selected.manufacturer} · {selected.sku}</b></div>
   <div><span>Current library stage</span><b>{selected.status}</b></div>
   <div><span>Source format expectation</span><b>{selected.cadFormat}</b></div>
   <div><span>Latest tenant verification</span><b>{latestByCandidate.get(selected.id)?'FILE VERIFIED':'NONE'}</b></div>
  </div>}

  <div className={styles.actions}><button type="button" disabled={busy||!file||!selected} onClick={verify}>{busy?'Verifying…':'Verify and store source file'}</button>{selected&&<a href={selected.cadUrl||selected.productUrl} target="_blank" rel="noopener noreferrer">Open manufacturer source ↗</a>}</div>
  {authRequired&&<p className={styles.auth}>Verification history and upload require an authenticated STRATUM user with an authorized role.</p>}
  {message&&<p className={styles.message} role="status">{message}</p>}

  <div className={styles.history}>
   <h3>Tenant verification history</h3>
   {records.slice(0,20).map(record=><article key={record.id}>
    <div><b>{record.manufacturer_name} · {record.sku}</b><span>FILE VERIFIED</span></div>
    <p>{record.product_name}</p>
    <small>{record.source_file_name} · {(Number(record.source_byte_size)/1024/1024).toFixed(2)} MB{record.revision?' · revision '+record.revision:''}</small>
    <code>{record.source_sha256}</code>
    <small>{new Date(record.verified_at).toLocaleString()}</small>
   </article>)}
   {!records.length&&!authRequired&&<p>No tenant CAD source verification records are stored yet.</p>}
  </div>

  <p className={styles.boundary}>FILE VERIFIED proves the stored source bytes, exact candidate binding, recorded revision context, and reuse terms. It does not mean the file has been converted to a controlled GLB, validated for meter-space geometry, approved for registry activation, matched to installed equipment, or accepted for engineering/AHJ use.</p>
 </section>;
}