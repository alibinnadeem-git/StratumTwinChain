import {resolveAssetPlacement,type AssetPlacement,type PlacementEntity,type ZAuthority} from './asset-placement.ts';
import type {ElectricalModelConfig} from './electrical-model-registry.ts';

export type ZSolutionCandidateKind=
  |'REVIEWED_OR_MEASURED'
  |'SOURCE_REFERENCE'
  |'SUPPORT_SURFACE_PLUS_OFFSET'
  |'SUPPORT_SURFACE_BASE'
  |'MOUNTING_GUIDANCE'
  |'RELATIVE_ONLY'
  |'UNRESOLVED';

export type ZSolutionStep={
  kind:string;
  label:string;
  valueMeters?:number;
  authority?:string;
  confidence:number;
  evidence?:string[];
};

export type ZSolutionCandidate={
  id:string;
  kind:ZSolutionCandidateKind;
  baseZ:number|null;
  topZ:number|null;
  confidence:number;
  authority:ZAuthority|string;
  absolute:boolean;
  steps:ZSolutionStep[];
  note:string;
};

export type ZSolutionConflict={
  candidateA:string;
  candidateB:string;
  deltaMeters:number;
  toleranceMeters:number;
  reason:string;
};

export type ZSolution={
  status:'RESOLVED_CANDIDATE'|'CONFLICT'|'RELATIVE_ONLY'|'UNRESOLVED';
  chosenCandidateId:string|null;
  baseZ:number|null;
  topZ:number|null;
  confidence:number;
  candidates:ZSolutionCandidate[];
  conflicts:ZSolutionConflict[];
  toleranceMeters:number;
  physicalTruth:false;
  reviewRequired:true;
  explanation:string;
};

const finite=(value:unknown)=>{const n=Number(value);return Number.isFinite(n)?n:null};
const confidence=(value:unknown,fallback=0)=>Math.max(0,Math.min(1,Number.isFinite(Number(value))?Number(value):fallback));

const WITHOUT_SOURCE_REFERENCE=[
  'zCandidateMeters','zCandidateReferencePoint','zResolutionStatus','zResolutionConfidence','zResolutionAuthority','zResolutionEvidence',
  'sourceDesignElevationKnown','sourceZReferencePoint'
];
const WITHOUT_REVIEW_PREVIEW=[
  'zPreviewBaseMeters','zPreviewReferenceMeters','zPreviewReferencePoint','zPreviewConfidence','zPreviewInferenceId',
  'zPreviewMethod','zPreviewBasis','zPreviewAppliedAt','zPreviewAuthority'
];
const WITHOUT_SUPPORT=[
  'localReviewSurfaceZ','localReviewSurfaceKind','localReviewSurfaceAuthority','localReviewSurfaceConfidence',
  'crossSheetReviewSurfaceZ','crossSheetReviewSurfaceKind','crossSheetReviewSurfaceAuthority','crossSheetReviewSurfaceConfidence',
  'floorDatumMeters','floorElevationMeters','finishedFloorElevationMeters','reviewSurfaceZ','reviewSurfaceKind','reviewSurfaceAuthority','reviewSurfaceConfidence',
  'supportBaseOffsetMeters','supportOffsetKind','supportOffsetAuthority','supportOffsetConfidence','supportOffsetEvidenceLabel',
  'mountingBaseFromFloorMeters','recommendedBaseFromFloorMeters','manufacturerMountingBaseMeters','installationBaseFromFloorMeters'
];

