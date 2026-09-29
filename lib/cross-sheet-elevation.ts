export type CrossSheetEntity={
  id:string;
  source?:string;
  layer?:string;
  kind:string;
  name?:string;
  x:number;
  y:number;
  z?:number;
  floor?:string;
  vertices?:{x:number;y:number}[];
  confidence?:number;
  meta?:Record<string,unknown>;
};

export type CrossSheetAlignmentContext={
  candidateId:string;
  referenceKey:string;
  movingKey:string;
  confidence:number;
};

type TriangleSurface={
  entityId:string;
  frameKey:string;
  kind:'GRADE'|'FINISHED_FLOOR';
  vertices:[{x:number;y:number},{x:number;y:number},{x:number;y:number}];
  z:[number,number,number];
  confidence:number;
};

function frameKey(entity:CrossSheetEntity){
  const sha=String(entity.meta?.sourceSha256||'').toLowerCase(),page=Number(entity.meta?.page||0);
  return sha&&Number.isInteger(page)&&page>0?`${sha}:${page}`:null;
}
function finite(value:unknown){const n=Number(value);return Number.isFinite(n)?n:null}
function physicalZKnown(entity:CrossSheetEntity){
  return entity.meta?.physicalElevationKnown===true||entity.meta?.elevationKnown===true;
}
function triangleSurface(entity:CrossSheetEntity):TriangleSurface|null{
  if(entity.kind!=='elevation-review-surface-triangle'||!Array.isArray(entity.vertices)||entity.vertices.length!==3)return null;
  const frame=frameKey(entity),meta=entity.meta?.elevationTriangle as Record<string,unknown>|undefined;
  const z=Array.isArray(meta?.zMeters)?meta!.zMeters.map(finite):[];
  const rawKind=String(meta?.kind||entity.meta?.localReviewSurfaceKind||'').toUpperCase();
  const kind=rawKind==='GRADE'?'GRADE':rawKind==='FINISHED_FLOOR'?'FINISHED_FLOOR':null;
  if(!frame||!kind||z.length!==3||z.some(value=>value===null))return null;
  return{
    entityId:entity.id,frameKey:frame,kind,
    vertices:[entity.vertices[0],entity.vertices[1],entity.vertices[2]],
    z:[z[0]!,z[1]!,z[2]!],
    confidence:Number.isFinite(Number(entity.confidence))?Number(entity.confidence):0
  };
}
function barycentric(x:number,y:number,t:TriangleSurface){
  const [a,b,c]=t.vertices,den=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
  if(Math.abs(den)<1e-9)return null;
  const w1=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/den;
  const w2=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/den,w3=1-w1-w2;
  if(w1<-.0001||w2<-.0001||w3<-.0001)return null;
  return{z:w1*t.z[0]+w2*t.z[1]+w3*t.z[2],weights:[w1,w2,w3] as [number,number,number]};
}
function preferredKind(entity:CrossSheetEntity):'GRADE'|'FINISHED_FLOOR'{
  const floor=String(entity.floor||'').toUpperCase();
  return floor&&floor!=='UNRESOLVED'?'FINISHED_FLOOR':'GRADE';
}
function clearKeys(meta:Record<string,unknown>){
  const next={...meta};
  for(const key of [
    'crossSheetReviewSurfaceZ','crossSheetReviewSurfaceKind','crossSheetReviewSurfaceAuthority',
    'crossSheetReviewSurfaceConfidence','crossSheetReviewSurfaceCandidateId','crossSheetReviewSurfaceTriangleId',
    'crossSheetReviewSurfaceSourceFrame','crossSheetReviewSurfaceTargetFrame'
  ])delete next[key];
  return next;
}

export function clearCrossSheetElevationForAlignment<T extends CrossSheetEntity>(entities:T[],candidateId:string):T[]{
  return entities.map(entity=>{
    if(entity.meta?.crossSheetReviewSurfaceCandidateId!==candidateId)return entity;
    return{...entity,meta:clearKeys(entity.meta||{})};
  });
}

export function enrichCrossSheetElevationSurfaces<T extends CrossSheetEntity>(
  entities:T[],
  alignment:CrossSheetAlignmentContext
):T[]{
  const allowedFrames=new Set([alignment.referenceKey,alignment.movingKey]);
  const surfaces=entities.map(triangleSurface).filter((surface):surface is TriangleSurface=>Boolean(surface&&allowedFrames.has(surface.frameKey)));
  if(!surfaces.length)return entities;

  return entities.map(entity=>{
    const targetFrame=frameKey(entity);
    if(!targetFrame||!allowedFrames.has(targetFrame))return entity;
    if(entity.kind==='elevation-review-surface-triangle'||entity.kind==='elevation-control-point'||entity.meta?.nonSpatial===true)return entity;
    if(physicalZKnown(entity)||Number.isFinite(Number(entity.meta?.zCandidateMeters))||Number.isFinite(Number(entity.meta?.localReviewSurfaceZ)))return entity;

    const sourceFrame=targetFrame===alignment.referenceKey?alignment.movingKey:alignment.referenceKey;
    const sourceSurfaces=surfaces.filter(surface=>surface.frameKey===sourceFrame);
    if(!sourceSurfaces.length)return entity;
    const preferred=preferredKind(entity);
    const ordered=[...sourceSurfaces.filter(surface=>surface.kind===preferred),...sourceSurfaces.filter(surface=>surface.kind!==preferred)];
    const matches=ordered.map(surface=>({surface,resolution:barycentric(entity.x,entity.y,surface)})).filter(item=>item.resolution);
    if(!matches.length)return entity;
    const best=matches[0],confidence=Math.min(Math.max(0,alignment.confidence),Math.max(0,best.surface.confidence));
    return{
      ...entity,
      meta:{
        ...(entity.meta||{}),
        crossSheetReviewSurfaceZ:best.resolution!.z,
        crossSheetReviewSurfaceKind:best.surface.kind,
        crossSheetReviewSurfaceAuthority:'HUMAN_CONFIRMED_ALIGNMENT_PLUS_SOURCE_ELEVATION_TRIANGLE',
        crossSheetReviewSurfaceConfidence:confidence,
        crossSheetReviewSurfaceCandidateId:alignment.candidateId,
        crossSheetReviewSurfaceTriangleId:best.surface.entityId,
        crossSheetReviewSurfaceSourceFrame:sourceFrame,
        crossSheetReviewSurfaceTargetFrame:targetFrame,
        physicalTruth:false,
        physicalElevationKnown:false,
        reviewRequired:true
      }
    };
  });
}
