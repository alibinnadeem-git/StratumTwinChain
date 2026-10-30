// The project's own equipment list, and where that equipment is drawn (docs/SPATIAL_SOURCE_FIDELITY_PLAN.md,
// Phase 20).
//
// The fixed label vocabulary (lib/sld-recognition.ts) knows "MS1" but not "HP1", "HL" or "HWH": those names
// belong to one project. The project states them itself, in its panel schedules, its service load table and
// its one-line. This module reads that roster from the drawings (schedules arrive as OCR text from the
// pasted images, lib/ocr-regions.ts; the one-line from the PDF text layer, lib/text-phrases.ts) and checks it
// against the drawings' own arithmetic: circuit subtotals add up to the printed total, VA ÷ volts gives the
// printed amps, and the service table repeats each panel's load. Then it finds each roster name on the
// plans where it labels a drawn symbol, plus the unit load centres ("ELEC. PANEL" over a filled bar) and the
// sections of a switchboard lineup (DIST and P/S beside MS1).
//
// Truth boundary: every roster value and every placement is a review candidate (physicalTruth false); a
// failed check is recorded, never hidden; nothing is deleted.

import {footprintOf,sharesSide,type CompactTextPhrase,type DrawnFootprint,type SheetBox} from "./text-phrases.ts";

export type RosterKind="PANELBOARD"|"SWITCHBOARD";
export type RosterCheck={id:string;passed:boolean;detail:string};
export type RosterSourceKind="PANEL_SCHEDULE"|"SERVICE_LOAD_TABLE"|"DWELLING_LOAD_TABLE"|"ONE_LINE_TEXT";
export type RosterSource={page:number;kind:RosterSourceKind;evidence:string;regionId?:string};
export type RosterEntry={
  tag:string;kind:RosterKind;
  ratingAmps:number|null;busAmps:number|null;mains:"LUGS"|"MAIN_BREAKER"|null;
  voltage:string|null;phases:1|3|null;wires:number|null;
  mounting:"SURFACE"|"FLUSH"|null;location:string|null;
  totalVa:number|null;totalAmps:number|null;
  fedFrom:string|null;feeds:string[];servedUnits:number|null;demandAmps:number|null;
  sources:RosterSource[];checks:RosterCheck[];confidence:number;
};

export type OcrRegionText={page:number;regionId:string;lines:string[]};
export type TextLayerPage={page:number;source:string;isPlan:boolean;isSld:boolean;planType:string|null;planDiscipline:string|null;floor:string;phrases:CompactTextPhrase[]};

const TAG="[A-Z]{1,4}\\d{0,3}[A-Z]?";
const number=(text:string)=>Number(text.replace(/,/g,""));
export const normalizeTag=(text:string)=>text.toUpperCase().replace(/[\s-]+/g,"").replace(/^PANEL(?=[A-Z])/,"");

function emptyEntry(tag:string,kind:RosterKind):RosterEntry{
  return{tag,kind,ratingAmps:null,busAmps:null,mains:null,voltage:null,phases:null,wires:null,mounting:null,location:null,totalVa:null,totalAmps:null,
    fedFrom:null,feeds:[],servedUnits:null,demandAmps:null,sources:[],checks:[],confidence:0};
}

// "TOTAL = 10820 VA = 52 AMPS": the last stated total in the schedule.
function scheduleTotal(text:string){
  let match:RegExpExecArray|null=null,last:RegExpExecArray|null=null;
  const pattern=/TOTAL\s*=?\s*([\d,]+)\s*VA\s*=?\s*([\d,]+)\s*A(?:MPS)?\b/gi;
  while((match=pattern.exec(text)))last=match;
  return last?{va:number(last[1]),amps:number(last[2]),index:last.index}:null;
}

