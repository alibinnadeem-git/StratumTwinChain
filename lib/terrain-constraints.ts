import type {PositionedSheetText} from './title-block.ts';
import {buildElevationTriangles,type ElevationControlPoint,type ElevationSurfaceKind,type ElevationTriangle} from './elevation-surface.ts';

export type TerrainBreaklineSemantic='TOP_OF_CURB'|'FLOWLINE';
export type TerrainBreakline={
  id:string;
  source:string;
  page:number;
  semantic:TerrainBreaklineSemantic;
  x:number;
  y:number;
  x2:number;
  y2:number;
  zMeters:number;
  z2Meters:number;
  pointIds:[string,string];
  confidence:number;
  authority:'SOURCE_VECTOR_BETWEEN_TYPED_ELEVATION_CONTROLS';
  physicalTruth:false;
  reviewRequired:true;
};

export type TerrainSlopeFormat='PERCENT'|'RATIO'|'INCH_PER_FOOT';
export type TerrainSlopeEvidence={
  id:string;
  source:string;
  page:number;
  x:number;
  y:number;
  label:string;
  slopeFraction:number;
  format:TerrainSlopeFormat;
  directionKnown:false;
  propagationEligible:false;
  authority:'SOURCE_SLOPE_TEXT_DIRECTION_UNRESOLVED';
  physicalTruth:false;
  reviewRequired:true;
};

export type SlopeDerivedZResolution={
  status:'RESOLVED_REVIEW_CANDIDATE'|'UNRESOLVED';
  zMeters:number|null;
  horizontalDistanceMeters:number|null;
  deltaZMeters:number|null;
  authority:'SOURCE_ANCHORED_SLOPE_RELATION'|'UNRESOLVED';
  reason:string;
  physicalTruth:false;
  reviewRequired:true;
};

export type TerrainSourceSegment={x:number;y:number;x2:number;y2:number};

const clean=(value:string)=>value.replace(/\s+/g,' ').trim();
const dist=(ax:number,ay:number,bx:number,by:number)=>Math.hypot(ax-bx,ay-by);

