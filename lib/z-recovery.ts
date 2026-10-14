import type {ProjectDatumSurface} from './project-datum.ts';
import type {ZEvidence,ZEntityLike} from './z-resolver.ts';

export type ZRecoveryMode=
 |'SOURCE_STORY_INTERVAL'
 |'EXPLICIT_STORY_HEIGHT'
 |'RELATIVE_EXPLICIT_STORY_HEIGHT'
 |'NONE';

export type ZRecoverySummary={
 mode:ZRecoveryMode;
 storyIntervalMeters:number|null;
 confidence:number;
 anchorFloor:string|null;
 anchorZMeters:number|null;
 source:string[];
 physicalTruth:false;
 reviewRequired:true;
};

type RecoveryEntity=ZEntityLike&{meta?:Record<string,unknown>};

function floorOrdinal(value:string|undefined|null){
 const floor=String(value||'').trim().toUpperCase();
 const level=floor.match(/^L(\d{1,2})$/);if(level)return Number(level[1])-1;
 const basement=floor.match(/^B(\d{1,2})$/);if(basement)return-Number(basement[1]);
 return null;
}
function median(values:number[]){
 if(!values.length)return null;
 const sorted=[...values].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);
 return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;
}
function storyHeightEvidence(evidence:ZEvidence[]){
 return evidence
  .filter(item=>item.type==='STORY_HEIGHT'&&item.valueMeters!==null&&Number.isFinite(Number(item.valueMeters)))
  .sort((a,b)=>b.confidence-a.confidence);
}
function sourceFloorSurfaces(surfaces:ProjectDatumSurface[]){
 return surfaces
  .filter(surface=>surface.kind==='FINISHED_FLOOR'&&surface.floor&&floorOrdinal(surface.floor)!==null)
  .map(surface=>({...surface,ordinal:floorOrdinal(surface.floor)!}));
}
function observedStoryInterval(surfaces:ProjectDatumSurface[]){
 const floors=sourceFloorSurfaces(surfaces);
 const candidates:number[]=[];
 for(let i=0;i<floors.length;i++)for(let j=i+1;j<floors.length;j++){
  const deltaOrdinal=floors[j].ordinal-floors[i].ordinal;
  if(!deltaOrdinal)continue;
  const interval=(floors[j].zMeters-floors[i].zMeters)/deltaOrdinal;
  if(interval>=2&&interval<=6)candidates.push(interval);
 }
 const value=median(candidates);
 if(value===null)return null;
 const spread=candidates.length>1?(Math.max(...candidates)-Math.min(...candidates))/Math.max(value,1e-9):0;
 if(spread>.12)return null;
 const confidence=Math.min(.78,Math.max(.58,Math.min(...floors.map(floor=>floor.confidence))*(candidates.length>=2?.9:.82)));
 return{value,confidence,source:candidates.map(candidate=>`OBSERVED_PROJECT_STORY_INTERVAL:${candidate.toFixed(4)}m`)};
}

export function summarizeZRecovery(evidence:ZEvidence[],surfaces:ProjectDatumSurface[]):ZRecoverySummary{
 const floors=sourceFloorSurfaces(surfaces);
 const interval=observedStoryInterval(surfaces);
 if(interval&&floors.length){
  const anchor=[...floors].sort((a,b)=>b.confidence-a.confidence)[0];
  return{mode:'SOURCE_STORY_INTERVAL',storyIntervalMeters:interval.value,confidence:interval.confidence,anchorFloor:anchor.floor,anchorZMeters:anchor.zMeters,source:[...anchor.evidence,...interval.source],physicalTruth:false,reviewRequired:true};
 }
 const explicit=storyHeightEvidence(evidence)[0];
 if(explicit){
  const anchor=[...floors].sort((a,b)=>b.confidence-a.confidence)[0]||null;
  return{
   mode:anchor?'EXPLICIT_STORY_HEIGHT':'RELATIVE_EXPLICIT_STORY_HEIGHT',
   storyIntervalMeters:Number(explicit.valueMeters),
   confidence:Math.min(.76,explicit.confidence,anchor?.confidence??.76),
   anchorFloor:anchor?.floor||null,
   anchorZMeters:anchor?.zMeters??null,
   source:explicit.evidence,
   physicalTruth:false,reviewRequired:true
  };
 }
 return{mode:'NONE',storyIntervalMeters:null,confidence:0,anchorFloor:null,anchorZMeters:null,source:[],physicalTruth:false,reviewRequired:true};
}

export function enrichZRecovery<T extends RecoveryEntity>(entities:T[],evidence:ZEvidence[],surfaces:ProjectDatumSurface[]):T[]{
 const summary=summarizeZRecovery(evidence,surfaces);
 const anchorOrdinal=floorOrdinal(summary.anchorFloor);
 return entities.map(entity=>{
  const ordinal=floorOrdinal(entity.floor);
  if(ordinal===null||entity.meta?.nonSpatial===true)return entity;
  const meta={...(entity.meta||{})};
  // Drop any persisted heuristic stack from earlier compilations; no source means no Z.
  for(const key of ['relativeReviewSurfaceZ','relativeReviewSurfaceFloor','relativeReviewSurfaceAuthority','relativeReviewSurfaceConfidence','relativeReviewSurfaceEvidence','inferredProjectDatumZ','inferredProjectDatumFloor','inferredProjectDatumAuthority','inferredProjectDatumConfidence','inferredProjectDatumEvidence'])delete meta[key];
  const alreadyAbsolute=Number.isFinite(Number(meta.localReviewSurfaceZ))||Number.isFinite(Number(meta.crossSheetReviewSurfaceZ))||Number.isFinite(Number(meta.floorDatumMeters))||Number.isFinite(Number(meta.reviewSurfaceZ))||meta.sourceDesignElevationKnown===true;
  if(alreadyAbsolute)return {...entity,meta} as T;
  if(summary.mode==='NONE')return {...entity,meta:{...meta,zRecoveryMode:'NONE',zRecoveryAbsoluteCandidate:false,physicalTruth:false,reviewRequired:true}} as T;

  if(summary.anchorZMeters!==null&&anchorOrdinal!==null&&summary.storyIntervalMeters!==null){
   const inferred=summary.anchorZMeters+(ordinal-anchorOrdinal)*summary.storyIntervalMeters;
   return{...entity,meta:{
    ...meta,
    inferredProjectDatumZ:inferred,
    inferredProjectDatumFloor:entity.floor,
    inferredProjectDatumAuthority:summary.mode==='SOURCE_STORY_INTERVAL'?'PROJECT_OBSERVED_STORY_INTERVAL_EXTRAPOLATION':'SOURCE_STORY_HEIGHT_FROM_ANCHORED_DATUM',
    inferredProjectDatumConfidence:summary.confidence,
    inferredProjectDatumEvidence:summary.source,
    zRecoveryMode:summary.mode,
    zRecoveryAbsoluteCandidate:true,
    physicalTruth:false,
    reviewRequired:true
   }} as T;
  }

  // A story-height note without a grade/floor control establishes an interval, not Z.
  return {...entity,meta:{...meta,zRecoveryMode:summary.mode,zRecoveryAbsoluteCandidate:false,physicalTruth:false,reviewRequired:true}} as T;
 });
}
