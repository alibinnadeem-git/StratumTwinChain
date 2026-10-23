import {assignZones,buildLinks,type GraphEntity,type GraphLink,type Layer} from './graph-assembly';
import {reconcileSpatialEquipmentIdentity} from './spatial-equipment-identity';
import {identifyLibraryComponents} from './library-component-identity';
import {gateEquipmentCandidates} from './candidate-gating';
import {applyRelativeStoryDatum} from './relative-story-datum';
import {enrichCoordinationIntelligence} from './coordination-intelligence';
import {enrichElectricalDesignIntelligence,type ElectricalDesignIntelligence} from './electrical-design-intelligence-v3';
import {enrichSpatialProjection} from './spatial-projection';
import {enrichPowerIntelligence} from './power-intelligence';
import {buildZResolutionIndex,type ZEvidence} from './z-resolver';
import {buildEntityZConstraintGraph} from './z-constraint-graph';
import {buildProjectDatumSurfaces,datumSurfaceMetadata,projectDatumSurfaceForEntity} from './project-datum';
import {enrichZRecovery} from './z-recovery';

// Post-parse enrichment + compilation, kept outside the React component so it can run
// inside workers/graph-assembly.worker.ts. On a large/accumulated graph these passes
// were the main-thread freeze (reprocess and repeat imports); the worker runs them off
// the UI thread, and the synchronous exports here double as the no-Worker fallback.

function withZConstraintGraph(entity:GraphEntity){
 const graph=buildEntityZConstraintGraph(entity);
 return {...entity,meta:{...entity.meta,zConstraintGraph:graph,zConstraintGraphStatus:graph.status,zConstraintBaseCandidateMeters:graph.baseZMeters,zConstraintConflictCount:graph.conflicts.length,zConstraintFrameGapCount:graph.frameGaps.length}};
}

export function enrichZCandidates(parsed:GraphEntity[]){
 const evidence=parsed.flatMap(entity=>entity.meta?.zEvidence?[entity.meta.zEvidence as ZEvidence]:[]);
 const surfaces=buildProjectDatumSurfaces(evidence);
 const recovered=enrichZRecovery(parsed,evidence,surfaces);
 // Source sheet basemap lines are context, not Z-bearing assets. Excluding
 // ~28k drawing segments from the per-asset Z solver avoids enormous
 // main-thread work and does not infer a physical elevation.
 const reviewable=recovered.filter(e=>!(e.kind==='line'&&e.meta?.drawingBasemap===true));
 const index=buildZResolutionIndex(reviewable,evidence);
 return recovered.map(entity=>{
  if(entity.kind==='line'&&entity.meta?.drawingBasemap===true){
   return {...entity,meta:{...entity.meta,zResolutionStatus:'UNRESOLVED',
    zPlacementAuthority:'UNVERIFIED_DRAWING_PLANE',physicalTruth:false,
    elevationKnown:false,physicalElevationKnown:false}};
  }
  const resolution=index.get(entity.id);
  const surface=projectDatumSurfaceForEntity(entity,surfaces);
  const surfaceMeta=datumSurfaceMetadata(surface);
  const xyzGuide=Number.isFinite(Number(entity.meta?.unitToMeters))&&String(entity.meta?.unitName||'')!=='unitless'
   ?{zScaleGuideMetersPerSourceUnit:Number(entity.meta?.unitToMeters),zScaleGuideAuthority:'XY_AND_Z_SHARE_SOURCE_UNITS'}
   :{};
  if(!resolution||resolution.status==='UNRESOLVED'){
   const inferred=Number.isFinite(Number(entity.meta?.inferredProjectDatumZ));
   const relative=Number.isFinite(Number(entity.meta?.relativeReviewSurfaceZ));
   return withZConstraintGraph({...entity,meta:{...entity.meta,...surfaceMeta,...xyzGuide,zResolutionStatus:inferred?'INFERRED_PROJECT_DATUM_CANDIDATE':relative?'RELATIVE_VISUALIZATION_ONLY':'UNRESOLVED',zResolutionConfidence:inferred?Number(entity.meta?.inferredProjectDatumConfidence||0):relative?Number(entity.meta?.relativeReviewSurfaceConfidence||0):0,zResolutionAuthority:inferred?String(entity.meta?.inferredProjectDatumAuthority||'PROJECT_STORY_INTERVAL_EXTRAPOLATION'):relative?String(entity.meta?.relativeReviewSurfaceAuthority||'VISUALIZATION_STORY_STACK_ONLY'):'UNRESOLVED',physicalElevationKnown:false,elevationKnown:false,reviewRequired:true}});
  }
  if(resolution.status==='RESOLVED_DESIGN_CANDIDATE'&&resolution.zMeters!==null){
   return withZConstraintGraph({...entity,meta:{...entity.meta,...surfaceMeta,...xyzGuide,zCandidateMeters:resolution.zMeters,zCandidateReferencePoint:resolution.referencePoint,zResolutionStatus:resolution.status,zResolutionConfidence:resolution.confidence,zResolutionAuthority:resolution.authority,zResolutionEvidence:resolution.evidence,physicalElevationKnown:false,elevationKnown:false,reviewRequired:true}});
  }
  return withZConstraintGraph({...entity,meta:{...entity.meta,...surfaceMeta,...xyzGuide,zCandidateReferencePoint:resolution.referencePoint,zResolutionStatus:resolution.status,zResolutionConfidence:resolution.confidence,zResolutionAuthority:resolution.authority,zResolutionEvidence:resolution.evidence,physicalElevationKnown:false,elevationKnown:false,reviewRequired:true}});
 });
}

