export type SldElectricalFamily='SOURCE'|'TRANSFORMER'|'MAIN_DISTRIBUTION'|'DISTRIBUTION'|'PANEL'|'PROTECTION'|'LOAD';

export const EXPLICIT_SLD_PATTERN=/single\s*line|one\s*line|one-line|single-line|\bsld\b|riser|power\s*diagram|electrical\s*diagram/i;

const FAMILY_PATTERNS:Record<SldElectricalFamily,RegExp>={
 SOURCE:/\butility\b|\bservice\b|\bincoming\b|\bsource\b|\bfeed\b|\bnormal\s+power\b|\bemergency\s+power\b/i,
 TRANSFORMER:/\btransformer\b|\bxfmr\b|\bxfrmr\b|\btx\s*[-#]?\s*\d+/i,
 MAIN_DISTRIBUTION:/\bswitchgear\b|\bswitchboard\b|\bswbd\b|\bmsb\b|\bmdb\b|\bmdp\b|\bmain\s*(?:distribution|board|switchboard|switchgear)\b/i,
 DISTRIBUTION:/\bats\b|\btransfer\s*switch\b|\bmcc\b|\bpdu\b|\bbusway\b|\bbus\s*duct\b|\bdistribution\s*(?:board|panel)?\b/i,
 PANEL:/\bpanelboard\b|\bpanel\s*[-#]?[a-z0-9]+\b|\bload\s*center\b|\blp\s*[-#]?\s*\d+/i,
 PROTECTION:/\bbreaker\b|\bcircuit\s*breaker\b|\bmccb\b|\bacb\b|\bvcb\b|\bcb\s*[-#]?\s*\d+/i,
 LOAD:/\bgenerator\b|\bgenset\b|\bups\b|\bbattery\b|\bsolar\b|\bpv\b|\binverter\b|\bdisconnect\b|\bvfd\b|\bmotor\b|\bevse\b|\bcharger\b|\breceptacle\b|\boutlet\b|\bequipment\b|\bload\b/i,
};

const POWER_RATING_PATTERN=/\b\d+(?:\.\d+)?\s*(?:v|kv|a|amp|amps|ka|kva|mva|kw|mw|hz)\b/i;
const FEEDER_PATTERN=/\b(?:ckt|circuit|feeder)\b|\b[a-z]{1,5}\d{0,3}[-/]\d{1,3}\b/i;

export function sldElectricalFamily(value:string):SldElectricalFamily|null{
 const text=String(value||'').trim();
 if(!text)return null;
 for(const [family,pattern] of Object.entries(FAMILY_PATTERNS) as [SldElectricalFamily,RegExp][]){
  if(pattern.test(text))return family;
 }
 return null;
}

export function electricalAssetCandidate(value:string){
 return sldElectricalFamily(value)!==null;
}

export function electricalLogicalCandidate(value:string){
 return FEEDER_PATTERN.test(String(value||''))||FAMILY_PATTERNS.PROTECTION.test(String(value||''));
}

export function sldLogicalDepth(value:string){
 switch(sldElectricalFamily(value)){
  case 'SOURCE': return 0;
  case 'TRANSFORMER': return 1;
  case 'MAIN_DISTRIBUTION': return 2;
  case 'DISTRIBUTION':
  case 'PROTECTION': return 3;
  case 'PANEL': return 4;
  case 'LOAD': return 5;
  default: return 3;
 }
}

export type SldPageEvidence={
 isSld:boolean;
 explicit:boolean;
 score:number;
 families:SldElectricalFamily[];
 powerRatingCount:number;
 electricalTokenCount:number;
};

export function analyzeSldText(values:string[]):SldPageEvidence{
 const clean=values.map(value=>String(value||'').replace(/\s+/g,' ').trim()).filter(Boolean);
 const joined=clean.join(' ');
 const explicit=EXPLICIT_SLD_PATTERN.test(joined);
 const families=[...new Set(clean.map(sldElectricalFamily).filter(Boolean) as SldElectricalFamily[])];
 const powerRatingCount=clean.filter(value=>POWER_RATING_PATTERN.test(value)).length;
 const electricalTokenCount=clean.filter(value=>electricalAssetCandidate(value)||electricalLogicalCandidate(value)).length;
 const hasHierarchyCue=families.includes('SOURCE')||families.includes('TRANSFORMER')||families.includes('MAIN_DISTRIBUTION');
 const score=families.length+Math.min(2,powerRatingCount)+Math.min(2,Math.floor(electricalTokenCount/3));
 const isSld=explicit||(families.length>=3&&hasHierarchyCue&&(powerRatingCount>0||electricalTokenCount>=4));
 return{isSld,explicit,score,families,powerRatingCount,electricalTokenCount};
}
