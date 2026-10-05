export type Point={x:number;y:number};
export type SheetXYTransform={a:number;b:number;tx:number;ty:number};
export type SheetTransform=SheetXYTransform&{floor:string;elevation:number};
export type DrawingEntity={id:string;source:string;x:number;y:number;z?:number;x2?:number;y2?:number;z2?:number;vertices?:Point[];floor?:string;kind:string;name:string;meta?:Record<string,unknown>};
type MetaSnapshotEntry={present:boolean;value:unknown};
type MetaSnapshot=Record<string,MetaSnapshotEntry>;
const SHEET_Z_REVIEW_META_KEYS=[
 'coordinateUnits','elevationKnown','physicalElevationKnown','physicalTruth','reviewRequired',
 'zCandidateMeters','zCandidateReferencePoint','zResolutionStatus','zResolutionAuthority',
 'zResolutionCoordinateFrame','zPlacementAuthority','sheetElevationReviewRequired',
 'alignmentMethod','alignmentVerified'
] as const;
function captureMeta(meta:Record<string,unknown>,keys:readonly string[]):MetaSnapshot{
 const snapshot:MetaSnapshot={};
 for(const key of keys)snapshot[key]={present:Object.prototype.hasOwnProperty.call(meta,key),value:meta[key]};
 return snapshot;
}
function restoreMeta(meta:Record<string,unknown>,snapshot:MetaSnapshot|undefined,keys:readonly string[]){
 const next={...meta};
 for(const key of keys)delete next[key];
 if(snapshot)for(const key of keys){
  const item=snapshot[key];
  if(item?.present)next[key]=item.value;
 }
 return next;
}

export function solveSheetXYTransform(source:[Point,Point],target:[Point,Point]):SheetXYTransform{
 if(![...source,...target].every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)))throw new Error('Provide finite source and target control point coordinates.');
 const dx=source[1].x-source[0].x,dy=source[1].y-source[0].y,ux=target[1].x-target[0].x,uy=target[1].y-target[0].y,d=dx*dx+dy*dy;
 if(d<1e-12||ux*ux+uy*uy<1e-12)throw new Error('Each control point pair must contain two distinct points.');
 const a=(ux*dx+uy*dy)/d,b=(uy*dx-ux*dy)/d;
 return {a,b,tx:target[0].x-a*source[0].x+b*source[0].y,ty:target[0].y-b*source[0].x-a*source[0].y};
}
export function transformSheetXY(point:Point,t:SheetXYTransform):Point{
 return{x:t.a*point.x-t.b*point.y+t.tx,y:t.b*point.x+t.a*point.y+t.ty};
}
export function sheetXYValidationResidual(source:Point,target:Point,t:SheetXYTransform){
 const actual=transformSheetXY(source,t);
 return Math.hypot(actual.x-target.x,actual.y-target.y);
}
export function applySheetXYTransform<T extends DrawingEntity>(entity:T,t:SheetXYTransform,validation?:{residualMeters:number;toleranceMeters:number}):T{
 const original=(entity.meta?.sheetXYOriginal as Partial<DrawingEntity>|undefined)||{x:entity.x,y:entity.y,x2:entity.x2,y2:entity.y2,vertices:entity.vertices};
 const point=(p:Point)=>transformSheetXY(p,t);
 const end=original.x2!==undefined&&original.y2!==undefined?point({x:original.x2,y:original.y2}):undefined;
 const validated=Boolean(validation&&Number.isFinite(validation.residualMeters)&&validation.residualMeters<=validation.toleranceMeters);
 return {...entity,...point({x:Number(original.x),y:Number(original.y)}),...(end?{x2:end.x,y2:end.y}:{}),vertices:original.vertices?.map(point),meta:{...entity.meta,sheetXYOriginal:original,sheetXYTransform:t,coordinateUnits:'m_xy',planXYAuthority:validated?'HUMAN_VALIDATED_3_POINT_TRANSFORM':'HUMAN_CALIBRATED_2_POINT_TRANSFORM',planXYValidated:validated,planXYValidationResidualMeters:validation?.residualMeters??null,planXYValidationToleranceMeters:validation?.toleranceMeters??null,physicalPositionVerified:false}};
}
export function restoreSheetXYCoordinates<T extends DrawingEntity>(entity:T):T{
 const original=entity.meta?.sheetXYOriginal as Partial<DrawingEntity>|undefined;
 if(!original)return entity;
 const {sheetXYOriginal,sheetXYTransform,planXYAuthority,planXYValidated,planXYValidationResidualMeters,planXYValidationToleranceMeters,physicalPositionVerified,...meta}=entity.meta||{};
 return {...entity,...original,meta:{...meta,coordinateUnits:'sheet'}};
}

