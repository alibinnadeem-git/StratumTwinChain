export type ZEvidenceType=
  |'IFC_DESIGN_PLACEMENT'
  |'CAD_DESIGN_Z'
  |'FLOOR_DATUM'
  |'SPOT_ELEVATION'
  |'MOUNTING_HEIGHT_AFF'
  |'SECTION_ELEVATION'
  |'GRADE_ELEVATION'
  |'UNRESOLVED';

export type ZEvidence={
  id:string;
  type:ZEvidenceType;
  valueMeters:number|null;
  relativeTo?:'FLOOR_DATUM'|'GRADE'|'PROJECT_DATUM'|'UNKNOWN';
  floor?:string|null;
  tag?:string|null;
  source?:string|null;
  confidence:number;
  evidence:string[];
  physicalTruth:false;
  reviewRequired:true;
};

export type ZEntityLike={
  id:string;name:string;source:string;z?:number;floor?:string;confidence:number;
  meta?:Record<string,unknown>;
};

export type ZResolution={
  entityId:string;
  status:'RESOLVED_DESIGN_CANDIDATE'|'RELATIVE_ONLY'|'CONFLICT'|'UNRESOLVED';
  zMeters:number|null;
  confidence:number;
  authority:string;
  evidence:ZEvidence[];
  physicalTruth:false;
  reviewRequired:true;
  reason:string;
};

