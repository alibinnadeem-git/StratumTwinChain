import {createPublicKey,verify as verifySignature} from 'crypto';
import {canonicalHash,canonicalize} from '@/lib/server/hash';
import {
 commitSchema,
 dirCandidateHeaderSchema,
 poviFinalityCertificateSchema,
 proposalSchema,
 validatorIdentitySchema,
 type PoVIFinalityCertificate,
 type ValidatorIdentity,
} from '../schema/povi';
import {requiredPoviQuorum} from './quorum';

export const VALIDATOR_SET_HASH_DOMAIN='STRATUM/VALIDATOR/SET/1' as const;
export const VALIDATOR_SET_HASH_PROFILE='STRATUM-VALIDATOR-SET-HASH/1' as const;
export const DIR_CANDIDATE_HASH_DOMAIN='STRATUM/DIR/CANDIDATE/1' as const;
export const DIR_CANDIDATE_HASH_PROFILE='STRATUM-DIR-CANDIDATE-HASH/1' as const;
export const POVI_PROPOSAL_DOMAIN='STRATUM/POVI/PROPOSAL/1' as const;
export const POVI_VERIFY_DOMAIN='STRATUM/POVI/VERIFY/1' as const;
export const POVI_COMMIT_DOMAIN='STRATUM/POVI/COMMIT/1' as const;

function canonicalActiveValidators(input:unknown):ValidatorIdentity[]{
 const validators=validatorIdentitySchema.array().min(1).parse(input);
 const ids=new Set<string>();
 for(const validator of validators){
  if(validator.state!=='ACTIVE')throw new Error(`Canonical PoVI validator set may contain ACTIVE validators only: ${validator.validatorId} is ${validator.state}`);
  if(ids.has(validator.validatorId))throw new Error(`Duplicate validatorId in canonical validator set: ${validator.validatorId}`);
  ids.add(validator.validatorId);
 }
 return[...validators].sort((a,b)=>a.validatorId.localeCompare(b.validatorId));
}

export function computeValidatorSetRoot(input:unknown){
 const validators=canonicalActiveValidators(input);
 return canonicalHash({domain:VALIDATOR_SET_HASH_DOMAIN,profile:VALIDATOR_SET_HASH_PROFILE,validators});
}

export function computeDIRCandidateHash(input:unknown){
 const header=dirCandidateHeaderSchema.parse(input);
 return canonicalHash({domain:DIR_CANDIDATE_HASH_DOMAIN,profile:DIR_CANDIDATE_HASH_PROFILE,header});
}

export function verifyProposalIdentity(input:unknown){
 const proposal=proposalSchema.parse(input);
 const computedProposalHash=computeDIRCandidateHash(proposal.DIRCandidateHeader);
 if(proposal.proposalHash!==computedProposalHash)throw new Error(`proposalHash mismatch: computed ${computedProposalHash}`);
 if(proposal.chainId!==proposal.DIRCandidateHeader.chainId||proposal.height!==proposal.DIRCandidateHeader.height||proposal.round!==proposal.DIRCandidateHeader.round)throw new Error('Proposal context does not match its DIR candidate header');
 if(proposal.validatorSetRoot!==proposal.DIRCandidateHeader.validatorSetRoot||proposal.protocolVersion!==proposal.DIRCandidateHeader.protocolVersion||proposal.proposerId!==proposal.DIRCandidateHeader.proposerId)throw new Error('Proposal identity fields do not match its DIR candidate header');
 return{valid:true as const,proposal,computedProposalHash};
}

export function commitPayloadFromPFC(PFC:PoVIFinalityCertificate,validatorId:string){
 return{
  domain:POVI_COMMIT_DOMAIN,
  chainId:PFC.chainId,
  height:PFC.height,
  round:PFC.round,
  step:'COMMIT' as const,
  proposalHash:PFC.DIRHash,
  stateRoot:PFC.stateRoot,
  validatorId,
  validatorSetRoot:PFC.validatorSetRoot,
  protocolVersion:PFC.protocolVersion,
 };
}

export type VerifiedPoVIFinalityCertificate={
 readonly verified:true;
 readonly PFC:PoVIFinalityCertificate;
 readonly validatorSetRoot:string;
 readonly activeValidatorCount:number;
 readonly requiredQuorum:number;
 readonly validSignerIds:readonly string[];
};

