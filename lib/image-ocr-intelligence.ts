import {parseEquipmentScheduleText,type ScheduleEntity} from './equipment-schedule.ts';

export type ImageOcrEvidence=ScheduleEntity&{
 meta:ScheduleEntity['meta']&{
  sourceType:'OCR_IMAGE_TEXT';
  ocrAuthority:'REVIEW_ONLY';
  geometryAuthority:'NONE';
  ocrMeanConfidence:number|null;
  ocrImageWidth:number;
  ocrImageHeight:number;
  ocrTextChars:number;
 };
};

export function buildImageOcrEvidence(input:{
 text:string;
 source:string;
 discipline:string;
 floor:string;
 width:number;
 height:number;
 meanConfidence?:number|null;
}){
 const text=input.text.replace(/\u0000/g,'').trim();
 const parsed=parseEquipmentScheduleText(text,input.source,input.discipline,input.floor);
 const mean=Number.isFinite(Number(input.meanConfidence))?Math.max(0,Math.min(100,Number(input.meanConfidence))):null;
 const confidenceFactor=mean===null ? .72 : Math.max(.35,Math.min(.9,mean/100));
 const entities=parsed.entities.map((entity,index):ImageOcrEvidence=>({
  ...entity,
  id:('ocr-'+index+'-'+entity.id).slice(0,300),
  confidence:Math.min(.66,Math.max(.3,entity.confidence*confidenceFactor)),
  meta:{
   ...entity.meta,
   sourceType:'OCR_IMAGE_TEXT',
   ocrAuthority:'REVIEW_ONLY',
   geometryAuthority:'NONE',
   nonSpatial:true,
   physicalTruth:false,
   reviewRequired:true,
   spatialPlacementAuthority:'OCR_NON_SPATIAL',
   registrationState:'CANDIDATE',
   ocrMeanConfidence:mean,
   ocrImageWidth:input.width,
   ocrImageHeight:input.height,
   ocrTextChars:text.length
  }
 }));
 return{
  text,
  entities,
  summary:`${input.width}×${input.height} image OCR · ${text.length} recognized text character(s) · ${entities.length} powered equipment candidate(s) · review-only/non-spatial until reconciled with drawing/BIM geometry.`,
  details:{width:input.width,height:input.height,textChars:text.length,meanConfidence:mean,equipmentCandidates:entities.length}
 };
}