const FT=.3048,IN=.0254;
const clean=(s:string)=>s.replace(/\s+/g,' ').trim();
const floorToken=(s:string)=>{
  const t=s.toUpperCase();
  if(/\b(?:GROUND|GROUND FLOOR|LEVEL 1|L1|FIRST FLOOR)\b/.test(t))return'L1';
  const m=t.match(/\b(?:LEVEL|LVL|FLOOR|L)\s*[-#:]?\s*(\d{1,2})\b/);if(m)return'L'+Number(m[1]);
  const b=t.match(/\b(?:BASEMENT|B)\s*[-#:]?\s*(\d{1,2})?\b/);if(b)return'B'+Number(b[1]||1);
  if(/\bROOF\b/.test(t))return'ROOF';
  if(/\bPENTHOUSE\b/.test(t))return'PENTHOUSE';
  return null;
};
function feetInchesToMeters(ft:string|undefined,inch:string|undefined){
  const f=Number(ft||0),i=Number(inch||0);
  return Number.isFinite(f)&&Number.isFinite(i)?f*FT+i*IN:null;
}
function parseArchitecturalElevation(text:string){
  const t=clean(text).replace(/[’]/g,"'").replace(/[”]/g,'"');
  const m=t.match(/(?:EL(?:EV(?:ATION)?)?\.?|ELEV\.?|LEVEL|F\.F\.?|FF|T\.O\.?\s*(?:SLAB|CURB|STEEL)?|B\.O\.?\s*(?:SLAB|STEEL)?)\s*[:=@-]?\s*([+-]?\d{1,4})\s*'\s*(?:-\s*(\d{1,2}(?:\.\d+)?)\s*")?/i);
  return m?feetInchesToMeters(m[1],m[2]):null;
}
function parseDecimalElevation(text:string){
  const t=clean(text);
  const m=t.match(/(?:EL(?:EV(?:ATION)?)?\.?|ELEV\.?|FF(?:E)?\.?|FINISH(?:ED)?\s+FLOOR|T\.O\.?\s*(?:SLAB|CURB|STEEL)?|B\.O\.?\s*(?:SLAB|STEEL)?|GRADE|FG|TC|FL)\s*[:=@-]?\s*([+-]?\d{1,4}(?:\.\d+)?)(?:\s*(FT|FEET|M|METERS?|MM))?/i);
  if(!m)return null;
  const n=Number(m[1]);if(!Number.isFinite(n))return null;
  const unit=(m[2]||'').toUpperCase();
  if(unit==='M'||unit.startsWith('METER'))return n;
  if(unit==='MM')return n/1000;
  if(unit==='FT'||unit==='FEET')return n*FT;
  return {raw:n,unit:'DRAWING_DATUM'} as const;
}
function parseAff(text:string){
  const t=clean(text).replace(/[’]/g,"'").replace(/[”]/g,'"');
  let m=t.match(/([+-]?\d+(?:\.\d+)?)\s*'\s*(?:-\s*(\d+(?:\.\d+)?)\s*")?\s*(?:A\.?F\.?F\.?|AFF)\b/i);
  if(m)return feetInchesToMeters(m[1],m[2]);
  m=t.match(/([+-]?\d+(?:\.\d+)?)\s*(IN|INCHES|MM|CM|M)\s*(?:A\.?F\.?F\.?|AFF)\b/i);
  if(!m)return null;const n=Number(m[1]),u=m[2].toUpperCase();if(!Number.isFinite(n))return null;
  return u==='IN'||u==='INCHES'?n*IN:u==='MM'?n/1000:u==='CM'?n/100:n;
}

export function extractZEvidenceFromText(text:string,context?:{source?:string;floor?:string;idPrefix?:string}):ZEvidence[]{
  const out:ZEvidence[]=[];const lines=text.split(/\r?\n/).map(clean).filter(Boolean);let i=0;
  for(const line of lines){
    const floor=context?.floor||floorToken(line);
    const arch=parseArchitecturalElevation(line);
    if(arch!==null)out.push({id:`${context?.idPrefix||'z'}-${i++}`,type:/SECTION|ELEVATION|T\.O\.|B\.O\./i.test(line)?'SECTION_ELEVATION':'FLOOR_DATUM',valueMeters:arch,relativeTo:'PROJECT_DATUM',floor,source:context?.source||null,confidence:.9,evidence:[line],physicalTruth:false,reviewRequired:true});
    const dec=arch===null?parseDecimalElevation(line):null;
    if(typeof dec==='number')out.push({id:`${context?.idPrefix||'z'}-${i++}`,type:/GRADE|FG|TC|FL/i.test(line)?'GRADE_ELEVATION':'FLOOR_DATUM',valueMeters:dec,relativeTo:/GRADE|FG|TC|FL/i.test(line)?'GRADE':'PROJECT_DATUM',floor,source:context?.source||null,confidence:.88,evidence:[line],physicalTruth:false,reviewRequired:true});
    else if(dec&&dec.unit==='DRAWING_DATUM')out.push({id:`${context?.idPrefix||'z'}-${i++}`,type:/GRADE|FG|TC|FL/i.test(line)?'SPOT_ELEVATION':'FLOOR_DATUM',valueMeters:dec.raw,relativeTo:/GRADE|FG|TC|FL/i.test(line)?'GRADE':'PROJECT_DATUM',floor,source:context?.source||null,confidence:.72,evidence:[line,'UNITS_REQUIRE_SOURCE_DATUM_REVIEW'],physicalTruth:false,reviewRequired:true});
    const aff=parseAff(line);
    if(aff!==null)out.push({id:`${context?.idPrefix||'z'}-${i++}`,type:'MOUNTING_HEIGHT_AFF',valueMeters:aff,relativeTo:'FLOOR_DATUM',floor,source:context?.source||null,confidence:.86,evidence:[line],physicalTruth:false,reviewRequired:true});
  }
  return out;
}

export function resolveEntityZ(entity:ZEntityLike,evidence:ZEvidence[]):ZResolution{
  const meta=entity.meta||{};
  if(meta.sourceDesignElevationKnown===true&&Number.isFinite(Number(entity.z))){
    return{entityId:entity.id,status:'RESOLVED_DESIGN_CANDIDATE',zMeters:Number(entity.z),confidence:.96,authority:String(meta.zPlacementAuthority||'SOURCE_DESIGN_PLACEMENT'),evidence:[{id:'source-z',type:String(meta.sourceType||'').startsWith('IFC')?'IFC_DESIGN_PLACEMENT':'CAD_DESIGN_Z',valueMeters:Number(entity.z),relativeTo:'PROJECT_DATUM',floor:entity.floor||null,source:entity.source,confidence:.96,evidence:[String(meta.zPlacementAuthority||'SOURCE_DESIGN_PLACEMENT')],physicalTruth:false,reviewRequired:true}],physicalTruth:false,reviewRequired:true,reason:'Source design placement provides Z; field/as-built verification is still separate.'};
  }
  const floor=(entity.floor||'').toUpperCase();
  const sameFloor=evidence.filter(e=>!e.floor||!floor||String(e.floor).toUpperCase()===floor);
  const datums=sameFloor.filter(e=>['FLOOR_DATUM','SECTION_ELEVATION'].includes(e.type)&&e.valueMeters!==null);
  const aff=sameFloor.filter(e=>e.type==='MOUNTING_HEIGHT_AFF'&&e.valueMeters!==null);
  if(datums.length){
    const sorted=[...datums].sort((a,b)=>b.confidence-a.confidence),base=sorted[0];
    const conflict=sorted.some(e=>Math.abs(Number(e.valueMeters)-Number(base.valueMeters))>.15);
    if(conflict)return{entityId:entity.id,status:'CONFLICT',zMeters:null,confidence:0,authority:'CONFLICTING_Z_EVIDENCE',evidence:sorted,physicalTruth:false,reviewRequired:true,reason:'Multiple source-derived floor/section elevations disagree by more than 0.15 m.'};
    if(aff.length){
      const bestAff=[...aff].sort((a,b)=>b.confidence-a.confidence)[0];
      const z=Number(base.valueMeters)+Number(bestAff.valueMeters);
      return{entityId:entity.id,status:'RESOLVED_DESIGN_CANDIDATE',zMeters:z,confidence:Math.min(base.confidence,bestAff.confidence),authority:'FLOOR_DATUM_PLUS_AFF',evidence:[base,bestAff],physicalTruth:false,reviewRequired:true,reason:'Resolved from source floor datum plus source mounting height above finished floor.'};
    }
    return{entityId:entity.id,status:'RESOLVED_DESIGN_CANDIDATE',zMeters:Number(base.valueMeters),confidence:base.confidence,authority:'SOURCE_FLOOR_OR_SECTION_DATUM',evidence:[base],physicalTruth:false,reviewRequired:true,reason:'Resolved to the source floor/section datum. Object-specific mounting height is unavailable.'};
  }
  if(aff.length)return{entityId:entity.id,status:'RELATIVE_ONLY',zMeters:null,confidence:aff[0].confidence,authority:'AFF_WITHOUT_FLOOR_DATUM',evidence:aff,physicalTruth:false,reviewRequired:true,reason:'Mounting height is known relative to finished floor, but the floor datum is unresolved.'};
  return{entityId:entity.id,status:'UNRESOLVED',zMeters:null,confidence:0,authority:'UNRESOLVED',evidence:[],physicalTruth:false,reviewRequired:true,reason:'No defensible source evidence establishes Z.'};
}

export function buildZResolutionIndex(entities:ZEntityLike[],textEvidence:ZEvidence[]){
  return new Map(entities.map(entity=>[entity.id,resolveEntityZ(entity,textEvidence)]));
}
