import {fitSheetSimilarity,type SheetSimilarity} from './sheet-similarity.ts';
import {drawingScaleDenominator} from './title-block.ts';

export type AlignmentEntity={id:string;name:string;x:number;y:number;kind:string;confidence:number;meta?:Record<string,unknown>};
export type AlignmentSheet={
 sourceSha256:string;
 page:number;
 sheetNumber:{value:string|null};
 discipline:{value:string|null};
 floor?:{value:string|null};
 drawingScale?:{value:string|null};
 pageGeometry?:{widthPoints:number|null;heightPoints:number|null;maxDimensionPoints:number|null};
 geometryScaleAuthority?:boolean;
 reviewState:'CANDIDATE'|'CONFIRMED';
};
export type AlignmentCrossChecks={
 discipline:'MATCH'|'MISMATCH'|'UNAVAILABLE';
 floor:'MATCH'|'MISMATCH'|'UNAVAILABLE';
 scale:'CONSISTENT'|'REVIEW'|'MISMATCH'|'UNAVAILABLE';
 expectedScale:number|null;
 scaleDeviationFactor:number|null;
};
export type AlignmentProposal={id:string;referenceKey:string;movingKey:string;referenceSheet:string;movingSheet:string;anchors:{name:string;referenceEntityId:string;movingEntityId:string}[];transform:SheetSimilarity;confidence:number;eligible:boolean;reasons:string[];crossChecks:AlignmentCrossChecks;reviewRequired:true;autoApply:false;verified:false};

const normalize=(value:string)=>value.toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const excluded=new Set(['ROOM','PLAN','ELECTRICAL','POWER','LIGHTING','GENERAL NOTES','NOTES','DETAIL','SECTION','ELEVATION','SHEET']);
const entityKey=(entity:AlignmentEntity)=>{const sha=String(entity.meta?.sourceSha256||'').toLowerCase(),page=Number(entity.meta?.page||0);return sha&&Number.isInteger(page)&&page>0?`${sha}:${page}`:null};
const sheetKey=(sheet:AlignmentSheet)=>`${sheet.sourceSha256.toLowerCase()}:${sheet.page}`;

function anchorsFor(entities:AlignmentEntity[],key:string){
 const byName=new Map<string,AlignmentEntity>();
 for(const entity of entities){
  if(entityKey(entity)!==key||!['room-label','text-asset-candidate','logical-tag','cad-text','cad-block'].includes(entity.kind))continue;
  const name=normalize(entity.name);if(name.length<3||excluded.has(name))continue;
  const prior=byName.get(name);if(!prior||entity.confidence>prior.confidence)byName.set(name,entity);
 }
 return byName;
}
function positive(value:unknown){const n=Number(value);return Number.isFinite(n)&&n>0?n:null}
function scaleExpectation(reference:AlignmentSheet,moving:AlignmentSheet){
 const referenceDenominator=drawingScaleDenominator(reference.drawingScale?.value),movingDenominator=drawingScaleDenominator(moving.drawingScale?.value);
 const referencePage=positive(reference.pageGeometry?.maxDimensionPoints),movingPage=positive(moving.pageGeometry?.maxDimensionPoints);
 if(!referenceDenominator||!movingDenominator||!referencePage||!movingPage)return null;
 const expected=movingDenominator*movingPage/(referenceDenominator*referencePage);
 return Number.isFinite(expected)&&expected>0?expected:null;
}

export function proposeSheetAlignments(entities:AlignmentEntity[],sheets:AlignmentSheet[]):AlignmentProposal[]{
 const confirmed=sheets.filter(sheet=>sheet.reviewState==='CONFIRMED'&&sheet.sheetNumber.value);
 const proposals:AlignmentProposal[]=[];
 for(let i=0;i<confirmed.length;i++)for(let j=i+1;j<confirmed.length;j++){
  const reference=confirmed[i],moving=confirmed[j],referenceKey=sheetKey(reference),movingKey=sheetKey(moving);
  const referenceAnchors=anchorsFor(entities,referenceKey),movingAnchors=anchorsFor(entities,movingKey);
  const names=[...referenceAnchors.keys()].filter(name=>movingAnchors.has(name)).sort();if(names.length<2)continue;
  const transform=fitSheetSimilarity(names.map(name=>({x:movingAnchors.get(name)!.x,y:movingAnchors.get(name)!.y})),names.map(name=>({x:referenceAnchors.get(name)!.x,y:referenceAnchors.get(name)!.y})));if(!transform)continue;
  const reasons:string[]=[];
  if(names.length<3)reasons.push('At least three shared source-grounded anchors are required.');
  if(transform.scale<.25||transform.scale>4)reasons.push('Estimated scale is outside the bounded review range.');
  if(transform.rmsResidual>.75)reasons.push('Residual exceeds the review threshold.');

  const disciplineReference=reference.discipline.value,disciplineMoving=moving.discipline.value;
  const discipline=disciplineReference&&disciplineMoving?(disciplineReference===disciplineMoving?'MATCH':'MISMATCH'):'UNAVAILABLE';
  if(discipline==='MISMATCH')reasons.push('Confirmed sheet disciplines differ.');

  const floorReference=reference.floor?.value,floorMoving=moving.floor?.value;
  const floor=floorReference&&floorMoving?(floorReference===floorMoving?'MATCH':'MISMATCH'):'UNAVAILABLE';
  if(floor==='MISMATCH')reasons.push(`Confirmed sheet floors differ (${floorReference} vs ${floorMoving}).`);

  if(reference.geometryScaleAuthority===true||moving.geometryScaleAuthority===true)reasons.push('Title-block scale cannot hold geometry authority.');
  const expectedScale=scaleExpectation(reference,moving);
  const scaleDeviationFactor=expectedScale?Math.max(transform.scale/expectedScale,expectedScale/transform.scale):null;
  const scale=scaleDeviationFactor===null?'UNAVAILABLE':scaleDeviationFactor>1.6?'MISMATCH':scaleDeviationFactor>1.25?'REVIEW':'CONSISTENT';
  if(scale==='MISMATCH')reasons.push(`Anchor-derived scale ${transform.scale.toFixed(4)}× strongly disagrees with the title-block/page-geometry expectation ${expectedScale!.toFixed(4)}× (factor ${scaleDeviationFactor!.toFixed(2)}).`);

  const confidence=Math.max(0,Math.min(1,(.48+Math.min(names.length,8)*.055+(discipline==='MATCH'?.08:0))*Math.exp(-transform.rmsResidual/.7)));
  proposals.push({id:`${referenceKey}->${movingKey}`,referenceKey,movingKey,referenceSheet:reference.sheetNumber.value!,movingSheet:moving.sheetNumber.value!,anchors:names.map(name=>({name,referenceEntityId:referenceAnchors.get(name)!.id,movingEntityId:movingAnchors.get(name)!.id})),transform,confidence:Number(confidence.toFixed(3)),eligible:reasons.length===0,reasons,crossChecks:{discipline,floor,scale,expectedScale:expectedScale===null?null:Number(expectedScale.toFixed(6)),scaleDeviationFactor:scaleDeviationFactor===null?null:Number(scaleDeviationFactor.toFixed(4))},reviewRequired:true,autoApply:false,verified:false});
 }
 return proposals.sort((a,b)=>Number(b.eligible)-Number(a.eligible)||b.confidence-a.confidence||a.id.localeCompare(b.id));
}