function omitMeta(meta:Record<string,unknown>|undefined,keys:string[]){
  const next={...(meta||{})};
  for(const key of keys)delete next[key];
  return next;
}
function entityWithMeta(entity:PlacementEntity,meta:Record<string,unknown>):PlacementEntity{
  return{...entity,meta};
}
function absoluteAuthority(authority:string){
  return[
    'MEASURED_OR_REVIEWED',
    'SOURCE_DESIGN_CANDIDATE',
    'SUPPORT_SURFACE_PLUS_SOURCE_BASE_OFFSET',
    'SOURCE_SUPPORT_SURFACE_CANDIDATE'
  ].includes(authority);
}
function classifyPlacement(placement:AssetPlacement):ZSolutionCandidateKind{
  switch(placement.zAuthority){
    case'MEASURED_OR_REVIEWED':return'REVIEWED_OR_MEASURED';
    case'SOURCE_DESIGN_CANDIDATE':return'SOURCE_REFERENCE';
    case'SUPPORT_SURFACE_PLUS_SOURCE_BASE_OFFSET':return'SUPPORT_SURFACE_PLUS_OFFSET';
    case'SOURCE_SUPPORT_SURFACE_CANDIDATE':return'SUPPORT_SURFACE_BASE';
    case'SUPPORT_SURFACE_PLUS_MOUNTING_GUIDANCE':
    case'HISTORICAL_RECOMMENDATION':
    case'FLOOR_STANDING_PROFILE':return'MOUNTING_GUIDANCE';
    case'RELATIVE_TO_REVIEW_PLANE':return'RELATIVE_ONLY';
    default:return'UNRESOLVED';
  }
}
function baseSteps(entity:PlacementEntity,placement:AssetPlacement,kind:ZSolutionCandidateKind):ZSolutionStep[]{
  const meta=entity.meta||{},steps:ZSolutionStep[]=[];
  const local=finite(meta.localReviewSurfaceZ),cross=finite(meta.crossSheetReviewSurfaceZ);
  const floor=finite(meta.floorDatumMeters??meta.floorElevationMeters??meta.finishedFloorElevationMeters??meta.reviewSurfaceZ);
  if(local!==null)steps.push({kind:'SUPPORT_SURFACE',label:String(meta.localReviewSurfaceKind||'LOCAL REVIEW SURFACE'),valueMeters:local,authority:String(meta.localReviewSurfaceAuthority||'SOURCE_ELEVATION_TRIANGLE'),confidence:confidence(meta.localReviewSurfaceConfidence,.6)});
  else if(cross!==null)steps.push({kind:'SUPPORT_SURFACE',label:String(meta.crossSheetReviewSurfaceKind||'CROSS SHEET SURFACE'),valueMeters:cross,authority:String(meta.crossSheetReviewSurfaceAuthority||'HUMAN_CONFIRMED_ALIGNMENT_PLUS_SOURCE_ELEVATION_TRIANGLE'),confidence:confidence(meta.crossSheetReviewSurfaceConfidence,.6)});
  else if(floor!==null)steps.push({kind:'SUPPORT_SURFACE',label:String(meta.reviewSurfaceKind||'PROJECT DATUM'),valueMeters:floor,authority:String(meta.reviewSurfaceAuthority||'SOURCE_PROJECT_DATUM'),confidence:confidence(meta.reviewSurfaceConfidence,.65)});

  const support=finite(meta.supportBaseOffsetMeters);
  if(support!==null)steps.push({kind:'SUPPORT_OFFSET',label:String(meta.supportOffsetKind||'SUPPORT BASE OFFSET'),valueMeters:support,authority:String(meta.supportOffsetAuthority||'SOURCE_SUPPORT_OFFSET'),confidence:confidence(meta.supportOffsetConfidence,.7),evidence:[String(meta.supportOffsetEvidenceLabel||'')].filter(Boolean)});

  const reference=finite(meta.zCandidateMeters);
  if(reference!==null&&kind==='SOURCE_REFERENCE')steps.push({kind:'SOURCE_Z_REFERENCE',label:String(meta.zCandidateReferencePoint||meta.sourceZReferencePoint||'SOURCE_ORIGIN'),valueMeters:reference,authority:String(meta.zResolutionAuthority||meta.zPlacementAuthority||'SOURCE_Z_EVIDENCE'),confidence:confidence(meta.zResolutionConfidence,.75)});

  if(placement.referenceZ!==undefined)steps.push({kind:'REFERENCE_TO_BASE',label:String(placement.referencePoint||'SOURCE REFERENCE'),valueMeters:placement.baseZ,authority:'EQUIPMENT_GEOMETRY_REFERENCE_CONVERSION',confidence:placement.dimensions.confidence,evidence:[placement.dimensions.source]});

  steps.push({kind:'MODEL_BASE',label:'MODEL BASE Z',valueMeters:placement.baseZ,authority:String(placement.zAuthority),confidence:placement.zConfidence});
  steps.push({kind:'MODEL_TOP',label:'MODEL TOP Z',valueMeters:placement.topZ,authority:'MODEL_BASE_PLUS_EQUIPMENT_HEIGHT',confidence:Math.min(placement.zConfidence,placement.dimensions.confidence),evidence:[placement.dimensions.source]});
  return steps;
}
function candidateFromPlacement(id:string,entity:PlacementEntity,placement:AssetPlacement):ZSolutionCandidate{
  const kind=classifyPlacement(placement),absolute=absoluteAuthority(String(placement.zAuthority));
  return{
    id,kind,
    baseZ:absolute||kind==='MOUNTING_GUIDANCE'||kind==='RELATIVE_ONLY'?placement.baseZ:null,
    topZ:absolute||kind==='MOUNTING_GUIDANCE'||kind==='RELATIVE_ONLY'?placement.topZ:null,
    confidence:placement.zConfidence,
    authority:placement.zAuthority,
    absolute,
    steps:baseSteps(entity,placement,kind),
    note:placement.recommendation?.note||(
      absolute?'Source-derived absolute design candidate.':'No absolute source-grounded project Z is established.'
    )
  };
}
function uniqueCandidates(candidates:ZSolutionCandidate[]){
  const out:ZSolutionCandidate[]=[];
  for(const candidate of candidates){
    const duplicate=out.some(existing=>
      existing.kind===candidate.kind&&
      existing.baseZ!==null&&candidate.baseZ!==null&&Math.abs(existing.baseZ-candidate.baseZ)<1e-6&&
      existing.authority===candidate.authority
    );
    if(!duplicate)out.push(candidate);
  }
  return out;
}
function priority(candidate:ZSolutionCandidate){
  switch(candidate.kind){
    case'REVIEWED_OR_MEASURED':return 100;
    case'SOURCE_REFERENCE':return 90;
    case'SUPPORT_SURFACE_PLUS_OFFSET':return 80;
    case'SUPPORT_SURFACE_BASE':return 70;
    case'MOUNTING_GUIDANCE':return 40;
    case'RELATIVE_ONLY':return 20;
    default:return 0;
  }
}

