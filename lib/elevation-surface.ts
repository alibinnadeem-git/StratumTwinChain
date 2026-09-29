import type {PositionedSheetText} from './title-block.ts';
import type {IndependentScaleValidation} from './scale-validation.ts';

export type ElevationUnit='ft'|'m';
export type ElevationSurfaceKind='GRADE'|'FINISHED_FLOOR';
export type ElevationControlSemantic='FINISHED_GRADE'|'FINISHED_SURFACE'|'TOP_OF_CURB'|'FLOWLINE'|'FINISHED_FLOOR';
export type ElevationControlPoint={
  id:string;
  source:string;
  page:number;
  x:number;
  y:number;
  zMeters:number;
  label:string;
  kind:ElevationSurfaceKind;
  semantic:ElevationControlSemantic;
  triangulationEligible:boolean;
  confidence:number;
  unit:ElevationUnit;
  unitAuthority:'EXPLICIT_LABEL'|'DRAWING_SCALE_CONVENTION';
  physicalTruth:false;
  reviewRequired:true;
};
export type ElevationTriangle={
  id:string;
  pointIds:[string,string,string];
  points:[ElevationControlPoint,ElevationControlPoint,ElevationControlPoint];
  kind:ElevationSurfaceKind;
  confidence:number;
};
export type LocalSurfaceResolution={
  status:'RESOLVED_REVIEW_SURFACE'|'OUTSIDE_CONTROL_ENVELOPE'|'INSUFFICIENT_CONTROLS';
  zMeters:number|null;
  confidence:number;
  kind:ElevationSurfaceKind|null;
  triangleId:string|null;
  controlPointIds:string[];
  authority:'SOURCE_ELEVATION_TRIANGLE'|'UNRESOLVED';
  physicalTruth:false;
  reviewRequired:true;
};

