export type ReprocessSourceLike={
 name:string;
 ext?:string;
 sha256?:string;
 state?:string;
 entities?:number;
 vectors?:number;
 textItems?:number;
 sldPages?:number;
 nonSldPlanPages?:number;
 planTypes?:string[];
};

export type ReprocessEntityLike={
 source?:string;
 kind?:string;
 layer?:string;
 floor?:string;
 meta?:Record<string,unknown>;
};

const DRAWING_EXTENSIONS=new Set(['pdf','png','jpg','jpeg']);

function sameSource(source:ReprocessSourceLike,entity:ReprocessEntityLike){
 const entitySha=String(entity.meta?.sourceSha256||'');
 return Boolean(
  (source.sha256&&entitySha&&source.sha256===entitySha)||
  (source.name&&entity.source===source.name)
 );
}

export function drawingSourceReprocessReason(source:ReprocessSourceLike,entities:ReprocessEntityLike[]){
 const ext=String(source.ext||source.name.split('.').pop()||'').toLowerCase();
 if(!DRAWING_EXTENSIONS.has(ext))return null;

 const scoped=entities.filter(entity=>sameSource(source,entity));
 const hasBasemap=scoped.some(entity=>
  entity.meta?.drawingBasemap===true||
  entity.kind==='source-raster-underlay'||
  entity.meta?.sourceType==='PDF source-plan vector line'
 );
 if(hasBasemap)return null;

 const hasSldGeometry=scoped.some(entity=>entity.kind==='sld-feeder-candidate'||entity.meta?.sldFeederCandidate===true);
 const sldPages=Number(source.sldPages||0);
 if(sldPages>0&&hasSldGeometry)return null;

 const nonSldPlanPages=Number(source.nonSldPlanPages||0);
 const planTypes=Array.isArray(source.planTypes)?source.planTypes.filter(Boolean):[];
 if(nonSldPlanPages>0||planTypes.length>0){
  return 'Recognized plan metadata exists, but no retained drawing basemap is present.';
 }

 const sourceEntityCount=Math.max(Number(source.entities||0),scoped.length);
 if(['png','jpg','jpeg'].includes(ext)&&sourceEntityCount>0){
  return 'Raster drawing evidence was extracted before source-underlay retention was available.';
 }

 const vectors=Number(source.vectors||0);
 const hasSourceCandidates=scoped.some(entity=>entity.meta?.nonSpatial!==true&&entity.kind!=='imported-3d-model');
 if(ext==='pdf'&&sldPages===0&&sourceEntityCount>0&&(vectors>0||hasSourceCandidates)){
  return 'PDF drawing candidates were extracted without a retained non-SLD drawing basemap.';
 }

 return null;
}

export function findDrawingSourcesNeedingReprocess(sources:ReprocessSourceLike[],entities:ReprocessEntityLike[]){
 return sources.flatMap(source=>{
  const reason=drawingSourceReprocessReason(source,entities);
  return reason?[{source,reason}]:[];
 });
}

/**
 * Post-reprocess diagnostic only. Detection does not mean an approved room,
 * installed asset or metric floor datum. Never creates or promotes geometry.
 */
export function inspectDrawingReprocessOutput(items:ReprocessEntityLike[]){
 const basemaps=items.filter(x=>x.meta?.drawingBasemap===true||x.meta?.sourceType==='PDF source-plan vector line'||x.kind==='source-raster-underlay').length;
 const candidateRooms=items.filter(x=>x.kind==='vector-boundary-candidate').length;
 const modeledRooms=items.filter(x=>x.kind==='room-boundary').length;
 const equipmentCandidates=items.filter(x=>x.layer==='L4').length;
 const modeledEquipment=items.filter(x=>x.layer==='L4'&&
  (x.meta?.resolution_state==='RESOLVED'||x.meta?.resolutionState==='RESOLVED')&&
  Boolean(x.meta?.model_ref||x.meta?.modelRef)).length;
 const floors=[...new Set(items.map(x=>String(x.floor||'UNRESOLVED')).filter(x=>x!=='UNRESOLVED'&&x.trim()))];
 // Floor text/plan-frame labels are not independently established Z levels.
 const physicallyEstablishedLevels=items.filter(x=>x.kind==='spatial-level'&&x.meta?.physicalTruth===true).length;
 const gaps=[
   ...(!basemaps?['drawing basemap absent']:[]),
   ...(!modeledRooms?[`0 modeled rooms (${candidateRooms} boundary proposals)`]:[]),
   ...(!modeledEquipment?[`0 confirmed model-linked assets (${equipmentCandidates} L4 candidates)`]:[]),
   ...(!physicallyEstablishedLevels?[`0 physical elevation levels (${floors.length} floor labels)`]:[])
 ];
 return {basemaps,candidateRooms,modeledRooms,equipmentCandidates,modeledEquipment,
  floors,physicallyEstablishedLevels,gaps,
  summary:`REPROCESS AUDIT: ${basemaps} retained source basemap elements; ${modeledRooms} modeled rooms / ${candidateRooms} boundary proposals; ${modeledEquipment} confirmed model-linked assets / ${equipmentCandidates} L4 candidates; ${physicallyEstablishedLevels} physical elevation levels / ${floors.length} floor labels.${gaps.length?' PARSER CAPABILITY GAP: '+gaps.join('; ')+'.':''}`};
}