// The phase or line subtotals printed just above the total must add up to it. Some schedules add a
// largest-continuous-load allowance ("LCL @25% =872") and print their own sum first (HL: 2,076 + 1,410 =
// 3,486; 3,486 + 872 = 4,358).
function subtotalCheck(text:string,total:{va:number;index:number}):RosterCheck{
  let before=text.slice(0,total.index);
  const lclMatch=/LCL\s*@?\s*\d+\s*%\s*=\s*([\d,]+)/i.exec(before);
  const lcl=lclMatch?number(lclMatch[1]):0;
  if(lclMatch)before=before.slice(0,lclMatch.index)+before.slice(lclMatch.index+lclMatch[0].length);
  // Table rules read as "|" or brackets ("3,486 |LCL …" in the browser read of HL) are not words.
  const tokens=before.replace(/SUB-?TOTALS?/gi," ").replace(/[=|¦[\]{}]/g," ").trim().split(/\s+/);
  const run:number[]=[];
  for(let index=tokens.length-1;index>=0&&/^\d[\d,]*$/.test(tokens[index]);index--)run.unshift(number(tokens[index]));
  const sum=(values:number[])=>values.reduce((acc,value)=>acc+value,0);
  const candidates=[sum(run),sum(run)+lcl];
  if(run.length>=2&&sum(run.slice(0,-1))===run[run.length-1])candidates.push(run[run.length-1]+lcl);
  const passed=run.length>=2&&candidates.some(value=>Math.abs(value-total.va)<=1);
  return{id:"SUBTOTALS_ADD_UP",passed,detail:`subtotals ${run.join(" + ")||"not read"}${lcl?` (+ LCL ${lcl})`:""} vs total ${total.va} VA`};
}

// Single-phase load divides by the line-to-line voltage; three-phase by √3 times it.
function ampsCheck(entry:RosterEntry):RosterCheck|null{
  if(entry.totalVa===null||entry.totalAmps===null||entry.phases===null||!entry.voltage)return null;
  const volts=Math.max(...(entry.voltage.match(/\d{3}/g)||[]).map(Number));if(!Number.isFinite(volts)||volts<=0)return null;
  const computed=entry.totalVa/(entry.phases===3?Math.sqrt(3)*volts:volts);
  const passed=Math.abs(computed-entry.totalAmps)<=Math.max(1,.02*entry.totalAmps);
  return{id:"VA_TO_AMPS",passed,detail:`${entry.totalVa} VA at ${volts} V ${entry.phases}ø = ${computed.toFixed(1)} A vs printed ${entry.totalAmps} A`};
}

export function parsePanelSchedule(region:OcrRegionText):RosterEntry|null{
  const headerIndex=region.lines.slice(0,4).findIndex(line=>new RegExp(`^PANEL\\s+${TAG}\\b`).test(line.trim().toUpperCase()));
  if(headerIndex<0)return null;
  const tag=normalizeTag(new RegExp(`^PANEL\\s+(${TAG})\\b`).exec(region.lines[headerIndex].trim().toUpperCase())![1]);
  const entry=emptyEntry(tag,"PANELBOARD");
  const header=region.lines.slice(headerIndex+1,headerIndex+8),headerText=header.join(" "),text=region.lines.join(" ");
  const location=header.map(line=>/^\((.+)\)$/.exec(line.trim())).find(Boolean);
  entry.location=location?location[1].trim():null;
  entry.mounting=/\bSURFACE\b/i.test(headerText)?"SURFACE":/\bFLUSH\b/i.test(headerText)?"FLUSH":null;
  const rating=/(\d{2,4})\s*(?:AMPERE|AMPS?|A)\s+PANEL/i.exec(headerText);entry.ratingAmps=rating?Number(rating[1]):null;
  entry.mains=/MAIN\s*:?\s*LUGS?\b/i.test(headerText)?"LUGS":/MAIN\s*(?:BREAKER|C\.?B\.?)\b/i.test(headerText)?"MAIN_BREAKER":null;
  // "120 /208V, 1ø, 3W": OCR garbles ø (2, s, g, ¢), so the phase comes from the wire count (3-wire on a
  // 120/208 or 120/240 system is single-phase, 4-wire is three-phase); a readable phase digit must agree.
  const system=/(\d{3})\s*\/\s*(\d{3})\s*V\s*,\s*(\S{1,3})\s*,\s*([234])\s*W/i.exec(headerText);
  if(system){
    entry.voltage=`${system[1]}/${system[2]}V`;entry.wires=Number(system[4]);
    entry.phases=entry.wires===4?3:entry.wires===3?1:null;
    const written=/^[13]/.exec(system[3])?Number(system[3][0]):null;
    if(written!==null&&entry.phases!==null)entry.checks.push({id:"PHASE_MATCHES_WIRES",passed:written===entry.phases,detail:`written phase ${written}, ${entry.wires}-wire system implies ${entry.phases}ø`});
  }
  const total=scheduleTotal(text);
  if(total){entry.totalVa=total.va;entry.totalAmps=total.amps;entry.checks.push(subtotalCheck(text,total))}
  const amps=ampsCheck(entry);if(amps)entry.checks.push(amps);
  entry.sources.push({page:region.page,kind:"PANEL_SCHEDULE",regionId:region.regionId,evidence:region.lines.slice(headerIndex,headerIndex+6).join(" · ")});
  return entry;
}

