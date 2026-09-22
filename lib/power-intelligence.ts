export type PowerSource={name:string;discipline?:string};
export type PowerEntity={
 id:string;source:string;layer:string;kind:string;name:string;floor?:string;zone?:string;confidence:number;
 meta?:Record<string,unknown>;
};
export type PowerGraph={
 version?:string;createdAt?:string;sources?:PowerSource[];entities:PowerEntity[];links?:Array<{id:string;from:string;to:string;type:string;confidence:number}>;
 powerIntelligence?:PowerIntelligenceSnapshot;
 [key:string]:unknown;
};
export type PowerAuthority='SOURCE_EXPLICIT'|'OEM_OR_PROJECT_METADATA'|'CLASS_EXPECTATION';
export type ExpectedPowerStatus='EXPECTED'|'MATCHED'|'MISSING'|'CONFLICTED'|'REVIEWED'|'DISMISSED';
export type PowerFindingType='MISSING_FEED'|'RATING_MISMATCH'|'VOLTAGE_PHASE_MISMATCH'|'EMERGENCY_POWER_REVIEW'|'CONTROL_POWER_MISSING'|'DISCONNECT_REVIEW';

export type ExpectedPowerRequirement={
 id:string;sourceEntityId:string;source:string;sourceDiscipline:string;equipmentClass:string;tag:string|null;
 voltage:number|null;phase:number|null;frequencyHz:number|null;inputKw:number|null;inputKva:number|null;
 fla:number|null;rla:number|null;lra:number|null;mca:number|null;mocp:number|null;motorHp:number|null;electricHeatKw:number|null;
 connectedLoadEstimateKva:number|null;calculationBasis:string|null;
 authorityClass:PowerAuthority;confidence:number;status:ExpectedPowerStatus;
 matchedElectricalEntityIds:string[];assumptions:string[];truthBoundary:'ADVISORY_ENGINEERING_REVIEW_REQUIRED';
};
export type PowerGapFinding={
 id:string;findingType:PowerFindingType;expectedPowerRequirementId:string;sourceEntityId:string;
 electricalEntityRefs:string[];title:string;detail:string;confidence:number;
 humanControlLevel:'H2'|'H3';status:'OPEN';truthBoundary:'NOT_CODE_COMPLIANCE_OR_ENGINEERING_APPROVAL';
};
export type PowerIntelligenceSnapshot={
 version:'1';generatedFrom:string|null;requirements:ExpectedPowerRequirement[];findings:PowerGapFinding[];
 summary:{expected:number;matched:number;missing:number;conflicted:number;findings:number};
 truthBoundary:'EXPECTED_POWER_IS_ADVISORY_UNTIL_QUALIFIED_ENGINEERING_REVIEW';
};