export function solveSheetTransform(source:[Point,Point],target:[Point,Point],floor:string,elevation:number):SheetTransform{
 if(!floor.trim()||floor==='UNRESOLVED'||![...source,...target].every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))||!Number.isFinite(elevation))throw new Error('Provide a floor, elevation and finite control point coordinates.');
 const xy=solveSheetXYTransform(source,target);
 return {...xy,floor:floor.trim(),elevation};
}
export function applySheetTransform<T extends DrawingEntity>(entity:T,t:SheetTransform):T{
 const currentMeta={...(entity.meta||{})};
 const base=(currentMeta.sheetOriginal as DrawingEntity|undefined)||{x:entity.x,y:entity.y,z:entity.z,x2:entity.x2,y2:entity.y2,z2:entity.z2,vertices:entity.vertices,floor:entity.floor};
 const originalMeta=(currentMeta.sheetZReviewOriginalMeta as MetaSnapshot|undefined)||captureMeta(currentMeta,SHEET_Z_REVIEW_META_KEYS);
 const point=(p:Point):Point=>({x:t.a*p.x-t.b*p.y+t.tx,y:t.b*p.x+t.a*p.y+t.ty});
 const end=base.x2!==undefined&&base.y2!==undefined?point({x:base.x2,y:base.y2}):undefined;
 return {...entity,...point(base),z:t.elevation,...(end?{x2:end.x,y2:end.y,z2:t.elevation}:{}),vertices:base.vertices?.map(point),floor:t.floor,meta:{
  ...currentMeta,
  sheetOriginal:base,
  sheetTransform:t,
  sheetZReviewOriginalMeta:originalMeta,
  coordinateUnits:'m',
  elevationKnown:false,
  physicalElevationKnown:false,
  physicalTruth:false,
  reviewRequired:true,
  zCandidateMeters:t.elevation,
  zCandidateReferencePoint:'PROJECT_DATUM',
  zResolutionStatus:'RESOLVED_DESIGN_CANDIDATE',
  zResolutionAuthority:'HUMAN_REVIEWED_SHEET_ELEVATION',
  zResolutionCoordinateFrame:'PROJECT_REVIEW_DATUM',
  zPlacementAuthority:'HUMAN_REVIEWED_SHEET_ELEVATION',
  sheetElevationReviewRequired:true,
  alignmentMethod:'reviewed-two-control-points',
  alignmentVerified:false
 }};
}
export function restoreSheetCoordinates<T extends DrawingEntity>(entity:T):T{
 const original=entity.meta?.sheetOriginal as Partial<DrawingEntity>|undefined;
 if(!original)return entity;
 const currentMeta={...(entity.meta||{})};
 const snapshot=currentMeta.sheetZReviewOriginalMeta as MetaSnapshot|undefined;
 delete currentMeta.sheetOriginal;delete currentMeta.sheetTransform;delete currentMeta.sheetZReviewOriginalMeta;
 const meta=restoreMeta(currentMeta,snapshot,SHEET_Z_REVIEW_META_KEYS);
 return {...entity,...original,meta};
}
