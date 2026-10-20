import {classifyElectricalLabel} from './sld-recognition.ts';

export type PositionedElectricalText={text:string;x:number;y:number;page:number};

export type ElectricalLegendEntry={
 id:string;page:number;abbreviation:string;description:string;componentHint:string|null;
 anchor:{x:number;y:number};confidence:number;sourceEvidence:string[];physicalTruth:false;reviewRequired:true;
};

export type ElectricalSpecificationRequirement={
 id:string;page:number;section:string|null;title:string;componentHint:string|null;
 manufacturer:string|null;model:string|null;ratings:Record<string,number|string>;
 sourceEvidence:string[];confidence:number;physicalTruth:false;reviewRequired:true;
};

export type PdfEquipmentMatrixRecord={
 id:string;page:number;tag:string|null;description:string|null;manufacturer:string|null;model:string|null;
 location:string|null;ratings:Record<string,number>;confidence:number;sourceEvidence:string[];
};

export type ElectricalIntelligenceEntity={
 id:string;source:string;layer:string;kind:string;name:string;x:number;y:number;z?:number;
 floor?:string;zone?:string;confidence:number;meta?:Record<string,unknown>;
};

export type ElectricalTakeoffRow={
 key:string;componentClass:string;floor:string;unitId:string|null;planFrameId:string|null;planType:string;count:number;
 entityIds:string[];sourceRefs:string[];pages:number[];legendBacked:number;sldRefs:number;scheduleRefs:number;specRefs:number;
};

export type ElectricalEvidenceFinding={
 id:string;severity:'H2'|'H3';type:
  'LEGEND_UNMAPPED'|'SLD_NOT_LOCATED'|'PLAN_NOT_IN_SLD'|'SCHEDULE_NOT_LOCATED'|'SPEC_SOURCE_MISSING'|
  'SPEC_CLASS_MISSING'|'PRODUCT_IDENTITY_CONFLICT'|'RATING_CONFLICT'|'SYMBOL_GEOMETRY_UNRESOLVED'|'DRAWING_SET_PARTIAL';
 title:string;detail:string;entityRefs:string[];sourceRefs:string[];blocking:boolean;
};

export type ElectricalDesignIntelligence={
 version:'1';legend:{pages:number[];entries:ElectricalLegendEntry[]};
 specifications:{pages:number[];requirements:ElectricalSpecificationRequirement[]};
 takeoff:{rows:ElectricalTakeoffRow[];totalPhysicalEquipment:number;floors:string[]};
 findings:ElectricalEvidenceFinding[];
 summary:{legendEntries:number;specRequirements:number;physicalEquipment:number;takeoffRows:number;findings:number;blocking:number;
  readiness:'COMPLETE_REVIEW'|'PARTIAL_EVIDENCE'|'BLOCKED_CONFLICT';
  coverage:{legend:boolean;physicalPlans:boolean;equipmentMatrix:boolean;sld:boolean;specifications:boolean;drawingSet:boolean}};
};

const clean=(value:unknown)=>String(value??'').replace(/\s+/g,' ').trim();
const norm=(value:unknown)=>clean(value).toUpperCase();
const uniq=<T>(items:T[])=>[...new Set(items)];

export function classifyElectricalLegendDescription(value:string):string|null{
 const text=norm(value);
 const deviceRules:[string,RegExp][]=[
  ['RECEPTACLE_GFCI',/\b(?:GFCI|GFI)\b.*\bRECEPTACLE\b|\bRECEPTACLE\b.*\b(?:GFCI|GFI)\b/],
  ['RECEPTACLE_DOUBLE_DUPLEX',/\bDOUBLE\s+DUPLEX\s+RECEPTACLE\b/],
  ['RECEPTACLE_SWITCHED',/\b(?:HALF[- ]HOT|SWITCHED)\b.*\bRECEPTACLE\b/],
  ['RECEPTACLE_208V',/\b(?:220|208)\s*VOLT\b.*\bRECEPTACLE\b/],
  ['RECEPTACLE_CEILING',/\bCEILING\s+MOUNTED\s+RECEPTACLE\b/],
  ['RECEPTACLE_FLOOR',/\bFLOOR\s+MOUNTED\s+RECEPTACLE\b/],
  ['RECEPTACLE_DUPLEX',/\bDUPLEX\s+RECEPTACLE\b/],
  ['SWITCH_OCCUPANCY',/\bOCCUPANCY\s+SENSOR\s+SWITCH\b/],
  ['SWITCH_DIMMER',/\bDIMMER\b.*\bSWITCH\b|\bSWITCH\b.*\bDIMMER\b/],
  ['SWITCH_4WAY',/\b4[- ]WAY\s+SWITCH\b/],
  ['SWITCH_3WAY',/\b3[- ]WAY\s+SWITCH\b/],
  ['SWITCH_SINGLE_POLE',/\bSINGLE\s+POLE\s+SWITCH\b/],
  ['SWITCH_KEY',/\bKEY\s+SWITCH\b/],
  ['SWITCH_2POLE',/\b2[- ]POLE\s+SWITCH\b/],
  ['SMOKE_DETECTOR',/\bSMOKE\s+DETECTOR\b/],
  ['CO_DETECTOR',/\bCARBON\s+MONOXIDE\s+DETECTOR\b/],
  ['JUNCTION_BOX',/\bJUNCTION\s+BOX\b/],
  ['TELEPHONE_OUTLET',/\bTELEPHONE\s+OUTLET\b/],
  ['THERMOSTAT',/\bTHERMOSTAT\b/],
  ['FAN',/\bFAN\b/],
  ['LIGHT_FIXTURE',/\b(?:LIGHT|LIGHTING)\s+FIXTURE\b|\bLUMINAIRE\b/]
 ];
 for(const [kind,pattern] of deviceRules)if(pattern.test(text))return kind;
 return classifyElectricalLabel(text);
}