function slopeFromLabel(label:string):{slopeFraction:number;format:TerrainSlopeFormat}|null{
  const t=clean(label).toUpperCase().replace(/[’]/g,"'").replace(/[”]/g,'"');
  if(!/\b(?:SLOPE|GRADE|RAMP|DRAIN|DRAINAGE)\b/.test(t))return null;

  const percent=t.match(/(?:\bSLOPE\b\s*[:=@-]?\s*)?([+-]?\d+(?:\.\d+)?)\s*%|([+-]?\d+(?:\.\d+)?)\s*%\s*(?:SLOPE|GRADE)/i);
  if(percent){
    const raw=Number(percent[1]??percent[2]);
    if(Number.isFinite(raw)&&raw!==0&&Math.abs(raw)<=100)return{slopeFraction:Math.abs(raw)/100,format:'PERCENT'};
  }

  const ratio=t.match(/\b1\s*[:/]\s*(\d+(?:\.\d+)?)\b/);
  if(ratio){
    const run=Number(ratio[1]);
    if(Number.isFinite(run)&&run>0)return{slopeFraction:1/run,format:'RATIO'};
  }

  const inchPerFoot=t.match(/([+-]?(?:\d+\s+)?(?:\d+\/\d+|\d+(?:\.\d+)?))\s*"\s*(?:\/|PER)\s*(?:1\s*)?(?:FT|FOOT|')\b/i);
  if(inchPerFoot){
    const raw=inchPerFoot[1].trim();
    let inches=0;
    for(const part of raw.split(/\s+/)){
      if(part.includes('/')){
        const [a,b]=part.split('/').map(Number);
        if(!Number.isFinite(a)||!Number.isFinite(b)||b===0)return null;
        inches+=a/b;
      }else{
        const n=Number(part);if(!Number.isFinite(n))return null;inches+=n;
      }
    }
    if(inches>0&&inches<=12)return{slopeFraction:inches/12,format:'INCH_PER_FOOT'};
  }
  return null;
}

export function extractPositionedTerrainSlopeEvidence(input:{
  items:PositionedSheetText[];
  source:string;
  page:number;
  planeWidth:number;
  planeHeight:number;
}):TerrainSlopeEvidence[]{
  const out:TerrainSlopeEvidence[]=[];
  let index=0;
  for(const item of input.items){
    const parsed=slopeFromLabel(item.text);
    if(!parsed)continue;
    out.push({
      id:`terrain-slope-${input.page}-${index++}`,
      source:input.source,page:input.page,
      x:(item.x-.5)*input.planeWidth,
      y:(.5-item.y)*input.planeHeight,
      label:clean(item.text),
      slopeFraction:parsed.slopeFraction,
      format:parsed.format,
      directionKnown:false,
      propagationEligible:false,
      authority:'SOURCE_SLOPE_TEXT_DIRECTION_UNRESOLVED',
      physicalTruth:false,
      reviewRequired:true
    });
  }
  return out;
}

function nearestTypedControl(
  controls:ElevationControlPoint[],
  semantic:TerrainBreaklineSemantic,
  x:number,y:number,
  maxDistance:number
){
  return controls
    .filter(point=>point.semantic===semantic)
    .map(point=>({point,distance:dist(point.x,point.y,x,y)}))
    .filter(item=>item.distance<=maxDistance)
    .sort((a,b)=>a.distance-b.distance)[0]||null;
}

export function associateTerrainBreaklines(input:{
  controls:ElevationControlPoint[];
  segments:TerrainSourceSegment[];
  source:string;
  page:number;
  maxEndpointDistance?:number;
}):TerrainBreakline[]{
  const maxDistance=input.maxEndpointDistance??.28;
  const out:TerrainBreakline[]=[];
  const seen=new Set<string>();
  for(const semantic of ['TOP_OF_CURB','FLOWLINE'] as TerrainBreaklineSemantic[]){
    for(const segment of input.segments){
      if(dist(segment.x,segment.y,segment.x2,segment.y2)<.05)continue;
      const a=nearestTypedControl(input.controls,semantic,segment.x,segment.y,maxDistance);
      const b=nearestTypedControl(input.controls,semantic,segment.x2,segment.y2,maxDistance);
      if(!a||!b||a.point.id===b.point.id)continue;
      const pair=[a.point.id,b.point.id].sort();
      const key=`${semantic}:${pair.join('|')}`;
      if(seen.has(key))continue;
      seen.add(key);
      out.push({
        id:`terrain-breakline-${input.page}-${semantic.toLowerCase()}-${out.length}`,
        source:input.source,page:input.page,semantic,
        x:segment.x,y:segment.y,x2:segment.x2,y2:segment.y2,
        zMeters:a.point.zMeters,z2Meters:b.point.zMeters,
        pointIds:[a.point.id,b.point.id],
        confidence:Math.max(0,Math.min(1,Math.min(a.point.confidence,b.point.confidence)*.9)),
        authority:'SOURCE_VECTOR_BETWEEN_TYPED_ELEVATION_CONTROLS',
        physicalTruth:false,
        reviewRequired:true
      });
    }
  }
  return out;
}

const orient=(ax:number,ay:number,bx:number,by:number,cx:number,cy:number)=>(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
function onSegment(ax:number,ay:number,bx:number,by:number,px:number,py:number){
  return Math.abs(orient(ax,ay,bx,by,px,py))<1e-8&&px>=Math.min(ax,bx)-1e-8&&px<=Math.max(ax,bx)+1e-8&&py>=Math.min(ay,by)-1e-8&&py<=Math.max(ay,by)+1e-8;
}
function segmentsIntersect(a:TerrainSourceSegment,b:TerrainSourceSegment){
  const o1=orient(a.x,a.y,a.x2,a.y2,b.x,b.y),o2=orient(a.x,a.y,a.x2,a.y2,b.x2,b.y2);
  const o3=orient(b.x,b.y,b.x2,b.y2,a.x,a.y),o4=orient(b.x,b.y,b.x2,b.y2,a.x2,a.y2);
  if(((o1>0&&o2<0)||(o1<0&&o2>0))&&((o3>0&&o4<0)||(o3<0&&o4>0)))return true;
  return onSegment(a.x,a.y,a.x2,a.y2,b.x,b.y)||onSegment(a.x,a.y,a.x2,a.y2,b.x2,b.y2)||onSegment(b.x,b.y,b.x2,b.y2,a.x,a.y)||onSegment(b.x,b.y,b.x2,b.y2,a.x2,a.y2);
}
function pointInTriangle(x:number,y:number,triangle:ElevationTriangle){
  const [a,b,c]=triangle.points;
  const d1=orient(x,y,a.x,a.y,b.x,b.y),d2=orient(x,y,b.x,b.y,c.x,c.y),d3=orient(x,y,c.x,c.y,a.x,a.y);
  const hasNeg=d1<0||d2<0||d3<0,hasPos=d1>0||d2>0||d3>0;
  return !(hasNeg&&hasPos);
}
function breaklineCutsTriangle(line:TerrainBreakline,triangle:ElevationTriangle){
  if(triangle.kind!=='GRADE')return false;
  if(pointInTriangle(line.x,line.y,triangle)||pointInTriangle(line.x2,line.y2,triangle))return true;
  const [a,b,c]=triangle.points;
  const edges=[
    {x:a.x,y:a.y,x2:b.x,y2:b.y},
    {x:b.x,y:b.y,x2:c.x,y2:c.y},
    {x:c.x,y:c.y,x2:a.x,y2:a.y}
  ];
  return edges.some(edge=>segmentsIntersect(line,edge));
}

export function constrainElevationTriangles(triangles:ElevationTriangle[],breaklines:TerrainBreakline[]){
  if(!breaklines.length)return triangles;
  return triangles.filter(triangle=>!breaklines.some(line=>breaklineCutsTriangle(line,triangle)));
}

export function buildConstrainedElevationTriangles(
  points:ElevationControlPoint[],
  kind:ElevationSurfaceKind,
  breaklines:TerrainBreakline[]
){
  return constrainElevationTriangles(buildElevationTriangles(points,kind),breaklines);
}

export function resolveSlopeDerivedZ(input:{
  anchor:{x:number;y:number;zMeters:number;authority:string};
  target:{x:number;y:number};
  slopeFraction:number;
  direction:'UPHILL'|'DOWNHILL'|null;
  directionAuthority:string|null;
  xyUnits:'m'|'m_reviewed_pdf'|'m_dxf_design'|'m_ifc_design'|string;
}):SlopeDerivedZResolution{
  const unresolved=(reason:string):SlopeDerivedZResolution=>({
    status:'UNRESOLVED',zMeters:null,horizontalDistanceMeters:null,deltaZMeters:null,
    authority:'UNRESOLVED',reason,physicalTruth:false,reviewRequired:true
  });
  if(!Number.isFinite(input.anchor.zMeters))return unresolved('A source-grounded anchor elevation is required before slope can propagate Z.');
  if(!Number.isFinite(input.slopeFraction)||input.slopeFraction<=0||input.slopeFraction>1)return unresolved('Slope magnitude is unresolved or outside the supported review range.');
  if(!input.direction||!input.directionAuthority)return unresolved('Slope magnitude alone does not establish uphill/downhill direction. STRATUM will not invent a direction.');
  if(!/^m(?:_|$)/i.test(String(input.xyUnits)))return unresolved('Slope propagation requires a metric XY frame; source-sheet coordinates are not enough.');
  const horizontalDistanceMeters=dist(input.anchor.x,input.anchor.y,input.target.x,input.target.y);
  if(!Number.isFinite(horizontalDistanceMeters))return unresolved('Horizontal run is unresolved.');
  const deltaZMeters=horizontalDistanceMeters*input.slopeFraction*(input.direction==='UPHILL'?1:-1);
  return{
    status:'RESOLVED_REVIEW_CANDIDATE',
    zMeters:input.anchor.zMeters+deltaZMeters,
    horizontalDistanceMeters,deltaZMeters,
    authority:'SOURCE_ANCHORED_SLOPE_RELATION',
    reason:`Resolved review-only Z from ${input.anchor.authority}, metric XY run, and source-grounded ${input.direction.toLowerCase()} slope direction (${input.directionAuthority}).`,
    physicalTruth:false,reviewRequired:true
  };
}
