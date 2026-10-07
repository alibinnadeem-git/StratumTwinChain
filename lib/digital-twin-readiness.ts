import {deriveSpatialEvidenceEnvelope,type SpatialEvidenceEntity} from './spatial-evidence-envelope.ts';
import {resolveSpatialModel,type SpatialModelResolution} from './spatial-model-resolution.ts';
import {resolveRegisteredSpatialAsset,spatialAssetDirState,type RegisteredSpatialAsset,type SpatialAssetBinding} from './spatial-asset-link.ts';
import {isIdentifiedProjectEquipment} from './spatial-ui-counts.ts';
import type {ElectricalModelConfig} from './electrical-model-registry.ts';
import {resolveReconciledAssetPlacement} from './z-solution-chain.ts';

export type DigitalTwinReadinessEntity=SpatialEvidenceEntity&{
  layer?:string;
  kind?:string;
  floor?:string;
  confidence?:number;
};

export type DigitalTwinComponentState=
  |'EXACT_TWIN_READY'
  |'FAMILY_TWIN_READY'
  |'SPATIAL_3D_REVIEW_READY'
  |'SPATIAL_2D_REVIEW_READY'
  |'REVIEW_BLOCKED'
  |'SOURCE_ONLY';

export type DigitalTwinBlockerCode=
  |'XY_NOT_METRIC'
  |'XY_CONFLICT'
  |'Z_UNRESOLVED'
  |'Z_CONFLICT'
  |'VERTICAL_FRAME_GAP'
  |'GEOMETRY_UNRESOLVED'
  |'PROCEDURAL_GEOMETRY_ONLY'
  |'RENDER_Z_UNRESOLVED'
  |'Z_RENDER_DIVERGENCE'
  |'ASSET_NOT_BOUND';

export type DigitalTwinWarningCode=
  |'PRODUCT_IDENTITY_NOT_EXACT'
  |'DIR_NOT_FINALIZED'
  |'MAINTENANCE_NOT_CONFIGURED'
  |'PHYSICAL_IDENTITY_NOT_VERIFIED'
  |'PHYSICAL_POSITION_NOT_VERIFIED';

export type DigitalTwinComponentReadiness={
  entityId:string;
  name:string;
  state:DigitalTwinComponentState;
  demoReady:boolean;
  exactProductTwin:boolean;
  evidence:ReturnType<typeof deriveSpatialEvidenceEnvelope>;
  model:SpatialModelResolution;
  assetBinding:SpatialAssetBinding|null;
  assetCode:string|null;
  lifecycleStatus:string|null;
  dirFinalized:boolean;
  dirBlockHeight:string|null;
  maintenanceConfigured:boolean;
  maintenanceStatus:string|null;
  renderZSolutionStatus:string;
  renderBaseZMeters:number|null;
  zAgreementDeltaMeters:number|null;
  blockerCodes:DigitalTwinBlockerCode[];
  warningCodes:DigitalTwinWarningCode[];
  blockerLabels:string[];
  warningLabels:string[];
  physicalTruth:false;
  asBuiltAuthority:false;
};

export type DigitalTwinProjectReadiness={
  totalEquipment:number;
  exactTwinReady:number;
  familyTwinReady:number;
  spatial3DReviewReady:number;
  spatial2DReviewReady:number;
  reviewBlocked:number;
  sourceOnly:number;
  demoReady:number;
  assetBound:number;
  dirFinalized:number;
  maintenanceConfigured:number;
  physicalTruth:false;
  asBuiltAuthority:false;
  components:DigitalTwinComponentReadiness[];
  blockerCounts:Record<string,number>;
  warningCounts:Record<string,number>;
};

const BLOCKER_LABELS:Record<DigitalTwinBlockerCode,string>={
  XY_NOT_METRIC:'Metric X/Y frame is not established.',
  XY_CONFLICT:'Horizontal placement evidence is conflicting or ambiguous.',
  Z_UNRESOLVED:'Base/equipment Z is not resolved for 3D review.',
  Z_CONFLICT:'Z evidence contains an unresolved conflict.',
  VERTICAL_FRAME_GAP:'Vertical coordinate frames still require registration.',
  GEOMETRY_UNRESOLVED:'No source-grounded component geometry is resolved.',
  PROCEDURAL_GEOMETRY_ONLY:'Only procedural review-envelope geometry is available.',
  RENDER_Z_UNRESOLVED:'The viewer placement solver cannot reproduce a resolved absolute base Z from the current source evidence.',
  Z_RENDER_DIVERGENCE:'The constraint-graph base Z and rendered placement base Z disagree beyond the review tolerance.',
  ASSET_NOT_BOUND:'No unique registered STRATUM asset is bound to this source component.'
};