export function detectElectricalLegendPage(labels:string[]){
 const text=labels.map(clean).filter(Boolean);
 const title=text.find(value=>/\b(?:ELECTRICAL\s+)?(?:SYMBOLS?|LEGEND|ABBREVIATIONS?|SYMBOLS\s*(?:&|AND)\s*ABBREVIATIONS?)\b/i.test(value));
 const electrical=text.some(value=>/\bELECTRICAL\b/i.test(value));
 const legendCue=text.filter(value=>/\b(?:SYMBOL|ABBREVIATION|DESCRIPTION|DEVICE|FIXTURE|EQUIPMENT)\b/i.test(value)).length;
 const score=(title?6:0)+(electrical?2:0)+Math.min(legendCue,4);
 return {isLegend:Boolean(title&&(electrical||legendCue>=2)),score,title:title||null,reasons:[...(title?['legend/symbol/abbreviation title']:[]),...(electrical?['electrical discipline cue']:[]),...(legendCue>=2?['legend-table vocabulary']:[])]};
}

function abbreviationCandidate(value:string){
 const v=clean(value);
 if(!v||v.length>24||/\d{3,}/.test(v))return false;
 if(/^(?:DESCRIPTION|SYMBOL|ABBREVIATION|LEGEND|ELECTRICAL|NOTES?)$/i.test(v))return false;
 return /^[A-Z0-9][A-Z0-9 ._\-/()#]{0,22}$/.test(v.toUpperCase())&&/[A-Z]/.test(v);
}

function descriptionCandidate(value:string){
 const v=clean(value);
 return v.length>=4&&v.length<=180&&!/^(?:SYMBOL|ABBREVIATION|DESCRIPTION)$/i.test(v);
}

function legendPairNoise(abbreviation:string,description:string){
 const joined=clean(abbreviation+' '+description);
 if(/\b(?:SHEET\s+INDEX|DRAWING\s+INDEX|(?:FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|GROUND|1ST|2ND|3RD|4TH)\s+FLOOR|SITE\s+PLAN|ROOF\s+PLAN|UNIT\s+PLANS?|PHOTOMETRICS|T-24|GENERAL\s+NOTES|CONDUCTOR\s+SIZE|EMERGENCY\s+LIGHTING\s+NOTES|HANDICAP\s+ACCESSIBILITY\s+NOTES|SCOPE\s+OF\s+WORK|UTILITY\s+CONTACTS|ENERGY\s+NOTES|ARTICLE\s+\d+|\bDETAILS?\b|\bSCHEDULE\b|\bJOB\b|\bCLIENT\b)\b/i.test(joined))return true;
 if(/^[A-Z]$/i.test(clean(abbreviation))&&/^FIXTURE$/i.test(clean(description)))return true;
 return false;
}

export function extractElectricalLegendEntries(items:PositionedElectricalText[],page:number):ElectricalLegendEntry[]{
 const allPageItems=items.filter(item=>item.page===page&&clean(item.text));
 const headingItems=allPageItems.filter(item=>/^(?:GENERAL\s+SYMBOLS|ELECTRICAL\s+ABBREVIATIONS|ELECTRICAL\s+SYMBOLS|SYMBOLS\s*(?:&|AND)\s*ABBREVIATIONS)$/i.test(clean(item.text)));
 const pageItems=headingItems.length?(()=>{
  const minX=Math.min(...headingItems.map(item=>item.x)),maxX=Math.max(...headingItems.map(item=>item.x));
  const maxY=Math.max(...headingItems.map(item=>item.y)),minY=Math.min(...headingItems.map(item=>item.y));
  return allPageItems.filter(item=>item.x>=minX-1.5&&item.x<=maxX+2&&item.y<=maxY+.5&&item.y>=minY-6.8&&!headingItems.includes(item));
 })():allPageItems;
 const out:ElectricalLegendEntry[]=[];
 const consumed=new Set<number>();
 for(let i=0;i<pageItems.length;i++){
  const left=pageItems[i],token=clean(left.text);
  if(!abbreviationCandidate(token))continue;
  const near=pageItems.map((item,index)=>({item,index,dx:item.x-left.x,dy:Math.abs(item.y-left.y)}))
   .filter(candidate=>candidate.index!==i&&candidate.dx>0&&candidate.dx<7&&candidate.dy<.28&&descriptionCandidate(candidate.item.text))
   .sort((a,b)=>a.dy-b.dy||a.dx-b.dx)[0];
  if(!near)continue;
  const description=clean(near.item.text);
  if(legendPairNoise(token,description))continue;
  const componentHint=classifyElectricalLegendDescription(token+' '+description);
  out.push({
   id:`legend-${page}-${out.length}-${token.replace(/[^A-Za-z0-9]+/g,'-')}`,
   page,abbreviation:token,description,componentHint:componentHint||null,
   anchor:{x:left.x,y:left.y},confidence:componentHint ? .94 : .82,
   sourceEvidence:[token,description],physicalTruth:false,reviewRequired:true
  });
  consumed.add(i);consumed.add(near.index);
 }
 // Also support single text objects such as "ATS - AUTOMATIC TRANSFER SWITCH".
 for(let i=0;i<pageItems.length;i++){
  if(consumed.has(i))continue;
  const value=clean(pageItems[i].text);
  const match=value.match(/^([A-Z0-9][A-Z0-9 ._\-/()#]{0,20})\s*(?:-|–|—|:)\s*(.{4,160})$/);
  if(!match||!abbreviationCandidate(match[1])||!descriptionCandidate(match[2])||legendPairNoise(match[1],match[2]))continue;
  const componentHint=classifyElectricalLegendDescription(match[1]+' '+match[2]);
  out.push({
   id:`legend-${page}-inline-${out.length}-${match[1].replace(/[^A-Za-z0-9]+/g,'-')}`,
   page,abbreviation:clean(match[1]),description:clean(match[2]),componentHint:componentHint||null,
   anchor:{x:pageItems[i].x,y:pageItems[i].y},confidence:componentHint ? .96 : .84,
   sourceEvidence:[value],physicalTruth:false,reviewRequired:true
  });
 }
 // Capture description-only legend rows whose graphical symbol is the primary key.
 for(const item of pageItems){
  const description=clean(item.text),componentHint=classifyElectricalLegendDescription(description);
  if(!componentHint||legendPairNoise('',description))continue;
  if(abbreviationCandidate(description)&&description.split(/\s+/).length===1)continue;
  if(out.some(entry=>norm(entry.description)===norm(description)))continue;
  out.push({
   id:`legend-${page}-description-${out.length}-${componentHint.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,
   page,abbreviation:'',description,componentHint,anchor:{x:item.x,y:item.y},
   confidence:.78,sourceEvidence:[description],physicalTruth:false,reviewRequired:true
  });
 }
 return [...new Map(out.map(entry=>[`${norm(entry.abbreviation)}|${norm(entry.description)}`,entry])).values()];
}

export function detectPdfEquipmentMatrixPage(labels:string[]){
 const text=labels.map(clean).filter(Boolean);
 const title=text.find(value=>/\b(?:ELECTRICAL\s+)?(?:EQUIPMENT\s+(?:MATRIX|SCHEDULE)|EQUIPMENT\s+LIST|DEVICE\s+SCHEDULE|(?:COMMON\s+AREA\s+\(HOUSE\)\s+)?LIGHT\s+FIXTURE\s+SCHEDULE)\b/i.test(value));
 const headers=new Set<string>();
 for(const value of text){
  const n=norm(value);
  if(/^(?:TAG|MARK|EQUIPMENT\s+ID|FIXTURE)$/.test(n))headers.add('tag');
  if(/^(?:DESCRIPTION|EQUIPMENT|EQUIPMENT\s+TYPE)$/.test(n))headers.add('description');
  if(/^(?:MANUFACTURER|MFR|MAKE)$/.test(n))headers.add('manufacturer');
  if(/^(?:MODEL|MODEL\s+NO\.?|MODEL\s+NUMBER|CATALOG\s+NUMBER|CATALOG\s+NO\.?)$/.test(n))headers.add('model');
  if(/^(?:VOLTAGE|VOLTS?|V)$/.test(n))headers.add('voltage');
  if(/^(?:PHASE|PH)$/.test(n))headers.add('phase');
  if(/^(?:LOCATION|ROOM|AREA)$/.test(n))headers.add('location');
 }
 return{isMatrix:Boolean(title||headers.size>=4),score:(title?6:0)+headers.size,title:title||null,headerFields:[...headers]};
}

function matrixHeaderKey(value:string){
 const n=norm(value);
 if(/^(?:TAG|MARK|EQUIPMENT\s+ID|EQUIPMENT\s+NO\.?|FIXTURE)$/.test(n))return'tag';
 if(/^(?:DESCRIPTION|EQUIPMENT|EQUIPMENT\s+TYPE|TYPE|NAME)$/.test(n))return'description';
 if(/^(?:MANUFACTURER|MFR|MAKE)$/.test(n))return'manufacturer';
 if(/^(?:MODEL|MODEL\s+NO\.?|MODEL\s+NUMBER|CATALOG\s+NUMBER|CATALOG\s+NO\.?)$/.test(n))return'model';
 if(/^(?:VOLTAGE|VOLTS?|V)$/.test(n))return'voltage';
 if(/^(?:PHASE|PH)$/.test(n))return'phase';
 if(/^(?:KVA|INPUT\s+KVA)$/.test(n))return'kva';
 if(/^(?:KW|INPUT\s+KW)$/.test(n))return'kw';
 if(/^(?:WATTS?|W)$/.test(n))return'watts';
 if(/^(?:FLA|FULL\s+LOAD\s+AMPS?)$/.test(n))return'fla';
 if(/^(?:MCA|MINIMUM\s+CIRCUIT\s+AMPACITY)$/.test(n))return'mca';
 if(/^(?:MOCP|MAX(?:IMUM)?\s+OVERCURRENT\s+PROTECTION)$/.test(n))return'mocp';
 if(/^(?:HP|HORSEPOWER)$/.test(n))return'hp';
 if(/^(?:LOCATION|ROOM|AREA|ZONE)$/.test(n))return'location';
 return null;
}
function firstNumber(value:unknown){const match=clean(value).replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);return match?Number(match[0]):null}

export function extractPdfEquipmentMatrixRecords(items:PositionedElectricalText[],page:number):PdfEquipmentMatrixRecord[]{
 const pageItems=items.filter(item=>item.page===page&&clean(item.text)).sort((a,b)=>b.y-a.y||a.x-b.x);
 if(!pageItems.length)return[];
 const rows:{y:number;items:PositionedElectricalText[]}[]=[];
 for(const item of pageItems){
  let row=rows.find(candidate=>Math.abs(candidate.y-item.y)<=.16);
  if(!row){row={y:item.y,items:[]};rows.push(row)}
  row.items.push(item);row.y=(row.y*(row.items.length-1)+item.y)/row.items.length;
 }
 for(const row of rows)row.items.sort((a,b)=>a.x-b.x);
 let header:{row:{y:number;items:PositionedElectricalText[]};columns:{key:string;x:number}[]}|null=null;
 for(const row of rows){
  const columns=row.items.map(item=>({key:matrixHeaderKey(item.text),x:item.x})).filter((item):item is {key:string;x:number}=>Boolean(item.key));
  if(columns.length>=3&&(!header||columns.length>header.columns.length))header={row,columns};
 }
 if(!header)return[];
 const records:PdfEquipmentMatrixRecord[]=[];
 const ordered=[...header.columns].sort((a,b)=>a.x-b.x);
 const rowCandidates=rows.filter(row=>row.y<header!.row.y-.12);
 for(const row of rowCandidates){
  const cells:Record<string,string>={};
  for(const item of row.items){
   let best=ordered[0],distance=Infinity;
   for(const column of ordered){const d=Math.abs(item.x-column.x);if(d<distance){distance=d;best=column}}
   if(distance>2.8)continue;
   cells[best.key]=clean([cells[best.key],item.text].filter(Boolean).join(' '));
  }
  const tag=clean(cells.tag)||null,description=clean(cells.description)||null;
  if(!tag&&!description)continue;
  const identity=classifyElectricalLabel([tag,description].filter(Boolean).join(' '));
  const ratings:Record<string,number>={};
  for(const key of ['voltage','phase','kva','kw','watts','fla','mca','mocp','hp']){const value=firstNumber(cells[key]);if(value!==null)ratings[key]=value}
  const hasEngineering=Boolean(identity||Object.keys(ratings).length||cells.manufacturer||cells.model);
  if(!hasEngineering)continue;
  records.push({
   id:`pdf-matrix-${page}-${records.length}-${(tag||description||'row').replace(/[^A-Za-z0-9]+/g,'-').slice(0,80)}`,
   page,tag,description,manufacturer:clean(cells.manufacturer)||null,model:clean(cells.model)||null,
   location:clean(cells.location)||null,ratings,confidence:tag&&identity ? .94 : tag ? .86 : .74,
   sourceEvidence:[row.items.map(item=>clean(item.text)).join(' | ')]
  });
 }
 return records.slice(0,1000);
}

export function detectElectricalSpecificationPage(labels:string[]){
 const text=labels.map(clean).filter(Boolean);
 const section=text.find(value=>/\bSECTION\s+26(?:\s|\d|\.)/i.test(value)||/^26\s?\d{2}\s?\d{2}\b/.test(value));
 const title=text.find(value=>/\bELECTRICAL\s+SPECIFICATIONS?\b|\bPART\s+[123]\s*[-–—:]?\s*(?:GENERAL|PRODUCTS|EXECUTION)\b/i.test(value));
 const score=(section?7:0)+(title?4:0)+text.filter(value=>/\b(?:MANUFACTURERS?|PRODUCTS?|SUBMITTALS?|EXECUTION|MATERIALS?)\b/i.test(value)).length;
 return {isSpecification:Boolean(section||title&&score>=6),score,section:section||null,title:title||null};
}

function parseRatings(text:string){
 const ratings:Record<string,number|string>={};
 const patterns:[string,RegExp][]=[
  ['voltage',/\b(\d{2,5})\s*V(?:OLTS?)?\b/i],['amperage',/\b(\d{2,5})\s*A(?:MPS?|MPERES?)?\b/i],
  ['kva',/\b(\d+(?:\.\d+)?)\s*KVA\b/i],['kw',/\b(\d+(?:\.\d+)?)\s*KW\b/i],
  ['phase',/\b([13])\s*(?:PH|PHASE)\b/i],['frequencyHz',/\b(50|60)\s*HZ\b/i]
 ];
 for(const [key,pattern] of patterns){const match=text.match(pattern);if(match)ratings[key]=Number(match[1]);}
 return ratings;
}

export function extractElectricalSpecificationRequirements(labels:string[],page:number):ElectricalSpecificationRequirement[]{
 const lines=labels.map(clean).filter(Boolean);
 let section:string|null=null;
 for(const line of lines){const m=line.match(/\bSECTION\s+(26(?:\s|\d|\.){2,12})/i)||line.match(/^((?:26\s?\d{2}\s?\d{2}))\b/);if(m){section=clean(m[1]);break}}
 const out:ElectricalSpecificationRequirement[]=[];
 for(let i=0;i<lines.length;i++){
  const line=lines[i];
  const componentHint=classifyElectricalLabel(line);
  const meaningful=/\b(?:MANUFACTURER|MODEL|RATED|RATING|VOLT|AMP|KVA|KW|PANEL|SWITCHBOARD|SWITCHGEAR|TRANSFORMER|ATS|GENERATOR|UPS|MCC|DISCONNECT|BREAKER|EVSE|LIGHTING|LUMINAIRE)\b/i.test(line);
  if(!componentHint&&!meaningful)continue;
  const context=[lines[i-1],line,lines[i+1]].filter(Boolean).join(' · ');
  const maker=context.match(/\b(?:MANUFACTURER|MFR)S?\s*[:=]?\s*([A-Z][A-Z0-9& .\-]{2,50})/i);
  const model=context.match(/\bMODEL\s*(?:NO\.?|NUMBER)?\s*[:=]?\s*([A-Z0-9][A-Z0-9._\-/]{1,40})/i);
  const ratings=parseRatings(context);
  out.push({
   id:`spec-${page}-${out.length}`,page,section,title:line,componentHint:componentHint||null,
   manufacturer:maker?clean(maker[1]):null,model:model?clean(model[1]):null,ratings,
   sourceEvidence:[context],confidence:componentHint ? .9 : .72,physicalTruth:false,reviewRequired:true
  });
 }
 return out.slice(0,500);
}

function entityTag(entity:ElectricalIntelligenceEntity){
 const explicit=clean(entity.meta?.assetTag||entity.meta?.equipmentTag||entity.meta?.tag);
 if(explicit)return norm(explicit).replace(/\s+/g,'-');
 const m=norm(entity.name).match(/\b(?:ATS|UPS|MCC|PDU|MDP|MDB|MSB|XFMR|TX|GEN|EVSE|PANEL|PNL|SWBD|SWGR)[-_ ]?#?[A-Z0-9]+(?:[-_.][A-Z0-9]+)*\b/);
 return m?.[0]?.replace(/\s+/g,'-')||null;
}
function componentClass(entity:ElectricalIntelligenceEntity){
 return clean(entity.meta?.electricalComponentHint||entity.meta?.poweredEquipmentClass)||classifyElectricalLabel(entity.name)||'UNRESOLVED';
}
function physicalPlanEntity(entity:ElectricalIntelligenceEntity){
 return entity.meta?.nonSpatial!==true&&entity.meta?.referenceOnly!==true&&
  (entity.layer==='L2'||entity.layer==='L4')&&entity.meta?.sldCandidate!==true&&
  !['asset-candidate','schedule-powered-equipment-candidate'].includes(entity.kind)&&entity.meta?.cadPhysicalAnchor!==false;
}
function scheduleEntity(entity:ElectricalIntelligenceEntity){
 return entity.meta?.nonSpatial===true&&['EQUIPMENT_SCHEDULE','TEXT_EQUIPMENT_SCHEDULE'].includes(String(entity.meta?.sourceType||''));
}
function legendEntity(entity:ElectricalIntelligenceEntity){return entity.kind==='electrical-legend-entry'}
function specEntity(entity:ElectricalIntelligenceEntity){return entity.kind==='electrical-spec-requirement'}
function sldEntity(entity:ElectricalIntelligenceEntity){return entity.meta?.sldCandidate===true&&(entity.layer==='L2'||entity.layer==='L4')}

export function buildElectricalDesignIntelligence(entities:ElectricalIntelligenceEntity[],options?:{drawingSetPartial?:boolean;missingSheets?:string[]}):ElectricalDesignIntelligence{
 const legends=entities.filter(legendEntity).map(entity=>entity.meta?.legendEntry as ElectricalLegendEntry).filter(Boolean);
 const specs=entities.filter(specEntity).map(entity=>entity.meta?.specRequirement as ElectricalSpecificationRequirement).filter(Boolean);
 const physicalRaw=entities.filter(physicalPlanEntity);
 const physical=[...physicalRaw].sort((a,b)=>{
  const authority=(e:ElectricalIntelligenceEntity)=>(e.meta?.legendBacked===true?3:0)+(e.meta?.symbolAnchorStatus==='RESOLVED_REVIEW_CANDIDATE'?2:0)+e.confidence;
  return authority(b)-authority(a);
 }).filter((entity,index,array)=>{
  const cls=componentClass(entity),page=Number(entity.meta?.page||0);
  return !array.slice(0,index).some(other=>componentClass(other)===cls&&Number(other.meta?.page||0)===page&&Math.hypot(other.x-entity.x,other.y-entity.y)<.07);
 });
 const schedules=entities.filter(scheduleEntity);
 const sld=entities.filter(sldEntity);
 const legendClasses=new Set(legends.map(entry=>entry.componentHint).filter(Boolean));
 const specClasses=new Set(specs.map(entry=>entry.componentHint).filter(Boolean));
 const specSourcePresent=specs.length>0;
 const rows=new Map<string,ElectricalTakeoffRow>();
 for(const entity of physical){
  const cls=componentClass(entity),floor=clean(entity.floor)||'UNRESOLVED',planType=clean(entity.meta?.planType)||'UNCLASSIFIED_PLAN';
  const unitId=clean(entity.meta?.planFrameUnitId)||null,planFrameId=clean(entity.meta?.planFrameId)||null;
  const locationBucket=unitId?`UNIT:${unitId}`:planFrameId?`FRAME:${planFrameId}`:floor;
  const key=`${locationBucket}|${planType}|${cls}`,prior=rows.get(key);
  const tag=entityTag(entity);
  const scheduleRefs=schedules.filter(item=>tag&&entityTag(item)===tag).map(item=>item.id);
  const sldRefs=sld.filter(item=>(tag&&entityTag(item)===tag)||componentClass(item)===cls).map(item=>item.id);
  const specRefs=specs.filter(item=>item.componentHint===cls).map(item=>item.id);
  if(prior){
   prior.count++;prior.entityIds.push(entity.id);prior.sourceRefs=uniq([...prior.sourceRefs,entity.source]);prior.pages=uniq([...prior.pages,Number(entity.meta?.page||0)].filter(Boolean));
   prior.legendBacked+=legendClasses.has(cls)?1:0;prior.sldRefs+=sldRefs.length?1:0;prior.scheduleRefs+=scheduleRefs.length?1:0;prior.specRefs+=specRefs.length?1:0;
  }else rows.set(key,{key,componentClass:cls,floor,unitId,planFrameId,planType,count:1,entityIds:[entity.id],sourceRefs:[entity.source],pages:[Number(entity.meta?.page||0)].filter(Boolean),legendBacked:legendClasses.has(cls)?1:0,sldRefs:sldRefs.length?1:0,scheduleRefs:scheduleRefs.length?1:0,specRefs:specRefs.length?1:0});
 }
 const findings:ElectricalEvidenceFinding[]=[];
 if(options?.drawingSetPartial)findings.push({id:'elec:drawing-set-partial',severity:'H2',type:'DRAWING_SET_PARTIAL',title:'Indexed electrical drawing set is incomplete',detail:`The source index references sheets that are not present in this compilation${options.missingSheets?.length?': '+options.missingSheets.join(', '):''}. Completeness remains partial; missing sheets are never inferred.`,entityRefs:[],sourceRefs:[],blocking:false});
 const graphicalLegendClasses=new Set(legends.map(item=>item.componentHint).filter((value):value is string=>Boolean(value)&&/^(?:RECEPTACLE_|SWITCH_|SMOKE_DETECTOR|CO_DETECTOR|JUNCTION_BOX|TELEPHONE_OUTLET|THERMOSTAT|FAN|LIGHT_FIXTURE)/.test(String(value))));
 const fingerprintClasses=new Set(entities.filter(entity=>entity.kind==='electrical-legend-symbol-fingerprint'||entity.kind==='electrical-legend-open-symbol-fingerprint').map(entity=>{const meta=entity.meta as any;return clean(meta?.legendSymbolFingerprint?.componentClass||meta?.legendOpenSymbolFingerprint?.componentClass)}).filter(Boolean));
 for(const cls of graphicalLegendClasses)if(!fingerprintClasses.has(cls))findings.push({
  id:`elec:symbol-geometry:${cls}`,severity:'H2',type:'SYMBOL_GEOMETRY_UNRESOLVED',
  title:`${cls} legend geometry is not yet matchable`,
  detail:'The project legend defines this graphical device class, but STRATUM has not derived a defensible vector/open-stroke fingerprint. Quantity takeoff for this class remains incomplete; no occurrences are invented.',
  entityRefs:[],sourceRefs:uniq(legends.filter(item=>item.componentHint===cls).flatMap(item=>item.sourceEvidence)),blocking:false
 });
 const physicalTags=new Set(physical.map(entityTag).filter(Boolean));
 const sldTags=new Set(sld.map(entityTag).filter(Boolean));
 for(const entity of physical){
  const cls=componentClass(entity),tag=entityTag(entity);
  if(legends.length&&cls!=='UNRESOLVED'&&!legendClasses.has(cls))findings.push({id:`elec:legend:${entity.id}`,severity:'H2',type:'LEGEND_UNMAPPED',title:`${entity.name} is not mapped to the project legend`,detail:'The physical-plan candidate was classified, but no legend entry currently corroborates that equipment class.',entityRefs:[entity.id],sourceRefs:[entity.source],blocking:false});
  if(tag&&sld.length&&!sldTags.has(tag))findings.push({id:`elec:sld-missing:${entity.id}`,severity:'H2',type:'PLAN_NOT_IN_SLD',title:`${tag} is located on a plan but not reconciled to the SLD`,detail:'Confirm whether the equipment is intentionally omitted from the single-line/riser, represented under another tag, or incompletely extracted.',entityRefs:[entity.id],sourceRefs:[entity.source],blocking:false});
 }
 for(const entity of sld){
  const tag=entityTag(entity);if(tag&&!physicalTags.has(tag))findings.push({id:`elec:plan-missing:${entity.id}`,severity:'H2',type:'SLD_NOT_LOCATED',title:`${tag} appears in the SLD but has no located physical-plan counterpart`,detail:'The SLD identifies this equipment but no physical plan entity with the same tag has been located.',entityRefs:[entity.id],sourceRefs:[entity.source],blocking:false});
 }
 for(const entity of schedules){
  const tag=entityTag(entity);if(tag&&!physicalTags.has(tag))findings.push({id:`elec:schedule-missing:${entity.id}`,severity:'H2',type:'SCHEDULE_NOT_LOCATED',title:`${tag} appears in the equipment matrix but is not located on a physical plan`,detail:'The equipment matrix/schedule record is preserved as non-spatial evidence until a physical-plan counterpart is found.',entityRefs:[entity.id],sourceRefs:[entity.source],blocking:false});
 }

 const ratingKeys=['voltage','phase','kva','kw','amperage'] as const;
 for(const entity of physical){
  const tag=entityTag(entity),cls=componentClass(entity);
  const matchedSchedules=schedules.filter(item=>tag&&entityTag(item)===tag);
  const matchedSpecs=specs.filter(item=>item.componentHint===cls);
  if(!matchedSchedules.length||!matchedSpecs.length)continue;
  const scheduleManufacturers=uniq(matchedSchedules.map(item=>norm(item.meta?.manufacturer||item.meta?.manufacturerName)).filter(Boolean));
  const specManufacturers=uniq(matchedSpecs.map(item=>norm(item.manufacturer)).filter(Boolean));
  if(scheduleManufacturers.length&&specManufacturers.length&&!scheduleManufacturers.some(value=>specManufacturers.includes(value))){
   findings.push({id:`elec:product-conflict:${entity.id}`,severity:'H3',type:'PRODUCT_IDENTITY_CONFLICT',title:`${tag||entity.name} manufacturer conflicts with specification evidence`,detail:`Equipment matrix manufacturer ${scheduleManufacturers.join(', ')} does not match the structured specification manufacturer evidence ${specManufacturers.join(', ')}. Preserve both sources and block exact-product promotion pending review.`,entityRefs:[entity.id,...matchedSchedules.map(item=>item.id)],sourceRefs:uniq([entity.source,...matchedSchedules.map(item=>item.source)]),blocking:true});
  }
  for(const schedule of matchedSchedules){
   const scheduleRatings:Record<string,number|null>={
    voltage:Number.isFinite(Number(schedule.meta?.voltage))?Number(schedule.meta?.voltage):null,
    phase:Number.isFinite(Number(schedule.meta?.phase))?Number(schedule.meta?.phase):null,
    kva:Number.isFinite(Number(schedule.meta?.inputKva))?Number(schedule.meta?.inputKva):null,
    kw:Number.isFinite(Number(schedule.meta?.inputKw))?Number(schedule.meta?.inputKw):null,
    amperage:Number.isFinite(Number(schedule.meta?.fla))?Number(schedule.meta?.fla):Number.isFinite(Number(schedule.meta?.mca))?Number(schedule.meta?.mca):null
   };
   for(const spec of matchedSpecs){
    const mismatches=ratingKeys.filter(key=>{
     const a=scheduleRatings[key],b=spec.ratings[key];
     return a!==null&&typeof b==='number'&&Math.abs(a-b)>1e-6;
    });
    if(mismatches.length)findings.push({id:`elec:rating-conflict:${entity.id}:${schedule.id}:${spec.id}`,severity:'H3',type:'RATING_CONFLICT',title:`${tag||entity.name} ratings conflict between matrix and specifications`,detail:`Conflicting fields: ${mismatches.join(', ')}. STRATUM preserves the disagreement and blocks exact-product promotion until the effective design source is reviewed.`,entityRefs:[entity.id,schedule.id],sourceRefs:uniq([entity.source,schedule.source]),blocking:true});
   }
  }
 }
 if(!specSourcePresent&&physical.length)findings.push({id:'elec:spec-source-missing',severity:'H2',type:'SPEC_SOURCE_MISSING',title:'Electrical specification evidence has not been ingested',detail:'The audio-defined workflow requires an applicable specification comparison for every resolved electrical item. 3D family previews may remain available, but exact-product resolution must remain review-gated until specification evidence is supplied or explicitly waived.',entityRefs:physical.map(item=>item.id),sourceRefs:uniq(physical.map(item=>item.source)),blocking:false});
 else if(specSourcePresent){
  for(const row of rows.values())if(row.componentClass!=='UNRESOLVED'&&!specClasses.has(row.componentClass))findings.push({id:`elec:spec-class:${row.key}`,severity:'H2',type:'SPEC_CLASS_MISSING',title:`${row.componentClass} has no matched specification requirement`,detail:'Specification pages were ingested, but no requirement was matched to this quantified equipment class. Review the applicable section and terminology.',entityRefs:row.entityIds,sourceRefs:row.sourceRefs,blocking:false});
 }
 const blockingCount=findings.filter(item=>item.blocking).length;
 const coverage={legend:legends.length>0,physicalPlans:physical.length>0,equipmentMatrix:schedules.length>0,sld:sld.length>0,specifications:specs.length>0,drawingSet:!options?.drawingSetPartial};
 const unresolvedSymbolGeometry=findings.some(item=>item.type==='SYMBOL_GEOMETRY_UNRESOLVED');
 const readiness=blockingCount>0?'BLOCKED_CONFLICT':Object.values(coverage).every(Boolean)&&!unresolvedSymbolGeometry?'COMPLETE_REVIEW':'PARTIAL_EVIDENCE';
 return{
  version:'1',
  legend:{pages:uniq(legends.map(item=>item.page)),entries:legends},
  specifications:{pages:uniq(specs.map(item=>item.page)),requirements:specs},
  takeoff:{rows:[...rows.values()].sort((a,b)=>(a.unitId||a.floor).localeCompare(b.unitId||b.floor)||a.componentClass.localeCompare(b.componentClass)),totalPhysicalEquipment:physical.length,floors:uniq(physical.map(item=>clean(item.floor)||'UNRESOLVED')).sort()},
  findings,
  summary:{legendEntries:legends.length,specRequirements:specs.length,physicalEquipment:physical.length,takeoffRows:rows.size,findings:findings.length,blocking:blockingCount,readiness,coverage}
 };
}

export function enrichElectricalDesignIntelligence<T extends {entities:ElectricalIntelligenceEntity[];sources?:Array<{setCompleteness?:{status?:string;missingSheets?:string[]}}>}>(graph:T):T&{electricalIntelligence:ElectricalDesignIntelligence}{
 const partialSources=(graph.sources||[]).filter(source=>source.setCompleteness?.status==='PARTIAL');
 const missingSheets=uniq(partialSources.flatMap(source=>source.setCompleteness?.missingSheets||[]));
 const intelligence=buildElectricalDesignIntelligence(graph.entities,{drawingSetPartial:partialSources.length>0,missingSheets});
 const schedules=graph.entities.filter(scheduleEntity);
 const sld=graph.entities.filter(sldEntity);
 const findingByEntity=new Map<string,ElectricalEvidenceFinding[]>();
 for(const finding of intelligence.findings)for(const id of finding.entityRefs)findingByEntity.set(id,[...(findingByEntity.get(id)||[]),finding]);
 const nextEntities=graph.entities.map(entity=>{
  if(!physicalPlanEntity(entity))return entity;
  const cls=componentClass(entity),findings=findingByEntity.get(entity.id)||[];
  const blocking=findings.some(item=>item.blocking),tag=entityTag(entity);
  const legendAvailable=intelligence.legend.entries.length>0;
  const specificationAvailable=intelligence.specifications.requirements.length>0;
  const scheduleAvailable=schedules.length>0,sldAvailable=sld.length>0;
  const legendCompared=intelligence.legend.entries.some(item=>item.componentHint===cls);
  const specCompared=intelligence.specifications.requirements.some(item=>item.componentHint===cls);
  const scheduleCompared=schedules.some(item=>tag&&entityTag(item)===tag);
  const sldCompared=sld.some(item=>(tag&&entityTag(item)===tag)||(!tag&&componentClass(item)===cls));
  const majorEquipment=['UTILITY_SOURCE','GENERATOR_SOURCE','PV_SOURCE','BATTERY_SOURCE','UPS','TRANSFORMER','SWITCHGEAR','SWITCHBOARD','ATS','BREAKER','MCC','PDU','PANEL','DISCONNECT','VFD','INVERTER','EVSE','MOTOR','METER'].includes(cls);
  const required=[
   {name:'legend',applicable:legendAvailable,passed:!legendAvailable||legendCompared},
   {name:'specification',applicable:true,passed:specificationAvailable&&specCompared},
   {name:'equipmentMatrix',applicable:majorEquipment&&Boolean(tag),passed:!majorEquipment||!tag||(scheduleAvailable&&scheduleCompared)},
   {name:'sld',applicable:majorEquipment&&Boolean(tag),passed:!majorEquipment||!tag||(sldAvailable&&sldCompared)}
  ];
  const missing=required.filter(item=>item.applicable&&!item.passed).map(item=>item.name);
  const reconciled=!blocking&&missing.length===0;
  return {...entity,meta:{...(entity.meta||{}),
   electricalEvidenceGate:blocking?'BLOCKED_CONFLICT':reconciled?'EVIDENCE_RECONCILED_REVIEW':'EVIDENCE_PARTIAL_REVIEW',
   electricalLegendCompared:legendCompared,electricalSpecificationCompared:specCompared,
   electricalScheduleCompared:scheduleCompared,electricalSldCompared:sldCompared,
   electricalEvidenceMissing:missing,electricalEvidenceCoverage:{legendAvailable,specificationAvailable,scheduleAvailable,sldAvailable,majorEquipment},
   electricalEvidenceFindingIds:findings.map(item=>item.id),electricalTakeoffIncluded:true,physicalTruth:false,reviewRequired:true}};
 });
 return {...graph,entities:nextEntities,electricalIntelligence:intelligence};
}
