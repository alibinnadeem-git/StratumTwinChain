export type SldEquipmentClass=
 |'UTILITY_SOURCE'|'GENERATOR_SOURCE'|'PV_SOURCE'|'BATTERY_SOURCE'|'UPS'
 |'TRANSFORMER'|'SWITCHGEAR'|'SWITCHBOARD'|'ATS'|'BREAKER'|'MCC'|'PDU'
 |'PANEL'|'DISCONNECT'|'VFD'|'INVERTER'|'EVSE'|'MOTOR'|'METER';

export type SldPageEvidence={
 isSld:boolean;
 score:number;
 equipmentClasses:SldEquipmentClass[];
 reasons:string[];
};

const RULES:[SldEquipmentClass,RegExp][]=[
 ['UTILITY_SOURCE',/\b(?:UTILITY|GRID|INCOMING|SERVICE(?:\s+ENTRANCE)?|SOURCE)\b/i],
 ['GENERATOR_SOURCE',/\b(?:GENERATOR|GENSET|GEN(?:[-_ ]?[A-Z0-9]+))\b/i],
 ['PV_SOURCE',/\b(?:SOLAR|PHOTOVOLTAIC|PV(?:[-_ ]?[A-Z0-9]+)?)\b/i],
 ['BATTERY_SOURCE',/\b(?:BATTERY|BATTERIES|BESS|ESS)\b/i],
 ['UPS',/\bUPS(?:[-_ ]?[A-Z0-9]+)?\b/i],
 ['TRANSFORMER',/\b(?:TRANSFORMER|XFMR|XFR)(?:[-_ ]?[A-Z0-9]+)?\b/i],
 ['SWITCHGEAR',/\b(?:SWITCHGEAR|SWGR|SWG)(?:[-_ ]?[A-Z0-9]+)?\b/i],
 ['SWITCHBOARD',/\b(?:SWITCHBOARD|SWBD|MSB|MDB|MDP)(?:[-_ ]?[A-Z0-9]+)?\b/i],
 ['ATS',/\b(?:ATS|AUTOMATIC\s+TRANSFER\s+SWITCH)(?:[-_ ]?[A-Z0-9]+)?\b/i],
 ['BREAKER',/\b(?:BREAKER|MCCB|ACB|MCB|CB)(?:[-_ ]?[A-Z0-9]+)?\b/i],
 ['MCC',/\b(?:MCC|MOTOR\s+CONTROL\s+CENTER)(?:[-_ ]?[A-Z0-9]+)?\b/i],
 ['PDU',/\b(?:PDU|POWER\s+DISTRIBUTION\s+UNIT)(?:[-_ ]?[A-Z0-9]+)?\b/i],
 ['PANEL',/\b(?:PANELBOARD|PANEL|LOAD\s+CENTER|PNL)(?:[-_ ]?[A-Z0-9]+)?\b/i],
 ['DISCONNECT',/\b(?:DISCONNECT|SAFETY\s+SWITCH)(?:[-_ ]?[A-Z0-9]+)?\b/i],
 ['VFD',/\bVFD(?:[-_ ]?[A-Z0-9]+)?\b/i],
 ['INVERTER',/\bINVERTER(?:[-_ ]?[A-Z0-9]+)?\b/i],
 ['EVSE',/\b(?:EVSE|CHARGER|CHARGING\s+STATION)(?:[-_ ]?[A-Z0-9]+)?\b/i],
 ['MOTOR',/\bMOTOR(?:[-_ ]?[A-Z0-9]+)?\b/i],
 ['METER',/\b(?:METER|METERING)(?:[-_ ]?[A-Z0-9]+)?\b/i],
];

export const SLD_TITLE_PATTERN=/single\s*line|one\s*line|one-line|single-line|\bsld\b|power\s*riser|electrical\s*riser|power\s*diagram|electrical\s*diagram/i;

export function classifyElectricalLabel(value:string):SldEquipmentClass|null{
 const text=String(value||'').trim();
 if(!text)return null;
 for(const [kind,pattern] of RULES)if(pattern.test(text))return kind;
 return null;
}

export function isElectricalAssetLabel(value:string){
 return classifyElectricalLabel(value)!==null;
}

export function isElectricalCircuitLabel(value:string){
 const text=String(value||'').trim();
 return /\b(?:CKT|CIRCUIT|FEEDER|BUS|TIE)\b/i.test(text)||
  /\b[A-Z]{1,5}\d{0,3}[-/]\d{1,3}\b/i.test(text);
}

export function isSldTitle(value:string){
 return SLD_TITLE_PATTERN.test(String(value||''));
}

export function sldLogicalDepth(value:string){
 const kind=classifyElectricalLabel(value);
 if(['UTILITY_SOURCE','GENERATOR_SOURCE','PV_SOURCE','BATTERY_SOURCE','UPS'].includes(String(kind)))return 0;
 if(kind==='TRANSFORMER')return 1;
 if(kind==='SWITCHGEAR'||kind==='SWITCHBOARD')return 2;
 if(kind==='ATS'||kind==='BREAKER'||kind==='MCC'||kind==='PDU'||kind==='METER')return 3;
 if(kind==='PANEL')return 4;
 if(kind)return 5;
 return 3;
}

export function detectSldPage(labels:string[],vectorOperatorCount=0):SldPageEvidence{
 const text=labels.map(value=>String(value||'').trim()).filter(Boolean);
 const joined=text.join(' ');
 const equipmentClasses=[...new Set(text.map(classifyElectricalLabel).filter((value):value is SldEquipmentClass=>Boolean(value)))];
 const title=isSldTitle(joined);
 const sources=new Set<SldEquipmentClass>(['UTILITY_SOURCE','GENERATOR_SOURCE','PV_SOURCE','BATTERY_SOURCE','UPS']);
 const hasSource=equipmentClasses.some(kind=>sources.has(kind));
 const hasDistribution=equipmentClasses.some(kind=>!sources.has(kind));
 const hasFeeder=text.some(isElectricalCircuitLabel);
 const hasVoltage=/\b\d+(?:\.\d+)?\s*(?:KV|VAC|VDC|V)\b/i.test(joined);
 const reasons:string[]=[];
 let score=0;
 if(title){score+=6;reasons.push('explicit SLD/riser/one-line title');}
 if(equipmentClasses.length){score+=Math.min(5,equipmentClasses.length);reasons.push(`${equipmentClasses.length} electrical equipment class(es)`);}
 if(hasSource&&hasDistribution){score+=2;reasons.push('source-to-distribution equipment mix');}
 if(hasFeeder){score+=1;reasons.push('feeder/circuit/bus notation');}
 if(hasVoltage){score+=1;reasons.push('electrical voltage notation');}
 if(vectorOperatorCount>=20){score+=1;reasons.push('drawing-vector topology present');}
 const isSld=Boolean(title||(equipmentClasses.length>=2&&score>=5));
 return{isSld,score,equipmentClasses,reasons};
}
