import type {PositionedSheetText} from './title-block.ts';

export type SupportBaseKind='PAD'|'HOUSEKEEPING_PAD'|'CURB'|'PLINTH'|'FOOTING';
export type SupportOffsetEvidence={
  id:string;
  source:string;
  page:number;
  x:number;
  y:number;
  label:string;
  kind:SupportBaseKind;
  heightMeters:number;
  assetTag:string|null;
  confidence:number;
  physicalTruth:false;
  reviewRequired:true;
};
export type SupportOffsetEntity={
  id:string;
  name:string;
  kind:string;
  x:number;
  y:number;
  floor?:string;
  confidence?:number;
  meta?:Record<string,unknown>;
};

const IN=.0254,FT=.3048;
const clean=(s:string)=>s.replace(/\s+/g,' ').trim().replace(/[’]/g,"'").replace(/[”]/g,'"');
const upper=(s:string)=>clean(s).toUpperCase();
const normalize=(s:string)=>upper(s).replace(/[^A-Z0-9]+/g,' ').trim();

function supportKind(label:string):SupportBaseKind|null{
  const t=upper(label);
  if(/HOUSEKEEPING\s+(?:PAD|CURB)/.test(t))return'HOUSEKEEPING_PAD';
  if(/\bPLINTH\b/.test(t))return'PLINTH';
  if(/\bCURB\b/.test(t))return'CURB';
  if(/\bFOOTING\b/.test(t))return'FOOTING';
  if(/\b(?:CONC(?:RETE)?\s+)?PAD\b|\bEQUIPMENT\s+PAD\b/.test(t))return'PAD';
  return null;
}
function parseHeightMeters(label:string){
  const t=upper(label);
  let m=t.match(/(\d+(?:\.\d+)?)\s*'\s*(?:-\s*(\d+(?:\.\d+)?)\s*")?/);
  if(m){const feet=Number(m[1]),inches=Number(m[2]||0);if(Number.isFinite(feet)&&Number.isFinite(inches)&&inches<12)return feet*FT+inches*IN}
  m=t.match(/(\d+(?:\.\d+)?)\s*(MM|CM|M|IN|INCHES|FT|FEET)\b/);
  if(!m)return null;
  const value=Number(m[1]),unit=m[2];
  if(!Number.isFinite(value)||value<=0)return null;
  if(unit==='MM')return value/1000;
  if(unit==='CM')return value/100;
  if(unit==='M')return value;
  if(unit==='IN'||unit==='INCHES')return value*IN;
  return value*FT;
}
function assetTag(label:string){
  const t=upper(label);
  const patterns=[
    /\b(?:XFMR|TRANSFORMER)\s*[-#:]?\s*([A-Z0-9][A-Z0-9._-]{0,20})\b/,
    /\b(?:GEN|GENERATOR)\s*[-#:]?\s*([A-Z0-9][A-Z0-9._-]{0,20})\b/,
    /\b(?:SWBD|SWITCHBOARD|SWGR|SWITCHGEAR|MCC|ATS|UPS|PDU|EVSE|CHARGER|PANEL|PNL)\s*[-#:]?\s*([A-Z0-9][A-Z0-9._-]{0,20})\b/
  ];
  for(const pattern of patterns){const m=t.match(pattern);if(m)return normalize(m[0])}
  return null;
}
function tagMatches(name:string,tag:string){
  const n=normalize(name),t=normalize(tag);
  if(!n||!t)return false;
  if(n.includes(t)||t.includes(n))return true;
  const suffix=t.split(' ').slice(1).join(' ');
  return suffix.length>=2&&n.includes(suffix);
}
function equipmentCandidate(entity:SupportOffsetEntity){
  if(entity.meta?.nonSpatial===true)return false;
  if(['elevation-control-point','elevation-review-surface-triangle','support-offset-evidence','line','wall-segment','source-raster-underlay'].includes(entity.kind))return false;
  if(['text-asset-candidate','powered-equipment-candidate','asset-candidate','cad-block','cad-text','imported-3d-model'].includes(entity.kind))return true;
  return /\b(?:XFMR|TRANSFORMER|GENERATOR|SWITCHBOARD|SWGR|SWITCHGEAR|MCC|ATS|UPS|PDU|EVSE|CHARGER|PANEL)\b/i.test(entity.name);
}

export function extractSupportOffsetEvidence(input:{
  items:PositionedSheetText[];
  source:string;
  page:number;
  planeWidth:number;
  planeHeight:number;
}):SupportOffsetEvidence[]{
  const out:SupportOffsetEvidence[]=[];let index=0;
  for(const item of input.items){
    const label=clean(item.text),kind=supportKind(label);if(!kind)continue;
    if(/(?:TYP|TYPICAL|MIN(?:IMUM)?|MAX(?:IMUM)?|CLEARANCE|SPACING)/i.test(label))continue;
    const heightMeters=parseHeightMeters(label);if(heightMeters===null||heightMeters<=0||heightMeters>3)continue;
    const tag=assetTag(label);
    out.push({
      id:`support-${input.page}-${index++}`,
      source:input.source,page:input.page,
      x:(item.x-.5)*input.planeWidth,
      y:(.5-item.y)*input.planeHeight,
      label,kind,heightMeters,assetTag:tag,
      confidence:tag ? .94 : .8,
      physicalTruth:false,reviewRequired:true
    });
  }
  return out;
}

export function enrichSupportBaseOffsets<T extends SupportOffsetEntity>(entities:T[],evidence:SupportOffsetEvidence[]):T[]{
  const byPage=new Map<number,SupportOffsetEvidence[]>();
  for(const item of evidence)byPage.set(item.page,[...(byPage.get(item.page)||[]),item]);
  return entities.map(entity=>{
    const meta=entity.meta||{},page=Number(meta.page||0);
    if(!page||!equipmentCandidate(entity)||Number.isFinite(Number(meta.supportBaseOffsetMeters)))return entity;
    const candidates=byPage.get(page)||[];if(!candidates.length)return entity;
    const tagged=candidates.filter(item=>item.assetTag&&tagMatches(entity.name,item.assetTag));
    let chosen:SupportOffsetEvidence|null=null,authority='',confidence=0;
    if(tagged.length===1){
      chosen=tagged[0];authority='TAG_LINKED_SOURCE_SUPPORT_NOTE';confidence=chosen.confidence;
    }else if(tagged.length>1){
      const ordered=tagged.map(item=>({item,d:Math.hypot(entity.x-item.x,entity.y-item.y)})).sort((a,b)=>a.d-b.d);
      if(!ordered[1]||ordered[1].d-ordered[0].d>=.25){chosen=ordered[0].item;authority='TAG_LINKED_SOURCE_SUPPORT_NOTE';confidence=Math.min(.9,chosen.confidence)}
    }else{
      const untagged=candidates.filter(item=>!item.assetTag).map(item=>({item,d:Math.hypot(entity.x-item.x,entity.y-item.y)})).filter(item=>item.d<=.85).sort((a,b)=>a.d-b.d);
      if(untagged.length){
        const first=untagged[0],second=untagged[1];
        const unique=!second||second.d>=Math.max(first.d*1.8,first.d+.3);
        if(unique){chosen=first.item;authority='UNIQUE_NEAREST_SOURCE_SUPPORT_NOTE';confidence=Math.min(.72,chosen.confidence*Math.max(.55,1-first.d/.85))}
      }
    }
    if(!chosen)return entity;
    return{
      ...entity,
      meta:{
        ...meta,
        supportBaseOffsetMeters:chosen.heightMeters,
        supportOffsetKind:chosen.kind,
        supportOffsetAuthority:authority,
        supportOffsetConfidence:confidence,
        supportOffsetEvidenceId:chosen.id,
        supportOffsetEvidenceLabel:chosen.label,
        supportOffsetSource:chosen.source,
        supportOffsetPage:chosen.page,
        physicalTruth:false,
        reviewRequired:true
      }
    };
  });
}
