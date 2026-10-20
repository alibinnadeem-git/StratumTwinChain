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
 key:string;componentClass:string;floor:string;planType:string;count:number;
 entityIds:string[];sourceRefs:string[];pages:number[];legendBacked:number;sldRefs:number;scheduleRefs:number;specRefs:number;
};

export type ElectricalEvidenceFinding={
 id:string;severity:'H2'|'H3';type:
  'LEGEND_UNMAPPED'|'SLD_NOT_LOCATED'|'PLAN_NOT_IN_SLD'|'SCHEDULE_NOT_LOCATED'|'SPEC_SOURCE_MISSING'|
  'SPEC_CLASS_MISSING'|'PRODUCT_IDENTITY_CONFLICT'|'RATING_CONFLICT';
 title:string;detail:string;entityRefs:string[];sourceRefs:string[];blocking:boolean;
};

export type ElectricalDesignIntelligence={
 version:'1';legend:{pages:number[];entries:ElectricalLegendEntry[]};
 specifications:{pages:number[];requirements:ElectricalSpecificationRequirement[]};
 takeoff:{rows:ElectricalTakeoffRow[];totalPhysicalEquipment:number;floors:string[]};
 findings:ElectricalEvidenceFinding[];
 summary:{legendEntries:number;specRequirements:number;physicalEquipment:number;takeoffRows:number;findings:number;blocking:number};
};

const clean=(value:unknown)=>String(value??'').replace(/\s+/g,' ').trim();
const norm=(value:unknown)=>clean(value).toUpperCase();
const uniq=<T>(items:T[])=>[...new Set(items)];

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

export function extractElectricalLegendEntries(items:PositionedElectricalText[],page:number):ElectricalLegendEntry[]{
 const pageItems=items.filter(item=>item.page===page&&clean(item.text));
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
  const componentHint=classifyElectricalLabel(token+' '+description);
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
  if(!match||!abbreviationCandidate(match[1])||!descriptionCandidate(match[2]))continue;
  const componentHint=classifyElectricalLabel(match[1]+' '+match[2]);
  out.push({
   id:`legend-${page}-inline-${out.length}-${match[1].replace(/[^A-Za-z0-9]+/g,'-')}`,
   page,abbreviation:clean(match[1]),description:clean(match[2]),componentHint:componentHint||null,
   anchor:{x:pageItems[i].x,y:pageItems[i].y},confidence:componentHint ? .96 : .84,
   sourceEvidence:[value],physicalTruth:false,reviewRequired:true
  });
 }
 return [...new Map(out.map(entry=>[`${norm(entry.abbreviation)}|${norm(entry.description)}`,entry])).values()];
}

export function detectPdfEquipmentMatrixPage(labels:string[]){
 const text=labels.map(clean).filter(Boolean);
 const title=text.find(value=>/\b(?:ELECTRICAL\s+)?(?:EQUIPMENT\s+(?:MATRIX|SCHEDULE)|EQUIPMENT\s+LIST|DEVICE\s+SCHEDULE)\b/i.test(value));
 const headers=new Set<string>();
 for(const value of text){
  const n=norm(value);
  if(/^(?:TAG|MARK|EQUIPMENT\s+ID)$/.test(n))headers.add('tag');
  if(/^(?:DESCRIPTION|EQUIPMENT|EQUIPMENT\s+TYPE)$/.test(n))headers.add('description');
  if(/^(?:MANUFACTURER|MFR|MAKE)$/.test(n))headers.add('manufacturer');
  if(/^(?:MODEL|MODEL\s+NO\.?|MODEL\s+NUMBER)$/.test(n))headers.add('model');
  if(/^(?:VOLTAGE|VOLTS?|V)$/.test(n))headers.add('voltage');
  if(/^(?:PHASE|PH)$/.test(n))headers.add('phase');
  if(/^(?:LOCATION|ROOM|AREA)$/.test(n))headers.add('location');
 }
 return{isMatrix:Boolean(title||headers.size>=4),score:(title?6:0)+headers.size,title:title||null,headerFields:[...headers]};
}