const FT=.3048;
const clean=(s:string)=>s.replace(/\s+/g,' ').trim().replace(/[()]/g,'');
function unitFromScale(declaredScale:string|null|undefined,validation?:IndependentScaleValidation|null):ElevationUnit|null{
  const s=String(declaredScale||'').toUpperCase();
  if(/'|FEET|\bFT\b/.test(s))return'ft';
  for(const w of validation?.witnesses||[]){
    const label=String(w.label||'').toUpperCase();
    if(/FEET|\bFT\b|'/.test(label))return'ft';
    if(/METERS?|METRES?|\bM\b/.test(label))return'm';
  }
  return null;
}
function surfaceControlSemantic(label:string):{kind:ElevationSurfaceKind;semantic:ElevationControlSemantic;triangulationEligible:boolean}|null{
  const t=clean(label).toUpperCase();
  if(/\b(?:FFE|FF)\b|FINISH(?:ED)?\s+FLOOR/.test(t))return{kind:'FINISHED_FLOOR',semantic:'FINISHED_FLOOR',triangulationEligible:true};
  if(/\bFG\b|FG$|\bGRADE\b/.test(t))return{kind:'GRADE',semantic:'FINISHED_GRADE',triangulationEligible:true};
  if(/\bFS\b|FS$|FINISH(?:ED)?\s+SURFACE/.test(t))return{kind:'GRADE',semantic:'FINISHED_SURFACE',triangulationEligible:true};
  if(/\bTC\b|TC$|TOP\s+OF\s+CURB/.test(t))return{kind:'GRADE',semantic:'TOP_OF_CURB',triangulationEligible:false};
  if(/\bFL\b|FL$|FLOW\s*LINE/.test(t))return{kind:'GRADE',semantic:'FLOWLINE',triangulationEligible:false};
  return null;
}
function parseExplicit(label:string){
  const t=clean(label).toUpperCase(),control=surfaceControlSemantic(t);
  if(!control)return null;
  const feetInches=t.match(/(?:FG|FFE|FF|FS|TC|FL|GRADE|FINISH(?:ED)?\s+(?:FLOOR|SURFACE)|TOP\s+OF\s+CURB|FLOW\s*LINE)(?:\s+(?:EL|ELEV|ELEVATION)\.?)?\s*[:=@-]?\s*([+-]?\d{1,3})\s*'\s*(\d{1,2}(?:\.\d+)?)?\s*"?/i);
  if(feetInches){
    const feet=Number(feetInches[1]),inches=Number(feetInches[2]||0);
    if(Number.isFinite(feet)&&Number.isFinite(inches)&&inches<12)return{value:feet+Math.sign(feet||1)*inches/12,unit:'ft' as ElevationUnit,...control};
  }
  const prefix=t.match(/(?:FG|FFE|FF|FS|TC|FL|GRADE|FINISH(?:ED)?\s+(?:FLOOR|SURFACE)|TOP\s+OF\s+CURB|FLOW\s*LINE)(?:\s+(?:EL|ELEV|ELEVATION)\.?)?\s*[:=@-]?\s*([+-]?\d{1,4}(?:\.\d+)?)\s*(FT|FEET|M|METERS?|METRES?)\b/i);
  const suffix=t.match(/\b([+-]?\d{1,4}(?:\.\d+)?)\s*(FT|FEET|M|METERS?|METRES?)\s*(FG|FFE|FF|TC|FL|GRADE)\b/i);
  const match=prefix||suffix;if(!match)return null;
  const raw=Number(match[1]),unit=String(match[2]).toUpperCase();
  if(!Number.isFinite(raw))return null;
  return{value:raw,unit:(unit==='FT'||unit==='FEET'?'ft':'m') as ElevationUnit,...control};
}
function parseUnitless(label:string,unitHint:ElevationUnit|null){
  if(!unitHint)return null;
  const t=clean(label).toUpperCase(),control=surfaceControlSemantic(t);
  if(!control)return null;
  const m=t.match(/([+-]?\d{1,4}(?:\.\d+)?)/);if(!m)return null;
  const value=Number(m[1]);if(!Number.isFinite(value))return null;
  return{value,unit:unitHint,...control};
}
export function extractPositionedElevationControls(input:{
  items:PositionedSheetText[];
  source:string;
  page:number;
  declaredScale?:string|null;
  scaleValidation?:IndependentScaleValidation|null;
  planeWidth:number;
  planeHeight:number;
}):ElevationControlPoint[]{
  const hint=unitFromScale(input.declaredScale,input.scaleValidation);
  const out:ElevationControlPoint[]=[];
  let index=0;
  for(const item of input.items){
    const label=clean(item.text);if(!label)continue;
    const explicit=parseExplicit(label);
    const unitless=explicit?null:parseUnitless(label,hint);
    if(!explicit&&!unitless)continue;
    const unit=explicit?.unit||unitless!.unit;
    const value=explicit?.value??unitless!.value;
    const zMeters=value*(unit==='ft'?FT:1);
    if(!Number.isFinite(zMeters))continue;
    const kind=explicit?.kind||unitless!.kind;
    const semantic=explicit?.semantic||unitless!.semantic;
    const triangulationEligible=explicit?.triangulationEligible??unitless!.triangulationEligible;
    out.push({
      id:`elev-${input.page}-${index++}`,
      source:input.source,page:input.page,
      x:(item.x-.5)*input.planeWidth,
      y:(.5-item.y)*input.planeHeight,
      zMeters,label,kind,semantic,triangulationEligible,
      confidence:explicit?.unit?0.93:0.74,
      unit,
      unitAuthority:explicit?.unit?'EXPLICIT_LABEL':'DRAWING_SCALE_CONVENTION',
      physicalTruth:false,reviewRequired:true
    });
  }
  const deduped:ElevationControlPoint[]=[];
  for(const point of out){
    if(deduped.some(p=>p.kind===point.kind&&Math.hypot(p.x-point.x,p.y-point.y)<.03&&Math.abs(p.zMeters-point.zMeters)<.015))continue;
    deduped.push(point);
  }
  return deduped;
}

type P={x:number;y:number;id:string};
type Tri={a:P;b:P;c:P};
function orient(a:P,b:P,c:P){return(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)}
function circumcircle(t:Tri){
  const {a,b,c}=t,d=2*(a.x*(b.y-c.y)+b.x*(c.y-a.y)+c.x*(a.y-b.y));
  if(Math.abs(d)<1e-9)return null;
  const aa=a.x*a.x+a.y*a.y,bb=b.x*b.x+b.y*b.y,cc=c.x*c.x+c.y*c.y;
  const ux=(aa*(b.y-c.y)+bb*(c.y-a.y)+cc*(a.y-b.y))/d;
  const uy=(aa*(c.x-b.x)+bb*(a.x-c.x)+cc*(b.x-a.x))/d;
  return{x:ux,y:uy,r2:(ux-a.x)**2+(uy-a.y)**2};
}
function edgeKey(a:P,b:P){return[a.id,b.id].sort().join('|')}
export function buildElevationTriangles(points:ElevationControlPoint[],kind?:ElevationSurfaceKind):ElevationTriangle[]{
  const source=(kind?points.filter(p=>p.kind===kind):points).filter(p=>p.triangulationEligible);
  if(source.length<3)return[];
  const minX=Math.min(...source.map(p=>p.x)),maxX=Math.max(...source.map(p=>p.x)),minY=Math.min(...source.map(p=>p.y)),maxY=Math.max(...source.map(p=>p.y));
  const span=Math.max(maxX-minX,maxY-minY,1),cx=(minX+maxX)/2,cy=(minY+maxY)/2;
  const s1:P={x:cx-20*span,y:cy-10*span,id:'__s1'},s2:P={x:cx,y:cy+20*span,id:'__s2'},s3:P={x:cx+20*span,y:cy-10*span,id:'__s3'};
  let tris:Tri[]=[{a:s1,b:s2,c:s3}];
  for(const point of source){
    const p:P={x:point.x,y:point.y,id:point.id};
    const bad=tris.filter(t=>{const cc=circumcircle(t);return cc&&((p.x-cc.x)**2+(p.y-cc.y)**2)<=cc.r2+1e-9});
    const edgeCount=new Map<string,{a:P;b:P;count:number}>();
    for(const t of bad)for(const [a,b] of [[t.a,t.b],[t.b,t.c],[t.c,t.a]] as [P,P][]){
      const key=edgeKey(a,b),prior=edgeCount.get(key);edgeCount.set(key,prior?{...prior,count:prior.count+1}:{a,b,count:1});
    }
    tris=tris.filter(t=>!bad.includes(t));
    for(const edge of edgeCount.values())if(edge.count===1&&Math.abs(orient(edge.a,edge.b,p))>1e-8)tris.push({a:edge.a,b:edge.b,c:p});
  }
  const byId=new Map(source.map(p=>[p.id,p]));
  return tris
    .filter(t=>![t.a.id,t.b.id,t.c.id].some(id=>id.startsWith('__')))
    .map((t,i)=>{
      const pts=[byId.get(t.a.id)!,byId.get(t.b.id)!,byId.get(t.c.id)!] as [ElevationControlPoint,ElevationControlPoint,ElevationControlPoint];
      return{id:`tri-${pts[0].page}-${kind||pts[0].kind}-${i}`,pointIds:[pts[0].id,pts[1].id,pts[2].id],points:pts,kind:kind||pts[0].kind,confidence:Math.min(...pts.map(p=>p.confidence))};
    });
}
function barycentric(x:number,y:number,t:ElevationTriangle){
  const [a,b,c]=t.points,den=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
  if(Math.abs(den)<1e-9)return null;
  const w1=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/den;
  const w2=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/den,w3=1-w1-w2;
  if(w1<-.0001||w2<-.0001||w3<-.0001)return null;
  return{w1,w2,w3,z:w1*a.zMeters+w2*b.zMeters+w3*c.zMeters};
}
export function resolveLocalElevationSurface(input:{x:number;y:number;points:ElevationControlPoint[];triangles?:ElevationTriangle[];kind?:ElevationSurfaceKind}):LocalSurfaceResolution{
  const candidates=(input.kind?input.points.filter(p=>p.kind===input.kind):input.points).filter(p=>p.triangulationEligible);
  if(candidates.length<3)return{status:'INSUFFICIENT_CONTROLS',zMeters:null,confidence:0,kind:input.kind||null,triangleId:null,controlPointIds:[],authority:'UNRESOLVED',physicalTruth:false,reviewRequired:true};
  const triangles=input.triangles||buildElevationTriangles(candidates,input.kind);
  const containing=triangles.map(t=>({t,b:barycentric(input.x,input.y,t)})).filter(x=>x.b).sort((a,b)=>{
    const da=Math.max(...a.t.points.map(p=>Math.hypot(input.x-p.x,input.y-p.y)));
    const db=Math.max(...b.t.points.map(p=>Math.hypot(input.x-p.x,input.y-p.y)));return da-db;
  })[0];
  if(!containing)return{status:'OUTSIDE_CONTROL_ENVELOPE',zMeters:null,confidence:0,kind:input.kind||null,triangleId:null,controlPointIds:[],authority:'UNRESOLVED',physicalTruth:false,reviewRequired:true};
  return{status:'RESOLVED_REVIEW_SURFACE',zMeters:containing.b!.z,confidence:containing.t.confidence,kind:containing.t.kind,triangleId:containing.t.id,controlPointIds:containing.t.pointIds,authority:'SOURCE_ELEVATION_TRIANGLE',physicalTruth:false,reviewRequired:true};
}
