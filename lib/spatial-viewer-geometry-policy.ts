import type {ElectricalModelConfig} from './electrical-model-registry.ts';
import {resolveSpatialModel,type SpatialModelEntity} from './spatial-model-resolution.ts';

export type SourceModelVisualTier='RESOLVED_UNVERIFIED'|'FALLBACK_UNVERIFIED'|'UNRESOLVED_CLASS_PREVIEW'|'UNRESOLVED_NO_MODEL';
export type SourceModelVisual={
 tier:SourceModelVisualTier;
 model:ElectricalModelConfig|null;
 componentKey:string|null;
 label:string;
 physicalTruth:false;
 reviewRequired:true;
 takeoffEligible:false;
 measurementEligible:false;
 exportEligible:false;
 reason:string;
};
const toNum=(x:unknown)=>typeof x==='number'&&Number.isFinite(x)?x:null;
const toStr=(x:unknown)=>typeof x==='string'?x.trim():'';
const independent=(x:unknown)=>Array.isArray(x)?new Set(x.filter(v=>typeof v==='string').map(v=>v.trim()).filter(Boolean)).size:0;
const permittedGeneric=(m:ElectricalModelConfig|null)=>Boolean(m&&
 (m.format==='GLB'||m.format==='GLTF')&&m.modelUrl.startsWith('/models/equipment/')&&
 (m.modelUrl.endsWith('.glb')||m.modelUrl.endsWith('.gltf'))&&
 /^(STRATUM-authored geometry|CC0)/i.test(m.license||'')&&
 m.geometryStatus==='DIMENSIONAL_VISUALIZATION');
const blank=(key:string|null,why:string):SourceModelVisual=>({
 tier:'UNRESOLVED_NO_MODEL',model:null,componentKey:key,label:'UNVERIFIED · NO APPROVED MODEL',
 physicalTruth:false,reviewRequired:true,takeoffEligible:false,measurementEligible:false,exportEligible:false,
 reason:why
});
export function decideSourceModelVisual(entity:SpatialModelEntity,registry:ElectricalModelConfig[]):SourceModelVisual{
 const meta=entity.meta||{},resolved=resolveSpatialModel(entity,registry);
 const explicitKey=toStr(meta.componentKey)||toStr(meta.electricalComponentKey)||toStr(meta.componentLibraryKey);
 const classKey=explicitKey||resolved.componentKey;
 const generic=classKey?registry.find(m=>m.componentKey===classKey&&permittedGeneric(m))||null:null;
 const classEvidence=Boolean(explicitKey||resolved.componentKey);
 if(!classEvidence||!generic)return blank(classKey||null,'No licensed in-house/CC0 model for a defensible exact component class; preserve ghost/sheet pin.');
 const score=toNum(meta.resolutionScore),margin=toNum(meta.resolutionMargin);
 const witnesses=independent(meta.resolutionEvidenceKinds);
 const thresholds=score!==null&&score>=.85&&margin!==null&&margin>=.15&&witnesses>=2;
 const recorded=toStr(meta.resolution_state)||toStr(meta.resolutionState);
 const intakeApproved=meta.intakeGateStatus==='PASSED'&&
  meta.intakeGateBinaryVerified===true&&
  meta.intakeTypeId===classKey&&
  (meta.intakeLicenceTier==='T1'||(meta.intakeLicenceTier==='T2'&&toStr(meta.intakeWrittenPermissionRef)!==''));
 // No user-supplied product/OEM model may supersede this candidate unless its
 // independent licence & geometry provenance is verified. Here only T1
 // in-house library review geometry can be shown.
 const base={model:generic,componentKey:classKey,physicalTruth:false as const,reviewRequired:true as const,
  takeoffEligible:false as const,measurementEligible:false as const,exportEligible:false as const};
 if(thresholds&&intakeApproved&&recorded==='RESOLVED')
  return {...base,tier:'RESOLVED_UNVERIFIED',label:'UNVERIFIED · RESOLVED LIBRARY MODEL',
    reason:'Resolution thresholds and exact-class model Intake Gate passed; human verification is still required.'};
 if(thresholds&&intakeApproved&&recorded==='FALLBACK')
  return {...base,tier:'FALLBACK_UNVERIFIED',label:'FALLBACK · UNVERIFIED · GENERIC CLASS MODEL',
    reason:'Licensed exact-class generic model approved through the Intake Gate; never an OEM candidate.'};
 return {...base,tier:'UNRESOLVED_CLASS_PREVIEW',label:'UNRESOLVED · GENERIC CLASS PREVIEW · UNVERIFIED',
  reason:'Source class has a STRATUM-authored visual example; resolution thresholds/Intake approval or human review are incomplete. Not a FALLBACK asset binding.'};
}