type PoweredClass={key:string;pattern:RegExp;emergency?:boolean;control?:boolean};
const POWERED_CLASSES:PoweredClass[]=[
 {key:'FIRE_PUMP',pattern:/\bfire\s*pump\b/i,emergency:true},
 {key:'JOCKEY_PUMP',pattern:/\bjockey\s*pump\b/i,emergency:true},
 {key:'SMOKE_CONTROL',pattern:/\b(smoke\s*(?:control|exhaust)|pressurization)\s*(?:fan)?\b/i,emergency:true},
 {key:'FIRE_ALARM',pattern:/\b(fire\s*alarm|facp|nac\s*(?:panel|power)|notification\s*appliance)\b/i,emergency:true,control:true},
 {key:'CHILLER',pattern:/\bchiller\b/i},
 {key:'ROOFTOP_UNIT',pattern:/\b(?:rtu|rooftop\s*unit)\s*[-#]?[a-z0-9]*/i},
 {key:'AIR_HANDLER',pattern:/\b(?:ahu|air\s*handling\s*unit)\s*[-#]?[a-z0-9]*/i},
 {key:'MAKEUP_AIR',pattern:/\b(?:mau|make[- ]?up\s*air)\s*[-#]?[a-z0-9]*/i},
 {key:'HEAT_PUMP',pattern:/\bheat\s*pump\b/i},
 {key:'CONDENSER_COMPRESSOR',pattern:/\b(?:condenser|compressor|condensing\s*unit)\b/i},
 {key:'COOLING_TOWER',pattern:/\bcooling\s*tower\b/i},
 {key:'FAN',pattern:/\b(?:exhaust|supply|return|relief|roof|inline)?\s*fan\s*[-#]?[a-z0-9]*/i},
 {key:'PUMP',pattern:/\b(?:booster|circulation|circulating|sump|sewage|ejector|condensate|domestic|hydronic|chw|hw)?\s*pump\s*[-#]?[a-z0-9]*/i},
 {key:'FAN_COIL',pattern:/\b(?:fcu|fan\s*coil)\s*[-#]?[a-z0-9]*/i},
 {key:'VAV_TERMINAL',pattern:/\b(?:vav|terminal\s*unit)\s*[-#]?[a-z0-9]*/i},
 {key:'ELECTRIC_HEAT',pattern:/\b(?:electric\s*(?:duct\s*)?heater|electric\s*reheat|unit\s*heater)\b/i},
 {key:'HUMIDIFIER',pattern:/\bhumidifier\b/i},
 {key:'WATER_HEATER',pattern:/\b(?:electric\s*)?water\s*heater\b/i},
 {key:'HEAT_TRACE',pattern:/\bheat\s*trace\b/i},
 {key:'ELEVATOR',pattern:/\b(?:elevator|escalator|platform\s*lift|chair\s*lift)\b/i},
 {key:'BMS_DDC',pattern:/\b(?:bms|bas|ddc)\s*(?:panel|controller|gateway)?\b/i,control:true},
 {key:'NETWORK_IT',pattern:/\b(?:poe\s*switch|network\s*rack|data\s*rack|server\s*rack|telecom\s*rack|idf|mdf)\b/i,control:true},
 {key:'SECURITY_AV',pattern:/\b(?:access\s*control|security\s*panel|camera|cctv|intercom|av\s*rack|audio\s*visual)\b/i,control:true},
 {key:'EVSE',pattern:/\b(?:evse|ev\s*charger|charging\s*station)\b/i},
 {key:'PV_INVERTER',pattern:/\b(?:pv|solar)\s*inverter\b/i},
 {key:'BESS',pattern:/\b(?:bess|battery\s*energy\s*storage)\b/i},
];

const ELECTRICAL_SUPPLY=/\b(?:panel|panelboard|switchboard|switchgear|breaker|circuit|feeder|disconnect|mcc|pdu|rpp|transformer|xfmr|ats|ups)\b/i;
const TAG_PATTERN=/\b(?:AHU|RTU|MAU|FCU|VAV|EF|SF|RF|PF|P|PMP|CH|CHLR|CT|CU|HP|WH|UH|HWP|CHWP|FACP|NAC|BMS|DDC|ELEV|EL|EVSE)[-_ ]?#?[A-Z0-9]+(?:[-_.][A-Z0-9]+)*\b/i;

function finite(value:unknown){const n=Number(value);return Number.isFinite(n)?n:null}
function firstMeta(entity:PowerEntity,keys:string[]){for(const key of keys){const n=finite(entity.meta?.[key]);if(n!==null)return n}return null}
function parseNumber(text:string,pattern:RegExp){const m=text.match(pattern);return m?finite(m[1]):null}
function normalized(value:string){return value.toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim()}
function equipmentClass(name:string){return POWERED_CLASSES.find(item=>item.pattern.test(name))||null}
function sourceDiscipline(graph:PowerGraph,entity:PowerEntity){
 const source=(graph.sources||[]).find(item=>item.name===entity.source);
 return String(source?.discipline||entity.meta?.discipline||'Unclassified');
}
function tagFor(entity:PowerEntity){
 const explicit=String(entity.meta?.assetTag||entity.meta?.equipmentTag||entity.meta?.tag||'').trim();
 if(explicit)return explicit.toUpperCase();
 const match=entity.name.toUpperCase().match(TAG_PATTERN);
 return match?.[0]?.replace(/\s+/g,'-')||null;
}
function electricalValues(entity:PowerEntity){
 const text=entity.name;
 const voltage=firstMeta(entity,['voltage','voltageV','volts','ratedVoltage'])??parseNumber(text,/\b(\d{2,5}(?:\.\d+)?)\s*V(?:OLT)?S?\b/i);
 const phase=firstMeta(entity,['phase','phases'])??(\/\b3\s*(?:PH|PHASE)\b/i.test(text)?3:/\b1\s*(?:PH|PHASE)\b/i.test(text)?1:null);
 const frequencyHz=firstMeta(entity,['frequencyHz','frequency','hz'])??parseNumber(text,/\b(\d{2,3})\s*HZ\b/i);
 const inputKw=firstMeta(entity,['inputKw','kw','ratedKw'])??parseNumber(text,/\b(\d+(?:\.\d+)?)\s*KW\b/i);
 const inputKva=firstMeta(entity,['inputKva','kva','ratedKva'])??parseNumber(text,/\b(\d+(?:\.\d+)?)\s*KVA\b/i);
 const fla=firstMeta(entity,['fla','fullLoadAmps'])??parseNumber(text,/\bFLA\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
 const rla=firstMeta(entity,['rla','ratedLoadAmps'])??parseNumber(text,/\bRLA\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
 const lra=firstMeta(entity,['lra','lockedRotorAmps'])??parseNumber(text,/\bLRA\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
 const mca=firstMeta(entity,['mca','minimumCircuitAmpacity'])??parseNumber(text,/\bMCA\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
 const mocp=firstMeta(entity,['mocp','maxOvercurrentProtection'])??parseNumber(text,/\bMOCP\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
 const motorHp=firstMeta(entity,['motorHp','hp'])??parseNumber(text,/\b(\d+(?:\.\d+)?)\s*HP\b/i);
 const electricHeatKw=firstMeta(entity,['electricHeatKw','heaterKw']);
 return{voltage,phase,frequencyHz,inputKw,inputKva,fla,rla,lra,mca,mocp,motorHp,electricHeatKw};
}
function apparentKva(values:ReturnType<typeof electricalValues>){
 if(values.inputKva!==null)return{value:values.inputKva,basis:'EXPLICIT_INPUT_KVA'};
 if(values.inputKw!==null)return{value:null,basis:'INPUT_KW_REQUIRES_POWER_FACTOR_FOR_KVA'};
 const current=values.fla??values.rla;
 if(values.voltage!==null&&current!==null&&values.phase===3)return{value:Math.sqrt(3)*values.voltage*current/1000,basis:values.fla!==null?'3PH_VOLTAGE_X_FLA':'3PH_VOLTAGE_X_RLA'};
 if(values.voltage!==null&&current!==null&&values.phase===1)return{value:values.voltage*current/1000,basis:values.fla!==null?'1PH_VOLTAGE_X_FLA':'1PH_VOLTAGE_X_RLA'};
 return{value:null,basis:null};
}
function comparableTag(name:string,tag:string|null){if(!tag)return false;return normalized(name).includes(normalized(tag))}
function likelySupply(entity:PowerEntity){return entity.layer==='L2'||entity.layer==='L3'||ELECTRICAL_SUPPLY.test(entity.name)}

export function buildPowerIntelligence(graph:PowerGraph):PowerIntelligenceSnapshot{
 const candidates=graph.entities.filter(entity=>Boolean(equipmentClass(entity.name)));
 const requirements:ExpectedPowerRequirement[]=[];
 const findings:PowerGapFinding[]=[];
 for(const entity of candidates){
  const cls=equipmentClass(entity.name)!;
  const discipline=sourceDiscipline(graph,entity);
  const tag=tagFor(entity);
  const values=electricalValues(entity);
  const explicit=Object.values(values).some(value=>value!==null);
  const kva=apparentKva(values);
  const matches=graph.entities.filter(other=>other.id!==entity.id&&likelySupply(other)&&(
   comparableTag(other.name,tag)||
   String(other.meta?.feedsTag||other.meta?.loadTag||'').toUpperCase()===(tag||'__NO_TAG__')
  ));
  const voltageConflicts=matches.filter(other=>{const v=electricalValues(other);return values.voltage!==null&&v.voltage!==null&&Math.abs(values.voltage-v.voltage)>.5});
  const phaseConflicts=matches.filter(other=>{const v=electricalValues(other);return values.phase!==null&&v.phase!==null&&values.phase!==v.phase});
  const nonElectricalSource=!/electrical/i.test(discipline);
  const status:ExpectedPowerStatus=matches.length?(voltageConflicts.length||phaseConflicts.length?'CONFLICTED':'MATCHED'):(nonElectricalSource&&tag?'MISSING':'EXPECTED');
  const assumptions:string[]=[];
  if(values.mca!==null&&values.inputKw===null&&values.inputKva===null)assumptions.push('MCA is retained as circuit-sizing evidence and is not treated as actual demand.');
  if(values.mocp!==null)assumptions.push('MOCP is retained as protection evidence and is not treated as actual demand.');
  if(!explicit)assumptions.push('Equipment class implies an electrical dependency; rating remains unresolved until project/OEM evidence is found.');
  const req:ExpectedPowerRequirement={
   id:'expected-power:'+entity.id,sourceEntityId:entity.id,source:entity.source,sourceDiscipline:discipline,equipmentClass:cls.key,tag,
   ...values,connectedLoadEstimateKva:kva.value===null?null:Number(kva.value.toFixed(3)),calculationBasis:kva.basis,
   authorityClass:explicit?'SOURCE_EXPLICIT':'CLASS_EXPECTATION',
   confidence:Math.min(1,Math.max(.35,entity.confidence)*(explicit?.95:.7)),
   status,matchedElectricalEntityIds:matches.map(item=>item.id),assumptions,
   truthBoundary:'ADVISORY_ENGINEERING_REVIEW_REQUIRED'
  };
  requirements.push(req);
  if(status==='MISSING'){
   findings.push({
    id:'power-finding:missing:'+entity.id,findingType:'MISSING_FEED',expectedPowerRequirementId:req.id,sourceEntityId:entity.id,electricalEntityRefs:[],
    title:`${tag||entity.name} has no reconciled electrical feed`,
    detail:`${entity.name} is identified from ${discipline} evidence as a powered ${cls.key.replaceAll('_',' ').toLowerCase()} but no matching electrical entity was found. Confirm tag, voltage/phase, feeder, disconnect and source panel.`,
    confidence:req.confidence,humanControlLevel:'H3',status:'OPEN',truthBoundary:'NOT_CODE_COMPLIANCE_OR_ENGINEERING_APPROVAL'
   });
  }
  if(voltageConflicts.length||phaseConflicts.length){
   findings.push({
    id:'power-finding:rating:'+entity.id,findingType:'VOLTAGE_PHASE_MISMATCH',expectedPowerRequirementId:req.id,sourceEntityId:entity.id,
    electricalEntityRefs:[...new Set([...voltageConflicts,...phaseConflicts].map(item=>item.id))],
    title:`${tag||entity.name} electrical characteristics conflict across sources`,
    detail:'Voltage and/or phase differs between the powered equipment evidence and matched electrical representation. Source revisions and OEM/project ratings require engineering review.',
    confidence:req.confidence,humanControlLevel:'H3',status:'OPEN',truthBoundary:'NOT_CODE_COMPLIANCE_OR_ENGINEERING_APPROVAL'
   });
  }
  if(cls.emergency&&nonElectricalSource&&!matches.length){
   findings.push({
    id:'power-finding:emergency:'+entity.id,findingType:'EMERGENCY_POWER_REVIEW',expectedPowerRequirementId:req.id,sourceEntityId:entity.id,electricalEntityRefs:[],
    title:`${tag||entity.name} needs emergency/standby power reconciliation`,
    detail:'The source indicates a fire/life-safety or smoke-control function. STRATUM is not asserting code applicability; confirm the project/AHJ-required source, transfer, supervision and survivability requirements.',
    confidence:req.confidence,humanControlLevel:'H3',status:'OPEN',truthBoundary:'NOT_CODE_COMPLIANCE_OR_ENGINEERING_APPROVAL'
   });
  }
  if(cls.control&&nonElectricalSource&&!matches.length&&tag){
   findings.push({
    id:'power-finding:control:'+entity.id,findingType:'CONTROL_POWER_MISSING',expectedPowerRequirementId:req.id,sourceEntityId:entity.id,electricalEntityRefs:[],
    title:`${tag} control power is unresolved`,
    detail:'A controls/IT/security or signaling device appears to require power, but no matching electrical supply representation was found. Confirm normal/emergency source and local power-supply requirements.',
    confidence:req.confidence,humanControlLevel:'H2',status:'OPEN',truthBoundary:'NOT_CODE_COMPLIANCE_OR_ENGINEERING_APPROVAL'
   });
  }
 }
 return{
  version:'1',generatedFrom:graph.createdAt||null,requirements,findings,
  summary:{
   expected:requirements.length,matched:requirements.filter(item=>item.status==='MATCHED').length,
   missing:requirements.filter(item=>item.status==='MISSING').length,conflicted:requirements.filter(item=>item.status==='CONFLICTED').length,findings:findings.length
  },
  truthBoundary:'EXPECTED_POWER_IS_ADVISORY_UNTIL_QUALIFIED_ENGINEERING_REVIEW'
 };
}

export function enrichPowerIntelligence<T extends PowerGraph>(graph:T):T{
 const next=buildPowerIntelligence(graph);
 if(JSON.stringify(graph.powerIntelligence||null)===JSON.stringify(next))return graph;
 return{...graph,powerIntelligence:next};
}