// "Service MS1": one row per load on the service, "2) PANEL HL" followed by its line loads.
export function parseServiceTable(region:OcrRegionText){
  const title=region.lines.slice(0,2).map(line=>new RegExp(`^Service\\s+(${TAG})\\b`,"i").exec(line.trim())).find(Boolean);
  if(!title)return null;
  const rows:Array<{label:string;values:number[]}>=[];
  for(const raw of region.lines){
    const line=raw.trim(),row=/^\d{1,2}\)\s*(.+)$/.exec(line);
    if(row){rows.push({label:row[1].trim().toUpperCase(),values:[]});continue}
    if(/^\d[\d,]*$/.test(line)&&rows.length)rows[rows.length-1].values.push(number(line));
    else if(rows.length&&/[A-Z]/i.test(line))rows.push({label:"",values:[]});
  }
  return{tag:normalizeTag(title[1]),rows:rows.filter(row=>row.label),region};
}

// "MS2 - 53 UNITS": the dwelling-unit meter stack and its demand ("@ 208V, 3ø 640 A").
export function parseDwellingLoadTable(region:OcrRegionText){
  const title=/^(MS\d+)\s*-\s*(\d+)\s*UNITS\b/i.exec(region.lines[0]?.trim()||"");
  if(!title)return null;
  const demand=/@\s*\d{3}\s*V\b.*?(\d[\d,]*)\s*A\b/i.exec(region.lines.slice(-6).join(" "));
  return{tag:normalizeTag(title[1]),units:Number(title[2]),demandAmps:demand?number(demand[1]):null,region};
}

function merge(target:RosterEntry,source:RosterEntry){
  for(const key of ["ratingAmps","busAmps","mains","voltage","phases","wires","mounting","location","totalVa","totalAmps","fedFrom","servedUnits","demandAmps"] as const)
    if(target[key]===null&&source[key]!==null)(target as Record<string,unknown>)[key]=source[key];
  target.feeds=[...new Set([...target.feeds,...source.feeds])];
  target.sources.push(...source.sources);target.checks.push(...source.checks);
}

