import type {IndependentScaleValidation} from './scale-validation.ts';

export type MetricFramePoint={x:number;y:number};
export type MetricFrameEntity={
 id:string;
 source:string;
 x:number;
 y:number;
 z?:number;
 x2?:number;
 y2?:number;
 z2?:number;
 vertices?:MetricFramePoint[];
 meta?:Record<string,unknown>;
};

export type PdfMetricFrameCandidate={
 id:string;
 frameKey:string;
 source:string;
 page:number;
 metersPerSheetUnit:number|null;
 declaredMetersPerSheetUnit:number|null;
 corroboratedMetersPerSheetUnit:number|null;
 confidence:number;
 witnessCount:number;
 eligible:boolean;
 autoApplyEligible:boolean;
 reasons:string[];
 reviewRequired:true;
 autoApply:false;
 physicalPositionVerified:false;
 zChanged:false;
};

export type MetricFrameOriginal={
 x:number;
 y:number;
 x2?:number;
 y2?:number;
 vertices?:MetricFramePoint[];
 coordinateUnits?:unknown;
};

function finite(value:unknown){
 const n=Number(value);
 return Number.isFinite(n)?n:null;
}
export function pdfMetricFrameKey(entity:MetricFrameEntity){
 const sha=String(entity.meta?.sourceSha256||'').toLowerCase();
 const page=Number(entity.meta?.page||0);
 return sha&&Number.isInteger(page)&&page>0?`${sha}:${page}`:null;
}
function validationFor(entity:MetricFrameEntity){
 const raw=entity.meta?.scaleValidationEvidence;
 if(!raw||typeof raw!=='object')return null;
 return raw as IndependentScaleValidation;
}
function isPdfSheetEntity(entity:MetricFrameEntity){
 const units=String(entity.meta?.coordinateUnits||'').toLowerCase();
 const sourceType=String(entity.meta?.sourceType||'').toUpperCase();
 return units==='sheet'||units==='image_preview'||units==='image_sheet'||sourceType.startsWith('PDF_')||sourceType.startsWith('PDF ');
}

export function derivePdfMetricFrameCandidates(entities:MetricFrameEntity[]):PdfMetricFrameCandidate[]{
 const byFrame=new Map<string,MetricFrameEntity[]>();
 for(const entity of entities){
  const frame=pdfMetricFrameKey(entity);
  if(!frame||!isPdfSheetEntity(entity))continue;
  byFrame.set(frame,[...(byFrame.get(frame)||[]),entity]);
 }
 const out:PdfMetricFrameCandidate[]=[];
 for(const [frameKey,items] of byFrame){
  const validations=items
   .map(entity=>({entity,validation:validationFor(entity)}))
   .filter((entry):entry is {entity:MetricFrameEntity;validation:IndependentScaleValidation}=>Boolean(entry.validation))
   .sort((a,b)=>Number(b.validation.confidence||0)-Number(a.validation.confidence||0));
  if(!validations.length)continue;
  const {entity,validation}=validations[0];
  const corroborated=finite(validation.corroboratedMetersPerNormalizedSheetUnit);
  const declared=finite(validation.declaredMetersPerNormalizedSheetUnit);
  const reasons:string[]=[];
  if(validation.status!=='CORROBORATED')reasons.push(`Independent scale status is ${validation.status}, not CORROBORATED.`);
  if(corroborated===null||corroborated<=0)reasons.push('No finite corroborated meters-per-sheet-unit value is available.');
  if(Number(validation.confidence||0)<.6)reasons.push('Scale confidence is below the review threshold.');
  const page=Number(entity.meta?.page||0);
  out.push({
   id:`metric-frame:${frameKey}:${corroborated?.toFixed(9)??'unresolved'}`,
   frameKey,source:entity.source,page,
   metersPerSheetUnit:corroborated,
   declaredMetersPerSheetUnit:declared,
   corroboratedMetersPerSheetUnit:corroborated,
   confidence:Math.max(0,Math.min(1,Number(validation.confidence||0))),
   witnessCount:Array.isArray(validation.witnesses)?validation.witnesses.length:0,
   eligible:reasons.length===0,
   autoApplyEligible:false, // No witness score can authorize automatic metric coordinates.
   reasons,
   reviewRequired:true,
   autoApply:false,
   physicalPositionVerified:false,
   zChanged:false
  });
 }
 return out.sort((a,b)=>Number(b.eligible)-Number(a.eligible)||b.confidence-a.confidence||a.source.localeCompare(b.source)||a.page-b.page);
}