// Full per-asset enrichment used for the accumulated graph (Z candidates + equipment identity).
export function enrichSpatialEntities(entities:GraphEntity[]):GraphEntity[]{
 // Relative story datum runs AFTER enrichZCandidates: z-recovery deliberately strips heuristic Z
 // stacks for floored entities, so the nominal datum is applied once that pass has run.
 return gateEquipmentCandidates(identifyLibraryComponents(reconcileSpatialEquipmentIdentity(applyRelativeStoryDatum(enrichZCandidates(entities)))));
}

export type CompileGraphInput={entities:GraphEntity[];sources:Array<{name:string;sha256?:string;discipline?:string;setCompleteness?:{status?:string;missingSheets?:string[]}}>;priorReviewState?:string};
export type CompileGraphResult={zoned:GraphEntity[];links:GraphLink[];coordinationIntelligence:unknown;electricalIntelligence:ElectricalDesignIntelligence;reviewState?:string;stats:Record<Layer,number>};

// Assigns zones, builds logical links, derives coordination findings, electrical evidence
// and layer stats in one pass. Mirrors exactly what saveGraph used to do inline on the main thread.
export function compileGraph(input:CompileGraphInput):CompileGraphResult{
 const sources=input.sources||[];
 const zoned=assignZones(input.entities);
 const links=buildLinks(zoned);
 const reviewState=zoned.some(e=>e.layer==='L2'||e.layer==='L4')?'REVIEW_REQUIRED':input.priorReviewState;
 const stats:Record<Layer,number>={L0:sources.length,L1:zoned.filter(e=>e.layer==='L1').length,L2:zoned.filter(e=>e.layer==='L2').length,L3:zoned.filter(e=>e.layer==='L3').length,L4:zoned.filter(e=>e.layer==='L4').length};
 const enriched=enrichCoordinationIntelligence({entities:zoned,sources,links} as any) as {coordinationIntelligence?:unknown};
 // Electrical evidence annotates physical plan entities, so the returned entities carry its findings.
 const electrical=enrichElectricalDesignIntelligence({entities:zoned as any[],sources});
 return {zoned:electrical.entities as GraphEntity[],links,coordinationIntelligence:enriched.coordinationIntelligence??null,electricalIntelligence:electrical.electricalIntelligence,reviewState,stats};
}

// Reactive projection enrichment (spatial projection -> power intelligence -> coordination),
// run off the main thread by the graph worker. Pure; the registry is read on the main thread.
export function projectGraph(graph:unknown,registry?:unknown){
 const spatial=enrichSpatialProjection(graph as any,registry as any);
 const power=enrichPowerIntelligence(spatial as any);
 return enrichCoordinationIntelligence(power as any);
}