export function buildEquipmentRoster(input:{ocrRegions:OcrRegionText[];textLayers:TextLayerPage[]}):RosterEntry[]{
  const entries=new Map<string,RosterEntry>();
  const upsert=(entry:RosterEntry)=>{const existing=entries.get(entry.tag);if(existing)merge(existing,entry);else entries.set(entry.tag,entry);return entries.get(entry.tag)!};
  for(const region of input.ocrRegions){const schedule=parsePanelSchedule(region);if(schedule)upsert(schedule)}
  for(const region of input.ocrRegions){
    const dwelling=parseDwellingLoadTable(region);
    if(dwelling){
      const entry=emptyEntry(dwelling.tag,"SWITCHBOARD");entry.servedUnits=dwelling.units;entry.demandAmps=dwelling.demandAmps;
      entry.sources.push({page:region.page,kind:"DWELLING_LOAD_TABLE",regionId:region.regionId,evidence:region.lines[0]});upsert(entry);
    }
    const service=parseServiceTable(region);
    if(!service)continue;
    const board=emptyEntry(service.tag,"SWITCHBOARD");
    board.sources.push({page:region.page,kind:"SERVICE_LOAD_TABLE",regionId:region.regionId,evidence:region.lines[0]});
    for(const row of service.rows){
      const panel=new RegExp(`^PANEL\\s+(${TAG})$`).exec(row.label);
      board.feeds.push(panel?normalizeTag(panel[1]):row.label);
      if(!panel)continue;
      const tag=normalizeTag(panel[1]),fed=emptyEntry(tag,"PANELBOARD");fed.fedFrom=service.tag;
      fed.sources.push({page:region.page,kind:"SERVICE_LOAD_TABLE",regionId:region.regionId,evidence:`${row.label} ${row.values.join(" ")}`});
      const scheduled=entries.get(tag),serviceLoad=row.values.reduce((sum,value)=>sum+value,0);
      if(scheduled?.totalVa!=null&&row.values.length)fed.checks.push({id:"SERVICE_TABLE_MATCHES_SCHEDULE",passed:Math.abs(serviceLoad-scheduled.totalVa)<=1,detail:`${service.tag} service table ${row.values.join(" + ")} = ${serviceLoad} VA vs ${tag} schedule ${scheduled.totalVa} VA`});
      upsert(fed);
    }
    upsert(board);
  }
  // Switchboards named on a one-line, with the bus rating printed nearest to each ("800A BUS").
  for(const layer of input.textLayers.filter(page=>page.isSld)){
    const boards=layer.phrases.filter(phrase=>/^MS\d+$/i.test(phrase.t.trim()));
    const buses=layer.phrases.map(phrase=>({phrase,amps:/^(\d{3,4})\s*A\s*BUS$/i.exec(phrase.t.trim())})).filter(item=>item.amps);
    const centre=(phrase:CompactTextPhrase)=>({x:(phrase.b[0]+phrase.b[2])/2,y:(phrase.b[1]+phrase.b[3])/2});
    const distance=(a:CompactTextPhrase,b:CompactTextPhrase)=>Math.hypot(centre(a).x-centre(b).x,centre(a).y-centre(b).y);
    for(const phrase of boards){
      const entry=emptyEntry(normalizeTag(phrase.t),"SWITCHBOARD");
      const nearestBus=[...buses].sort((a,b)=>distance(phrase,a.phrase)-distance(phrase,b.phrase))[0];
      // Mutual nearest only: the bus label must also be closer to this board than to any other.
      if(nearestBus&&distance(phrase,nearestBus.phrase)<=6&&[...boards].sort((a,b)=>distance(a,nearestBus.phrase)-distance(b,nearestBus.phrase))[0]===phrase)entry.busAmps=Number(nearestBus.amps![1]);
      entry.sources.push({page:layer.page,kind:"ONE_LINE_TEXT",evidence:`${phrase.t}${entry.busAmps?` · ${entry.busAmps}A BUS`:""}`});
      upsert(entry);
    }
  }
  for(const entry of entries.values()){
    const checks=entry.checks,failed=checks.filter(check=>!check.passed).length;
    entry.confidence=Math.min(.95,(entry.sources.some(source=>source.kind==="PANEL_SCHEDULE")?.72:.6)+(checks.length&&!failed?.15:0)-.1*failed+(entry.sources.length>1?.05:0));
  }
  return [...entries.values()].sort((a,b)=>a.kind.localeCompare(b.kind)||a.tag.localeCompare(b.tag));
}

// Words that name a section of a switchboard lineup, read only when boxed beside the switchboard itself.
const LINEUP_SECTION=/^(?:DIST(?:RIBUTION)?|P\/S|PULL(?:\s+SECTION)?|PULL\s*BOX|MAIN|C\/?T(?:\s+CAB(?:INET)?)?|METER(?:ING)?|UTIL(?:ITY)?|TVSS|SPD|FDR|FEEDER)$/i;
// A unit load centre: the class phrase next to its filled bar.
const LOAD_CENTRE_PHRASE=/^(?:ELEC\.?|ELECTRICAL)\s+PANEL$|^SUB-?PANEL$|^LOAD\s+CENT(?:ER|RE)$/i;

type Candidate={id:string;source:string;layer:"L2";kind:"text-asset-candidate";name:string;x:number;y:number;z:number;floor:string;confidence:number;meta:Record<string,unknown>};
type ExistingEntity={id:string;name:string;layer:string;kind:string;x:number;y:number;source?:string;meta?:Record<string,unknown>};

