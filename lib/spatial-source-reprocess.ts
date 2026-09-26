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