export function buildZSolution(entity:PlacementEntity,options?:{toleranceMeters?:number;registry?:ElectricalModelConfig|null}):ZSolution{
  const tolerance=Math.max(.01,Number(options?.toleranceMeters??.15));
  const registry=options?.registry||null;
  const meta=entity.meta||{};
  const candidates:ZSolutionCandidate[]=[];
  // Human-applied inferred previews are rendering state, not an evidence chain.
  // Strip them while reconciling source/support evidence so a preview can never
  // hide a newly discovered conflict or become self-corroborating evidence.
  const evidenceEntity=entityWithMeta(entity,omitMeta(meta,WITHOUT_REVIEW_PREVIEW));
  const evidenceMeta=evidenceEntity.meta||{};

  const primary=resolveAssetPlacement(evidenceEntity,registry);
  candidates.push(candidateFromPlacement('primary',evidenceEntity,primary));

  const supportOnlyEntity=entityWithMeta(evidenceEntity,omitMeta(evidenceMeta,WITHOUT_SOURCE_REFERENCE));
  const supportPlacement=resolveAssetPlacement(supportOnlyEntity,registry);
  candidates.push(candidateFromPlacement('support-chain',supportOnlyEntity,supportPlacement));

  const sourceOnlyEntity=entityWithMeta(evidenceEntity,omitMeta(evidenceMeta,WITHOUT_SUPPORT));
  const sourcePlacement=resolveAssetPlacement(sourceOnlyEntity,registry);
  candidates.push(candidateFromPlacement('source-reference-chain',sourceOnlyEntity,sourcePlacement));

  const all=uniqueCandidates(candidates);
  const absolute=all.filter(c=>c.absolute&&c.baseZ!==null&&c.confidence>=.55);
  const conflicts:ZSolutionConflict[]=[];
  for(let i=0;i<absolute.length;i++)for(let j=i+1;j<absolute.length;j++){
    const a=absolute[i],b=absolute[j];
    const delta=Math.abs(Number(a.baseZ)-Number(b.baseZ));
    if(delta>tolerance){
      conflicts.push({
        candidateA:a.id,candidateB:b.id,deltaMeters:delta,toleranceMeters:tolerance,
        reason:`Independent absolute-Z chains disagree by ${delta.toFixed(3)} m (> ${tolerance.toFixed(3)} m review threshold).`
      });
    }
  }

  const ranked=[...all].sort((a,b)=>priority(b)-priority(a)||b.confidence-a.confidence);
  const chosen=ranked.find(c=>c.baseZ!==null&&c.kind!=='UNRESOLVED')||null;

  if(conflicts.length){
    return{
      status:'CONFLICT',chosenCandidateId:null,baseZ:null,topZ:null,confidence:0,
      candidates:all,conflicts,toleranceMeters:tolerance,physicalTruth:false,reviewRequired:true,
      explanation:'Multiple defensible Z chains disagree beyond the review threshold. STRATUM preserves each chain and refuses to select a final design base Z until reviewed.'
    };
  }

  if(chosen&&chosen.absolute){
    return{
      status:'RESOLVED_CANDIDATE',chosenCandidateId:chosen.id,baseZ:chosen.baseZ,topZ:chosen.topZ,confidence:chosen.confidence,
      candidates:all,conflicts:[],toleranceMeters:tolerance,physicalTruth:false,reviewRequired:true,
      explanation:`Selected ${chosen.kind.replaceAll('_',' ').toLowerCase()} because all available absolute-Z chains are mutually consistent within the review threshold.`
    };
  }
  if(chosen){
    return{
      status:'RELATIVE_ONLY',chosenCandidateId:chosen.id,baseZ:chosen.baseZ,topZ:chosen.topZ,confidence:chosen.confidence,
      candidates:all,conflicts:[],toleranceMeters:tolerance,physicalTruth:false,reviewRequired:true,
      explanation:'Only relative/review-plane placement is available; no source-grounded absolute project Z is established.'
    };
  }
  return{
    status:'UNRESOLVED',chosenCandidateId:null,baseZ:null,topZ:null,confidence:0,
    candidates:all,conflicts:[],toleranceMeters:tolerance,physicalTruth:false,reviewRequired:true,
    explanation:'No defensible source-grounded Z chain is available.'
  };
}