const centreOf=(box:SheetBox)=>({x:(box.x0+box.x1)/2,y:(box.y0+box.y1)/2});
const boxOf=(phrase:CompactTextPhrase):SheetBox=>({x0:phrase.b[0],y0:phrase.b[1],x1:phrase.b[2],y1:phrase.b[3]});
// Phrase boxes are stored rounded (lib/text-phrases.ts), so a label's own anchor can sit a hair outside.
const inside=(point:{x:number;y:number},box:SheetBox,tolerance=.002)=>point.x>=box.x0-tolerance&&point.x<=box.x1+tolerance&&point.y>=box.y0-tolerance&&point.y<=box.y1+tolerance;
// A panelboard or load centre is a thin wall-mounted box: in plan its long side is several times its depth
// (HP1 on E-4: 0.083 × 0.015 sheet units, about 17" × 3"). On the golden fixture's roof, "HP1" also labels a
// 1.2 m × 0.7 m box, a heat pump, which this keeps from being taken for panel HP1.
const WALL_PANEL_MIN_ASPECT=2.5;
const thinBar=(footprint:DrawnFootprint)=>{const width=footprint.x1-footprint.x0,height=footprint.y1-footprint.y0;return Math.max(width,height)/Math.max(Math.min(width,height),1e-9)>=WALL_PANEL_MIN_ASPECT};
// "1ST FLOOR LAUNDRY" → L1, "ROOF W.P." → ROOF; a location without a floor ("METER ROOM") says nothing.
function locationFloor(location:string|null){
  if(!location)return null;
  const ordinal=/\b(\d{1,2})(?:ST|ND|RD|TH)\s+FL(?:OOR|R)?\b/i.exec(location);
  if(ordinal)return`L${Number(ordinal[1])}`;
  return/\bROOF\b/i.test(location)?"ROOF":null;
}

function footprintMeta(footprint:DrawnFootprint){
  const width=footprint.x1-footprint.x0,height=footprint.y1-footprint.y0;
  // Sheet units: a reviewed metric frame (lib/pdf-metric-frame.ts) rescales the entity's x/y, not this evidence.
  return{drawnFootprint:{x0:footprint.x0,y0:footprint.y0,x1:footprint.x1,y1:footprint.y1,filled:footprint.filled,relation:footprint.relation,units:"SHEET"},
    drawnFootprintSheetSize:[Math.round(Math.max(width,height)*1e4)/1e4,Math.round(Math.min(width,height)*1e4)/1e4],drawnFootprintRotationDegrees:width>=height?0:90};
}

