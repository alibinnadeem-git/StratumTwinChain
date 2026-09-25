import type {OemCadCandidate} from './oem-cad-candidates.ts';

export type OemCadReadiness={
 stage:OemCadCandidate['status'];
 readyForActivation:boolean;
 blockers:string[];
 evidence:string[];
 nextAction:string;
};

const sha256=/^[a-f0-9]{64}$/i;

export function oemCadReadiness(candidate:OemCadCandidate):OemCadReadiness{
 const blockers:string[]=[];
 const evidence:string[]=[`Exact product: ${candidate.manufacturer} ${candidate.sku}`];

 if(candidate.productUrl)evidence.push('Manufacturer/product source identified');
 if(candidate.cadUrl)evidence.push('CAD download/source URL identified');
 if(candidate.dimensionsMeters?.every(value=>Number.isFinite(value)&&value>0))evidence.push('Physical envelope recorded');
 if(candidate.sourceSha256&&sha256.test(candidate.sourceSha256))evidence.push('Source CAD SHA-256 verified');
 if(candidate.modelSha256&&sha256.test(candidate.modelSha256))evidence.push('Converted model SHA-256 verified');
 if(candidate.reuseTerms?.trim())evidence.push('Reuse terms recorded');

 if(candidate.status==='SOURCE_IDENTIFIED'){
  blockers.push('Exact downloadable CAD file has not been identified.');
 }
 if(candidate.status==='CAD_DOWNLOAD_IDENTIFIED'){
  blockers.push('Downloaded source CAD file has not been hash-verified.');
 }
 if(candidate.status==='FILE_VERIFIED'&&!candidate.sourceSha256){
  blockers.push('FILE_VERIFIED requires a source CAD SHA-256.');
 }
 if(candidate.status!=='GLB_APPROVED'){
  blockers.push('Controlled browser GLB has not been approved.');
 }
 if(!candidate.reuseTerms?.trim()){
  blockers.push('Reuse/redistribution terms have not been recorded.');
 }
 if(candidate.status==='GLB_APPROVED'){
  if(!candidate.sourceSha256||!sha256.test(candidate.sourceSha256))blockers.push('Approved OEM geometry requires a verified source CAD SHA-256.');
  if(!candidate.modelSha256||!sha256.test(candidate.modelSha256))blockers.push('Approved OEM geometry requires a verified converted-model SHA-256.');
  if(!candidate.modelUrl?.startsWith('/models/oem/'))blockers.push('Approved OEM geometry must use the controlled /models/oem/ path.');
  if(!candidate.verifiedAt)blockers.push('Approved OEM geometry requires a verification timestamp.');
  if(!candidate.approvedAt)blockers.push('Approved OEM geometry requires an approval timestamp.');
 }

 const readyForActivation=candidate.status==='GLB_APPROVED'&&blockers.length===0;
 let nextAction='Keep as acquisition evidence only.';
 if(candidate.status==='SOURCE_IDENTIFIED')nextAction='Identify the exact manufacturer CAD download and its file format.';
 else if(candidate.status==='CAD_DOWNLOAD_IDENTIFIED')nextAction='Acquire the CAD file, verify exact SKU/revision, hash it, and record reuse terms.';
 else if(candidate.status==='FILE_VERIFIED')nextAction='Convert to meter-space GLB, validate geometry/dimensions, hash the output, and approve activation.';
 else if(readyForActivation)nextAction='Exact OEM geometry is eligible for controlled registry activation.';
 else if(candidate.status==='GLB_APPROVED')nextAction='Resolve approval provenance blockers before activating the model.';

 return{stage:candidate.status,readyForActivation,blockers,evidence,nextAction};
}

export function oemCadStageLabel(status:OemCadCandidate['status']){
 return({
  SOURCE_IDENTIFIED:'SOURCE FOUND',
  CAD_DOWNLOAD_IDENTIFIED:'CAD FOUND',
  FILE_VERIFIED:'FILE VERIFIED',
  GLB_APPROVED:'OEM ACTIVE',
 } as const)[status];
}
