import {detectSldPage,type SldPageEvidence} from './sld-recognition.ts';

export type NonSldPlanType=
 |'ELECTRICAL_POWER_PLAN'
 |'ELECTRICAL_LIGHTING_PLAN'
 |'UTILITY_PLAN'
 |'SITE_PLAN'
 |'CIVIL_GRADING_PLAN'
 |'DRAINAGE_PLAN'
 |'ARCHITECTURAL_FLOOR_PLAN'
 |'REFLECTED_CEILING_PLAN'
 |'STRUCTURAL_FRAMING_PLAN'
 |'FOUNDATION_PLAN'
 |'ROOF_PLAN'
 |'UNIT_PLAN'
 |'MECHANICAL_PLAN'
 |'PLUMBING_PLAN'
 |'FIRE_PROTECTION_PLAN'
 |'HAZARDOUS_AREA_PLAN'
 |'LIFE_SAFETY_PLAN'
 |'LOW_VOLTAGE_PLAN'
 |'GENERAL_LAYOUT_PLAN'
 |'SHOP_LAYOUT_PLAN'
 |'EQUIPMENT_LAYOUT_PLAN'
 |'PIT_LAYOUT_PLAN'
 |'PIT_PERMIT_PLAN'
 |'FLOOR_ANCHOR_PLAN'
 |'PERMIT_PLAN_ELEVATION'
 |'PLAN_VIEW_UNCLASSIFIED';

export type NonSldPlanEvidence={
 isPlan:boolean;
 planType:NonSldPlanType|null;
 discipline:string|null;
 score:number;
 titleEvidence:string[];
 reasons:string[];
};

type Rule={type:NonSldPlanType;discipline:string;patterns:RegExp[];score:number};