// Roster names, unit load centres and lineup sections on this file's plan sheets. Labels already emitted by
// the parser (MS1, MS2) are enriched in place, keeping their position; new candidates sit on their drawn
// symbol, not on the label. Symbols are placed only on a plan frame with a resolved floor: an enlarged
// typical-unit plan (E-7 to E-9 on the golden fixture, no floor) repeats panels already on the floor plans.
export function recognizeRosterOnPlans(input:{roster:RosterEntry[];textLayers:TextLayerPage[];entities:ExistingEntity[]}){
  const byTag=new Map(input.roster.map(entry=>[entry.tag,entry]));
  const unitServer=input.roster.filter(entry=>entry.servedUnits);
  const created:Candidate[]=[],patches=new Map<string,Record<string,unknown>>();
  // A piece of equipment is drawn once. When a roster name labels a symbol on more than one plan, the one on
  // the floor its schedule names wins, then a filled symbol; the others are left as text.
  const chosen=new Set<string>();
  const matches=new Map<string,Array<{key:string;score:number}>>();
  for(const layer of input.textLayers){
    if(!layer.isPlan||layer.isSld)continue;
    for(const phrase of layer.phrases){
      const entry=byTag.get(normalizeTag(phrase.t.trim())),footprint=phrase.fl?footprintOf(phrase):null;
      if(!entry||!footprint||(entry.kind==="PANELBOARD"&&!thinBar(footprint)))continue;
      const expected=locationFloor(entry.location);
      const score=(expected&&phrase.fl?(expected===phrase.fl?4:-4):0)+(footprint.filled?1:0)+(footprint.relation==="CONTAINS_LABEL"?1:0);
      matches.set(entry.tag,[...(matches.get(entry.tag)||[]),{key:`${layer.source}|${layer.page}|${phrase.b.join(",")}`,score}]);
    }
  }
  for(const candidates of matches.values())chosen.add([...candidates].sort((a,b)=>b.score-a.score)[0].key);
  const patch=(id:string,meta:Record<string,unknown>)=>patches.set(id,{...(patches.get(id)||{}),...meta});
  const existingOnPage=(page:number,source:string)=>input.entities.filter(entity=>entity.layer==="L2"&&entity.kind==="text-asset-candidate"&&Number(entity.meta?.page)===page&&(!entity.source||entity.source===source));
  for(const layer of input.textLayers){
    const pageEntities=existingOnPage(layer.page,layer.source);
    const planMeta=(phrase:CompactTextPhrase)=>({page:layer.page,coordinateUnits:"sheet",floorInference:"plan-frame-or-sheet-title-candidate",
      ...(layer.isPlan&&!layer.isSld?{nonSldPlan:true,planType:layer.planType||"PLAN_VIEW_UNCLASSIFIED",planRecognition:"CONTENT_PLAN_V2_FRAMES",planDiscipline:layer.planDiscipline||"Electrical",planFrameId:phrase.fr||null,planFrameFloor:phrase.fl||null}:{}),
      elevationKnown:false,physicalElevationKnown:false,physicalTruth:false,reviewRequired:true,registrationState:"CANDIDATE"});
    // The label's own position: the nearest-shape anchor (lib/pdf-equipment-symbol-anchor.ts) may have moved
    // the entity and keeps where the label was printed in sourceLabelX/Y.
    const labelAt=(entity:ExistingEntity)=>({x:Number.isFinite(Number(entity.meta?.sourceLabelX))?Number(entity.meta!.sourceLabelX):entity.x,y:Number.isFinite(Number(entity.meta?.sourceLabelY))?Number(entity.meta!.sourceLabelY):entity.y});
    const match=(phrase:CompactTextPhrase,name:string)=>pageEntities.find(entity=>normalizeTag(entity.name)===normalizeTag(name)&&Math.hypot(labelAt(entity).x-phrase.b[0],labelAt(entity).y-phrase.b[1])<.08)
      ||pageEntities.find(entity=>normalizeTag(entity.name)===normalizeTag(name)&&inside(labelAt(entity),boxOf(phrase)));
    const switchboards:Array<{tag:string;footprint:DrawnFootprint;targetId:string}>=[];
    for(const phrase of layer.phrases){
      const entry=byTag.get(normalizeTag(phrase.t.trim()));
      if(!entry)continue;
      const footprint=phrase.fl?footprintOf(phrase):null,existing=match(phrase,phrase.t.trim());
      if(layer.isPlan&&!layer.isSld&&footprint&&entry.kind==="PANELBOARD"&&!thinBar(footprint))continue;
      if(layer.isPlan&&!layer.isSld&&footprint&&!chosen.has(`${layer.source}|${layer.page}|${phrase.b.join(",")}`))continue;
      const expectedFloor=locationFloor(entry.location);
      const rosterMeta={rosterBacked:true,rosterTag:entry.tag,rosterKind:entry.kind,rosterRatingAmps:entry.ratingAmps??entry.busAmps,rosterMounting:entry.mounting,rosterLocation:entry.location,
        rosterFedFrom:entry.fedFrom,rosterConfidence:entry.confidence,designatorAuthority:"PROJECT_EQUIPMENT_ROSTER",electricalComponentHint:entry.kind==="SWITCHBOARD"?"SWITCHBOARD":"PANEL",
        ...(expectedFloor&&phrase.fl&&layer.isPlan&&!layer.isSld?{rosterLocationFloorAgrees:expectedFloor===phrase.fl}:{})};
      // On a one-line a roster name is a schematic box, not a placed symbol: identity only.
      if(layer.isSld||!layer.isPlan){if(existing)patch(existing.id,rosterMeta);continue}
      if(!footprint)continue;
      const symbolMeta={...rosterMeta,...footprintMeta(footprint),labelAnchor:{x:phrase.b[0],y:phrase.b[1],units:"SHEET"}};
      if(existing){patch(existing.id,symbolMeta);if(entry.kind==="SWITCHBOARD"&&footprint.relation==="CONTAINS_LABEL")switchboards.push({tag:entry.tag,footprint,targetId:existing.id});continue}
      const at=centreOf(footprint),id=`pdf-roster-${layer.page}-${created.length}`;
      created.push({id,source:layer.source,layer:"L2",kind:"text-asset-candidate",name:entry.tag,x:at.x,y:at.y,z:0,floor:phrase.fl||layer.floor,confidence:Math.min(.9,.6+entry.confidence*.3),
        meta:{...planMeta(phrase),...symbolMeta,sourceType:"PDF_PLAN_ROSTER_SYMBOL",spatialPlacementAuthority:"SOURCE_SHEET_DRAWN_FOOTPRINT",
          libraryComponentKey:entry.kind==="SWITCHBOARD"?"main-switchboard":"panelboard",libraryComponentAuthority:"PROJECT_ROSTER",libraryComponentConfidence:entry.confidence,libraryComponentReviewRequired:true}});
      if(entry.kind==="SWITCHBOARD"&&footprint.relation==="CONTAINS_LABEL")switchboards.push({tag:entry.tag,footprint,targetId:id});
    }
    if(!layer.isPlan||layer.isSld)continue;
    for(const phrase of layer.phrases){
      const footprint=phrase.fl?footprintOf(phrase):null;
      if(!footprint||footprint.relation!=="BESIDE_LABEL"||!thinBar(footprint)||!LOAD_CENTRE_PHRASE.test(phrase.t.trim()))continue;
      const at=centreOf(footprint),id=`pdf-roster-${layer.page}-${created.length}`;
      created.push({id,source:layer.source,layer:"L2",kind:"text-asset-candidate",name:phrase.t.trim(),x:at.x,y:at.y,z:0,floor:phrase.fl||layer.floor,confidence:footprint.filled?.78:.68,
        meta:{...planMeta(phrase),...footprintMeta(footprint),labelAnchor:{x:phrase.b[0],y:phrase.b[1],units:"SHEET"},footprintClassPhrase:true,electricalComponentHint:"PANEL",
          rosterGroup:"UNIT_LOAD_CENTER",...(unitServer.length===1?{rosterFedFrom:unitServer[0].tag}:{}),
          sourceType:"PDF_PLAN_CLASS_PHRASE_SYMBOL",spatialPlacementAuthority:"SOURCE_SHEET_DRAWN_FOOTPRINT",
          libraryComponentKey:"load-center",libraryComponentAuthority:"DRAWN_SYMBOL_CLASS_PHRASE",libraryComponentConfidence:footprint.filled?.78:.68,libraryComponentReviewRequired:true}});
      // The parser's bare "PANEL" label from the same two-line phrase stays a label, pointing at the panel.
      for(const entity of pageEntities)if(/^PANEL$/i.test(entity.name.trim())&&inside(labelAt(entity),boxOf(phrase)))patch(entity.id,{assembledInto:id,assembledPhrase:phrase.t.trim()});
    }
    // Lineup sections: boxed section words sharing a side with the switchboard's box, or with a section
    // already found, are part of that lineup and are drawn with it, not as separate equipment.
    for(const board of switchboards){
      const lineup:Array<{name:string;footprint:DrawnFootprint}>=[{name:board.tag,footprint:board.footprint}];
      const tolerance=.1*Math.min(board.footprint.x1-board.footprint.x0,board.footprint.y1-board.footprint.y0);
      let grew=true;
      while(grew){
        grew=false;
        for(const phrase of layer.phrases){
          const footprint=footprintOf(phrase),name=phrase.t.trim();
          if(!footprint||footprint.relation!=="CONTAINS_LABEL"||!LINEUP_SECTION.test(name)||byTag.has(normalizeTag(name)))continue;
          if(lineup.some(section=>section.name===name&&Math.abs(section.footprint.x0-footprint.x0)<1e-6))continue;
          if(!lineup.some(section=>sharesSide(section.footprint,footprint,tolerance)))continue;
          lineup.push({name,footprint});grew=true;
          const at=centreOf(footprint);
          created.push({id:`pdf-roster-${layer.page}-${created.length}`,source:layer.source,layer:"L2",kind:"text-asset-candidate",name,x:at.x,y:at.y,z:0,floor:phrase.fl||layer.floor,confidence:.7,
            meta:{...planMeta(phrase),...footprintMeta(footprint),labelAnchor:{x:phrase.b[0],y:phrase.b[1],units:"SHEET"},lineupSectionOf:board.tag,electricalComponentHint:"SWITCHBOARD",
              sourceType:"PDF_PLAN_LINEUP_SECTION",spatialPlacementAuthority:"SOURCE_SHEET_DRAWN_FOOTPRINT"}});
        }
      }
      if(lineup.length>1){
        const ordered=[...lineup].sort((a,b)=>a.footprint.x0-b.footprint.x0||a.footprint.y0-b.footprint.y0);
        const box=ordered.reduce((acc,section)=>({x0:Math.min(acc.x0,section.footprint.x0),y0:Math.min(acc.y0,section.footprint.y0),x1:Math.max(acc.x1,section.footprint.x1),y1:Math.max(acc.y1,section.footprint.y1)}),{x0:Infinity,y0:Infinity,x1:-Infinity,y1:-Infinity});
        const target=created.find(candidate=>candidate.id===board.targetId);
        const lineupMeta={lineupSections:ordered.map(section=>section.name),lineupFootprint:box};
        if(target)target.meta={...target.meta,...lineupMeta};else patch(board.targetId,lineupMeta);
      }
    }
  }
  return{created,patches};
}