const WARNING_LABELS:Record<DigitalTwinWarningCode,string>={
  PRODUCT_IDENTITY_NOT_EXACT:'Exact manufacturer/model product identity is not established; family geometry may be in use.',
  DIR_NOT_FINALIZED:'The linked asset DIR/ledger record is not finalized.',
  MAINTENANCE_NOT_CONFIGURED:'No maintenance plan/status is configured on the linked asset.',
  PHYSICAL_IDENTITY_NOT_VERIFIED:'Catalog/source identity has not been independently verified as the installed physical unit.',
  PHYSICAL_POSITION_NOT_VERIFIED:'Design/review coordinates are not independently field/as-built verified.'
};

function addUnique<T extends string>(items:T[],value:T){if(!items.includes(value))items.push(value)}

function maintenanceConfigured(asset:RegisteredSpatialAsset|null){
  if(!asset)return false;
  return Boolean(
    asset.maintenance_plan_id||
    asset.maintenance_status||
    asset.maintenance_interval_days||
    asset.maintenance_interval_hours||
    asset.maintenance_task_summary||
    (Array.isArray(asset.maintenance_condition_triggers)&&asset.maintenance_condition_triggers.length)||
    (Array.isArray(asset.maintenance_source_refs)&&asset.maintenance_source_refs.length)
  );
}

export function deriveDigitalTwinComponentReadiness(
  entity:DigitalTwinReadinessEntity,
  assets:RegisteredSpatialAsset[],
  registry:ElectricalModelConfig[]
):DigitalTwinComponentReadiness{
  const model=resolveSpatialModel(entity,registry);
  const evidence=deriveSpatialEvidenceEnvelope(entity,model);
  const rendered=resolveReconciledAssetPlacement(entity,{registry:model.model});
  const renderSolution=rendered.solution;
  const renderResolved=(renderSolution.status==='RESOLVED_CANDIDATE'||renderSolution.status==='REVIEW_RESOLVED_CANDIDATE')&&renderSolution.baseZ!==null;
  const graphBase=evidence.vertical.baseCandidateMeters;
  const renderBase=renderResolved?renderSolution.baseZ:null;
  const graphToleranceRaw=Number((entity.meta?.zConstraintGraph as Record<string,unknown>|undefined)?.toleranceMeters??.15);
  const graphTolerance=Number.isFinite(graphToleranceRaw)&&graphToleranceRaw>0?graphToleranceRaw:.15;
  const zAgreementDelta=graphBase!==null&&renderBase!==null?Math.abs(graphBase-renderBase):null;
  const assetBinding=resolveRegisteredSpatialAsset({id:entity.id,name:entity.name,layer:String(entity.layer||'L2'),meta:entity.meta},assets);
  const asset=assetBinding?.asset||null;
  const dir=spatialAssetDirState(assetBinding);
  const maintenance=maintenanceConfigured(asset);
  const blockers:DigitalTwinBlockerCode[]=[];
  const warnings:DigitalTwinWarningCode[]=[];

  if(!evidence.horizontal.metricCoordinateKnown)addUnique(blockers,'XY_NOT_METRIC');
  if(evidence.horizontal.state==='CONFLICT')addUnique(blockers,'XY_CONFLICT');
  if(evidence.vertical.state==='CONFLICT')addUnique(blockers,'Z_CONFLICT');
  else if(evidence.vertical.state!=='RESOLVED_CANDIDATE')addUnique(blockers,'Z_UNRESOLVED');
  if(evidence.vertical.frameGapCount>0)addUnique(blockers,'VERTICAL_FRAME_GAP');
  if(evidence.vertical.state==='RESOLVED_CANDIDATE'&&!renderResolved)addUnique(blockers,'RENDER_Z_UNRESOLVED');
  if(zAgreementDelta!==null&&zAgreementDelta>graphTolerance)addUnique(blockers,'Z_RENDER_DIVERGENCE');
  if(model.tier==='UNRESOLVED')addUnique(blockers,'GEOMETRY_UNRESOLVED');
  if(model.tier==='PROCEDURAL_FALLBACK')addUnique(blockers,'PROCEDURAL_GEOMETRY_ONLY');
  if(!assetBinding)addUnique(blockers,'ASSET_NOT_BOUND');

  if(!model.exactProductIdentity)addUnique(warnings,'PRODUCT_IDENTITY_NOT_EXACT');
  if(assetBinding&&!dir.finalized)addUnique(warnings,'DIR_NOT_FINALIZED');
  if(assetBinding&&!maintenance)addUnique(warnings,'MAINTENANCE_NOT_CONFIGURED');
  addUnique(warnings,'PHYSICAL_IDENTITY_NOT_VERIFIED');
  addUnique(warnings,'PHYSICAL_POSITION_NOT_VERIFIED');

  const usable3D=evidence.readiness==='DESIGN_3D_COORDINATION_CANDIDATE'&&
    ['EXACT_VERIFIED_OEM_CAD','EXACT_PRODUCT_VISUALIZATION','FAMILY_MODEL'].includes(model.tier);
  const assetConnected=Boolean(assetBinding);
  const demoReady=usable3D&&renderResolved&&assetConnected&&!blockers.some(code=>
    ['XY_NOT_METRIC','XY_CONFLICT','Z_UNRESOLVED','Z_CONFLICT','VERTICAL_FRAME_GAP','GEOMETRY_UNRESOLVED','PROCEDURAL_GEOMETRY_ONLY','RENDER_Z_UNRESOLVED','Z_RENDER_DIVERGENCE','ASSET_NOT_BOUND'].includes(code)
  );

  let state:DigitalTwinComponentState='SOURCE_ONLY';
  if(evidence.readiness==='REVIEW_BLOCKED'||blockers.includes('XY_CONFLICT')||blockers.includes('Z_CONFLICT')||blockers.includes('VERTICAL_FRAME_GAP')||blockers.includes('Z_RENDER_DIVERGENCE')){
    state='REVIEW_BLOCKED';
  }else if(demoReady&&model.exactProductIdentity&&['EXACT_VERIFIED_OEM_CAD','EXACT_PRODUCT_VISUALIZATION'].includes(model.tier)){
    state='EXACT_TWIN_READY';
  }else if(demoReady&&model.tier==='FAMILY_MODEL'){
    state='FAMILY_TWIN_READY';
  }else if(usable3D){
    state='SPATIAL_3D_REVIEW_READY';
  }else if(evidence.horizontal.metricCoordinateKnown&&evidence.horizontal.state!=='CONFLICT'){
    state='SPATIAL_2D_REVIEW_READY';
  }

  return{
    entityId:entity.id,
    name:entity.name,
    state,
    demoReady,
    exactProductTwin:state==='EXACT_TWIN_READY',
    evidence,
    model,
    assetBinding,
    assetCode:asset?.asset_code||null,
    lifecycleStatus:asset?.status||null,
    dirFinalized:dir.finalized,
    dirBlockHeight:dir.blockHeight,
    maintenanceConfigured:maintenance,
    maintenanceStatus:asset?.maintenance_status||null,
    renderZSolutionStatus:renderSolution.status,
    renderBaseZMeters:renderBase,
    zAgreementDeltaMeters:zAgreementDelta,
    blockerCodes:blockers,
    warningCodes:warnings,
    blockerLabels:blockers.map(code=>BLOCKER_LABELS[code]),
    warningLabels:warnings.map(code=>WARNING_LABELS[code]),
    physicalTruth:false,
    asBuiltAuthority:false
  };
}

