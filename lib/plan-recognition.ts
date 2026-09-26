import {detectSldPage,type SldPageEvidence} from './sld-recognition.ts';

export type NonSldPlanType=
 |'ELECTRICAL_POWER_PLAN'
 |'ELECTRICAL_LIGHTING_PLAN'
 |'UTILITY_PLAN'
 |'SITE_PLAN'
 |'ARCHITECTURAL_FLOOR_PLAN'
 |'REFLECTED_CEILING_PLAN'
 |'STRUCTURAL_FRAMING_PLAN'
 |'FOUNDATION_PLAN'
 |'ROOF_PLAN'
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
 {type:'GENERAL_LAYOUT_PLAN',discipline:'General / Equipment',score:8,patterns:[/\bGENERAL\s+LAYOUT\b/i,/\bGENERAL\s+LAYOUT\s+PLAN\b/i]},
 {type:'SHOP_LAYOUT_PLAN',discipline:'Equipment',score:9,patterns:[/\bSHOP\s+LAYOUT\b/i]},
 {type:'EQUIPMENT_LAYOUT_PLAN',discipline:'Equipment',score:8,patterns:[/\bEQUIPMENT\s+(?:LAYOUT|PLAN)\b/i]},
 {type:'PIT_LAYOUT_PLAN',discipline:'Equipment / Structural',score:9,patterns:[/\bPIT\s+LAYOUT\b/i,/\bPIT\s+PLAN\b/i]},
 {type:'FLOOR_ANCHOR_PLAN',discipline:'Equipment / Structural',score:10,patterns:[/\bFLOOR\s+ANCHOR\s+PLAN\b/i,/\bANCHOR\s+PLAN\b/i]},
 {type:'PERMIT_PLAN_ELEVATION',discipline:'Equipment / Permit',score:8,patterns:[/\b(?:BOOTH|MIXING\s+ROOM)\s+PERMIT(?:\s+\d+)?\b/i,/\bPLAN\s+AND\s+ELEVATION\s+VIEWS\b/i]},
];

const noise=/\b(?:GENERAL\s+NOTES?|DETAILS?|SECTIONS?|SCHEDULES?|SPECIFICATIONS?|COVER\s+SHEET|DRAWING\s+INDEX)\b/i;
const referenceLead=/^(?:SEE|REFER(?:ENCE)?|REF\.?|PER|VERIFY|COORDINATE|SHOWN|AS\s+SHOWN)\b/i;
const titleLike=(value:string)=>value.length<=140&&!referenceLead.test(value)&&!noise.test(value);

export function detectNonSldPlanPage(labels:string[],vectorOperatorCount=0):NonSldPlanEvidence{
 const text=labels.map(value=>String(value||'').replace(/\s+/g,' ').trim()).filter(Boolean);
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
  reasons.push(`recognized ${best.rule.type.toLowerCase().replaceAll('_',' ')} title/content`);
  if(vectorOperatorCount>=20)reasons.push('drawing-vector content present');
  return{isPlan:true,planType:best.rule.type,discipline:best.rule.discipline,score:best.rule.score+(vectorOperatorCount>=20?1:0),titleEvidence:best.matches.slice(0,5),reasons};
 }
 const planView=text.filter(value=>/\bPLAN\s+VIEW\b/i.test(value));
 const genericPlan=text.filter(value=>/\bPLAN\b/i.test(value)&&!noise.test(value));
 const nonPlanSheetContext=text.some(value=>/^(?:GENERAL\s+|ELECTRICAL\s+|MECHANICAL\s+|PLUMBING\s+|STRUCTURAL\s+)?NOTES?\b|^(?:DETAILS?|SECTIONS?|SCHEDULES?|SPECIFICATIONS?|COVER\s+SHEET|DRAWING\s+INDEX)\b/i.test(value));
 const geometric=vectorOperatorCount>=40;
 if(planView.length&&(geometric||text.length>=8)){
  reasons.push('plan-view label present');if(geometric)reasons.push('drawing-vector content present');
  return{isPlan:true,planType:'PLAN_VIEW_UNCLASSIFIED',discipline:null,score:5+(geometric?1:0),titleEvidence:planView.slice(0,5),reasons};
 }
 if(genericPlan.length&&geometric&&!nonPlanSheetContext){
  reasons.push('generic plan title/content present','drawing-vector content present');
  return{isPlan:true,planType:'PLAN_VIEW_UNCLASSIFIED',discipline:null,score:5,titleEvidence:genericPlan.slice(0,5),reasons};
 }
 return{isPlan:false,planType:null,discipline:null,score:0,titleEvidence:[],reasons:[]};
}


export function resolveDrawingPageRecognition(labels:string[],vectorOperatorCount=0):{sld:SldPageEvidence;plan:NonSldPlanEvidence}{
 const plan=detectNonSldPlanPage(labels,vectorOperatorCount),detectedSld=detectSldPage(labels,vectorOperatorCount),explicitSldTitle=detectedSld.reasons.includes('explicit SLD/riser/one-line title');
 const sld=plan.isPlan&&!explicitSldTitle?{...detectedSld,isSld:false,reasons:[...detectedSld.reasons,'suppressed by explicit non-SLD plan title/content']}:detectedSld;
 return{sld,plan:sld.isSld?{isPlan:false,planType:null,discipline:null,score:0,titleEvidence:[],reasons:[]}:plan};
}