// Entry point for the import (components/CompilerWorkspace.tsx): roster from this file's schedules and
// one-line plus roster entries already known from other files, recognition on this file's plans, and one
// non-spatial roster record per entry for review.
export function applyEquipmentRoster<T extends ExistingEntity>(input:{fileName:string;entities:T[];knownEntities?:ExistingEntity[]}){
  const lines=new Map<string,OcrRegionText>();
  for(const entity of input.entities){
    if(entity.kind!=="ocr-text-line")continue;
    const regionId=String(entity.meta?.ocrRegionId||"");if(!regionId)continue;
    const region=lines.get(regionId)||{page:Number(entity.meta?.page||0),regionId,lines:[]};
    region.lines.push(entity.name);lines.set(regionId,region);
  }
  const textLayers:TextLayerPage[]=input.entities.filter(entity=>entity.kind==="pdf-text-layer").map(entity=>({
    page:Number(entity.meta?.page||0),source:String(entity.source||input.fileName),isPlan:entity.meta?.isPlan===true,isSld:entity.meta?.isSld===true,
    planType:(entity.meta?.planType as string)||null,planDiscipline:(entity.meta?.planDiscipline as string)||null,
    floor:String((entity as {floor?:string}).floor||"UNRESOLVED"),phrases:Array.isArray(entity.meta?.textPhrases)?entity.meta!.textPhrases as CompactTextPhrase[]:[]}));
  const own=buildEquipmentRoster({ocrRegions:[...lines.values()],textLayers});
  const known=(input.knownEntities||[]).filter(entity=>entity.kind==="equipment-roster-entry").map(entity=>entity.meta?.rosterEntry as RosterEntry).filter(entry=>entry&&!own.some(item=>item.tag===entry.tag));
  const roster=[...own,...known];
  const {created,patches}=recognizeRosterOnPlans({roster,textLayers,entities:input.entities});
  const records=own.map(entry=>({id:`roster-${entry.tag}`,source:input.fileName,layer:"L0" as const,kind:"equipment-roster-entry",name:`${entry.tag} · ${entry.kind==="SWITCHBOARD"?"switchboard":"panelboard"}`,
    x:0,y:0,z:0,floor:"UNRESOLVED",confidence:entry.confidence,
    meta:{nonSpatial:true,referenceOnly:true,sourceType:"PROJECT_EQUIPMENT_ROSTER",rosterEntry:entry,page:entry.sources[0]?.page||null,physicalTruth:false,reviewRequired:true}}));
  const entities=[...input.entities.map(entity=>patches.has(entity.id)?{...entity,meta:{...(entity.meta||{}),...patches.get(entity.id)}}:entity),...created,...records];
  const checks=own.flatMap(entry=>entry.checks);
  const stats={entries:own.length,panels:own.filter(entry=>entry.kind==="PANELBOARD").length,switchboards:own.filter(entry=>entry.kind==="SWITCHBOARD").length,
    checksPassed:checks.filter(check=>check.passed).length,checksFailed:checks.filter(check=>!check.passed).length,
    rosterSymbols:created.filter(candidate=>candidate.meta.rosterBacked===true).length+[...patches.values()].filter(meta=>meta.drawnFootprint&&meta.rosterBacked).length,
    unitLoadCenters:created.filter(candidate=>candidate.meta.footprintClassPhrase===true).length,lineupSections:created.filter(candidate=>candidate.meta.lineupSectionOf).length};
  return{entities:entities as Array<T|typeof created[number]|typeof records[number]>,roster,stats};
}