export function deriveDigitalTwinProjectReadiness(
  entities:DigitalTwinReadinessEntity[],
  assets:RegisteredSpatialAsset[],
  registry:ElectricalModelConfig[]
):DigitalTwinProjectReadiness{
  const ids=new Set(entities.map(entity=>entity.id));
  const equipment=entities.filter(entity=>{
    if(!isIdentifiedProjectEquipment(entity))return false;
    const derivedFrom=String(entity.meta?.derivedFrom||'').trim();
    if(entity.layer==='L4'&&derivedFrom&&ids.has(derivedFrom))return false;
    return true;
  });
  const components=equipment.map(entity=>deriveDigitalTwinComponentReadiness(entity,assets,registry));
  const blockerCounts:Record<string,number>={},warningCounts:Record<string,number>={};
  for(const component of components){
    for(const code of component.blockerCodes)blockerCounts[code]=(blockerCounts[code]||0)+1;
    for(const code of component.warningCodes)warningCounts[code]=(warningCounts[code]||0)+1;
  }
  const count=(state:DigitalTwinComponentState)=>components.filter(component=>component.state===state).length;
  return{
    totalEquipment:components.length,
    exactTwinReady:count('EXACT_TWIN_READY'),
    familyTwinReady:count('FAMILY_TWIN_READY'),
    spatial3DReviewReady:count('SPATIAL_3D_REVIEW_READY'),
    spatial2DReviewReady:count('SPATIAL_2D_REVIEW_READY'),
    reviewBlocked:count('REVIEW_BLOCKED'),
    sourceOnly:count('SOURCE_ONLY'),
    demoReady:components.filter(component=>component.demoReady).length,
    assetBound:components.filter(component=>component.assetBinding).length,
    dirFinalized:components.filter(component=>component.dirFinalized).length,
    maintenanceConfigured:components.filter(component=>component.maintenanceConfigured).length,
    physicalTruth:false,
    asBuiltAuthority:false,
    components,
    blockerCounts,
    warningCounts
  };
}
