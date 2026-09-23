export type CoordinationEntity={
 id:string;source:string;layer:string;kind:string;name:string;floor?:string;zone?:string;confidence:number;
 meta?:Record<string,unknown>;
};
export type CoordinationTitleBlock={
 sourceName:string;sourceSha256:string;page:number;reviewState?:string;
 sheetNumber?:{value?:string|null};revision?:{value?:string|null};issueDate?:{value?:string|null};
};
export type CoordinationGraph={
 createdAt?:string;
 sources?:Array<{name:string;sha256?:string;discipline?:string}>;
 entities:CoordinationEntity[];
 titleBlocks?:CoordinationTitleBlock[];
 coordinationIntelligence?:CoordinationSnapshot;
 [key:string]:unknown;
};
export type CoordinationFindingType=
 'MISSING_SPATIAL_REPRESENTATION'|'MODEL_CONFLICT'|'RATING_CONFLICT'|'LOCATION_CONFLICT'|'SHEET_REVISION_CONFLICT'|'SOURCE_REVISION_AMBIGUITY';
export type CoordinationFinding={
 id:string;findingType:CoordinationFindingType;title:string;detail:string;
 entityRefs:string[];sourceRefs:string[];comparison:Record<string,unknown>;
 confidence:number;humanControlLevel:'H2'|'H3';status:'OPEN';
 truthBoundary:'COORDINATION_FINDING_REQUIRES_HUMAN_REVIEW';
};
export type CoordinationSnapshot={
 version:'1';generatedFrom:string|null;findings:CoordinationFinding[];
 summary:{findings:number;high:number;review:number};
 truthBoundary:'COORDINATION_FINDINGS_DO_NOT_ESTABLISH_PHYSICAL_CLASH_CODE_COMPLIANCE_OR_ENGINEERING_APPROVAL';
};

const TAG_PATTERN=/\b(?:AHU|RTU|MAU|FCU|VAV|EF|SF|RF|PF|FP|JP|SMF|PMP|P|CH|CHLR|CT|CU|HP|WH|UH|HWP|CHWP|FACP|NAC|BMS|DDC|ELEV|EL|EVSE|ATS|UPS|MCC|PDU|MDP|MDB|MSB|XFMR|TX|GEN)[-_ ]?#?[A-Z0-9]+(?:[-_.][A-Z0-9]+)*\b/i;
function norm(value:unknown){return String(value??'').trim().toUpperCase().replace(/\s+/g,' ')}
function finite(value:unknown){if(value===null||value===undefined||value==='')return null;const n=Number(value);return Number.isFinite(n)?n:null}
function tag(entity:CoordinationEntity){
 const explicit=norm(entity.meta?.assetTag||entity.meta?.equipmentTag||entity.meta?.tag);
 if(explicit)return explicit.replace(/\s+/g,'-');
 const match=entity.name.toUpperCase().match(TAG_PATTERN);
 return match?.[0]?.replace(/\s+/g,'-')||null;
}
function model(entity:CoordinationEntity){return norm(entity.meta?.model||entity.meta?.modelNumber)}
function manufacturer(entity:CoordinationEntity){return norm(entity.meta?.manufacturer||entity.meta?.manufacturerName)}
function sourceSha(entity:CoordinationEntity){return norm(entity.meta?.sourceSha256)||norm(entity.source)}
function nonSpatial(entity:CoordinationEntity){return entity.meta?.nonSpatial===true}
function parsedNumber(text:string,pattern:RegExp){const match=text.match(pattern);return match?finite(match[1]):null}
function rating(entity:CoordinationEntity){
 const text=entity.name;
 return{
  voltage:finite(entity.meta?.voltage??entity.meta?.voltageV??entity.meta?.ratedVoltage)??parsedNumber(text,/\b(\d{2,5}(?:\.\d+)?)\s*V(?:OLT)?S?\b/i),
  phase:finite(entity.meta?.phase??entity.meta?.phases)??(/\b3\s*(?:PH|PHASE)\b/i.test(text)?3:/\b1\s*(?:PH|PHASE)\b/i.test(text)?1:null),
  inputKw:finite(entity.meta?.inputKw??entity.meta?.kw??entity.meta?.ratedKw)??parsedNumber(text,/\b(\d+(?:\.\d+)?)\s*KW\b/i),
  inputKva:finite(entity.meta?.inputKva??entity.meta?.kva??entity.meta?.ratedKva)??parsedNumber(text,/\b(\d+(?:\.\d+)?)\s*KVA\b/i),
  fla:finite(entity.meta?.fla??entity.meta?.fullLoadAmps)??parsedNumber(text,/\bFLA\s*[:=]?\s*(\d+(?:\.\d+)?)/i),
  mca:finite(entity.meta?.mca??entity.meta?.minimumCircuitAmpacity)??parsedNumber(text,/\bMCA\s*[:=]?\s*(\d+(?:\.\d+)?)/i),
  mocp:finite(entity.meta?.mocp??entity.meta?.maxOvercurrentProtection)??parsedNumber(text,/\bMOCP\s*[:=]?\s*(\d+(?:\.\d+)?)/i),
  motorHp:finite(entity.meta?.motorHp??entity.meta?.hp)??parsedNumber(text,/\b(\d+(?:\.\d+)?)\s*HP\b/i)
 };
}
function different(a:unknown,b:unknown,tolerance=.001){
 const x=finite(a),y=finite(b);if(x===null||y===null)return false;
 return Math.abs(x-y)>tolerance;
}
function comparableLocation(value:string|undefined){const n=norm(value);return n&&n!=='UNRESOLVED'&&n!=='PENDING'?n:null}

