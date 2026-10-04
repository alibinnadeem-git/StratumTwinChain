import {transformSheetPoint,type SheetSimilarity} from './sheet-similarity.ts';

export type BoundaryPoint={x:number;y:number};
export type BoundaryEntity={
 id:string;
 x:number;
 y:number;
 x2?:number;
 y2?:number;
 vertices?:BoundaryPoint[];
 kind:string;
 meta?:Record<string,unknown>;
};

export type SourceBoundary={
 frameKey:string;
 planFrameId:string|null;
 points:BoundaryPoint[];
 hull:BoundaryPoint[];
 area:number;
};

export type BoundaryOverlapResult={
 referenceArea:number;
 movingArea:number;
 intersectionArea:number;
 overlapOfSmaller:number;
 iou:number;
 referenceVertexCount:number;
 movingVertexCount:number;
};

const EPS=1e-9;

function entityFrameKey(entity:BoundaryEntity){
 const sha=String(entity.meta?.sourceSha256||'').toLowerCase();
 const page=Number(entity.meta?.page||0);
 return sha&&Number.isInteger(page)&&page>0?`${sha}:${page}`:null;
}
function finitePoint(point:BoundaryPoint|null|undefined):point is BoundaryPoint{
 return Boolean(point&&Number.isFinite(point.x)&&Number.isFinite(point.y));
}
function key(point:BoundaryPoint){return `${point.x.toFixed(8)},${point.y.toFixed(8)}`}
function cross(o:BoundaryPoint,a:BoundaryPoint,b:BoundaryPoint){return(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x)}
function polygonArea(points:BoundaryPoint[]){
 if(points.length<3)return 0;
 let sum=0;
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length];
  sum+=a.x*b.y-b.x*a.y;
 }
 return Math.abs(sum)/2;
}
function signedArea(points:BoundaryPoint[]){
 if(points.length<3)return 0;
 let sum=0;
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length];
  sum+=a.x*b.y-b.x*a.y;
 }
 return sum/2;
}
function convexHull(points:BoundaryPoint[]){
 const unique=[...new Map(points.filter(finitePoint).map(point=>[key(point),point])).values()]
  .sort((a,b)=>a.x-b.x||a.y-b.y);
 if(unique.length<3)return unique;
 const lower:BoundaryPoint[]=[];
 for(const point of unique){
  while(lower.length>=2&&cross(lower[lower.length-2],lower[lower.length-1],point)<=EPS)lower.pop();
  lower.push(point);
 }
 const upper:BoundaryPoint[]=[];
 for(let i=unique.length-1;i>=0;i--){
  const point=unique[i];
  while(upper.length>=2&&cross(upper[upper.length-2],upper[upper.length-1],point)<=EPS)upper.pop();
  upper.push(point);
 }
 lower.pop();upper.pop();
 return[...lower,...upper];
}
function geometryPoints(entity:BoundaryEntity){
 const result:BoundaryPoint[]=[];
 if(Array.isArray(entity.vertices))result.push(...entity.vertices.filter(finitePoint));
 if(Number.isFinite(entity.x)&&Number.isFinite(entity.y))result.push({x:entity.x,y:entity.y});
 if(Number.isFinite(entity.x2)&&Number.isFinite(entity.y2))result.push({x:Number(entity.x2),y:Number(entity.y2)});
 if(entity.kind==='source-raster-underlay'&&Number.isFinite(entity.x2)&&Number.isFinite(entity.y2)){
  result.push({x:entity.x,y:Number(entity.y2)},{x:Number(entity.x2),y:entity.y});
 }
 return result;
}
function isBoundaryGeometry(entity:BoundaryEntity){
 return entity.meta?.drawingBasemap===true||
  entity.kind==='line'||
  entity.kind==='source-raster-underlay'||
  entity.kind==='room-boundary'||
  entity.kind==='vector-boundary-candidate';
}

export function buildSourceBoundary(entities:BoundaryEntity[],frameKey:string,preferredPlanFrameId?:string|null):SourceBoundary|null{
 const frameEntities=entities.filter(entity=>entityFrameKey(entity)===frameKey&&isBoundaryGeometry(entity));
 if(!frameEntities.length)return null;
 const scoped=preferredPlanFrameId
  ?frameEntities.filter(entity=>String(entity.meta?.planFrameId||'')===preferredPlanFrameId)
  :[];
 const selected=scoped.length>=2?scoped:frameEntities;
 const points=selected.flatMap(geometryPoints);
 const hull=convexHull(points);
 const area=polygonArea(hull);
 if(hull.length<3||area<=EPS)return null;
 return{frameKey,planFrameId:scoped.length>=2?preferredPlanFrameId||null:null,points,hull,area};
}

function lineIntersection(a:BoundaryPoint,b:BoundaryPoint,c:BoundaryPoint,d:BoundaryPoint){
 const r={x:b.x-a.x,y:b.y-a.y},s={x:d.x-c.x,y:d.y-c.y};
 const den=r.x*s.y-r.y*s.x;
 if(Math.abs(den)<EPS)return b;
 const t=((c.x-a.x)*s.y-(c.y-a.y)*s.x)/den;
 return{x:a.x+t*r.x,y:a.y+t*r.y};
}
function inside(point:BoundaryPoint,a:BoundaryPoint,b:BoundaryPoint){
 return cross(a,b,point)>=-1e-8;
}
function clipConvex(subject:BoundaryPoint[],clipper:BoundaryPoint[]){
 if(subject.length<3||clipper.length<3)return[];
 const clip=signedArea(clipper)>=0?clipper:[...clipper].reverse();
 let output=[...subject];
 for(let i=0;i<clip.length;i++){
  const a=clip[i],b=clip[(i+1)%clip.length],input=output;
  output=[];
  if(!input.length)break;
  let previous=input[input.length-1];
  for(const current of input){
   const currentInside=inside(current,a,b),previousInside=inside(previous,a,b);
   if(currentInside){
    if(!previousInside)output.push(lineIntersection(previous,current,a,b));
    output.push(current);
   }else if(previousInside)output.push(lineIntersection(previous,current,a,b));
   previous=current;
  }
 }
 return output;
}

export function transformBoundary(boundary:SourceBoundary,transform:SheetSimilarity):SourceBoundary{
 const hull=boundary.hull.map(point=>transformSheetPoint(point,transform));
 return{...boundary,hull,points:hull,area:polygonArea(hull)};
}

export function measureBoundaryOverlap(reference:SourceBoundary,moving:SourceBoundary,transform:SheetSimilarity):BoundaryOverlapResult|null{
 const transformed=transformBoundary(moving,transform);
 const referenceHull=signedArea(reference.hull)>=0?reference.hull:[...reference.hull].reverse();
 const movingHull=signedArea(transformed.hull)>=0?transformed.hull:[...transformed.hull].reverse();
 const intersection=clipConvex(movingHull,referenceHull);
 const intersectionArea=polygonArea(intersection);
 const referenceArea=polygonArea(referenceHull),movingArea=polygonArea(movingHull);
 if(referenceArea<=EPS||movingArea<=EPS)return null;
 const union=referenceArea+movingArea-intersectionArea;
 return{
  referenceArea,
  movingArea,
  intersectionArea,
  overlapOfSmaller:Math.max(0,Math.min(1,intersectionArea/Math.min(referenceArea,movingArea))),
  iou:union>EPS?Math.max(0,Math.min(1,intersectionArea/union)):0,
  referenceVertexCount:referenceHull.length,
  movingVertexCount:movingHull.length
 };
}
