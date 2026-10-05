import type {ZEvidence,ZEntityLike} from './z-resolver.ts';

export type ProjectDatumSurfaceKind='FINISHED_FLOOR'|'SECTION_DATUM'|'GRADE';
export type ProjectDatumSurface={
 id:string;
 kind:ProjectDatumSurfaceKind;
 floor:string|null;
 zMeters:number;
 confidence:number;
 source:string|null;
 evidence:string[];
 physicalTruth:false;
 reviewRequired:true;
 conflict:boolean;
};

const floorKey=(value:string|undefined|null)=>String(value||'').trim().toUpperCase()||'UNRESOLVED';
const evidenceText=(e:ZEvidence)=>e.evidence.join(' ').toUpperCase();

function isFinishedGradeOrSurfaceEvidence(e:ZEvidence){
 const text=evidenceText(e);
 if(/\b(?:TC|TOP\s+OF\s+CURB|FL|FLOW\s*LINE)\b/.test(text))return false;
 return /\b(?:FG|GRADE|FINISH(?:ED)?\s+GRADE|FS|FINISH(?:ED)?\s+SURFACE)\b/.test(text);
}

function eligible(e:ZEvidence){
 if(e.valueMeters===null||!Number.isFinite(Number(e.valueMeters)))return false;
 if(e.evidence.some(item=>/UNITS_REQUIRE_SOURCE_DATUM_REVIEW/i.test(item)))return false;
 if(e.type==='FLOOR_DATUM')return true;
 if(e.type==='GRADE_ELEVATION'||e.type==='SPOT_ELEVATION')return isFinishedGradeOrSurfaceEvidence(e);
 return false;
}

function kindFor(e:ZEvidence):ProjectDatumSurfaceKind{
 if(e.type==='GRADE_ELEVATION'||e.type==='SPOT_ELEVATION')return'GRADE';
 return'FINISHED_FLOOR';
}

export function buildProjectDatumSurfaces(evidence:ZEvidence[]):ProjectDatumSurface[]{
 const groups=new Map<string,ZEvidence[]>();
 for(const item of evidence.filter(eligible)){
  const kind=kindFor(item);
  const floor=kind==='GRADE'?'PROJECT_GRADE':floorKey(item.floor);
  const key=`${kind}:${floor}`;
  groups.set(key,[...(groups.get(key)||[]),item]);
 }
 const surfaces:ProjectDatumSurface[]=[];
 for(const [key,items] of groups){
  const sorted=[...items].sort((a,b)=>b.confidence-a.confidence);
  const best=sorted[0],z=Number(best.valueMeters);
  const conflict=sorted.some(item=>Math.abs(Number(item.valueMeters)-z)>.15);
  if(conflict)continue;
  const kind=kindFor(best);
  const floor=kind==='GRADE'?null:(best.floor||null);
  surfaces.push({
   id:`datum:${key}`,
   kind,
   floor,
   zMeters:z,
   confidence:best.confidence,
   source:best.source||null,
   evidence:best.evidence,
   physicalTruth:false,
   reviewRequired:true,
   conflict:false
  });
 }
 return surfaces.sort((a,b)=>b.confidence-a.confidence);
}

export function projectDatumSurfaceForEntity(entity:ZEntityLike,surfaces:ProjectDatumSurface[]){
 const floor=floorKey(entity.floor);
 const floorMatches=surfaces.filter(surface=>surface.kind==='FINISHED_FLOOR'&&floor!=='UNRESOLVED'&&floorKey(surface.floor)===floor);
 if(floorMatches.length)return floorMatches[0];
 if(floor==='UNRESOLVED'){
  const grade=surfaces.find(surface=>surface.kind==='GRADE');
  if(grade)return grade;
 }
 return null;
}

export function datumSurfaceMetadata(surface:ProjectDatumSurface|null){
 if(!surface||surface.kind==='SECTION_DATUM')return{};
 return{
  reviewSurfaceZ:surface.zMeters,
  reviewSurfaceKind:surface.kind,
  reviewSurfaceAuthority:'SOURCE_PROJECT_DATUM',
  reviewSurfaceConfidence:surface.confidence,
  reviewSurfaceSource:surface.source,
  reviewSurfaceEvidence:surface.evidence,
  ...(surface.kind==='FINISHED_FLOOR'?{floorDatumMeters:surface.zMeters}:{}),
  physicalTruth:false,
  reviewRequired:true
 };
}