export function buildCoordinationIntelligence(graph:CoordinationGraph):CoordinationSnapshot{
 const findings:CoordinationFinding[]=[];
 const tagged=graph.entities.filter(entity=>entity.meta?.referenceOnly!==true).map(entity=>({entity,tag:tag(entity)})).filter(item=>item.tag);
 const byTag=new Map<string,CoordinationEntity[]>();
 for(const item of tagged){const list=byTag.get(item.tag!)||[];list.push(item.entity);byTag.set(item.tag!,list)}

 for(const [assetTag,items] of byTag){
  const schedules=items.filter(nonSpatial);
  const spatial=items.filter(item=>!nonSpatial(item));
  if(schedules.length&&spatial.length===0){
   const refs=schedules.map(item=>item.id);
   findings.push({
    id:'coord:missing-spatial:'+assetTag,findingType:'MISSING_SPATIAL_REPRESENTATION',
    title:assetTag+' appears in schedule evidence but has no drawing/spatial counterpart',
    detail:'A source-grounded equipment schedule record exists for '+assetTag+', but no spatial/drawing entity with the same tag is available. Confirm whether the equipment is omitted from plans, tagged differently, or not yet spatially extracted.',
    entityRefs:refs,sourceRefs:[...new Set(schedules.map(item=>item.source))],comparison:{tag:assetTag,scheduleCount:schedules.length,spatialCount:0},
    confidence:Math.min(...schedules.map(item=>item.confidence)),humanControlLevel:'H2',status:'OPEN',truthBoundary:'COORDINATION_FINDING_REQUIRES_HUMAN_REVIEW'
   });
  }
  if(items.length<2)continue;
  const authorityGroups=[...new Set(items.map(sourceSha))];
  if(authorityGroups.length<2&&!schedules.length)continue;

  const manufacturers=[...new Set(items.map(manufacturer).filter(Boolean))];
  const models=[...new Set(items.map(model).filter(Boolean))];
  if(manufacturers.length>1||models.length>1){
   findings.push({
    id:'coord:model:'+assetTag,findingType:'MODEL_CONFLICT',
    title:assetTag+' has conflicting manufacturer/model evidence',
    detail:'The same asset tag resolves to different manufacturer and/or model values across source records. STRATUM is preserving the conflict instead of choosing one source silently.',
    entityRefs:items.map(item=>item.id),sourceRefs:[...new Set(items.map(item=>item.source))],
    comparison:{tag:assetTag,manufacturers,models},
    confidence:Math.min(.98,Math.max(...items.map(item=>item.confidence))),humanControlLevel:'H3',status:'OPEN',truthBoundary:'COORDINATION_FINDING_REQUIRES_HUMAN_REVIEW'
   });
  }

  const rated=items.map(item=>({id:item.id,source:item.source,rating:rating(item)}));
  const conflicts:string[]=[];
  for(let i=0;i<rated.length;i++)for(let j=i+1;j<rated.length;j++){
   for(const key of ['voltage','phase','inputKw','inputKva','fla','mca','mocp','motorHp'] as const){
    if(different(rated[i].rating[key],rated[j].rating[key]))conflicts.push(key);
   }
  }
  if(conflicts.length){
   findings.push({
    id:'coord:rating:'+assetTag,findingType:'RATING_CONFLICT',
    title:assetTag+' has conflicting equipment ratings across sources',
    detail:'Electrical/equipment rating fields for the same tag disagree across project sources. Review the effective revision, approved submittal/OEM basis, and electrical representation before accepting the asset requirement.',
    entityRefs:items.map(item=>item.id),sourceRefs:[...new Set(items.map(item=>item.source))],
    comparison:{tag:assetTag,fields:[...new Set(conflicts)],records:rated},
    confidence:Math.min(.98,Math.max(...items.map(item=>item.confidence))),humanControlLevel:'H3',status:'OPEN',truthBoundary:'COORDINATION_FINDING_REQUIRES_HUMAN_REVIEW'
   });
  }

  const floors=[...new Set(items.map(item=>comparableLocation(item.floor)).filter(Boolean))];
  const zones=[...new Set(items.map(item=>comparableLocation(item.zone)).filter(Boolean))];
  if(floors.length>1||zones.length>1){
   findings.push({
    id:'coord:location:'+assetTag,findingType:'LOCATION_CONFLICT',
    title:assetTag+' has conflicting floor/zone evidence',
    detail:'The same tag is associated with different floor and/or zone labels across sources. This is a semantic coordination conflict only; STRATUM is not asserting a geometric clash unless coordinate frames are separately aligned.',
    entityRefs:items.map(item=>item.id),sourceRefs:[...new Set(items.map(item=>item.source))],
    comparison:{tag:assetTag,floors,zones},
    confidence:Math.min(.95,Math.max(...items.map(item=>item.confidence))),humanControlLevel:'H2',status:'OPEN',truthBoundary:'COORDINATION_FINDING_REQUIRES_HUMAN_REVIEW'
   });
  }
 }

 const titleBlocks=graph.titleBlocks||[];
 const bySheet=new Map<string,CoordinationTitleBlock[]>();
 for(const item of titleBlocks){
  const sheet=norm(item.sheetNumber?.value);if(!sheet)continue;
  const list=bySheet.get(sheet)||[];list.push(item);bySheet.set(sheet,list);
 }
 for(const [sheet,items] of bySheet){
  const revisions=[...new Set(items.map(item=>norm(item.revision?.value)).filter(Boolean))];
  if(revisions.length>1){
   findings.push({
    id:'coord:sheet-revision:'+sheet,findingType:'SHEET_REVISION_CONFLICT',
    title:'Sheet '+sheet+' appears with multiple revisions',
    detail:'Multiple source files/pages claim the same sheet number with different revision identifiers. Confirm the effective issue/revision before using downstream geometry, dimensions, ratings, or schedules.',
    entityRefs:[],sourceRefs:[...new Set(items.map(item=>item.sourceName))],
    comparison:{sheetNumber:sheet,revisions,records:items.map(item=>({source:item.sourceName,page:item.page,revision:item.revision?.value||null,issueDate:item.issueDate?.value||null,reviewState:item.reviewState||'CANDIDATE'}))},
    confidence:.92,humanControlLevel:'H3',status:'OPEN',truthBoundary:'COORDINATION_FINDING_REQUIRES_HUMAN_REVIEW'
   });
  }
 }

 const byName=new Map<string,Array<{name:string;sha:string}>>();
 for(const source of graph.sources||[]){
  const name=norm(source.name);if(!name)continue;
  const list=byName.get(name)||[];list.push({name:source.name,sha:norm(source.sha256)});byName.set(name,list);
 }
 for(const [name,items] of byName){
  const hashes=[...new Set(items.map(item=>item.sha).filter(Boolean))];
  if(hashes.length>1){
   findings.push({
    id:'coord:source-revision:'+name,findingType:'SOURCE_REVISION_AMBIGUITY',
    title:items[0].name+' exists as multiple file fingerprints',
    detail:'Files with the same source name have different SHA-256 fingerprints in the project workspace. Treat them as potentially different revisions until title-block/issue metadata identifies the effective source.',
    entityRefs:[],sourceRefs:[...new Set(items.map(item=>item.name))],comparison:{sourceName:items[0].name,sha256:hashes},
    confidence:.9,humanControlLevel:'H2',status:'OPEN',truthBoundary:'COORDINATION_FINDING_REQUIRES_HUMAN_REVIEW'
   });
  }
 }

 return{
  version:'1',generatedFrom:graph.createdAt||null,findings,
  summary:{findings:findings.length,high:findings.filter(item=>item.humanControlLevel==='H3').length,review:findings.filter(item=>item.humanControlLevel==='H2').length},
  truthBoundary:'COORDINATION_FINDINGS_DO_NOT_ESTABLISH_PHYSICAL_CLASH_CODE_COMPLIANCE_OR_ENGINEERING_APPROVAL'
 };
}

export function enrichCoordinationIntelligence<T extends CoordinationGraph>(graph:T):T{
 const next=buildCoordinationIntelligence(graph);
 if(JSON.stringify(graph.coordinationIntelligence||null)===JSON.stringify(next))return graph;
 return{...graph,coordinationIntelligence:next};
}
