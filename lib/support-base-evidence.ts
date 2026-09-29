import type {PositionedSheetText} from './title-block.ts';

export type SupportBaseKind='HOUSEKEEPING_PAD'|'CONCRETE_PAD'|'EQUIPMENT_PAD'|'CURB';
export type SupportBaseEvidence={
 id:string;
 source:string;
 page:number;
 x:number;
 y:number;
 kind:SupportBaseKind;
 offsetMeters:number;
 targetTag:string|null;
 confidence:number;
 evidence:string[];
 physicalTruth:false;
 reviewRequired:true;
};

const IN=.0254;
const clean=(value:string)=>value.replace(/[’]/g,"'").replace(/[”]/g,'"').replace(/\s+/g,' ').trim();
const normalizeTag=(value:string)=>value.toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();

function targetTag(text:string){
 const t=clean(text).toUpperCase();
 const patterns=[
  /\b(?:TRANSFORMER|XFMR)\s*[-#:]?\s*([A-Z0-9][A-Z0-9._-]{0,20})\b/,
  /\b(?:PANEL|PNL|SWITCHBOARD|SWBD|SWITCHGEAR|SWGR|MCC|ATS|UPS|PDU|VFD|GENERATOR|GEN|EVSE)\s*[-#:]?\s*([A-Z0-9][A-Z0-9._-]{0,20})\b/
 ];
 for(const pattern of patterns){
  const m=t.match(pattern);if(m)return normalizeTag(m[0]);
 }
 return null;
}
function kindOf(text:string):SupportBaseKind|null{
 const t=clean(text).toUpperCase();
 if(/HOUSEKEEPING\s+PAD/.test(t))return'HOUSEKEEPING_PAD';
 if(/EQUIPMENT\s+PAD/.test(t))return'EQUIPMENT_PAD';
 if(/CONCRETE\s+PAD/.test(t))return'CONCRETE_PAD';
 if(/\bCURB\b/.test(t))return'CURB';
 return null;
}
function distanceMeters(raw:string,unit:string){
 const value=Number(raw);if(!Number.isFinite(value)||value<0)return null;
 const u=unit.toUpperCase();
 const meters=u==='"MM'?value/1000:u==='CM'?value/100:u==='M'?value:value*IN;
 return Number.isFinite(meters)&&meters>=0&&meters<=.6?meters:null;
}
function parseOffset(text:string){
 const t=clean(text).toUpperCase(),kind=kindOf(t);if(!kind)return null;
 const patterns=[
  /(?:HOUSEKEEPING\s+PAD|EQUIPMENT\s+PAD|CONCRETE\s+PAD|CURB)[^0-9+\-]{0,22}(?:\+\s*)?(\d+(?:\.\d+)?)\s*("|IN(?:CH(?:ES)?)?\.?|MM|CM|M\b)/i,
  /(\d+(?:\.\d+)?)\s*("|IN(?:CH(?:ES)?)?\.?|MM|CM|M\b)[^A-Z0-9]{0,18}(?:HIGH|THICK|HT\.?|HEIGHT)?[^A-Z0-9]{0,18}(?:HOUSEKEEPING\s+PAD|EQUIPMENT\s+PAD|CONCRETE\s+PAD|CURB)/i,
  /(?:PAD|CURB)\s*\+\s*(\d+(?:\.\d+)?)\s*("|IN(?:CH(?:ES)?)?\.?|MM|CM|M\b)/i
 ];
 for(const pattern of patterns){
  const m=t.match(pattern);if(!m)continue;
  const meters=distanceMeters(m[1],m[2].startsWith('"')?'IN':m[2].replace(/\./g,''));
  if(meters!==null)return{kind,meters};
 }
 return null;
}

export function extractSupportBaseEvidence(input:{
 items:PositionedSheetText[];
 source:string;
 page:number;
 planeWidth:number;
 planeHeight:number;
}):SupportBaseEvidence[]{
 const out:SupportBaseEvidence[]=[];let index=0;
 for(const item of input.items){
  const label=clean(item.text),parsed=parseOffset(label);if(!parsed)continue;
  const tag=targetTag(label);
  out.push({
   id:`support-${input.page}-${index++}`,source:input.source,page:input.page,
   x:(item.x-.5)*input.planeWidth,y:(.5-item.y)*input.planeHeight,
   kind:parsed.kind,offsetMeters:parsed.meters,targetTag:tag,
   confidence:tag?.92:.58,
   evidence:[label,...(tag?[`OBJECT_LINK:${tag}`]:['OBJECT_LINK_UNRESOLVED'])],
   physicalTruth:false,reviewRequired:true
  });
 }
 return out;
}

export function supportEvidenceMatchesEntity(evidence:SupportBaseEvidence,entity:{name:string;meta?:Record<string,unknown>}){
 if(!evidence.targetTag)return false;
 const target=normalizeTag(evidence.targetTag),name=normalizeTag(entity.name);
 if(name.includes(target))return true;
 const targetParts=target.split(' '),suffix=targetParts.slice(1).join(' ');
 if(suffix.length>=2&&name.includes(suffix))return true;
 const hint=normalizeTag(String(entity.meta?.electricalComponentHint||''));
 return suffix.length>=2&&hint.includes(suffix);
}

export function resolveSupportBaseForEntity(
 entity:{name:string;meta?:Record<string,unknown>},
 evidence:SupportBaseEvidence[]
){
 const matches=evidence.filter(item=>supportEvidenceMatchesEntity(item,entity));
 if(!matches.length)return{status:'UNRESOLVED' as const,offsetMeters:null,evidence:[] as SupportBaseEvidence[]};
 const sorted=[...matches].sort((a,b)=>b.confidence-a.confidence),best=sorted[0];
 const conflict=sorted.some(item=>Math.abs(item.offsetMeters-best.offsetMeters)>.0254);
 if(conflict)return{status:'CONFLICT' as const,offsetMeters:null,evidence:sorted};
 return{status:'RESOLVED_CANDIDATE' as const,offsetMeters:best.offsetMeters,evidence:sorted};
}