export function verifyPoVIFinalityCertificate(args:{PFC:unknown;validators:unknown}):VerifiedPoVIFinalityCertificate{
 const PFC=poviFinalityCertificateSchema.parse(args.PFC);
 const validators=canonicalActiveValidators(args.validators);
 const validatorSetRoot=computeValidatorSetRoot(validators);
 if(PFC.validatorSetRoot!==validatorSetRoot)throw new Error(`PFC validatorSetRoot mismatch: computed ${validatorSetRoot}`);
 if(PFC.signerProof.aggregateProof)throw new Error('PoVI PFC v1 aggregateProof verification is not yet defined; individual COMMIT signatures are required');
 if(PFC.signerProof.signerBitmap)throw new Error('PoVI PFC v1 signerBitmap mapping is not yet defined; explicit signerIds are required');
 const signatures=PFC.signerProof.signatures;
 if(!signatures?.length)throw new Error('PoVI PFC v1 requires individual COMMIT signatures');
 const signerIds=PFC.signerProof.signerIds;
 if(new Set(signerIds).size!==signerIds.length)throw new Error('PFC signerIds contain duplicates');
 const signatureSignerIds=signatures.map(signature=>signature.signerId);
 if(new Set(signatureSignerIds).size!==signatureSignerIds.length)throw new Error('PFC signatures contain duplicate signerIds');
 if(signatures.length!==signerIds.length||[...signerIds].sort().join('\u0000')!==[...signatureSignerIds].sort().join('\u0000'))throw new Error('PFC signerIds must exactly match individual signature signerIds');

 const byId=new Map(validators.map(validator=>[validator.validatorId,validator]));
 const validSignerIds:string[]=[];
 for(const signature of signatures){
  const validator=byId.get(signature.signerId);
  if(!validator)throw new Error(`PFC signer ${signature.signerId} is not in the ACTIVE validator set`);
  if(signature.algorithm!=='Ed25519')throw new Error(`PFC signer ${signature.signerId} must use Ed25519 in PoVI PFC v1`);
  if(signature.domain!==POVI_COMMIT_DOMAIN)throw new Error(`PFC signer ${signature.signerId} has invalid COMMIT signature domain`);
  if(signature.signedAt)throw new Error('PoVI PFC v1 does not accept unsigned signedAt metadata inside COMMIT signature wrappers');
  const payload=commitSchema.parse({...commitPayloadFromPFC(PFC,signature.signerId),signature:{signerId:signature.signerId,signature:'detached'}});
  const {signature:_detached,...message}=payload;
  let publicKey;
  try{publicKey=createPublicKey({key:Buffer.from(validator.consensusPublicKey,'base64'),format:'der',type:'spki'});}catch{throw new Error(`Validator ${validator.validatorId} consensusPublicKey is not valid base64 SPKI DER`);}
  const valid=verifySignature(null,Buffer.from(canonicalize(message),'utf8'),publicKey,Buffer.from(signature.signature,'base64'));
  if(!valid)throw new Error(`Invalid COMMIT signature from ${signature.signerId}`);
  validSignerIds.push(signature.signerId);
 }
 const requiredQuorum=requiredPoviQuorum(validators.length);
 if(validSignerIds.length<requiredQuorum)throw new Error(`PoVI PFC cryptographic quorum not met: ${validSignerIds.length}/${validators.length} valid signatures; ${requiredQuorum} required`);
 return{verified:true,PFC,validatorSetRoot,activeValidatorCount:validators.length,requiredQuorum,validSignerIds:Object.freeze([...validSignerIds].sort())};
}

export function assertPFCBindsDIRCandidate(args:{PFC:unknown;DIRCandidateHeader:unknown}){
 const PFC=poviFinalityCertificateSchema.parse(args.PFC);
 const header=dirCandidateHeaderSchema.parse(args.DIRCandidateHeader);
 const candidateHash=computeDIRCandidateHash(header);
 if(PFC.DIRHash!==candidateHash)throw new Error(`PFC DIRHash does not equal canonical DIR candidate/proposal hash ${candidateHash}`);
 if(PFC.chainId!==header.chainId||PFC.height!==header.height||PFC.round!==header.round)throw new Error('PFC consensus context does not match DIR candidate header');
 if(PFC.stateRoot!==header.stateRoot||PFC.validatorSetRoot!==header.validatorSetRoot||PFC.protocolVersion!==header.protocolVersion)throw new Error('PFC roots/protocol do not match DIR candidate header');
 return{valid:true as const,candidateHash,PFC,header};
}