function matrixHeaderKey(value:string){
 const n=norm(value);
 if(/^(?:TAG|MARK|EQUIPMENT\s+ID|EQUIPMENT\s+NO\.?)$/.test(n))return'tag';
 if(/^(?:DESCRIPTION|EQUIPMENT|EQUIPMENT\s+TYPE|TYPE|NAME)$/.test(n))return'description';
 if(/^(?:MANUFACTURER|MFR|MAKE)$/.test(n))return'manufacturer';
 if(/^(?:MODEL|MODEL\s+NO\.?|MODEL\s+NUMBER)$/.test(n))return'model';
 if(/^(?:VOLTAGE|VOLTS?|V)$/.test(n))return'voltage';
 if(/^(?:PHASE|PH)$/.test(n))return'phase';
 if(/^(?:KVA|INPUT\s+KVA)$/.test(n))return'kva';
 if(/^(?:KW|INPUT\s+KW)$/.test(n))return'kw';
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
  for(const key of ['voltage','phase','kva','kw','fla','mca','mocp','hp']){const value=firstNumber(cells[key]);if(value!==null)ratings[key]=value}
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

export function buildElectricalDesignIntelligence(entities:ElectricalIntelligenceEntity[]):ElectricalDesignIntelligence{
 const legends=entities.filter(legendEntity).map(entity=>entity.meta?.legendEntry as ElectricalLegendEntry).filter(Boolean);
 const specs=entities.filter(specEntity).map(entity=>entity.meta?.specRequirement as ElectricalSpecificationRequirement).filter(Boolean);
 const physical=entities.filter(physicalPlanEntity);
 const schedules=entities.filter(scheduleEntity);
 const sld=entities.filter(sldEntity);
 const legendClasses=new Set(legends.map(entry=>entry.componentHint).filter(Boolean));
 const specClasses=new Set(specs.map(entry=>entry.componentHint).filter(Boolean));
 const specSourcePresent=specs.length>0;
 const rows=new Map<string,ElectricalTakeoffRow>();
 for(const entity of physical){
  const cls=componentClass(entity),floor=clean(entity.floor)||'UNRESOLVED',planType=clean(entity.meta?.planType)||'UNCLASSIFIED_PLAN';
  const key=`${floor}|${planType}|${cls}`,prior=rows.get(key);
  const tag=entityTag(entity);
  const scheduleRefs=schedules.filter(item=>tag&&entityTag(item)===tag).map(item=>item.id);
  const sldRefs=sld.filter(item=>(tag&&entityTag(item)===tag)||componentClass(item)===cls).map(item=>item.id);
  const specRefs=specs.filter(item=>item.componentHint===cls).map(item=>item.id);
  if(prior){
   prior.count++;prior.entityIds.push(entity.id);prior.sourceRefs=uniq([...prior.sourceRefs,entity.source]);prior.pages=uniq([...prior.pages,Number(entity.meta?.page||0)].filter(Boolean));
   prior.legendBacked+=legendClasses.has(cls)?1:0;prior.sldRefs+=sldRefs.length?1:0;prior.scheduleRefs+=scheduleRefs.length?1:0;prior.specRefs+=specRefs.length?1:0;
  }else rows.set(key,{key,componentClass:cls,floor,planType,count:1,entityIds:[entity.id],sourceRefs:[entity.source],pages:[Number(entity.meta?.page||0)].filter(Boolean),legendBacked:legendClasses.has(cls)?1:0,sldRefs:sldRefs.length?1:0,scheduleRefs:scheduleRefs.length?1:0,specRefs:specRefs.length?1:0});
 }
 const findings:ElectricalEvidenceFinding[]=[];
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
 return{
  version:'1',
  legend:{pages:uniq(legends.map(item=>item.page)),entries:legends},
  specifications:{pages:uniq(specs.map(item=>item.page)),requirements:specs},
  takeoff:{rows:[...rows.values()].sort((a,b)=>a.floor.localeCompare(b.floor)||a.componentClass.localeCompare(b.componentClass)),totalPhysicalEquipment:physical.length,floors:uniq(physical.map(item=>clean(item.floor)||'UNRESOLVED')).sort()},
  findings,
  summary:{legendEntries:legends.length,specRequirements:specs.length,physicalEquipment:physical.length,takeoffRows:rows.size,findings:findings.length,blocking:findings.filter(item=>item.blocking).length}
 };
}

export function enrichElectricalDesignIntelligence<T extends {entities:ElectricalIntelligenceEntity[]}>(graph:T):T&{electricalIntelligence:ElectricalDesignIntelligence}{
 const intelligence=buildElectricalDesignIntelligence(graph.entities);
 const findingByEntity=new Map<string,ElectricalEvidenceFinding[]>();
 for(const finding of intelligence.findings)for(const id of finding.entityRefs)findingByEntity.set(id,[...(findingByEntity.get(id)||[]),finding]);
 const nextEntities=graph.entities.map(entity=>{
  if(!physicalPlanEntity(entity))return entity;
  const cls=componentClass(entity),findings=findingByEntity.get(entity.id)||[];
  const blocking=findings.some(item=>item.blocking);
  const specCompared=intelligence.specifications.requirements.some(item=>item.componentHint===cls);
  const legendCompared=intelligence.legend.entries.some(item=>item.componentHint===cls);
  return {...entity,meta:{...(entity.meta||{}),electricalEvidenceGate:blocking?'BLOCKED_CONFLICT':specCompared?'EVIDENCE_RECONCILED_REVIEW':'EVIDENCE_PARTIAL_REVIEW',electricalLegendCompared:legendCompared,electricalSpecificationCompared:specCompared,electricalEvidenceFindingIds:findings.map(item=>item.id),electricalTakeoffIncluded:true,physicalTruth:false,reviewRequired:true}};
 });
 return {...graph,entities:nextEntities,electricalIntelligence:intelligence};
}
