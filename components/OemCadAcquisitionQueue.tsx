'use client';

import {useEffect,useMemo,useState} from 'react';
import {OEM_CAD_CANDIDATES,type OemCadCandidate} from '@/lib/oem-cad-candidates';
import {oemCadReadiness,oemCadStageLabel} from '@/lib/oem-cad-readiness';
import {ELECTRICAL_COMPONENTS} from '@/lib/electrical-component-library';
import {OEM_SOURCES} from '@/lib/oem-source-catalog';
import styles from './OemCadAcquisitionQueue.module.css';

type VerificationRecord={
 candidate_id:string;revision:string|null;source_file_name:string;source_sha256:string;reuse_terms:string;verified_at:string;verification_status:'FILE_VERIFIED';
};

const stages:OemCadCandidate['status'][]=['SOURCE_IDENTIFIED','CAD_DOWNLOAD_IDENTIFIED','FILE_VERIFIED','GLB_APPROVED'];
const VERIFICATION_EVENT='stratum:oem-cad-verification-updated';

export default function OemCadAcquisitionQueue(){
 const [query,setQuery]=useState('');
 const [stage,setStage]=useState<'ALL'|OemCadCandidate['status']>('ALL');
 const [verifications,setVerifications]=useState<VerificationRecord[]>([]);
 const components=useMemo(()=>new Map(ELECTRICAL_COMPONENTS.map(item=>[item.key,item.name])),[]);
 const sources=useMemo(()=>new Map(OEM_SOURCES.map(item=>[item.id,item])),[]);
 useEffect(()=>{
  let active=true;
  const refresh=async()=>{
   try{
    const response=await fetch('/api/oem/cad-verifications',{cache:'no-store'});
    if(response.status===401||response.status===403){if(active)setVerifications([]);return}
    if(!response.ok)return;
    const body=await response.json().catch(()=>({}));
    if(active)setVerifications(Array.isArray(body.records)?body.records:[]);
   }catch{/* Static acquisition registry remains available when tenant verification is unavailable. */}
  };
  const onUpdate=()=>{void refresh()};
  void refresh();
  window.addEventListener(VERIFICATION_EVENT,onUpdate);
  return()=>{active=false;window.removeEventListener(VERIFICATION_EVENT,onUpdate)};
 },[]);
 const latestVerification=useMemo(()=>{
  const map=new Map<string,VerificationRecord>();
  for(const record of verifications)if(!map.has(record.candidate_id))map.set(record.candidate_id,record);
  return map;
 },[verifications]);
 const items=useMemo(()=>OEM_CAD_CANDIDATES.map(candidate=>{
  const verification=latestVerification.get(candidate.id);
  const effectiveCandidate:OemCadCandidate=candidate.status==='GLB_APPROVED'||!verification?candidate:{
   ...candidate,
   status:'FILE_VERIFIED',
   sourceSha256:verification.source_sha256,
   reuseTerms:verification.reuse_terms,
   verifiedAt:verification.verified_at,
  };
  return{candidate:effectiveCandidate,staticCandidate:candidate,verification,readiness:oemCadReadiness(effectiveCandidate)};
 }),[latestVerification]);
 const visible=useMemo(()=>items.filter(({candidate})=>(stage==='ALL'||candidate.status===stage)&&`${candidate.manufacturer} ${candidate.sku} ${candidate.product} ${components.get(candidate.componentKey)||candidate.componentKey}`.toLowerCase().includes(query.trim().toLowerCase())),[items,stage,query,components]);
 const counts=useMemo(()=>({
  total:items.length,
  cadFound:items.filter(item=>item.candidate.status==='CAD_DOWNLOAD_IDENTIFIED'||item.candidate.status==='FILE_VERIFIED'||item.candidate.status==='GLB_APPROVED').length,
  verified:items.filter(item=>item.candidate.status==='FILE_VERIFIED'||item.candidate.status==='GLB_APPROVED').length,
  active:items.filter(item=>item.readiness.readyForActivation).length,
 }),[items]);

 function inspect(componentKey:string){
  window.dispatchEvent(new CustomEvent('stratum:select-model-registry',{detail:{componentKey}}));
  document.getElementById('spatial-3d-asset-registry')?.scrollIntoView({behavior:'smooth',block:'start'});
 }

 return <section className={styles.queue} aria-label="Exact OEM CAD acquisition queue">
  <div className={styles.head}>
   <div><span>GOVERNED ACQUISITION</span><h2>Exact OEM CAD acquisition queue</h2><p>Track exact manufacturer products from discovery through file verification and controlled GLB approval. Finding a CAD download is not permission to activate it as project geometry.</p></div>
   <div className={styles.stats}>
    <div><b>{counts.total}</b><small>exact products</small></div>
    <div><b>{counts.cadFound}</b><small>CAD found</small></div>
    <div><b>{counts.verified}</b><small>files verified</small></div>
    <div><b>{counts.active}</b><small>OEM active</small></div>
   </div>
  </div>

  <div className={styles.filters}>
   <label>Search exact products<input aria-label="Search exact OEM CAD queue" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Manufacturer, SKU, product, component…"/></label>
   <label>Acquisition stage<select aria-label="Filter OEM CAD acquisition stage" value={stage} onChange={event=>setStage(event.target.value as typeof stage)}><option value="ALL">All stages</option>{stages.map(value=><option key={value} value={value}>{oemCadStageLabel(value)}</option>)}</select></label>
  </div>

  <div className={styles.list}>{visible.map(({candidate,readiness,verification})=>{
   const source=sources.get(candidate.sourceId);
   const className=components.get(candidate.componentKey)||candidate.componentKey;
   return <article className={styles.card} key={candidate.id}>
    <div className={styles.title}>
     <div><span>{candidate.manufacturer}</span><h3>{candidate.sku}</h3><p>{candidate.product}</p></div>
     <strong data-stage={candidate.status}>{oemCadStageLabel(candidate.status)}</strong>
    </div>
    <div className={styles.facts}>
     <div><span>Library class</span><b>{className}</b></div>
     <div><span>CAD format</span><b>{candidate.cadFormat}</b></div>
     <div><span>Activation</span><b>{readiness.readyForActivation?'ELIGIBLE':'BLOCKED'}</b></div>
     <div><span>Manufacturer source</span><b>{source?.manufacturer||candidate.manufacturer}</b></div>
    </div>
    {candidate.dimensionsMeters&&<p className={styles.dimensions}>W × H × D: {candidate.dimensionsMeters.map(value=>`${(value*1000).toFixed(value*1000<10?1:0)} mm`).join(' × ')}</p>}
    <div className={styles.columns}>
     <div><h4>Evidence retained</h4><ul>{readiness.evidence.map(item=><li key={item}>{item}</li>)}</ul></div>
     <div><h4>{readiness.blockers.length?'Activation blockers':'Activation gate'}</h4>{readiness.blockers.length?<ul className={styles.blockers}>{readiness.blockers.map(item=><li key={item}>{item}</li>)}</ul>:<p className={styles.ready}>Required provenance gates are complete.</p>}</div>
    </div>
    <div className={styles.next}><b>Next controlled action</b><span>{readiness.nextAction}</span></div>
    {verification&&candidate.status==='FILE_VERIFIED'&&<div className={styles.next}><b>Tenant verification</b><span>{verification.source_file_name}{verification.revision?' · revision '+verification.revision:''} · SHA-256 {verification.source_sha256} · verified {new Date(verification.verified_at).toLocaleString()}</span></div>}
    <details><summary>Acquisition notes</summary><p>{candidate.notes}</p>{candidate.reuseTerms&&<p><b>Reuse terms:</b> {candidate.reuseTerms}</p>}{candidate.sourceSha256&&<p><b>Source SHA-256:</b> <code>{candidate.sourceSha256}</code></p>}{candidate.modelSha256&&<p><b>Model SHA-256:</b> <code>{candidate.modelSha256}</code></p>}</details>
    <div className={styles.actions}>
     <a href={candidate.productUrl} target="_blank" rel="noopener noreferrer">Official product ↗</a>
     {candidate.cadUrl&&<a href={candidate.cadUrl} target="_blank" rel="noopener noreferrer">CAD source ↗</a>}
     <button type="button" onClick={()=>inspect(candidate.componentKey)}>Inspect registry class</button>
    </div>
   </article>;
  })}</div>
  {!visible.length&&<p className={styles.empty}>No exact OEM acquisition record matches this filter.</p>}
  <p className={styles.boundary}>An OEM CAD record is library provenance only. It does not identify installed equipment, prove field placement, establish project XYZ, approve engineering use, create a STRATUM Asset, or finalize a DIR/PoVI state.</p>
 </section>;
}
