'use client';

import {useEffect,useMemo,useState} from 'react';
import {
 applyReviewedPdfMetricFrame,
 derivePdfMetricFrameCandidates,
 pdfMetricFrameKey,
 restoreReviewedPdfMetricFrame,
 type MetricFrameEntity,
 type PdfMetricFrameCandidate
} from '@/lib/pdf-metric-frame';
import {readPrimarySpatialGraph,replaceCurrentSpatialGraph,type SpatialGraphLike} from '@/lib/spatial-browser-recovery';

type Graph=Omit<SpatialGraphLike,'entities'>&{
 entities:MetricFrameEntity[];
 pdfMetricFrameReviews?:unknown[];
};

export default function PdfMetricFrameReview(){
 const [graph,setGraph]=useState<Graph|null>(null);
 const [message,setMessage]=useState('');

 useEffect(()=>{
  let active=true;
  const load=async()=>{const next=await readPrimarySpatialGraph() as Graph|null;if(active)setGraph(next)};
  const refresh=()=>{void load()};
  void load();window.addEventListener('stratum:graph-updated',refresh);
  return()=>{active=false;window.removeEventListener('stratum:graph-updated',refresh)};
 },[]);

 const candidates=useMemo(()=>derivePdfMetricFrameCandidates(graph?.entities||[]),[graph]);

 function frameState(candidate:PdfMetricFrameCandidate){
  const items=(graph?.entities||[]).filter(entity=>pdfMetricFrameKey(entity)===candidate.frameKey);
  return{
   applied:items.some(entity=>entity.meta?.pdfMetricFrameCandidateId===candidate.id),
   otherMetric:items.some(entity=>entity.meta?.pdfMetricFrameOriginal&&entity.meta?.pdfMetricFrameCandidateId!==candidate.id),
   autoAligned:items.some(entity=>Boolean(entity.meta?.autoSheetAlignmentCandidateId)),
   manualAligned:items.some(entity=>Boolean(entity.meta?.sheetXYCalibrationId))
  };
 }

 async function apply(candidate:PdfMetricFrameCandidate){
  try{
   if(!candidate.eligible)throw new Error(candidate.reasons.join(' ')||'This scale candidate is not eligible.');
   const current=await readPrimarySpatialGraph() as Graph|null;if(!current)throw new Error('No Spatial graph is available.');
   const matching=current.entities.filter(entity=>pdfMetricFrameKey(entity)===candidate.frameKey);
   if(matching.some(entity=>entity.meta?.autoSheetAlignmentCandidateId))throw new Error('Restore automatic sheet alignment for this page before applying its metric frame.');
   if(matching.some(entity=>entity.meta?.sheetXYCalibrationId))throw new Error('Restore manual XY calibration for this page before applying its metric frame.');
   if(matching.some(entity=>entity.meta?.pdfMetricFrameOriginal&&entity.meta?.pdfMetricFrameCandidateId!==candidate.id))throw new Error('Restore the existing PDF metric frame before applying another scale candidate.');
   let changed=0;const occurredAt=new Date().toISOString();
   current.entities=current.entities.map(entity=>{
    if(pdfMetricFrameKey(entity)!==candidate.frameKey)return entity;
    const next=applyReviewedPdfMetricFrame(entity,candidate,occurredAt);
    if(next!==entity)changed++;
    return next;
   });
   current.pdfMetricFrameReviews=[...(Array.isArray(current.pdfMetricFrameReviews)?current.pdfMetricFrameReviews:[]),{
    candidateId:candidate.id,frameKey:candidate.frameKey,action:'APPLY',occurredAt,
    metersPerSheetUnit:candidate.metersPerSheetUnit,confidence:candidate.confidence,witnessCount:candidate.witnessCount,
    sourceCoordinatesPreserved:true,zChanged:false,physicalPositionVerified:false,reviewRequired:true
   }];
   await replaceCurrentSpatialGraph(current as SpatialGraphLike);
   setMessage('Applied reviewed PDF metric scale to '+changed+' object'+(changed===1?'':'s')+' on '+candidate.source+' page '+candidate.page+'. X/Y are now meter-scaled for Spatial review; original sheet coordinates are preserved and all Z values are unchanged.');
  }catch(error){setMessage(error instanceof Error?error.message:'Unable to apply PDF metric frame.')}
 }

 async function restore(candidate:PdfMetricFrameCandidate){
  try{
   const current=await readPrimarySpatialGraph() as Graph|null;if(!current)throw new Error('No Spatial graph is available.');
   let changed=0;const occurredAt=new Date().toISOString();
   current.entities=current.entities.map(entity=>{
    if(pdfMetricFrameKey(entity)!==candidate.frameKey||!entity.meta?.pdfMetricFrameOriginal)return entity;
    changed++;return restoreReviewedPdfMetricFrame(entity);
   });
   current.pdfMetricFrameReviews=[...(Array.isArray(current.pdfMetricFrameReviews)?current.pdfMetricFrameReviews:[]),{
    candidateId:candidate.id,frameKey:candidate.frameKey,action:'RESTORE',occurredAt,
    sourceCoordinatesPreserved:true,zChanged:false,physicalPositionVerified:false,reviewRequired:true
   }];
   await replaceCurrentSpatialGraph(current as SpatialGraphLike);
   setMessage('Restored '+changed+' object'+(changed===1?'':'s')+' on '+candidate.source+' page '+candidate.page+' to original sheet X/Y. Z was unchanged.');
  }catch(error){setMessage(error instanceof Error?error.message:'Unable to restore PDF sheet coordinates.')}
 }

 return <section className="card" style={{marginTop:16}} aria-label="PDF metric frame review">
  <div className="section-head"><div><div className="eyebrow">PDF metric frame · Review required</div><h2>Put reviewed PDF X/Y into the same meter world as Z</h2><p className="muted">STRATUM uses only independently corroborated drawing-scale evidence. Applying a candidate multiplies immutable source-sheet X/Y by the corroborated meters-per-sheet-unit value; Z is never rescaled or changed. Original sheet coordinates remain stored for one-click restoration.</p></div><span className="pending">{candidates.filter(candidate=>candidate.eligible).length} ELIGIBLE</span></div>
  {message&&<div className="notice" role="status"><strong>METRIC FRAME</strong><span>{message}</span></div>}
  {!candidates.length&&<p className="muted" style={{marginBottom:0}}>No PDF page has independently measurable scale evidence yet. STRATUM will keep its native sheet frame rather than invent metric X/Y.</p>}
  {candidates.length>0&&<div style={{display:'grid',gap:10,marginTop:12}}>{candidates.map(candidate=>{
   const state=frameState(candidate),blocked=state.autoAligned||state.manualAligned||state.otherMetric;
   return <article className="card" key={candidate.id} style={{padding:14}}>
    <div className="section-head"><div><strong>{candidate.source} · page {candidate.page}</strong><small style={{display:'block'}}>{candidate.witnessCount} independent scale witness{candidate.witnessCount===1?'':'es'} · confidence {Math.round(candidate.confidence*100)}%</small></div><span className={candidate.eligible&&!blocked?'proof':'pending'}>{state.applied?'METRIC APPLIED':candidate.eligible&&!blocked?'REVIEWABLE':'BLOCKED'}</span></div>
    <div className="grid two">
     <div><div className="label">Corroborated metric scale</div><b>{candidate.corroboratedMetersPerSheetUnit!==null?candidate.corroboratedMetersPerSheetUnit.toFixed(6)+' m / sheet unit':'Unavailable'}</b></div>
     <div><div className="label">Declared-scale cross-check</div><b>{candidate.declaredMetersPerSheetUnit!==null?candidate.declaredMetersPerSheetUnit.toFixed(6)+' m / sheet unit':'Unavailable'}</b></div>
    </div>
    {candidate.reasons.length>0&&<p className="muted">Blocked: {candidate.reasons.join(' ')}</p>}
    {(state.autoAligned||state.manualAligned)&&<div className="notice"><strong>RESTORE EXISTING XY TRANSFORM FIRST</strong><span>This page already carries {state.autoAligned?'an automatic sheet alignment':'a manual XY calibration'}. STRATUM blocks compounded transforms so the coordinate lineage remains auditable.</span></div>}
    {state.otherMetric&&<div className="notice"><strong>RESTORE PRIOR METRIC FRAME</strong><span>A different reviewed metric-frame candidate is already applied to this page.</span></div>}
    <div className="button-row"><button type="button" className="action" disabled={!candidate.eligible||blocked||state.applied} onClick={()=>apply(candidate)}>Apply reviewed metric frame</button><button type="button" className="ghost" disabled={!state.applied&&!state.otherMetric} onClick={()=>restore(candidate)}>Restore source sheet X/Y</button></div>
   </article>;
  })}</div>}
  <small className="spatial-review-boundary">Metric-frame review establishes a drawing coordinate transform only. It does not establish installed/as-built position, physical Z, asset identity, engineering approval, DIR finality, or PoVI finality.</small>
 </section>;
}
