export type SpatialUiEntityLike={
  id?:string;
  layer?:string;
  kind?:string;
  floor?:string;
  meta?:Record<string,unknown>;
};

const NON_OBJECT_KINDS=new Set([
  'line','wall-segment','source-raster-underlay','sld-feeder-candidate',
  'elevation-control-point','elevation-review-surface-triangle','plan-frame-candidate'
]);

export function isSpatialRecord(entity:SpatialUiEntityLike){
  return entity.meta?.nonSpatial!==true;
}

export function isIdentifiedProjectEquipment(entity:SpatialUiEntityLike){
  return isSpatialRecord(entity)&&
    (entity.layer==='L2'||entity.layer==='L4')&&
    entity.meta?.referenceOnly!==true&&
    entity.meta?.cadPhysicalAnchor!==false&&
    String(entity.kind||'')!=='cad-text'&&
    !NON_OBJECT_KINDS.has(String(entity.kind||''));
}

export function isSourceGeometry(entity:SpatialUiEntityLike){
  return isSpatialRecord(entity)&&[
    'line','wall-segment','source-raster-underlay','room-boundary','room-label','vector-boundary-candidate'
  ].includes(String(entity.kind||''));
}

export function isActionableReviewEntity(entity:SpatialUiEntityLike){
  if(!isSpatialRecord(entity))return false;
  const kind=String(entity.kind||'');
  if(['line','wall-segment','source-raster-underlay','elevation-review-surface-triangle','plan-frame-candidate'].includes(kind))return false;
  if(entity.meta?.zReviewRequired===true)return true;
  if((entity.layer==='L2'||entity.layer==='L4')&&entity.meta?.physicalElevationKnown!==true&&entity.meta?.elevationKnown!==true)return true;
  if(entity.floor==='UNRESOLVED'&&entity.layer==='L2')return true;
  if(/candidate/i.test(kind))return true;
  return entity.meta?.reviewRequired===true&&['L2','L4'].includes(String(entity.layer||''));
}

export function spatialUiCounts(entities:SpatialUiEntityLike[]){
  const spatial=entities.filter(isSpatialRecord);
  const drawingLines=spatial.filter(entity=>entity.kind==='line').length;
  const identifiedEquipment=spatial.filter(isIdentifiedProjectEquipment).length;
  const reviewObjects=spatial.filter(entity=>!NON_OBJECT_KINDS.has(String(entity.kind||''))).length;
  const actionableReview=spatial.filter(isActionableReviewEntity).length;
  return{
    totalEntities:entities.length,
    spatialRecords:spatial.length,
    drawingLines,
    identifiedEquipment,
    reviewObjects,
    actionableReview,
  };
}
