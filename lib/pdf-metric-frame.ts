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
 // OWN_WITNESSES: this page's own dimensions agree with its printed scale. SAME_SET_CORROBORATED_SHEET: the
 // page has no measurable dimensions (typical of electrical plans), but another page of the same PDF prints
 // the same scale on the same page size and its dimensions corroborate it.
 basis:'OWN_WITNESSES'|'SAME_SET_CORROBORATED_SHEET';
 corroboratedByPage:number|null;
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
// Witnesses that support the scale: the agreeing majority under consensus, the usable ones otherwise.
function supportingWitnessCount(validation:IndependentScaleValidation){
 const count=Number(validation.independentWitnessCount);
 return Number.isFinite(count)&&count>0?count:Array.isArray(validation.witnesses)?validation.witnesses.length:0;
}
function isPdfSheetEntity(entity:MetricFrameEntity){
 const units=String(entity.meta?.coordinateUnits||'').toLowerCase();
 const sourceType=String(entity.meta?.sourceType||'').toUpperCase();
 return units==='sheet'||units==='image_preview'||units==='image_sheet'||sourceType.startsWith('PDF_')||sourceType.startsWith('PDF ');
}

export function derivePdfMetricFrameCandidates(entities:MetricFrameEntity[]):PdfMetricFrameCandidate[]{
 type Frame={source:string;page:number;sheet:boolean;validation:IndependentScaleValidation|null};
 const byFrame=new Map<string,Frame>();
 for(const entity of entities){
  const frameKey=pdfMetricFrameKey(entity);if(!frameKey)continue;
  const frame=byFrame.get(frameKey)||{source:entity.source,page:Number(entity.meta?.page||0),sheet:false,validation:null};
  if(isPdfSheetEntity(entity))frame.sheet=true;
  // The PDF parser keeps a page's scale evidence on a non-spatial scale-validation record rather than on
  // the sheet geometry, so evidence counts from any record of the page.
  const validation=validationFor(entity);
  if(validation&&(!frame.validation||Number(validation.confidence||0)>Number(frame.validation.confidence||0)))frame.validation=validation;
  byFrame.set(frameKey,frame);
 }
 const sourceKey=(frameKey:string)=>frameKey.slice(0,frameKey.lastIndexOf(':'));
 const provenSheets=[...byFrame.entries()].filter(([,frame])=>frame.sheet&&frame.validation?.status==='CORROBORATED'&&Number(frame.validation.confidence||0)>=.6&&finite(frame.validation.declaredMetersPerNormalizedSheetUnit)!==null);
 const out:PdfMetricFrameCandidate[]=[];
 for(const [frameKey,frame] of byFrame){
  const validation=frame.validation;if(!frame.sheet||!validation)continue;
  const corroborated=finite(validation.corroboratedMetersPerNormalizedSheetUnit);
  const declared=finite(validation.declaredMetersPerNormalizedSheetUnit);
  const common={frameKey,source:frame.source,page:frame.page,declaredMetersPerSheetUnit:declared,autoApplyEligible:false as const, // No witness score can authorize automatic metric coordinates.
   reviewRequired:true as const,autoApply:false as const,physicalPositionVerified:false as const,zChanged:false as const};
  // A page with a printed scale but nothing measurable on it borrows corroboration from a sibling page of
  // the same PDF whose identical declared metres-per-unit (same scale text, same page size) its own
  // dimensions confirmed. The page's own declared value is applied; a person still confirms it.
  const sibling=validation.status==='UNRESOLVED'&&declared!==null
   ?provenSheets.find(([key,proven])=>key!==frameKey&&sourceKey(key)===sourceKey(frameKey)&&Math.abs(finite(proven.validation!.declaredMetersPerNormalizedSheetUnit)!/declared-1)<=.001)
   :undefined;
  if(sibling&&declared!==null){
   const [,proven]=sibling,provenValidation=proven.validation!;
   out.push({...common,
    id:`metric-frame:${frameKey}:${declared.toFixed(9)}:same-set-p${proven.page}`,
    metersPerSheetUnit:declared,
    corroboratedMetersPerSheetUnit:finite(provenValidation.corroboratedMetersPerNormalizedSheetUnit),
    confidence:Math.min(.75,Math.max(0,Number(provenValidation.confidence||0))),
    witnessCount:supportingWitnessCount(provenValidation),
    basis:'SAME_SET_CORROBORATED_SHEET',corroboratedByPage:proven.page,
    eligible:true,reasons:[]
   });
   continue;
  }
  const reasons:string[]=[];
  if(validation.status!=='CORROBORATED')reasons.push(`Independent scale status is ${validation.status}, not CORROBORATED.`);
  if(corroborated===null||corroborated<=0)reasons.push('No finite corroborated meters-per-sheet-unit value is available.');
  if(Number(validation.confidence||0)<.6)reasons.push('Scale confidence is below the review threshold.');
  out.push({...common,
   id:`metric-frame:${frameKey}:${corroborated?.toFixed(9)??'unresolved'}`,
   metersPerSheetUnit:corroborated,
   corroboratedMetersPerSheetUnit:corroborated,
   confidence:Math.max(0,Math.min(1,Number(validation.confidence||0))),
   witnessCount:supportingWitnessCount(validation),
   basis:'OWN_WITNESSES',corroboratedByPage:null,
   eligible:reasons.length===0,
   reasons
  });
 }
 return out.sort((a,b)=>Number(b.eligible)-Number(a.eligible)||b.confidence-a.confidence||a.source.localeCompare(b.source)||a.page-b.page);
}

function applyPdfMetricFrame<T extends MetricFrameEntity>(
 entity:T,
 candidate:PdfMetricFrameCandidate,
 appliedAt:string,
 authority:'HUMAN_REVIEWED_CORROBORATED_PDF_SCALE'|'HUMAN_REVIEWED_SAME_SET_PDF_SCALE'|'AUTO_CORROBORATED_PDF_SCALE',
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
  metricFrameBasis:candidate.basis,
  metricFrameCorroboratedByPage:candidate.corroboratedByPage,
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
 return applyPdfMetricFrame(entity,candidate,appliedAt,candidate.basis==='SAME_SET_CORROBORATED_SHEET'?'HUMAN_REVIEWED_SAME_SET_PDF_SCALE':'HUMAN_REVIEWED_CORROBORATED_PDF_SCALE',false);
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
 delete nextMeta.metricFrameBasis;
 delete nextMeta.metricFrameCorroboratedByPage;
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
