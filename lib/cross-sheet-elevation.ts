type Point={x:number;y:number};
export type CrossSheetEntity={
 id:string;source:string;kind:string;x:number;y:number;x2?:number;y2?:number;vertices?:Point[];confidence:number;meta?:Record<string,unknown>;
};
export type CrossSheetSurfaceResolution={
 zMeters:number;
 kind:string;
 confidence:number;
 triangleId:string;
 triangleEntityId:string;
 source:string;
 sourceFrameKey:string;
 targetFrameGroup:string;
 authority:'ALIGNED_SOURCE_ELEVATION_TRIANGLE';
 physicalTruth:false;
 reviewRequired:true;
};

function frameKey(entity:CrossSheetEntity){
 const sha=String(entity.meta?.sourceSha256||'').toLowerCase(),page=Number(entity.meta?.page||0);
 return sha&&Number.isInteger(page)&&page>0?`${sha}:${page}`:null;
}
function autoReferenceKey(entity:CrossSheetEntity){
 const id=String(entity.meta?.autoSheetAlignmentCandidateId||'');
 const split=id.indexOf('->');return split>0?id.slice(0,split):null;
}
function validatedManual(entity:CrossSheetEntity){
 return entity.meta?.planXYValidated===true&&String(entity.meta?.coordinateUnits||'')==='m_xy';
}
function triangleData(entity:CrossSheetEntity){
 if(entity.kind!=='elevation-review-surface-triangle'||!Array.isArray(entity.vertices)||entity.vertices.length!==3)return null;
 const raw=entity.meta?.elevationTriangle as {id?:unknown;kind?:unknown;zMeters?:unknown}|undefined;
 const zs=Array.isArray(raw?.zMeters)?raw!.zMeters.map(Number):[];
 if(zs.length!==3||zs.some(z=>!Number.isFinite(z)))return null;
 return{id:String(raw?.id||entity.id),kind:String(raw?.kind||'GRADE'),vertices:entity.vertices as [Point,Point,Point],zs:zs as [number,number,number]};
}
function barycentric(x:number,y:number,vertices:[Point,Point,Point]){
 const [a,b,c]=vertices,den=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
 if(Math.abs(den)<1e-9)return null;
 const w1=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/den;
 const w2=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/den,w3=1-w1-w2;
 if(w1<-.0001||w2<-.0001||w3<-.0001)return null;
 return{w1,w2,w3};
}
function stripCrossSheet(meta:Record<string,unknown>|undefined){
 const next={...(meta||{})};
 for(const key of Object.keys(next))if(key.startsWith('crossSheetReviewSurface'))delete next[key];
 return next;
}
function autoGroups(entities:CrossSheetEntity[]){
 const refs=new Set<string>();
 for(const entity of entities){const ref=autoReferenceKey(entity);if(ref)refs.add(ref)}
 return refs;
}
function frameGroup(entity:CrossSheetEntity,autoRefs:Set<string>){
 const key=frameKey(entity);if(!key)return null;
 if(validatedManual(entity))return'MODEL_XY_METERS';
 const ref=autoReferenceKey(entity);if(ref)return`AUTO_REFERENCE:${ref}`;
 if(autoRefs.has(key))return`AUTO_REFERENCE:${key}`;
 return null;
}

export function enrichCrossSheetElevationSurfaces<T extends CrossSheetEntity>(entities:T[]):T[]{
 const autoRefs=autoGroups(entities);
 const surfaces=entities.flatMap(entity=>{
  const tri=triangleData(entity),group=frameGroup(entity,autoRefs),sourceFrameKey=frameKey(entity);
  return tri&&group&&sourceFrameKey?[{entity,tri,group,sourceFrameKey}]:[];
 });
 return entities.map(original=>{
  const meta=stripCrossSheet(original.meta),entity={...original,meta} as T;
  if(entity.kind==='elevation-control-point'||entity.kind==='elevation-review-surface-triangle'||meta.nonSpatial===true)return entity;
  if(Number.isFinite(Number(meta.localReviewSurfaceZ)))return entity;
  const targetGroup=frameGroup(entity,autoRefs),targetFrame=frameKey(entity);if(!targetGroup||!targetFrame)return entity;
  const matches=surfaces.flatMap(surface=>{
   if(surface.group!==targetGroup||surface.sourceFrameKey===targetFrame)return[];
   const b=barycentric(entity.x,entity.y,surface.tri.vertices);if(!b)return[];
   const z=b.w1*surface.tri.zs[0]+b.w2*surface.tri.zs[1]+b.w3*surface.tri.zs[2];
   const maxDistance=Math.max(...surface.tri.vertices.map(p=>Math.hypot(entity.x-p.x,entity.y-p.y)));
   return[{surface,z,maxDistance}];
  }).sort((a,b)=>a.maxDistance-b.maxDistance||b.surface.entity.confidence-a.surface.entity.confidence);
  const best=matches[0];if(!best)return entity;
  const resolution:CrossSheetSurfaceResolution={
   zMeters:best.z,kind:best.surface.tri.kind,confidence:best.surface.entity.confidence,
   triangleId:best.surface.tri.id,triangleEntityId:best.surface.entity.id,source:best.surface.entity.source,
   sourceFrameKey:best.surface.sourceFrameKey,targetFrameGroup:targetGroup,
   authority:'ALIGNED_SOURCE_ELEVATION_TRIANGLE',physicalTruth:false,reviewRequired:true
  };
  return{...entity,meta:{...meta,
   crossSheetReviewSurfaceZ:resolution.zMeters,
   crossSheetReviewSurfaceKind:resolution.kind,
   crossSheetReviewSurfaceAuthority:resolution.authority,
   crossSheetReviewSurfaceConfidence:resolution.confidence,
   crossSheetReviewSurfaceTriangleId:resolution.triangleId,
   crossSheetReviewSurfaceTriangleEntityId:resolution.triangleEntityId,
   crossSheetReviewSurfaceSource:resolution.source,
   crossSheetReviewSurfaceSourceFrameKey:resolution.sourceFrameKey,
   crossSheetReviewSurfaceFrameGroup:resolution.targetFrameGroup,
   physicalTruth:false,reviewRequired:true
  }};
 });
}
