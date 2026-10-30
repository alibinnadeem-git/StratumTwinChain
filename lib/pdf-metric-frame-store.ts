import {
 applyReviewedPdfMetricFrame,
 pdfMetricFrameKey,
 restoreReviewedPdfMetricFrame,
 type MetricFrameEntity,
 type PdfMetricFrameCandidate
} from './pdf-metric-frame.ts';
import {updateCurrentSpatialGraph,type SpatialGraphLike} from './spatial-browser-recovery.ts';

// Applies or restores a person-confirmed PDF metric frame on the stored Spatial graph. Shared by the
// /compiler review panel and the Spatial view so both write the same lineage and review log. The read and
// the write happen in one turn of the primary write queue, so a background projection pass can never land
// in between (it re-projects from the new graph instead).

type Graph=Omit<SpatialGraphLike,'entities'>&{entities:MetricFrameEntity[];pdfMetricFrameReviews?:unknown[]};

async function updateStoredGraph(change:(current:Graph)=>{entities:MetricFrameEntity[];review:Record<string,unknown>;changed:number}){
 const changed=await updateCurrentSpatialGraph(stored=>{
  const current=stored as Graph,next=change(current);
  const reviews=[...(Array.isArray(current.pdfMetricFrameReviews)?current.pdfMetricFrameReviews:[]),next.review];
  return{graph:{...stored,entities:next.entities,pdfMetricFrameReviews:reviews},result:next.changed};
 });
 if(changed===null)throw new Error('No Spatial graph is available.');
 return changed;
}

/** Returns how many objects were rescaled. Throws with a reviewer-facing reason when blocked. */
export async function applyStoredPdfMetricFrame(candidate:PdfMetricFrameCandidate){
 if(!candidate.eligible)throw new Error(candidate.reasons.join(' ')||'This scale candidate is not eligible.');
 return updateStoredGraph(current=>{
  const matching=current.entities.filter(entity=>pdfMetricFrameKey(entity)===candidate.frameKey);
  if(matching.some(entity=>entity.meta?.autoSheetAlignmentCandidateId))throw new Error('Restore automatic sheet alignment for this page before applying its metric frame.');
  if(matching.some(entity=>entity.meta?.sheetXYCalibrationId))throw new Error('Restore manual XY calibration for this page before applying its metric frame.');
  if(matching.some(entity=>entity.meta?.pdfMetricFrameOriginal&&entity.meta?.pdfMetricFrameCandidateId!==candidate.id))throw new Error('Restore the existing PDF metric frame before applying another scale candidate.');
  let changed=0;const occurredAt=new Date().toISOString();
  const entities=current.entities.map(entity=>{
   if(pdfMetricFrameKey(entity)!==candidate.frameKey)return entity;
   const next=applyReviewedPdfMetricFrame(entity,candidate,occurredAt);
   if(next!==entity)changed++;
   return next;
  });
  return{entities,changed,review:{
   candidateId:candidate.id,frameKey:candidate.frameKey,action:'APPLY',occurredAt,
   metersPerSheetUnit:candidate.metersPerSheetUnit,confidence:candidate.confidence,witnessCount:candidate.witnessCount,
   basis:candidate.basis,corroboratedByPage:candidate.corroboratedByPage,
   sourceCoordinatesPreserved:true,zChanged:false,physicalPositionVerified:false,reviewRequired:true
  }};
 });
}

/** Returns how many objects were put back on their original sheet X/Y. Only the page key is needed, so an
 * applied frame can be undone even after the evidence behind its candidate has changed. */
export async function restoreStoredPdfMetricFrame(candidate:Pick<PdfMetricFrameCandidate,'id'|'frameKey'>){
 return updateStoredGraph(current=>{
  let changed=0;const occurredAt=new Date().toISOString();
  const entities=current.entities.map(entity=>{
   if(pdfMetricFrameKey(entity)!==candidate.frameKey||!entity.meta?.pdfMetricFrameOriginal)return entity;
   changed++;return restoreReviewedPdfMetricFrame(entity);
  });
  return{entities,changed,review:{
   candidateId:candidate.id,frameKey:candidate.frameKey,action:'RESTORE',occurredAt,
   sourceCoordinatesPreserved:true,zChanged:false,physicalPositionVerified:false,reviewRequired:true
  }};
 });
}
