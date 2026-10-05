export type RenderOriginEntity={
  id:string;
  layer?:string;
  x:number;
  y:number;
  x2?:number;
  y2?:number;
  vertices?:{x:number;y:number}[];
  meta?:Record<string,unknown>;
};

export type SpatialRenderOrigin={
  enabled:boolean;
  frameId:string|null;
  x:number;
  y:number;
  extentMeters:number|null;
  eligibleEntityCount:number;
  reason:string;
};

const text=(value:unknown)=>String(value??'').trim();
const finite=(value:unknown)=>{const n=Number(value);return Number.isFinite(n)?n:null};
const metricUnits=(value:unknown)=>{
  const unit=text(value).toLowerCase();
  return unit==='m'||unit==='m_reviewed_pdf'||unit==='m_xy'||unit==='m_dxf_design'||unit.startsWith('m_');
};

function horizontalFrame(entity:RenderOriginEntity){
  const meta=entity.meta||{};
  const project=text(meta.projectXYFrameId);
  if(project&&meta.projectXYFrameMetric===true)return project;
  const explicit=text(meta.xyCoordinateFrame);
  if(explicit&&metricUnits(meta.coordinateUnits))return explicit;
  const units=text(meta.coordinateUnits).toLowerCase();
  const source=text(meta.sourceSha256)||text((entity as any).source)||entity.id;
  if(units==='m_reviewed_pdf')return'PDF_REVIEW_METRIC:'+source+':'+String(meta.page||'?');
  if(units==='m_dxf_design')return'CAD_LOCAL_ENGINEERING:'+source;
  if(text(meta.ifcCoordinateFrame)==='LOCAL_ENGINEERING')return'IFC_LOCAL_ENGINEERING:'+source;
  if(metricUnits(units))return'METRIC_SOURCE_FRAME:'+source;
  return null;
}

function coordinateBearing(entity:RenderOriginEntity){
  if(entity.meta?.nonSpatial===true)return false;
  if(entity.layer==='L0')return false;
  return Number.isFinite(entity.x)&&Number.isFinite(entity.y);
}

function points(entity:RenderOriginEntity){
  const out:{x:number;y:number}[]=[];
  if(Number.isFinite(entity.x)&&Number.isFinite(entity.y))out.push({x:entity.x,y:entity.y});
  if(Number.isFinite(entity.x2)&&Number.isFinite(entity.y2))out.push({x:Number(entity.x2),y:Number(entity.y2)});
  if(Array.isArray(entity.vertices))for(const point of entity.vertices){
    const x=finite(point?.x),y=finite(point?.y);if(x!==null&&y!==null)out.push({x,y});
  }
  return out;
}

export function deriveSpatialRenderOrigin(
  entities:RenderOriginEntity[],
  options?:{absoluteThresholdMeters?:number}
):SpatialRenderOrigin{
  const threshold=options?.absoluteThresholdMeters??10000;
  const eligible=entities.filter(coordinateBearing);
  if(!eligible.length)return{enabled:false,frameId:null,x:0,y:0,extentMeters:null,eligibleEntityCount:0,reason:'NO_RENDER_GEOMETRY'};

  const framed=eligible.map(entity=>({entity,frame:horizontalFrame(entity)}));
  if(framed.some(item=>!item.frame)){
    return{enabled:false,frameId:null,x:0,y:0,extentMeters:null,eligibleEntityCount:eligible.length,reason:'MIXED_OR_NON_METRIC_RENDER_GEOMETRY'};
  }
  const frames=[...new Set(framed.map(item=>item.frame!))];
  if(frames.length!==1){
    return{enabled:false,frameId:null,x:0,y:0,extentMeters:null,eligibleEntityCount:eligible.length,reason:'MULTIPLE_UNREGISTERED_METRIC_FRAMES'};
  }

  const all=eligible.flatMap(points);
  if(!all.length)return{enabled:false,frameId:frames[0],x:0,y:0,extentMeters:null,eligibleEntityCount:eligible.length,reason:'NO_FINITE_RENDER_POINTS'};
  const minX=Math.min(...all.map(p=>p.x)),maxX=Math.max(...all.map(p=>p.x));
  const minY=Math.min(...all.map(p=>p.y)),maxY=Math.max(...all.map(p=>p.y));
  const centerX=(minX+maxX)/2,centerY=(minY+maxY)/2;
  const extent=Math.max(maxX-minX,maxY-minY);
  const far=Math.max(Math.abs(centerX),Math.abs(centerY),Math.abs(minX),Math.abs(maxX),Math.abs(minY),Math.abs(maxY));
  if(far<threshold){
    return{enabled:false,frameId:frames[0],x:0,y:0,extentMeters:extent,eligibleEntityCount:eligible.length,reason:'COORDINATES_ALREADY_RENDER_SAFE'};
  }

  return{
    enabled:true,frameId:frames[0],x:centerX,y:centerY,extentMeters:extent,
    eligibleEntityCount:eligible.length,reason:'LARGE_METRIC_COORDINATES_LOCALIZED_FOR_RENDER_ONLY'
  };
}

export function renderXY(x:number,y:number,origin:SpatialRenderOrigin){
  return origin.enabled?{x:x-origin.x,y:y-origin.y}:{x,y};
}
