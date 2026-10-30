import {declaredScaleMetersPerNormalizedSheetUnit,type PositionedSheetText} from './title-block.ts';

export type ScaleValidationStatus='CORROBORATED'|'REVIEW'|'MISMATCH'|'UNRESOLVED';
export type ScaleWitnessType='DIMENSION_STRING'|'GRAPHIC_SCALE';

export type ScaleSegment={x:number;y:number;x2:number;y2:number};
export type ScaleValidationWitness={
  type:ScaleWitnessType;
  label:string;
  observedMeters:number;
  sheetDistance:number;
  metersPerNormalizedSheetUnit:number;
  deviationFactor:number|null;
  confidence:number;
  evidence:string[];
};

export type IndependentScaleValidation={
  status:ScaleValidationStatus;
  declaredMetersPerNormalizedSheetUnit:number|null;
  corroboratedMetersPerNormalizedSheetUnit:number|null;
  confidence:number;
  witnesses:ScaleValidationWitness[];
  automationEligible:boolean;
  automationReason:string;
  independentWitnessCount:number;
  witnessTypeCount:number;
  reviewRequired:true;
  autoApply:false;
  geometryScaleAuthority:false;
  reason:string;
  // Set when a majority of witnesses corroborated the declared scale despite outliers (see CONSENSUS_*).
  agreement?:{agreeing:number;usable:number};
};

