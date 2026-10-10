import {findSpatialTaxonomyEntry} from './spatial-component-taxonomy.ts';

/** A10 intake packet validation; never imports or activates untrusted geometry. */
export type IntakeLicenceTier='T1'|'T2'|'T3';
export type IntakeLicenceBasis='CC0'|'INHOUSE'|'OEM_WRITTEN_PERMISSION'|'LINK_OUT';
export type IntakeNormalization={units:'m';upAxis:'Y';frontAxis:'+Z';origin:'HOST_CONTACT'};
export type ModelIntakeCandidate={
 typeId:string;
 licenceTier:IntakeLicenceTier;
 licenceBasis:IntakeLicenceBasis;
 licenceEvidenceRef:string|null;
 permissionRef?:string|null;
 glbUri:string|null;
 glbSha256:string|null;
 binaryInspectionRef:string|null;
 normalization:IntakeNormalization|null;
 normalizationEvidenceRef:string|null;
 anchors:string[];
 anchorEvidenceRef:string|null;
 triangles:number|null;
 compression:'meshopt'|'draco'|null;
 optimizationEvidenceRef:string|null;
 validatorErrors:number|null;
 validatorReportRef:string|null;
 registry:{
  typeId:string; ifcClass:string; source:string; licenceTier:IntakeLicenceTier;
  permissionRef?:string|null; sha256:string; dimensionsMeters:[number,number,number];
  scaleRule:'FIXED'|'UNIFORM'|'PER_AXIS';
 }|null;
};
export type IntakeCheckId='LICENCE'|'GLB'|'NORMALIZATION'|'ANCHORS'|'OPTIMIZATION'|'VALIDATION'|'REGISTRY';
export type IntakeCheck={id:IntakeCheckId;passed:boolean;reason:string};
export type IntakeEvaluation={
 typeId:string;
 checks:IntakeCheck[];
 metadataReady:boolean;
 /** Metadata checks are not proof that the referenced binary or external reports are valid. */
 requiresIndependentBinaryAudit:true;
 /** Deliberately never permits direct mutation of the current runtime model registry. */
 registryWriteAuthorized:false;
 blockers:string[];
};
const present=(value:string|null|undefined)=>typeof value==='string'&&value.trim().length>0;
const digest=(value:string|null|undefined)=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value);
const finitePositive=(value:number)=>Number.isFinite(value)&&value>0;

export function evaluateComponentIntake(candidate:ModelIntakeCandidate):IntakeEvaluation{
 const row=findSpatialTaxonomyEntry(candidate.typeId);
 const checks:IntakeCheck[]=[];
 const add=(id:IntakeCheckId,passed:boolean,reason:string)=>checks.push({id,passed,reason:passed?'Evidence reference provided; independently verify underlying artefact.':reason});
 const licenceAllowed=(candidate.licenceTier==='T1'&&['CC0','INHOUSE'].includes(candidate.licenceBasis))||
  (candidate.licenceTier==='T2'&&candidate.licenceBasis==='OEM_WRITTEN_PERMISSION'&&present(candidate.permissionRef));
 add('LICENCE',licenceAllowed&&present(candidate.licenceEvidenceRef),
  'Only CC0/in-house or OEM with documented written permission is eligible; link-out/CC-BY remains blocked.');
 add('GLB',Boolean(candidate.glbUri&&/\\.glb(?:[?#]|$)/i.test(candidate.glbUri)&&digest(candidate.glbSha256)&&present(candidate.binaryInspectionRef)),
  'Verified GLB URL, SHA-256 and binary inspection evidence are required.');
 add('NORMALIZATION',Boolean(candidate.normalization&&candidate.normalization.units==='m'&&candidate.normalization.upAxis==='Y'&&candidate.normalization.frontAxis==='+Z'&&candidate.normalization.origin==='HOST_CONTACT'&&present(candidate.normalizationEvidenceRef)),
  'GLB requires metre units, Y-up, +Z front, a host-contact origin and a normalization report.');
 add('ANCHORS',Array.isArray(candidate.anchors)&&candidate.anchors.some(anchor=>/^mount_(?:face|floor|ceiling|wall)$/.test(anchor))&&present(candidate.anchorEvidenceRef),
  'A named host-contact mount anchor and evidence report are required.');
 const small=Boolean(row&&/(?:receptacle|detector|sensor|outlet|pushbutton|pull station|light switch|dimmer|card reader|photocell)/i.test(row.name));
 const maxTriangles=small?5000:50000;
 add('OPTIMIZATION',candidate.triangles!==null&&Number.isInteger(candidate.triangles)&&candidate.triangles>0&&candidate.triangles<=maxTriangles&&
  ['meshopt','draco'].includes(String(candidate.compression))&&present(candidate.optimizationEvidenceRef),
  `Requires <=${maxTriangles} triangles, meshopt/Draco compression and an optimization report.`);
 add('VALIDATION',candidate.validatorErrors===0&&present(candidate.validatorReportRef),
  'A Khronos glTF-Validator report with zero errors is required.');
 const registry=candidate.registry;
 add('REGISTRY',Boolean(row&&registry&&registry.typeId===candidate.typeId&&registry.ifcClass===row.ifcCandidate&&
  registry.licenceTier===candidate.licenceTier&&present(registry.source)&&digest(registry.sha256)&&
  registry.sha256.toLowerCase()===String(candidate.glbSha256).toLowerCase()&&
  (candidate.licenceTier!=='T2'||registry.permissionRef===candidate.permissionRef)&&
  registry.dimensionsMeters.length===3&&registry.dimensionsMeters.every(finitePositive)&&
  ['FIXED','UNIFORM','PER_AXIS'].includes(registry.scaleRule)),
  'Registry requires a recognized taxonomy class, SHA, dimensions, source, licence tier, and scale rule.');
 const blockers=checks.filter(check=>!check.passed).map(check=>`${check.id}: ${check.reason}`);
 return{typeId:candidate.typeId,checks,metadataReady:blockers.length===0,
  requiresIndependentBinaryAudit:true,registryWriteAuthorized:false,blockers};
}
