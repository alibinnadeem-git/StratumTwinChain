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
};

const FT=.3048,IN=.0254;
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
function pointSegmentDistance(px:number,py:number,s:ScaleSegment){
  const dx=s.x2-s.x,dy=s.y2-s.y,l2=dx*dx+dy*dy;if(l2<1e-9)return Math.hypot(px-s.x,py-s.y);
  const t=Math.max(0,Math.min(1,((px-s.x)*dx+(py-s.y)*dy)/l2));
  return Math.hypot(px-(s.x+t*dx),py-(s.y+t*dy));
}
function segmentLength(s:ScaleSegment){return Math.hypot(s.x2-s.x,s.y2-s.y)}
function dimensionWitnesses(items:PositionedSheetText[],segments:ScaleSegment[],declared:number|null,distanceScale=1){
  const out:ScaleValidationWitness[]=[];
  for(const item of items){
    const meters=parseDimensionMeters(item.text);if(!meters)continue;
    const candidates=segments.map(segment=>({segment,distance:pointSegmentDistance(item.x,item.y,segment),length:segmentLength(segment)}))
      .filter(c=>c.length>=.15&&c.distance<=.45)
      .sort((a,b)=>a.distance-b.distance||b.length-a.length);
    if(!candidates.length)continue;
    const best=candidates[0],second=candidates[1];
    if(second&&second.distance<=best.distance+.04&&Math.abs(second.length-best.length)/Math.max(best.length,1e-6)>.2)continue;
    const normalizedDistance=best.length*distanceScale;const mpu=meters/normalizedDistance;if(!Number.isFinite(mpu)||mpu<=0)continue;
    const deviation=declared?Math.max(mpu/declared,declared/mpu):null;
    const confidence=Math.max(.45,Math.min(.92,.9-best.distance*.7-(second&&second.distance<best.distance+.12?.08:0)));
    out.push({type:'DIMENSION_STRING',label:compact(item.text),observedMeters:meters,sheetDistance:normalizedDistance,metersPerNormalizedSheetUnit:mpu,deviationFactor:deviation,confidence,evidence:[compact(item.text),`nearest vector dimension candidate distance ${best.distance.toFixed(3)} sheet units`]});
  }
  return out;
}
function graphicScaleWitnesses(items:PositionedSheetText[],declared:number|null,distanceScale=1){
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
      const first=group[0],last=group[group.length-1],rawSheetDistance=Math.abs(last.item.x-first.item.x);if(rawSheetDistance<.004)continue;const sheetDistance=rawSheetDistance*distanceScale;
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
  const witnesses=[...dimensionWitnesses(input.items,input.segments,declared,distanceScale),...graphicScaleWitnesses(input.items,declared,distanceScale)].sort((a,b)=>b.confidence-a.confidence);
  if(!witnesses.length)return{status:'UNRESOLVED',declaredMetersPerNormalizedSheetUnit:declared,corroboratedMetersPerNormalizedSheetUnit:null,confidence:0,witnesses:[],automationEligible:false,automationReason:'No independent measurable scale witness is available.',independentWitnessCount:0,witnessTypeCount:0,reviewRequired:true,autoApply:false,geometryScaleAuthority:false,reason:'No independent dimension or graphic-scale witness could be measured.'};
  const usable=witnesses.filter(w=>w.confidence>=.6);if(!usable.length)return{status:'REVIEW',declaredMetersPerNormalizedSheetUnit:declared,corroboratedMetersPerNormalizedSheetUnit:witnesses[0].metersPerNormalizedSheetUnit,confidence:witnesses[0].confidence,witnesses,automationEligible:false,automationReason:'Independent witnesses are below the automation confidence threshold.',independentWitnessCount:0,witnessTypeCount:new Set(witnesses.map(w=>w.type)).size,reviewRequired:true,autoApply:false,geometryScaleAuthority:false,reason:'Independent scale evidence exists but is too weak for corroboration.'};
  const values=usable.map(w=>w.metersPerNormalizedSheetUnit).sort((a,b)=>a-b),median=values[Math.floor(values.length/2)];
  const spread=Math.max(...values)/Math.min(...values);
  const witnessTypeCount=new Set(usable.map(w=>w.type)).size;
  const independentWitnessCount=usable.length;
  if(spread>1.18)return{status:'MISMATCH',declaredMetersPerNormalizedSheetUnit:declared,corroboratedMetersPerNormalizedSheetUnit:median,confidence:.35,witnesses,automationEligible:false,automationReason:'Independent witnesses disagree beyond the safe automation envelope.',independentWitnessCount,witnessTypeCount,reviewRequired:true,autoApply:false,geometryScaleAuthority:false,reason:'Independent scale witnesses disagree with one another.'};
  if(!declared)return{status:'REVIEW',declaredMetersPerNormalizedSheetUnit:null,corroboratedMetersPerNormalizedSheetUnit:median,confidence:Math.min(.86,usable[0].confidence),witnesses,automationEligible:false,automationReason:'No declared source scale is available to cross-check the measured witnesses.',independentWitnessCount,witnessTypeCount,reviewRequired:true,autoApply:false,geometryScaleAuthority:false,reason:'Independent scale evidence is measurable, but no declared PDF scale candidate is available for corroboration.'};
  const deviation=Math.max(median/declared,declared/median);
  const status:ScaleValidationStatus=deviation<=1.05?'CORROBORATED':deviation<=1.15?'REVIEW':'MISMATCH';
  const confidence=status==='CORROBORATED'?Math.min(.94,(usable[0].confidence+.9)/2):status==='REVIEW'?.62:.25;
  const redundantEvidence=witnessTypeCount>=2||independentWitnessCount>=3;
  const automationEligible=status==='CORROBORATED'&&deviation<=1.03&&spread<=1.04&&confidence>=.72&&redundantEvidence;
  const automationReason=automationEligible
   ?'Declared scale and redundant independent witnesses agree within the strict 3% automation envelope.'
   :status!=='CORROBORATED'
    ?'Scale is not corroborated strongly enough for automation.'
    :!redundantEvidence
     ?'A second independent witness type or at least three consistent measured dimensions is required for automatic metric conversion.'
     :deviation>1.03||spread>1.04
      ?'Evidence agrees for review but not inside the stricter automatic-conversion tolerance.'
      :'Scale confidence is below the automatic-conversion threshold.';
  return{status,declaredMetersPerNormalizedSheetUnit:declared,corroboratedMetersPerNormalizedSheetUnit:median,confidence,witnesses,automationEligible,automationReason,independentWitnessCount,witnessTypeCount,reviewRequired:true,autoApply:false,geometryScaleAuthority:false,reason:status==='CORROBORATED'?'Declared scale and independent measured drawing evidence agree within 5%.':status==='REVIEW'?'Declared and independent scale evidence are close but require review.':'Declared scale strongly disagrees with independent drawing evidence.'};
}