const RULES:Rule[]=[
 {type:'ELECTRICAL_POWER_PLAN',discipline:'Electrical',score:10,patterns:[/\bELECTRICAL\s+POWER\s+PLAN\b/i,/\bPOWER\s+PLAN\b/i]},
 {type:'ELECTRICAL_LIGHTING_PLAN',discipline:'Electrical',score:10,patterns:[/\bELECTRICAL\s+LIGHTING\s+PLAN\b/i,/\bLIGHTING\s+PLAN\b/i]},
 {type:'UTILITY_PLAN',discipline:'Multi-discipline / Utilities',score:10,patterns:[/\bUTILITY\s+PLAN\b/i]},
 {type:'SITE_PLAN',discipline:'Civil / Site',score:10,patterns:[/\bSITE\s+PLAN\b/i,/\bOVERALL\s+SITE\s+PLAN\b/i]},
 {type:'CIVIL_GRADING_PLAN',discipline:'Civil / Grading',score:10,patterns:[/\bGRADING\s+PLAN\b/i,/\bROUGH\s+GRADING\s+PLAN\b/i,/\bPRECISE\s+GRADING\s+PLAN\b/i]},
 {type:'DRAINAGE_PLAN',discipline:'Civil / Drainage',score:9,patterns:[/\bDRAINAGE\s+PLAN\b/i,/\bSTORM(?:WATER|\s+WATER)\s+PLAN\b/i,/\bSTORM\s+DRAIN\s+PLAN\b/i]},
 {type:'REFLECTED_CEILING_PLAN',discipline:'Architectural',score:10,patterns:[/\bREFLECTED\s+CEILING\s+PLAN\b/i,/\bRCP\b/i]},
 {type:'STRUCTURAL_FRAMING_PLAN',discipline:'Structural',score:10,patterns:[/\b(?:ROOF|MEZZANINE|FLOOR|LOW\s+ROOF)\s+FRAMING\s+PLAN\b/i,/\bFRAMING\s+PLAN\b/i]},
 {type:'FOUNDATION_PLAN',discipline:'Structural',score:10,patterns:[/\bFOUNDATION\s+PLAN\b/i]},
 {type:'MECHANICAL_PLAN',discipline:'Mechanical',score:10,patterns:[/\b(?:MECHANICAL|HVAC)\s+(?:FLOOR\s+)?PLAN\b/i]},
 {type:'PLUMBING_PLAN',discipline:'Plumbing',score:10,patterns:[/\bPLUMBING\s+(?:FLOOR\s+)?PLAN\b/i]},
 {type:'FIRE_PROTECTION_PLAN',discipline:'Fire Protection',score:9,patterns:[/\bFIRE\s+(?:SUPPRESSION|PROTECTION)\b/i,/\bSPRINKLER\s+PLAN\b/i]},
 {type:'HAZARDOUS_AREA_PLAN',discipline:'Electrical / Life Safety',score:9,patterns:[/\bC1D1\b.*\bC1D2\b/i,/\bCLASS\s*1\s*,?\s*DIVISION\s*[12]\b/i,/\bHAZARDOUS\s+(?:AREA|LOCATION)/i]},
 {type:'LIFE_SAFETY_PLAN',discipline:'Life Safety',score:9,patterns:[/\bLIFE\s+SAFETY\s+PLAN\b/i,/\bEGRESS\s+PLAN\b/i]},
 {type:'LOW_VOLTAGE_PLAN',discipline:'Telecommunications',score:9,patterns:[/\b(?:LOW\s+VOLTAGE|TELECOM(?:MUNICATIONS)?|DATA)\s+PLAN\b/i]},
 {type:'ARCHITECTURAL_FLOOR_PLAN',discipline:'Architectural',score:9,patterns:[/\b(?:ARCHITECTURAL\s+)?FLOOR\s+PLAN\b/i,/\b(?:FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|GROUND)\s+FLOOR\s+PLAN\b/i]},
 {type:'ROOF_PLAN',discipline:'Architectural / Structural',score:8,patterns:[/\bROOF\s+PLAN\b/i]},
 {type:'UNIT_PLAN',discipline:'Multi-discipline / Unit',score:9,patterns:[/\bUNIT\s+PLANS?\b/i,/\bPLAN\s*["'“”]?\s*[A-Z](?:\s+ALT)?\s*["'“”]?\s+UNIT\s*#?\s*\d+\b/i]},
 {type:'GENERAL_LAYOUT_PLAN',discipline:'General / Equipment',score:8,patterns:[/\bGENERAL\s+LAYOUT\b/i,/\bGENERAL\s+LAYOUT\s+PLAN\b/i]},
 {type:'SHOP_LAYOUT_PLAN',discipline:'Equipment',score:9,patterns:[/\bSHOP\s+LAYOUT\b/i]},
 {type:'EQUIPMENT_LAYOUT_PLAN',discipline:'Equipment',score:8,patterns:[/\bEQUIPMENT\s+(?:LAYOUT|PLAN)\b/i]},
 {type:'PIT_LAYOUT_PLAN',discipline:'Equipment / Structural',score:9,patterns:[/\bPIT\s+LAYOUT\b/i,/\bPIT\s+PLAN\b/i]},
 {type:'PIT_PERMIT_PLAN',discipline:'Equipment / Structural',score:10,patterns:[/^(?:TITAN|MX)\s+PIT\s+PERMIT$/i]},
 {type:'FLOOR_ANCHOR_PLAN',discipline:'Equipment / Structural',score:10,patterns:[/^FLOOR\s+ANCHOR\s+PLAN$/i,/^ANCHOR\s+PLAN$/i]},
 {type:'PERMIT_PLAN_ELEVATION',discipline:'Equipment / Permit',score:8,patterns:[/\b(?:BOOTH|MIXING\s+ROOM)\s+PERMIT(?:\s+\d+)?\b/i,/\bPLAN\s+AND\s+ELEVATION\s+VIEWS\b/i]},
];

const noise=/\b(?:GENERAL\s+NOTES?|DETAILS?|SECTIONS?|SCHEDULES?|SPECIFICATIONS?|COVER\s+SHEET|DRAWING\s+INDEX)\b/i;
const referenceLead=/^(?:SEE|REFER(?:ENCE)?|REF\.?|PER|VERIFY|COORDINATE|SHOWN|AS\s+SHOWN)\b/i;
const revisionLead=/^REV(?:ISION)?(?:[-\s:]|$)/i;
const titleLike=(value:string)=>value.length<=140&&!referenceLead.test(value)&&!revisionLead.test(value)&&!noise.test(value);

export function detectNonSldPlanPage(labels:string[],vectorOperatorCount=0):NonSldPlanEvidence{
 const text=labels.map(value=>String(value||'').replace(/\s+/g,' ').trim()).filter(Boolean);
 const coverOrIndexPage=text.some(value=>/^(?:COVER\s+SHEET|(?:[A-Z][A-Z &\/.-]{0,40}\s+)?(?:DRAWING|SHEET)\s+INDEX)$/i.test(value));
 if(coverOrIndexPage)return{isPlan:false,planType:null,discipline:null,score:0,titleEvidence:[],reasons:['cover/index page excluded from plan-frame recognition']};
 let best:{rule:Rule;matches:string[]}|null=null;
 for(const rule of RULES){
  const matches:string[]=[];
  for(const value of text){
   if(titleLike(value)&&rule.patterns.some(pattern=>pattern.test(value)))matches.push(value);
  }
  if(!matches.length){
   for(let i=0;i<text.length;i++){
    const window=text.slice(i,i+4).join(' ');
    if(titleLike(window)&&rule.patterns.some(pattern=>pattern.test(window))){matches.push(window);break}
   }
  }
  if(matches.length&&(!best||rule.score>best.rule.score))best={rule,matches};
 }
 const reasons:string[]=[];
 if(best){
  const electricalSheet=text.some(value=>/^E\s*[-.]?\s*\d+(?:\.\d+)?\b/i.test(value)||/\bELECTRICAL\b/i.test(value));
  const electricalCuePattern=/\b(?:ELEC\.?\s*PANEL|RECEPTACLE|CIRCUIT|DISCONNECT|MAIN\s+SWITCHBOARD|SWITCHBOARD|HP\d+(?:-\d+)?|MS\d+|SDCO|F\.?A\.?P\.?)\b/i;
  const electricalContent=[...new Set([
   ...text.filter(value=>electricalCuePattern.test(value)),
   ...text.slice(0,-1).map((value,index)=>`${value} ${text[index+1]}`).filter(value=>electricalCuePattern.test(value))
  ])].length;
  const electricalFloorPlan=best.rule.type==='ARCHITECTURAL_FLOOR_PLAN'&&vectorOperatorCount>=20&&electricalSheet&&electricalContent>=2;
  const unitPlanElectrical=best.rule.type==='UNIT_PLAN'&&electricalSheet&&electricalContent>=2;
  const resolvedRule=electricalFloorPlan?{...best.rule,type:'ELECTRICAL_POWER_PLAN' as const,discipline:'Electrical',score:10}:best.rule;
  reasons.push(`recognized ${resolvedRule.type.toLowerCase().replaceAll('_',' ')} title/content`);
  if(electricalFloorPlan)reasons.push('electrical sheet marker and electrical device/circuit evidence promote generic floor-plan title to electrical power plan');
  if(unitPlanElectrical)reasons.push('unit-plan sheet carries electrical sheet/device evidence');
  if(vectorOperatorCount>=20)reasons.push('drawing-vector content present');
  return{isPlan:true,planType:resolvedRule.type,discipline:unitPlanElectrical?'Electrical':resolvedRule.discipline,score:resolvedRule.score+(vectorOperatorCount>=20?1:0),titleEvidence:best.matches.slice(0,5),reasons};
 }
 const planView=text.filter(value=>titleLike(value)&&/\bPLAN\s+VIEW\b/i.test(value));
 const genericPlan=text.filter(value=>titleLike(value)&&/\bPLAN\b/i.test(value));
 const nonPlanSheetContext=text.some(value=>noise.test(value));
 const geometric=vectorOperatorCount>=40;
 if(planView.length&&!nonPlanSheetContext&&(geometric||text.length>=8)){
  reasons.push('plan-view label present');if(geometric)reasons.push('drawing-vector content present');
  return{isPlan:true,planType:'PLAN_VIEW_UNCLASSIFIED',discipline:null,score:5+(geometric?1:0),titleEvidence:planView.slice(0,5),reasons};
 }
 if(genericPlan.length&&geometric&&!nonPlanSheetContext){
  reasons.push('generic plan title/content present','drawing-vector content present');
  return{isPlan:true,planType:'PLAN_VIEW_UNCLASSIFIED',discipline:null,score:5,titleEvidence:genericPlan.slice(0,5),reasons};
 }
 return{isPlan:false,planType:null,discipline:null,score:0,titleEvidence:[],reasons:[]};
}


export type PositionedPlanLabel={text:string;x:number;y:number};
export type PlanFrameEvidence={
 id:string;
 title:string;
 planType:NonSldPlanType;
 discipline:string|null;
 floor:string|null;
 unitId:string|null;
 unitPlan:string|null;
 anchorX:number;
 anchorY:number;
 confidence:number;
 evidence:string[];
 reviewRequired:true;
 physicalTruth:false;
};

const FRAME_ORDINALS:Record<string,number>={FIRST:1,SECOND:2,THIRD:3,FOURTH:4,FIFTH:5,SIXTH:6,SEVENTH:7,EIGHTH:8,NINTH:9,TENTH:10};

function explicitPlanFrameCandidate(item:PositionedPlanLabel,pagePlan?:NonSldPlanEvidence|null):PlanFrameEvidence|null{
 const text=String(item.text||'').replace(/\s+/g,' ').trim();
 if(!text)return null;
 const floorMatch=text.match(/\b(FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH)\s+FLOOR\s+PLAN\b/i);
 if(floorMatch){
  const floor=`L${FRAME_ORDINALS[floorMatch[1].toUpperCase()]}`;
  const pageElectrical=pagePlan?.isPlan&&pagePlan.planType==='ELECTRICAL_POWER_PLAN';
  return{id:`frame-${floor.toLowerCase()}`,title:text,planType:pageElectrical?'ELECTRICAL_POWER_PLAN':'ARCHITECTURAL_FLOOR_PLAN',discipline:pageElectrical?'Electrical':'Architectural',floor,unitId:null,unitPlan:null,anchorX:item.x,anchorY:item.y,confidence:/\bSCALE\b/i.test(text)?.96:.9,evidence:[text,'EXPLICIT_FLOOR_PLAN_TITLE'],reviewRequired:true,physicalTruth:false};
 }
 if(/\bROOF\s+PLAN\b/i.test(text)&&!/\bROOF\s+FRAMING\s+PLAN\b/i.test(text)){
  return{id:'frame-roof',title:text,planType:'ROOF_PLAN',discipline:pagePlan?.discipline||'Architectural / Structural',floor:'ROOF',unitId:null,unitPlan:null,anchorX:item.x,anchorY:item.y,confidence:/\bSCALE\b/i.test(text)?.96:.9,evidence:[text,'EXPLICIT_ROOF_PLAN_TITLE'],reviewRequired:true,physicalTruth:false};
 }
 if(/\bSITE\s+PLAN\b/i.test(text)){
  return{id:'frame-site',title:text,planType:'SITE_PLAN',discipline:pagePlan?.discipline||'Civil / Site',floor:'SITE',unitId:null,unitPlan:null,anchorX:item.x,anchorY:item.y,confidence:/\bSCALE\b/i.test(text)?.96:.9,evidence:[text,'EXPLICIT_SITE_PLAN_TITLE'],reviewRequired:true,physicalTruth:false};
 }
 const unit=text.match(/\bPLAN\s*["'“”]?\s*([A-Z](?:\s+ALT)?)\s*["'“”]?\s+UNIT\s*#?\s*(\d+)\b/i);
 if(unit){
  const unitPlan=unit[1].toUpperCase().replace(/\s+/g,' ');
  const unitId=unit[2];
  return{id:`frame-unit-${unitId.toLowerCase()}`,title:text,planType:'UNIT_PLAN',discipline:pagePlan?.discipline||'Multi-discipline / Unit',floor:null,unitId,unitPlan,anchorX:item.x,anchorY:item.y,confidence:.93,evidence:[text,'EXPLICIT_UNIT_PLAN_TITLE'],reviewRequired:true,physicalTruth:false};
 }
 return null;
}

/** Detect distinct plan viewports on one physical PDF sheet without inventing geometry extents. */
export function detectPlanFrames(items:PositionedPlanLabel[],pagePlan?:NonSldPlanEvidence|null):PlanFrameEvidence[]{
 const chosen=new Map<string,PlanFrameEvidence>();
 const retain=(candidate:PlanFrameEvidence)=>{
  const key=candidate.unitId?`UNIT:${candidate.unitId}:${candidate.unitPlan||''}`:`${candidate.floor||'UNRESOLVED'}:${candidate.planType}`;
  const existing=chosen.get(key);
  if(!existing||candidate.confidence>existing.confidence)chosen.set(key,candidate);
 };
 for(const item of items){
  const candidate=explicitPlanFrameCandidate(item,pagePlan);
  if(candidate)retain(candidate);
 }
 if(pagePlan?.isPlan&&pagePlan.planType==='UNIT_PLAN'){
  const planTokens=items.map(item=>({item,match:String(item.text||'').replace(/\s+/g,' ').trim().match(/^PLAN\s*["'“”]?\s*([A-Z](?:\s+ALT)?)\s*["'“”]?$/i)})).filter(entry=>entry.match);
  const unitTokens=items.map(item=>({item,match:String(item.text||'').replace(/\s+/g,' ').trim().match(/^UNIT\s*#?\s*(\d+)$/i)})).filter(entry=>entry.match);
  for(const plan of planTokens){
   const nearest=unitTokens.map(unit=>({unit,distance:Math.hypot(plan.item.x-unit.item.x,plan.item.y-unit.item.y)})).filter(entry=>entry.distance<=.75).sort((a,b)=>a.distance-b.distance)[0];
   if(!nearest)continue;
   const unitPlan=String(plan.match?.[1]||'').toUpperCase().replace(/\s+/g,' '),unitId=String(nearest.unit.match?.[1]||'');
   if(!unitPlan||!unitId)continue;
   retain({id:`frame-unit-${unitId.toLowerCase()}`,title:`Plan "${unitPlan}" Unit#${unitId}`,planType:'UNIT_PLAN',discipline:pagePlan.discipline||'Multi-discipline / Unit',floor:null,unitId,unitPlan,anchorX:(plan.item.x+nearest.unit.item.x)/2,anchorY:(plan.item.y+nearest.unit.item.y)/2,confidence:.9,evidence:[String(plan.item.text),String(nearest.unit.item.text),'SPLIT_UNIT_PLAN_LABEL'],reviewRequired:true,physicalTruth:false});
  }
 }
 return [...chosen.values()].sort((a,b)=>a.anchorY-b.anchorY||a.anchorX-b.anchorX);
}

/** Assign source-sheet geometry to the nearest explicit plan-title anchor; this is sheet segmentation, not physical XYZ authority. */
export function resolvePlanFrameAtPoint(frames:PlanFrameEvidence[],x:number,y:number):PlanFrameEvidence|null{
 if(!frames.length||!Number.isFinite(x)||!Number.isFinite(y))return null;
 let best:PlanFrameEvidence|null=null,bestDistance=Infinity;
 for(const frame of frames){
  const distance=Math.hypot(x-frame.anchorX,y-frame.anchorY);
  if(distance<bestDistance){best=frame;bestDistance=distance}
 }
 return best;
}


export function resolveDrawingPageRecognition(labels:string[],vectorOperatorCount=0):{sld:SldPageEvidence;plan:NonSldPlanEvidence}{
 const plan=detectNonSldPlanPage(labels,vectorOperatorCount),detectedSld=detectSldPage(labels,vectorOperatorCount),explicitSldTitle=detectedSld.reasons.includes('explicit SLD/riser/one-line title');
 const excludedSheet=plan.reasons.some(reason=>reason.includes('excluded from plan-frame recognition'));
 const suppressHeuristicSld=(plan.isPlan||excludedSheet)&&!explicitSldTitle;
 const sld=suppressHeuristicSld?{...detectedSld,isSld:false,reasons:[...detectedSld.reasons,plan.isPlan?'suppressed by explicit non-SLD plan title/content':'suppressed by excluded cover/index sheet classification']}:detectedSld;
 return{sld,plan:sld.isSld?{isPlan:false,planType:null,discipline:null,score:0,titleEvidence:[],reasons:[]}:plan};
}