function reviewAnchorZ(entity:PlacementEntity){
  const meta=entity.meta||{};
  for(const key of ['localReviewSurfaceZ','crossSheetReviewSurfaceZ','floorDatumMeters','floorElevationMeters','finishedFloorElevationMeters','reviewSurfaceZ']){
    const value=finite(meta[key]);if(value!==null)return value;
  }
  return 0;
}

export function resolveReconciledAssetPlacement(
  entity:PlacementEntity,
  options?:{toleranceMeters?:number;registry?:ElectricalModelConfig|null}
):{placement:AssetPlacement;solution:ZSolution}{
  const solution=buildZSolution(entity,options);
  const primary=resolveAssetPlacement(entity,options?.registry||null);
  if(solution.status==='CONFLICT'){
    const base=reviewAnchorZ(entity);
    return{
      solution,
      placement:{
        ...primary,
        baseZ:base,
        topZ:base+primary.dimensions.height,
        zAuthority:'UNRESOLVED',
        zConfidence:0,
        referenceZ:undefined,
        referencePoint:undefined,
        recommendation:{
          kind:'Z_CONFLICT_REVIEW_SURFACE',
          valueMeters:base,
          source:'STRATUM Z reconciliation',
          evidenceClass:'VISUALIZATION_HEURISTIC',
          note:'Conflicting absolute-Z evidence chains are present. Equipment is rendered on the underlying review surface only; neither disputed equipment base is selected.'
        },
        physicalTruth:false
      }
    };
  }
  let resolvedPlacement=primary;
  if(primary.zAuthority==='H2_ACCEPTED_INFERRED_PREVIEW'){
    const chosen=solution.candidates.find(candidate=>candidate.id===solution.chosenCandidateId)||null;
    const strongSource=Boolean(chosen&&['REVIEWED_OR_MEASURED','SOURCE_REFERENCE','SUPPORT_SURFACE_PLUS_OFFSET'].includes(chosen.kind));
    // H2 preview may replace a generic support-surface/type-profile display,
    // but it can never outrank measured/reviewed Z, an explicit source Z
    // reference, a source support-base offset, or a reconciled conflict.
    if(!strongSource)return{solution,placement:primary};
    // When stronger source evidence wins, strip preview metadata before
    // constructing the returned placement so its authority/recommendation do
    // not falsely continue to describe the displaced H2 preview.
    resolvedPlacement=resolveAssetPlacement(entityWithMeta(entity,omitMeta(entity.meta||{},WITHOUT_REVIEW_PREVIEW)),options?.registry||null);
  }
  if(solution.chosenCandidateId&&solution.baseZ!==null){
    return{
      solution,
      placement:{
        ...resolvedPlacement,
        baseZ:solution.baseZ,
        topZ:solution.topZ??solution.baseZ+resolvedPlacement.dimensions.height,
        zConfidence:solution.confidence,
        physicalTruth:false
      }
    };
  }
  return{solution,placement:primary};
}