function applyPdfMetricFrame<T extends MetricFrameEntity>(
 entity:T,
 candidate:PdfMetricFrameCandidate,
 appliedAt:string,
 authority:'HUMAN_REVIEWED_CORROBORATED_PDF_SCALE'|'AUTO_CORROBORATED_PDF_SCALE',
 autoApplied:boolean
):T{
 if(autoApplied)throw new Error('Automatic PDF metric-frame application is prohibited; human-confirm manual XY calibration and witness corroboration.');
 if(pdfMetricFrameKey(entity)!==candidate.frameKey)return entity;
 if(!candidate.eligible||candidate.metersPerSheetUnit===null)throw new Error('This PDF metric-frame candidate is not eligible for application.');
 if(autoApplied&&!candidate.autoApplyEligible)throw new Error('This PDF metric-frame candidate does not have redundant evidence for automatic application.');
 const meta={...(entity.meta||{})};
 if(meta.autoSheetAlignmentCandidateId)throw new Error('Restore automatic sheet alignment before applying the PDF metric frame.');
 if(meta.sheetXYCalibrationId)throw new Error('Restore manual XY calibration before applying the PDF metric frame.');
 const existing=meta.pdfMetricFrameOriginal as MetricFrameOriginal|undefined;
 if(existing){
  if(meta.pdfMetricFrameCandidateId===candidate.id)return entity;
  throw new Error('Restore the existing PDF metric frame before applying another scale candidate.');
 }
 const scalar=candidate.metersPerSheetUnit;
 const original:MetricFrameOriginal={
  x:entity.x,y:entity.y,
  ...(Number.isFinite(Number(entity.x2))&&Number.isFinite(Number(entity.y2))?{x2:Number(entity.x2),y2:Number(entity.y2)}:{}),
  ...(Array.isArray(entity.vertices)?{vertices:entity.vertices.map(point=>({x:point.x,y:point.y}))}:{}),
  coordinateUnits:meta.coordinateUnits
 };
 const nextMeta={
  ...meta,
  pdfMetricFrameOriginal:original,
  pdfMetricFrameCandidateId:candidate.id,
  pdfMetricFrameAppliedAt:appliedAt,
  metricFrameAuthority:authority,
  metricFrameMetersPerSheetUnit:scalar,
  metricFrameConfidence:candidate.confidence,
  metricFrameWitnessCount:candidate.witnessCount,
  metricFrameReviewRequired:true,
  metricFrameAutoApplied:autoApplied,
  metricFramePhysicalPositionVerified:false,
  metricFrameZChanged:false,
  coordinateUnits:autoApplied?'m_auto_corroborated_pdf':'m_reviewed_pdf',
  physicalTruth:false
 };
 return{
  ...entity,
  x:entity.x*scalar,
  y:entity.y*scalar,
  ...(original.x2!==undefined&&original.y2!==undefined?{x2:original.x2*scalar,y2:original.y2*scalar}:{}),
  ...(original.vertices?{vertices:original.vertices.map(point=>({x:point.x*scalar,y:point.y*scalar}))}:{}),
  meta:nextMeta
 };
}

export function applyReviewedPdfMetricFrame<T extends MetricFrameEntity>(
 entity:T,
 candidate:PdfMetricFrameCandidate,
 appliedAt=new Date().toISOString()
):T{
 return applyPdfMetricFrame(entity,candidate,appliedAt,'HUMAN_REVIEWED_CORROBORATED_PDF_SCALE',false);
}

export function applyAutomaticPdfMetricFrame<T extends MetricFrameEntity>(
 entity:T,
 candidate:PdfMetricFrameCandidate,
 appliedAt=new Date().toISOString()
):T{
 return applyPdfMetricFrame(entity,candidate,appliedAt,'AUTO_CORROBORATED_PDF_SCALE',true);
}

export function restoreReviewedPdfMetricFrame<T extends MetricFrameEntity>(entity:T):T{
 const meta={...(entity.meta||{})};
 const original=meta.pdfMetricFrameOriginal as MetricFrameOriginal|undefined;
 if(!original)return entity;
 const nextMeta={...meta};
 delete nextMeta.pdfMetricFrameOriginal;
 delete nextMeta.pdfMetricFrameCandidateId;
 delete nextMeta.pdfMetricFrameAppliedAt;
 delete nextMeta.metricFrameAuthority;
 delete nextMeta.metricFrameMetersPerSheetUnit;
 delete nextMeta.metricFrameConfidence;
 delete nextMeta.metricFrameWitnessCount;
 delete nextMeta.metricFrameReviewRequired;
 delete nextMeta.metricFrameAutoApplied;
 delete nextMeta.metricFramePhysicalPositionVerified;
 delete nextMeta.metricFrameZChanged;
 if(original.coordinateUnits===undefined)delete nextMeta.coordinateUnits;
 else nextMeta.coordinateUnits=original.coordinateUnits;
 const next={...entity,x:original.x,y:original.y,meta:nextMeta} as T;
 if(original.x2!==undefined&&original.y2!==undefined){next.x2=original.x2;next.y2=original.y2}else{delete next.x2;delete next.y2}
 if(original.vertices)next.vertices=original.vertices.map(point=>({...point}));else delete next.vertices;
 return next;
}
