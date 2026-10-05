export type ZReferencePoint='BASE'|'BOTTOM'|'CENTERLINE'|'TOP'|'MOUNTING_POINT'|'SOURCE_ORIGIN'|'PROJECT_DATUM'|'UNSPECIFIED';

export type ZEvidenceType=
  |'IFC_DESIGN_PLACEMENT'
  |'CAD_DESIGN_Z'
  |'FLOOR_DATUM'
  |'SPOT_ELEVATION'
  |'MOUNTING_HEIGHT_AFF'
  |'SECTION_ELEVATION'
  |'GRADE_ELEVATION'
  |'EXISTING_GRADE_ELEVATION'
  |'CODE_GRADE_PLANE'
  |'LOWEST_ADJACENT_GRADE'
  |'TOP_OF_CURB_ELEVATION'
  |'FLOWLINE_ELEVATION'
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
  referencePoint?:ZReferencePoint;
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
  referencePoint:ZReferencePoint;
  evidence:ZEvidence[];
  physicalTruth:false;
  reviewRequired:true;
  reason:string;
};

const FT=.3048,IN=.0254;
const clean=(s:string)=>s.replace(/\s+/g,' ').trim();
const floorToken=(s:string)=>{
  const t=s.toUpperCase();
  if(/\b(?:GROUND|GROUND FLOOR|LEVEL 1|L1|FIRST FLOOR|1ST STORY|FIRST STORY)\b/.test(t))return'L1';
  const story=t.match(/\b(\d{1,2})(?:ST|ND|RD|TH)\s+STORY\b/);if(story)return'L'+Number(story[1]);
  const wordStory=t.match(/\b(SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH)\s+STORY\b/);
  if(wordStory){const n:{[key:string]:number}={SECOND:2,THIRD:3,FOURTH:4,FIFTH:5,SIXTH:6,SEVENTH:7,EIGHTH:8,NINTH:9,TENTH:10};return'L'+n[wordStory[1]]}
  const m=t.match(/\b(?:LEVEL|LVL|FLOOR|L)\s*[-#:]?\s*(\d{1,2})\b/);if(m)return'L'+Number(m[1]);
  const b=t.match(/\b(?:BASEMENT|B)\s*[-#:]?\s*(\d{1,2})?\b/);if(b)return'B'+Number(b[1]||1);
  if(/\bROOF\b/.test(t))return'ROOF';
  if(/\bPENTHOUSE\b/.test(t))return'PENTHOUSE';
  return null;
};
function mixedNumber(value:string|undefined){
  if(!value)return 0;
  const parts=value.trim().split(/\s+/).filter(Boolean);let total=0;
  for(const part of parts){
    if(part.includes('/')){const [a,b]=part.split('/').map(Number);if(!Number.isFinite(a)||!Number.isFinite(b)||b===0)return null;total+=a/b}
    else{const n=Number(part);if(!Number.isFinite(n))return null;total+=n}
  }
  return total;
}
function feetInchesToMeters(ft:string|undefined,inch:string|undefined){
  const f=Number(ft||0),i=mixedNumber(inch);
  if(!Number.isFinite(f)||i===null)return null;
  const sign=f<0?-1:1;
  return f*FT+sign*i*IN;
}
function parseArchitecturalElevation(text:string){
  const t=clean(text).replace(/[’]/g,"'").replace(/[”]/g,'"');
  const m=t.match(/(?:EL(?:EV(?:ATION)?)?\.?|ELEV\.?|LEVEL|F\.F\.?|FF|T\.O\.?\s*(?:SLAB|CURB|STEEL|DECK)?|B\.O\.?\s*(?:SLAB|STEEL|DECK)?|TOP\s+OF\s+(?:SLAB|STEEL|DECK|CURB)(?:\s+ELEV(?:ATION)?)?|BOTTOM\s+OF\s+(?:SLAB|STEEL|DECK)(?:\s+ELEV(?:ATION)?)?|TOS|BOS|TOD|BOD|B\.O\.D\.)\s*[:=@-]?\s*([+-]?\d{1,4})\s*'\s*(?:-\s*((?:\d+\s+)?(?:\d+\/\d+|\d+(?:\.\d+)?))\s*")?/i);
  return m?feetInchesToMeters(m[1],m[2]):null;
}
function parseStandaloneArchitecturalValue(text:string){
  const t=clean(text).replace(/[’]/g,"'").replace(/[”]/g,'"').replace(/[.,;:]+$/,'');
  const m=t.match(/^([+-]?\d{1,4})\s*'\s*(?:-\s*((?:\d+\s+)?(?:\d+\/\d+|\d+(?:\.\d+)?))\s*")?$/);
  return m?feetInchesToMeters(m[1],m[2]):null;
}
function parseTrailingArchitecturalValue(text:string){
  const t=clean(text).replace(/[’]/g,"'").replace(/[”]/g,'"').replace(/[.,;:]+$/,'');
  const m=t.match(/([+-]?\d{1,4}(?:\.\d+)?)\s*'\s*(?:-\s*((?:\d+\s+)?(?:\d+\/\d+|\d+(?:\.\d+)?))\s*")?\s*$/);
  return m?feetInchesToMeters(m[1],m[2]):null;
}
function architecturalDatumLabel(text:string):{type:ZEvidenceType;floor:string|null;relativeTo:'PROJECT_DATUM'|'GRADE'}|null{
  const t=clean(text).toUpperCase(),floor=floorToken(t);
  if(/\bGRADE\s+PLANE\b/.test(t))return{type:'CODE_GRADE_PLANE',floor:null,relativeTo:'PROJECT_DATUM'};
  if(/\bLOWEST\s+ADJACENT\s+GRADE\b|^LAG\b/.test(t))return{type:'LOWEST_ADJACENT_GRADE',floor:null,relativeTo:'PROJECT_DATUM'};
  if(/\b(?:\d{1,2}(?:ST|ND|RD|TH)|FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH)\s+STORY\b/.test(t))return{type:'FLOOR_DATUM',floor,relativeTo:'PROJECT_DATUM'};
  if(/\bTOP\s+OF\s+(?:ROOF|PARAPET)\b|^ROOF\b/.test(t))return{type:'SECTION_ELEVATION',floor:floor||(/ROOF/.test(t)?'ROOF':null),relativeTo:'PROJECT_DATUM'};
  return null;
}
function structuralDatumLabel(text:string):{type:'FLOOR_DATUM'|'SECTION_ELEVATION';floor:string|null}|null{
  const t=clean(text).toUpperCase();
  const floor=floorToken(t);
  if(/\bLEVEL\s*\d+\s+SLAB\s+ELEV\.?\b|\bFINISH(?:ED)?\s+FLOOR\s+ELEV\.?\b|\bFFE?\b/.test(t))return{type:'FLOOR_DATUM',floor};
  if(/\bB\.O\.D\.?\b|\bBOD\b|\bTOP\s+OF\s+(?:SLAB|STEEL|DECK|ROOF|PARAPET)\b|\bBOTTOM\s+OF\s+(?:SLAB|STEEL|DECK)\b|\b(?:HIGH|LOW)\s+PARAPET\s+ELEV\.?\b|\bROOF\s+ELEV\.?\b/.test(t))return{type:'SECTION_ELEVATION',floor};
  return null;
}
function parseSuffixStructuralElevation(text:string){
  const t=clean(text).replace(/[’]/g,"'").replace(/[”]/g,'"');
  const marker=structuralDatumLabel(t);if(!marker)return null;
  const m=t.match(/^([+-]?\d{1,4})\s*'\s*(?:-\s*((?:\d+\s+)?(?:\d+\/\d+|\d+(?:\.\d+)?))\s*")?\s*(?:-|=|:)?\s*(?:B\.O\.D\.?|BOD|TOP\s+OF\s+(?:SLAB|STEEL|DECK|CURB)|BOTTOM\s+OF\s+(?:SLAB|STEEL|DECK)|(?:HIGH|LOW)\s+PARAPET\s+ELEV\.?|ROOF\s+ELEV\.?)/i);
  if(!m)return null;
  const valueMeters=feetInchesToMeters(m[1],m[2]);if(valueMeters===null)return null;
  return{...marker,valueMeters};
}
function parseDecimalElevation(text:string){
  const t=clean(text);
  const semantic='(?:EL(?:EV(?:ATION)?)?\\.?|ELEV\\.?|FF(?:E)?\\.?|FINISH(?:ED)?\\s+FLOOR|T\\.O\\.?\\s*(?:SLAB|CURB|STEEL|DECK)?|B\\.O\\.?\\s*(?:SLAB|STEEL|DECK)?|TOP\\s+OF\\s+(?:SLAB|STEEL|DECK|CURB)(?:\\s+ELEV(?:ATION)?)?|BOTTOM\\s+OF\\s+(?:SLAB|STEEL|DECK)(?:\\s+ELEV(?:ATION)?)?|TOS|BOS|TOD|BOD|B\\.O\\.D\\.|GRADE|FG|FS|FINISH(?:ED)?\\s+(?:GRADE|SURFACE)|EG|EXISTING\\s+GRADE|TC|TOP\\s+OF\\s+CURB|FL|FLOW\\s*LINE)';
  const number='([+-]?\\d{1,4}(?:\\.\\d+)?)';
  const unit='(FT|FEET|M|METERS?|MM)';
  const prefix=t.match(new RegExp(semantic+'\\\\s*[:=@-]?\\\\s*'+number+'(?:\\\\s*'+unit+')?','i'));
  const suffix=t.match(new RegExp(number+'(?:\\\\s*'+unit+')?\\\\s*'+semantic+'\\\\b','i'));
  const m=prefix||suffix;
  if(!m)return null;
  const n=Number(m[1]);if(!Number.isFinite(n))return null;
  const rawUnit=(m[2]||'').toUpperCase();
  if(rawUnit==='M'||rawUnit.startsWith('METER'))return n;
  if(rawUnit==='MM')return n/1000;
  if(rawUnit==='FT'||rawUnit==='FEET')return n*FT;
  return {raw:n,unit:'DRAWING_DATUM'} as const;
}
function civilElevationType(text:string,unitless=false):ZEvidenceType|null{
  const t=clean(text).toUpperCase();
  if(/\bGRADE\s+PLANE\b/.test(t))return'CODE_GRADE_PLANE';
  if(/\bLOWEST\s+ADJACENT\s+GRADE\b|^LAG\b/.test(t))return'LOWEST_ADJACENT_GRADE';
  if(/\bEG\b|\bEXISTING\s+GRADE\b/.test(t))return'EXISTING_GRADE_ELEVATION';
  if(/\bTC\b|\bTOP\s+OF\s+CURB\b/.test(t))return'TOP_OF_CURB_ELEVATION';
  if(/\bFL\b|\bFLOW\s*LINE\b/.test(t))return'FLOWLINE_ELEVATION';
  if(/\bFG\b|\bFS\b|\bFINISH(?:ED)?\s+(?:GRADE|SURFACE)\b|(?:^|\s)GRADE(?:\s|$)/.test(t))return unitless?'SPOT_ELEVATION':'GRADE_ELEVATION';
  return null;
}
function civilRelativeTo(type:ZEvidenceType|null){
  return type&&['GRADE_ELEVATION','SPOT_ELEVATION','EXISTING_GRADE_ELEVATION','TOP_OF_CURB_ELEVATION','FLOWLINE_ELEVATION'].includes(type)?'GRADE' as const:'PROJECT_DATUM' as const;
}
function parseAff(text:string){
  const t=clean(text).replace(/[’]/g,"'").replace(/[”]/g,'"');
  let m=t.match(/([+-]?\d+(?:\.\d+)?)\s*'\s*(?:-\s*(\d+(?:\.\d+)?)\s*")?\s*(?:A\.?F\.?F\.?|AFF)\b/i);
  if(m)return feetInchesToMeters(m[1],m[2]);
  m=t.match(/([+-]?\d+(?:\.\d+)?)\s*(IN|INCHES|MM|CM|M)\s*(?:A\.?F\.?F\.?|AFF)\b/i);
  if(!m)return null;const n=Number(m[1]),u=m[2].toUpperCase();if(!Number.isFinite(n))return null;
  return u==='IN'||u==='INCHES'?n*IN:u==='MM'?n/1000:u==='CM'?n/100:n;
}

function affReferencePoint(text:string):ZReferencePoint{
  const t=clean(text).toUpperCase().replace(/[’]/g,"'").replace(/[”]/g,'"');
  if(/\b(?:BOTTOM|BOT(?:TOM)?|B\.O\.)\b/.test(t))return'BOTTOM';
  if(/\bBASE\b/.test(t))return'BASE';
  if(/\bCENTERLINE\b|\bCENTER\s+LINE\b|\bC\/L\b/.test(t))return'CENTERLINE';
  if(/\b(?:TOP|T\.O\.)\b/.test(t))return'TOP';
  if(/\bMOUNT(?:ING)?\s+(?:POINT|PT)\b/.test(t))return'MOUNTING_POINT';
  return'UNSPECIFIED';
}

function equipmentTagFromLine(text:string){
  const t=clean(text).toUpperCase();
  const m=t.match(/\b(PANEL|PNL|TRANSFORMER|XFMR|SWITCHBOARD|SWBD|SWITCHGEAR|SWGR|ATS|UPS|MCC|PDU|VFD|EVSE|RTU|AHU|FCU|DEVICE|RECEPTACLE|LIGHT|FIXTURE)\s*[-#:]?\s*([A-Z0-9][A-Z0-9._-]{0,24})\b/);
  return m?`${m[1]} ${m[2]}`:null;
}
function tagMatchesEntity(tag:string|undefined|null,name:string){
  if(!tag)return false;
  const normalize=(value:string)=>value.toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
  const t=normalize(tag),n=normalize(name);
  if(!t||!n)return false;
  if(n.includes(t))return true;
  const suffix=t.split(' ').slice(1).join(' ');
  return suffix.length>=2&&n.includes(suffix);
}

export function extractZEvidenceFromText(text:string,context?:{source?:string;floor?:string;idPrefix?:string}):ZEvidence[]{
  const out:ZEvidence[]=[];const lines=text.split(/\r?\n/).map(clean).filter(Boolean);let i=0;
  for(let lineIndex=0;lineIndex<lines.length;lineIndex++){
    const line=lines[lineIndex],floor=context?.floor||floorToken(line);
    const special=architecturalDatumLabel(line);
    const specialInline=special?parseTrailingArchitecturalValue(line):null;
    let specialHandled=false;
    if(special&&specialInline!==null){
      out.push({id:`${context?.idPrefix||'z'}-${i++}`,type:special.type,valueMeters:specialInline,relativeTo:special.relativeTo,referencePoint:'PROJECT_DATUM',floor:context?.floor||special.floor,source:context?.source||null,confidence:.9,evidence:[line,'ARCHITECTURAL_DATUM'],physicalTruth:false,reviewRequired:true});
      specialHandled=true;
    }else if(special){
      const next=lines[lineIndex+1],nextValue=next?parseStandaloneArchitecturalValue(next):null;
      if(nextValue!==null){
        out.push({id:`${context?.idPrefix||'z'}-${i++}`,type:special.type,valueMeters:nextValue,relativeTo:special.relativeTo,referencePoint:'PROJECT_DATUM',floor:context?.floor||special.floor,source:context?.source||null,confidence:.86,evidence:[line,next,'SPLIT_LINE_ARCHITECTURAL_DATUM'],physicalTruth:false,reviewRequired:true});
        specialHandled=true;
      }
    }
    const suffix=specialHandled?null:parseSuffixStructuralElevation(line);
    if(suffix){
      out.push({id:`${context?.idPrefix||'z'}-${i++}`,type:suffix.type,valueMeters:suffix.valueMeters,relativeTo:'PROJECT_DATUM',referencePoint:'PROJECT_DATUM',floor:context?.floor||suffix.floor,source:context?.source||null,confidence:.88,evidence:[line,'SUFFIX_STRUCTURAL_DATUM'],physicalTruth:false,reviewRequired:true});
    }
    const labelOnly=specialHandled?null:structuralDatumLabel(line);
    const inlineValue=specialHandled?null:parseArchitecturalElevation(line);
    if(labelOnly&&inlineValue===null&&!/\d+\s*'/.test(line)){
      const next=lines[lineIndex+1],nextValue=next?parseStandaloneArchitecturalValue(next):null;
      if(nextValue!==null){
        out.push({id:`${context?.idPrefix||'z'}-${i++}`,type:labelOnly.type,valueMeters:nextValue,relativeTo:'PROJECT_DATUM',referencePoint:'PROJECT_DATUM',floor:context?.floor||labelOnly.floor,source:context?.source||null,confidence:.84,evidence:[line,next,'SPLIT_LINE_STRUCTURAL_DATUM'],physicalTruth:false,reviewRequired:true});
      }
    }
    const arch=suffix?null:inlineValue;
    if(arch!==null){const civilType=civilElevationType(line);out.push({id:`${context?.idPrefix||'z'}-${i++}`,type:civilType||(/SECTION|ELEVATION|T\.O\.|B\.O\.|TOP OF|BOTTOM OF|\bTOS\b|\bBOS\b|\bTOD\b|\bBOD\b|B\.O\.D\./i.test(line)?'SECTION_ELEVATION':'FLOOR_DATUM'),valueMeters:arch,relativeTo:civilType?'GRADE':'PROJECT_DATUM',referencePoint:'PROJECT_DATUM',floor,source:context?.source||null,confidence:.9,evidence:[line],physicalTruth:false,reviewRequired:true});}
    const dec=!specialHandled&&arch===null?parseDecimalElevation(line):null;
    if(typeof dec==='number'){const civilType=civilElevationType(line);out.push({id:`${context?.idPrefix||'z'}-${i++}`,type:civilType||'FLOOR_DATUM',valueMeters:dec,relativeTo:civilRelativeTo(civilType),referencePoint:'PROJECT_DATUM',floor,source:context?.source||null,confidence:.88,evidence:[line],physicalTruth:false,reviewRequired:true});}
    else if(dec&&dec.unit==='DRAWING_DATUM'){const civilType=civilElevationType(line,true);out.push({id:`${context?.idPrefix||'z'}-${i++}`,type:civilType||'FLOOR_DATUM',valueMeters:dec.raw,relativeTo:civilRelativeTo(civilType),referencePoint:'PROJECT_DATUM',floor,source:context?.source||null,confidence:.72,evidence:[line,'UNITS_REQUIRE_SOURCE_DATUM_REVIEW'],physicalTruth:false,reviewRequired:true});}
    const aff=parseAff(line);
    if(aff!==null){const tag=equipmentTagFromLine(line),referencePoint=affReferencePoint(line);out.push({id:`${context?.idPrefix||'z'}-${i++}`,type:'MOUNTING_HEIGHT_AFF',valueMeters:aff,relativeTo:'FLOOR_DATUM',referencePoint,floor,tag,source:context?.source||null,confidence:tag?(referencePoint==='UNSPECIFIED'?.7:.88):.58,evidence:[line,...(tag?[`OBJECT_LINK:${tag}`]:['OBJECT_LINK_UNRESOLVED']),`REFERENCE_POINT:${referencePoint}`],physicalTruth:false,reviewRequired:true});}
  }
  return out;
}

export function resolveEntityZ(entity:ZEntityLike,evidence:ZEvidence[]):ZResolution{
  const meta=entity.meta||{};
  if(meta.sourceDesignElevationKnown===true&&Number.isFinite(Number(entity.z))){
    const referencePoint=(String(meta.sourceZReferencePoint||'SOURCE_ORIGIN') as ZReferencePoint);
    return{entityId:entity.id,status:'RESOLVED_DESIGN_CANDIDATE',zMeters:Number(entity.z),confidence:.96,authority:String(meta.zPlacementAuthority||'SOURCE_DESIGN_PLACEMENT'),referencePoint,evidence:[{id:'source-z',type:String(meta.sourceType||'').startsWith('IFC')?'IFC_DESIGN_PLACEMENT':'CAD_DESIGN_Z',valueMeters:Number(entity.z),relativeTo:'PROJECT_DATUM',referencePoint,floor:entity.floor||null,source:entity.source,confidence:.96,evidence:[String(meta.zPlacementAuthority||'SOURCE_DESIGN_PLACEMENT'),`REFERENCE_POINT:${referencePoint}`],physicalTruth:false,reviewRequired:true}],physicalTruth:false,reviewRequired:true,reason:'Source design placement provides a source-origin Z candidate; field/as-built verification and origin-to-equipment reference semantics remain separate.'};
  }
  const floor=(entity.floor||'').toUpperCase();
  const sameFloor=evidence.filter(e=>!e.floor||!floor||String(e.floor).toUpperCase()===floor);
  const datums=sameFloor.filter(e=>e.type==='FLOOR_DATUM'&&e.valueMeters!==null&&!e.evidence.some(item=>/UNITS_REQUIRE_SOURCE_DATUM_REVIEW/i.test(item)));
  const aff=sameFloor.filter(e=>e.type==='MOUNTING_HEIGHT_AFF'&&e.valueMeters!==null&&tagMatchesEntity(e.tag,entity.name));
  if(datums.length){
    const sorted=[...datums].sort((a,b)=>b.confidence-a.confidence),base=sorted[0];
    const conflict=sorted.some(e=>Math.abs(Number(e.valueMeters)-Number(base.valueMeters))>.15);
    if(conflict)return{entityId:entity.id,status:'CONFLICT',zMeters:null,confidence:0,authority:'CONFLICTING_Z_EVIDENCE',referencePoint:'UNSPECIFIED',evidence:sorted,physicalTruth:false,reviewRequired:true,reason:'Multiple source-derived floor/section elevations disagree by more than 0.15 m.'};
    if(aff.length){
      const bestAff=[...aff].sort((a,b)=>b.confidence-a.confidence)[0];
      const referencePoint=bestAff.referencePoint||'UNSPECIFIED';
      if(referencePoint==='UNSPECIFIED'){
        return{entityId:entity.id,status:'RELATIVE_ONLY',zMeters:null,confidence:bestAff.confidence,authority:'AFF_REFERENCE_UNSPECIFIED',referencePoint,evidence:[base,bestAff],physicalTruth:false,reviewRequired:true,reason:'AFF height is linked to this object and the floor datum is known, but the drawing does not establish whether the height is to the base, bottom, centerline, top, or mounting point.'};
      }
      const z=Number(base.valueMeters)+Number(bestAff.valueMeters);
      return{entityId:entity.id,status:'RESOLVED_DESIGN_CANDIDATE',zMeters:z,confidence:Math.min(base.confidence,bestAff.confidence),authority:'FLOOR_DATUM_PLUS_AFF_REFERENCE',referencePoint,evidence:[base,bestAff],physicalTruth:false,reviewRequired:true,reason:`Resolved source reference-point Z from floor datum plus AFF height to ${referencePoint.toLowerCase().replaceAll('_',' ')}; converting that reference into equipment base Z remains a separate placement step.`};
    }
    return{entityId:entity.id,status:'RELATIVE_ONLY',zMeters:null,confidence:base.confidence,authority:'PROJECT_FLOOR_DATUM_ONLY',referencePoint:'PROJECT_DATUM',evidence:[base],physicalTruth:false,reviewRequired:true,reason:'A source floor/section datum establishes the project review surface, but object-specific mounting/base elevation is still unresolved.'};
  }
  if(aff.length){const bestAff=[...aff].sort((a,b)=>b.confidence-a.confidence)[0];return{entityId:entity.id,status:'RELATIVE_ONLY',zMeters:null,confidence:bestAff.confidence,authority:bestAff.referencePoint==='UNSPECIFIED'?'AFF_REFERENCE_UNSPECIFIED':'AFF_WITHOUT_FLOOR_DATUM',referencePoint:bestAff.referencePoint||'UNSPECIFIED',evidence:aff,physicalTruth:false,reviewRequired:true,reason:bestAff.referencePoint==='UNSPECIFIED'?'AFF height is linked to this object, but its vertical reference point is unspecified.':'Mounting reference height is known relative to finished floor, but the floor datum is unresolved.'};}
  return{entityId:entity.id,status:'UNRESOLVED',zMeters:null,confidence:0,authority:'UNRESOLVED',referencePoint:'UNSPECIFIED',evidence:[],physicalTruth:false,reviewRequired:true,reason:'No defensible source evidence establishes Z.'};
}

export function buildZResolutionIndex(entities:ZEntityLike[],textEvidence:ZEvidence[]){
  return new Map(entities.map(entity=>[entity.id,resolveEntityZ(entity,textEvidence)]));
}