const FT=.3048,IN=.0254;
const CONSENSUS_MIN_WITNESSES=5,CONSENSUS_MIN_SHARE=.6;
const compact=(s:string)=>s.replace(/\s+/g,' ').trim();
function mixedNumber(value:string){
  const parts=value.trim().split(/\s+/).filter(Boolean);let total=0;
  for(const part of parts){if(part.includes('/')){const [a,b]=part.split('/').map(Number);if(!Number.isFinite(a)||!Number.isFinite(b)||b===0)return null;total+=a/b}else{const n=Number(part);if(!Number.isFinite(n))return null;total+=n}}
  return Number.isFinite(total)?total:null;
}
export function parseDimensionMeters(label:string){
  const t=compact(label).replace(/[’]/g,"'").replace(/[”]/g,'"');
  let m=t.match(/^([+-]?(?:\d+\s+)?(?:\d+\/\d+|\d+(?:\.\d+)?)?)\s*'\s*(?:-\s*((?:\d+\s+)?(?:\d+\/\d+|\d+(?:\.\d+)?)?)\s*")?$/);
  if(m){const ft=mixedNumber(m[1]),inch=m[2]?mixedNumber(m[2]):0;if(ft!==null&&inch!==null)return ft*FT+inch*IN}
  m=t.match(/^([+-]?\d+(?:\.\d+)?)\s*(MM|CM|M|METERS?|IN|INCHES|FT|FEET)$/i);
  if(!m)return null;const n=Number(m[1]),u=m[2].toUpperCase();if(!Number.isFinite(n)||n<=0)return null;
  if(u==='MM')return n/1000;if(u==='CM')return n/100;if(u==='M'||u.startsWith('METER'))return n;if(u==='IN'||u==='INCHES')return n*IN;return n*FT;
}
type SheetLine={index:number;x:number;y:number;length:number;ux:number;uy:number};
const PERPENDICULAR=Math.sin(5*Math.PI/180);
// PDFs often draw the same line twice; duplicates would let two labels each claim "their own" copy.
function sheetLines(segments:ScaleSegment[]):SheetLine[]{
  const seen=new Set<string>(),out:SheetLine[]=[];
  for(const s of segments){
    const length=Math.hypot(s.x2-s.x,s.y2-s.y);if(!(length>.01))continue;
    const a=`${s.x.toFixed(4)},${s.y.toFixed(4)}`,b=`${s.x2.toFixed(4)},${s.y2.toFixed(4)}`,key=a<b?a+b:b+a;
    if(seen.has(key))continue;seen.add(key);
    out.push({index:out.length,x:s.x,y:s.y,length,ux:(s.x2-s.x)/length,uy:(s.y2-s.y)/length});
  }
  return out;
}
// Fractions along `line` where perpendicular lines pass through it. An extension line has ends on both sides
// of its dimension line, which the corners of outlines and text boxes do not.
function extensionCrossings(line:SheetLine,lines:SheetLine[]){
  const out:number[]=[];
  const side=(x:number,y:number)=>(x-line.x)*line.uy-(y-line.y)*line.ux;
  for(const other of lines){
    if(other===line||Math.abs(other.ux*line.ux+other.uy*line.uy)>PERPENDICULAR)continue;
    const a=side(other.x,other.y),b=side(other.x+other.ux*other.length,other.y+other.uy*other.length);
    if(!(a*b<0&&Math.min(Math.abs(a),Math.abs(b))>.004))continue;
    const k=a/(a-b)*other.length,s=((other.x+other.ux*k-line.x)*line.ux+(other.y+other.uy*k-line.y)*line.uy)/line.length;
    if(s>=-.1&&s<=1.1)out.push(s);
  }
  return out;
}
// Witness finders take items and segments already in normalized sheet units (see validateIndependentScale);
// every distance/length threshold below is in those units.
//
// A dimension label measures the gap between two extension lines. Its dimension line runs close to and
// centred on the label, and both extension lines cross it near its ends with equal overshoot. The nearest
// line alone is not enough: text boxes, ticks and equipment outlines usually sit closer to the label.
function dimensionWitnesses(items:PositionedSheetText[],segments:ScaleSegment[],declared:number|null){
  const lines=sheetLines(segments),crossingsByLine=new Map<number,number[]>();
  const crossings=(line:SheetLine)=>{let found=crossingsByLine.get(line.index);if(!found){found=extensionCrossings(line,lines);crossingsByLine.set(line.index,found)}return found};
  type Match={item:PositionedSheetText;meters:number;line:SheetLine;measured:number;offset:number;asymmetry:number};
  const matches:Match[]=[];
  for(const item of items){
    const meters=parseDimensionMeters(item.text);if(!meters)continue;
    let best:Match|null=null;
    for(const line of lines){
      if(line.length<.15)continue;
      const along=((item.x-line.x)*line.ux+(item.y-line.y)*line.uy)/line.length,offset=Math.abs((item.x-line.x)*line.uy-(item.y-line.y)*line.ux);
      if(along<.2||along>.8||offset>.15)continue;
      const found=crossings(line);
      const start=found.filter(s=>s<=.3).sort((a,b)=>Math.abs(a)-Math.abs(b))[0],end=found.filter(s=>s>=.7).sort((a,b)=>Math.abs(a-1)-Math.abs(b-1))[0];
      if(start===undefined||end===undefined)continue;
      const asymmetry=Math.abs(start-(1-end))*line.length,centring=Math.abs((along-start)/(end-start)-.5);
      if(asymmetry>.012||centring>.3)continue;
      if(!best||asymmetry<best.asymmetry||(asymmetry===best.asymmetry&&offset<best.offset))best={item,meters,line,measured:(end-start)*line.length,offset,asymmetry};
    }
    if(best)matches.push(best);
  }
  // One label per dimension line: a line claimed twice belongs to the closer label.
  const owners=new Map<number,Match>();
  for(const match of matches){const prior=owners.get(match.line.index);if(!prior||match.offset<prior.offset)owners.set(match.line.index,match)}
  const out:ScaleValidationWitness[]=[];
  for(const {item,meters,line,measured,offset,asymmetry} of owners.values()){
    const mpu=meters/measured;if(!Number.isFinite(mpu)||mpu<=0)continue;
    const deviation=declared?Math.max(mpu/declared,declared/mpu):null;
    const confidence=Math.max(.45,Math.min(.92,.9-offset*.7-asymmetry*5));
    out.push({type:'DIMENSION_STRING',label:compact(item.text),observedMeters:meters,sheetDistance:measured,metersPerNormalizedSheetUnit:mpu,deviationFactor:deviation,confidence,evidence:[compact(item.text),`extension lines ${measured.toFixed(3)} sheet units apart on a ${line.length.toFixed(3)}-unit dimension line, label offset ${offset.toFixed(3)}`]});
  }
  return out;
}
function graphicScaleWitnesses(items:PositionedSheetText[],declared:number|null){
  const numeric=items.map(item=>({item,value:Number(compact(item.text))})).filter(x=>Number.isFinite(x.value)&&x.value>=0&&x.value<=100000);
  const unitHints=items.filter(item=>/\b(?:FEET|FT|METERS?|METRES?|M)\b/i.test(item.text));
  const out:ScaleValidationWitness[]=[];
  for(const hint of unitHints){
    const near=numeric.filter(n=>Math.abs(n.item.y-hint.y)<=.08&&Math.abs(n.item.x-hint.x)<=.45).sort((a,b)=>a.item.x-b.item.x);
    if(near.length<3)continue;
    for(let start=0;start<=near.length-3;start++){
      const group=near.slice(start,Math.min(near.length,start+6));
      if(group.length<3)continue;
      const diffs=group.slice(1).map((n,i)=>n.value-group[i].value);
      const positive=diffs.filter(d=>d>0);if(positive.length!==diffs.length)continue;
      const avg=positive.reduce((a,b)=>a+b,0)/positive.length;
      if(positive.some(d=>Math.abs(d-avg)/Math.max(avg,1e-9)>.08))continue;
      const first=group[0],last=group[group.length-1],sheetDistance=Math.abs(last.item.x-first.item.x);if(sheetDistance<.004)continue;
      const unit=/\b(?:FEET|FT)\b/i.test(hint.text)?FT:1;
      const observedMeters=(last.value-first.value)*unit;if(observedMeters<=0)continue;
      const mpu=observedMeters/sheetDistance,deviation=declared?Math.max(mpu/declared,declared/mpu):null;
      out.push({type:'GRAPHIC_SCALE',label:group.map(n=>n.value).join('–')+' '+compact(hint.text),observedMeters,sheetDistance,metersPerNormalizedSheetUnit:mpu,deviationFactor:deviation,confidence:.84,evidence:[compact(hint.text),...group.map(n=>compact(n.item.text))]});
      break;
    }
  }
  return out;
}
export function validateIndependentScale(input:{items:PositionedSheetText[];segments:ScaleSegment[];declaredScale:string|null|undefined;pageMaxDimensionPoints:number|null|undefined;normalizedSheetSpan?:number;coordinateSpan?:number}):IndependentScaleValidation{
  const span=input.normalizedSheetSpan||20,coordinateSpan=input.coordinateSpan||span,distanceScale=span/coordinateSpan;
  const declared=declaredScaleMetersPerNormalizedSheetUnit(input.declaredScale,input.pageMaxDimensionPoints,span);
  // Callers may pass 0–1 page coordinates (coordinateSpan:1, as the PDF workers do). Convert once so the
  // witness thresholds apply in normalized sheet units; applying them in 0–1 space paired short dimension
  // labels with long walls and made the golden fixture's correct 1/8" scale look 6.2x wrong.
  const items=distanceScale===1?input.items:input.items.map(item=>({...item,x:item.x*distanceScale,y:item.y*distanceScale}));
  const segments=distanceScale===1?input.segments:input.segments.map(s=>({x:s.x*distanceScale,y:s.y*distanceScale,x2:s.x2*distanceScale,y2:s.y2*distanceScale}));
  const witnesses=[...dimensionWitnesses(items,segments,declared),...graphicScaleWitnesses(items,declared)].sort((a,b)=>b.confidence-a.confidence);
  if(!witnesses.length)return{status:'UNRESOLVED',declaredMetersPerNormalizedSheetUnit:declared,corroboratedMetersPerNormalizedSheetUnit:null,confidence:0,witnesses:[],automationEligible:false,automationReason:'No independent measurable scale witness is available.',independentWitnessCount:0,witnessTypeCount:0,reviewRequired:true,autoApply:false,geometryScaleAuthority:false,reason:'No independent dimension or graphic-scale witness could be measured.'};
  const usable=witnesses.filter(w=>w.confidence>=.6);if(!usable.length)return{status:'REVIEW',declaredMetersPerNormalizedSheetUnit:declared,corroboratedMetersPerNormalizedSheetUnit:witnesses[0].metersPerNormalizedSheetUnit,confidence:witnesses[0].confidence,witnesses,automationEligible:false,automationReason:'Independent witnesses are too weak for corroborated scale review.',independentWitnessCount:0,witnessTypeCount:new Set(witnesses.map(w=>w.type)).size,reviewRequired:true,autoApply:false,geometryScaleAuthority:false,reason:'Independent scale evidence exists but is too weak for corroboration.'};
  const values=usable.map(w=>w.metersPerNormalizedSheetUnit).sort((a,b)=>a-b),median=values[Math.floor(values.length/2)];
  const spread=Math.max(...values)/Math.min(...values);
  const witnessTypeCount=new Set(usable.map(w=>w.type)).size;
  const independentWitnessCount=usable.length;
  if(spread>1.18&&declared){
    // Real sheets always carry a few labels paired with the wrong line (the golden fixture's site plan: 14
    // of 19 agree with 1/8", 5 do not). A clear majority agreeing with the declared scale corroborates it; the outliers stay
    // listed as evidence but are not used. Too few witnesses, or no clear majority, is still a MISMATCH.
    const agreeing=usable.filter(w=>Math.max(w.metersPerNormalizedSheetUnit/declared,declared/w.metersPerNormalizedSheetUnit)<=1.05);
    if(usable.length>=CONSENSUS_MIN_WITNESSES&&agreeing.length>=usable.length*CONSENSUS_MIN_SHARE){
      const agreed=agreeing.map(w=>w.metersPerNormalizedSheetUnit).sort((a,b)=>a-b),share=agreeing.length/usable.length;
      return{status:'CORROBORATED',declaredMetersPerNormalizedSheetUnit:declared,corroboratedMetersPerNormalizedSheetUnit:agreed[Math.floor(agreed.length/2)],
        confidence:Math.min(.86,(usable[0].confidence+.9)/2)-(1-share)*.3,witnesses,automationEligible:false,
        automationReason:'Proposal only: corroboration never auto-applies X/Y. Human-confirm manual XY pairs and independent witnesses before applying a transform.',
        independentWitnessCount:agreeing.length,witnessTypeCount:new Set(agreeing.map(w=>w.type)).size,reviewRequired:true,autoApply:false,geometryScaleAuthority:false,
        reason:`${agreeing.length} of ${usable.length} independent witnesses agree with the declared scale within 5%; the other ${usable.length-agreeing.length} disagree and are kept as evidence, not used.`,
        agreement:{agreeing:agreeing.length,usable:usable.length}};
    }
  }
  if(spread>1.18)return{status:'MISMATCH',declaredMetersPerNormalizedSheetUnit:declared,corroboratedMetersPerNormalizedSheetUnit:median,confidence:.35,witnesses,automationEligible:false,automationReason:'Independent scale witnesses disagree; human review required.',independentWitnessCount,witnessTypeCount,reviewRequired:true,autoApply:false,geometryScaleAuthority:false,reason:'Independent scale witnesses disagree with one another.'};
  if(!declared)return{status:'REVIEW',declaredMetersPerNormalizedSheetUnit:null,corroboratedMetersPerNormalizedSheetUnit:median,confidence:Math.min(.86,usable[0].confidence),witnesses,automationEligible:false,automationReason:'No declared source scale is available to cross-check the measured witnesses.',independentWitnessCount,witnessTypeCount,reviewRequired:true,autoApply:false,geometryScaleAuthority:false,reason:'Independent scale evidence is measurable, but no declared PDF scale candidate is available for corroboration.'};
  const deviation=Math.max(median/declared,declared/median);
  const status:ScaleValidationStatus=deviation<=1.05?'CORROBORATED':deviation<=1.15?'REVIEW':'MISMATCH';
  const confidence=status==='CORROBORATED'?Math.min(.94,(usable[0].confidence+.9)/2):status==='REVIEW'?.62:.25;
  // Witness agreement is a review signal, never permission to alter sheet coordinates.
  // Only a human-confirmed manual XY calibration may establish the metric transform.
  const automationEligible=false;
  const automationReason='Proposal only: corroboration never auto-applies X/Y. Human-confirm manual XY pairs and independent witnesses before applying a transform.';
  return{status,declaredMetersPerNormalizedSheetUnit:declared,corroboratedMetersPerNormalizedSheetUnit:median,confidence,witnesses,automationEligible,automationReason,independentWitnessCount,witnessTypeCount,reviewRequired:true,autoApply:false,geometryScaleAuthority:false,reason:status==='CORROBORATED'?'Declared scale and independent measured drawing evidence agree within 5%.':status==='REVIEW'?'Declared and independent scale evidence are close but require review.':'Declared scale strongly disagrees with independent drawing evidence.'};
}
