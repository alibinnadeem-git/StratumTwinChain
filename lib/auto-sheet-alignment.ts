import {fitSheetSimilarity,type SheetSimilarity} from './sheet-similarity.ts';

export type AlignmentEntity={id:string;name:string;x:number;y:number;kind:string;confidence:number;meta?:Record<string,unknown>};
export type AlignmentSheet={sourceSha256:string;page:number;sheetNumber:{value:string|null};discipline:{value:string|null};reviewState:'CANDIDATE'|'CONFIRMED'};
export type AlignmentProposal={id:string;referenceKey:string;movingKey:string;referenceSheet:string;movingSheet:string;anchors:{name:string;referenceEntityId:string;movingEntityId:string}[];transform:SheetSimilarity;confidence:number;eligible:boolean;reasons:string[];reviewRequired:true;autoApply:false;verified:false};

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
  const sameDiscipline=Boolean(reference.discipline.value&&moving.discipline.value&&reference.discipline.value===moving.discipline.value);
  if(reference.discipline.value&&moving.discipline.value&&!sameDiscipline)reasons.push('Confirmed sheet disciplines differ.');
  const confidence=Math.max(0,Math.min(1,(.48+Math.min(names.length,8)*.055+(sameDiscipline?.08:0))*Math.exp(-transform.rmsResidual/.7)));
  proposals.push({id:`${referenceKey}->${movingKey}`,referenceKey,movingKey,referenceSheet:reference.sheetNumber.value!,movingSheet:moving.sheetNumber.value!,anchors:names.map(name=>({name,referenceEntityId:referenceAnchors.get(name)!.id,movingEntityId:movingAnchors.get(name)!.id})),transform,confidence:Number(confidence.toFixed(3)),eligible:reasons.length===0,reasons,reviewRequired:true,autoApply:false,verified:false});
 }
 return proposals.sort((a,b)=>Number(b.eligible)-Number(a.eligible)||b.confidence-a.confidence||a.id.localeCompare(b.id));
}
