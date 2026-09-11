import {createHash,createPublicKey,verify as verifySignature} from 'crypto';
import {canonicalHash} from '@/lib/server/hash';
import {snapshotValidatorSetSchema,type SnapshotValidatorSet} from '../schema/snapshot';
import {
 POVI_PROPOSER_PROFILE,
 POVI_PROPOSER_SELECTION_DOMAIN,
 POVI_VRF_EVIDENCE_DOMAIN,
 POVI_VRF_KEY_REGISTRY_PROFILE,
 POVI_VRF_KEY_REGISTRY_ROOT_DOMAIN,
 proposerEntropyEvidenceSchema,
 proposerSelectionContextSchema,
 vrfKeyRegistrySchema,
 type ProposerEntropyEvidence,
 type ProposerSelectionContext,
 type VRFKeyRegistry,
} from '../schema/vrf';
import {validatorActiveAtHeight,validatorSetRootAtHeight} from '../snapshot-trust';

function vrfKeyActiveAtHeight(key:VRFKeyRegistry['validators'][number]['keys'][number],height:number){
 return key.activeFromHeight<=height&&(key.retiredAtHeight===null||key.retiredAtHeight>height);
}

export function activeVRFKeyAtHeight(registry:VRFKeyRegistry,validatorId:string,height:number){
 const validator=registry.validators.find(item=>item.validatorId===validatorId);
 if(!validator)throw new Error(`Missing VRF key history for validator ${validatorId}`);
 const keys=validator.keys.filter(key=>vrfKeyActiveAtHeight(key,height));
 if(keys.length!==1)throw new Error(`Validator ${validatorId} must have exactly one active VRF key at height ${height}; found ${keys.length}`);
 return keys[0];
}

export function canonicalVRFKeyRegistryAtHeight(input:VRFKeyRegistry|unknown,height:number){
 const registry=vrfKeyRegistrySchema.parse(input);
 if(!Number.isInteger(height)||height<0)throw new Error('height must be a non-negative integer');
 const validators=registry.validators.map(validator=>{
  const key=activeVRFKeyAtHeight(registry,validator.validatorId,height);
  return{validatorId:validator.validatorId,keyId:key.keyId,algorithm:key.algorithm,publicKeyDerB64:key.publicKeyDerB64};
 }).sort((a,b)=>a.validatorId.localeCompare(b.validatorId));
 return{domain:POVI_VRF_KEY_REGISTRY_ROOT_DOMAIN,profile:POVI_VRF_KEY_REGISTRY_PROFILE,chainId:registry.chainId,height,validators};
}

export function vrfKeyRegistryRootAtHeight(input:VRFKeyRegistry|unknown,height:number){
 return canonicalHash(canonicalVRFKeyRegistryAtHeight(input,height));
}

function activeValidatorIds(validatorSet:SnapshotValidatorSet,height:number){
 const ids=validatorSet.members.filter(member=>validatorActiveAtHeight(member,height)).map(member=>member.validatorId).sort();
 if(ids.length<1)throw new Error(`No ACTIVE validators at height ${height}`);
 return ids;
}

export function proposerSelectionSeed(input:ProposerSelectionContext|unknown){
 const context=proposerSelectionContextSchema.parse(input);
 return canonicalHash({
  domain:POVI_PROPOSER_SELECTION_DOMAIN,
  profileVersion:POVI_PROPOSER_PROFILE,
  chainId:context.chainId,
  height:context.height,
  round:context.round,
  previousDIRHash:context.previousDIRHash,
  previousEntropy:context.previousEntropy,
  validatorSetRoot:context.validatorSetRoot,
  vrfKeyRegistryRoot:context.vrfKeyRegistryRoot,
  protocolVersion:context.protocolVersion,
 });
}

export function selectProposer(args:{validatorSet:unknown;context:unknown}){
 const validatorSet=snapshotValidatorSetSchema.parse(args.validatorSet);
 const context=proposerSelectionContextSchema.parse(args.context);
 if(validatorSet.chainId!==context.chainId)throw new Error('Proposer-selection chainId mismatch');
 const computedValidatorSetRoot=validatorSetRootAtHeight(validatorSet,context.height);
 if(computedValidatorSetRoot!==context.validatorSetRoot)throw new Error(`Proposer-selection validator-set root mismatch: computed ${computedValidatorSetRoot}`);
 const active=activeValidatorIds(validatorSet,context.height);
 const seed=proposerSelectionSeed(context);
 const index=Number(BigInt(`0x${seed}`)%BigInt(active.length));
 return Object.freeze({profileVersion:POVI_PROPOSER_PROFILE,selectionSeed:seed,proposerId:active[index],proposerIndex:index,activeValidatorIds:Object.freeze(active)});
}

export function proposerEntropyMessageHash(evidence:Omit<ProposerEntropyEvidence,'messageHash'|'proofB64'|'vrfOutput'>){
 return canonicalHash({
  domain:POVI_VRF_EVIDENCE_DOMAIN,
  profileVersion:POVI_PROPOSER_PROFILE,
  chainId:evidence.chainId,
  height:evidence.height,
  round:evidence.round,
  previousDIRHash:evidence.previousDIRHash,
  previousEntropy:evidence.previousEntropy,
  validatorSetRoot:evidence.validatorSetRoot,
  vrfKeyRegistryRoot:evidence.vrfKeyRegistryRoot,
  protocolVersion:evidence.protocolVersion,
  proposerId:evidence.proposerId,
  keyId:evidence.keyId,
  selectionSeed:evidence.selectionSeed,
 });
}

export function verifyProposerEntropyEvidence(args:{
 validatorSet:unknown;
 vrfKeyRegistry:unknown;
 evidence:unknown;
 expectedValidatorSetRoot:string;
 expectedVRFKeyRegistryRoot:string;
 expectedProtocolVersion?:string;
}){
 const validatorSet=snapshotValidatorSetSchema.parse(args.validatorSet);
 const registry=vrfKeyRegistrySchema.parse(args.vrfKeyRegistry);
 const evidence=proposerEntropyEvidenceSchema.parse(args.evidence);
 if(evidence.profileVersion!==POVI_PROPOSER_PROFILE||evidence.domain!==POVI_VRF_EVIDENCE_DOMAIN)throw new Error('Unsupported proposer entropy profile');
 if(validatorSet.chainId!==evidence.chainId||registry.chainId!==evidence.chainId)throw new Error('Proposer entropy chainId mismatch');
 if(args.expectedProtocolVersion&&evidence.protocolVersion!==args.expectedProtocolVersion)throw new Error('Proposer entropy protocolVersion mismatch');
 const computedValidatorSetRoot=validatorSetRootAtHeight(validatorSet,evidence.height);
 if(computedValidatorSetRoot!==args.expectedValidatorSetRoot||evidence.validatorSetRoot!==computedValidatorSetRoot)throw new Error('Proposer entropy validator-set root mismatch');
 const computedVRFRoot=vrfKeyRegistryRootAtHeight(registry,evidence.height);
 if(computedVRFRoot!==args.expectedVRFKeyRegistryRoot||evidence.vrfKeyRegistryRoot!==computedVRFRoot)throw new Error('Proposer entropy VRF-key registry root mismatch');
 const activeIds=activeValidatorIds(validatorSet,evidence.height);
 const registeredIds=registry.validators.map(item=>item.validatorId).sort();
 if(activeIds.length!==registeredIds.length||activeIds.some((id,index)=>id!==registeredIds[index]))throw new Error('VRF-key registry must cover exactly the ACTIVE validator set');
 const context:ProposerSelectionContext={profileVersion:POVI_PROPOSER_PROFILE,chainId:evidence.chainId,height:evidence.height,round:evidence.round,previousDIRHash:evidence.previousDIRHash,previousEntropy:evidence.previousEntropy,validatorSetRoot:evidence.validatorSetRoot,vrfKeyRegistryRoot:evidence.vrfKeyRegistryRoot,protocolVersion:evidence.protocolVersion};
 const selected=selectProposer({validatorSet,context});
 if(evidence.selectionSeed!==selected.selectionSeed)throw new Error('Proposer entropy selectionSeed mismatch');
 if(evidence.proposerId!==selected.proposerId)throw new Error(`Wrong proposer: expected ${selected.proposerId}, got ${evidence.proposerId}`);
 const key=activeVRFKeyAtHeight(registry,evidence.proposerId,evidence.height);
 if(evidence.keyId!==key.keyId)throw new Error('Proposer entropy keyId mismatch');
 const {messageHash:_messageHash,proofB64:_proofB64,vrfOutput:_vrfOutput,...unsigned}=evidence;
 const expectedMessageHash=proposerEntropyMessageHash(unsigned);
 if(evidence.messageHash!==expectedMessageHash)throw new Error('Proposer entropy messageHash mismatch');
 const publicKey=createPublicKey({key:Buffer.from(key.publicKeyDerB64,'base64'),format:'der',type:'spki'});
 if(publicKey.asymmetricKeyType!=='ed25519')throw new Error('VRF profile requires Ed25519 key material');
 const proof=Buffer.from(evidence.proofB64,'base64');
 if(!verifySignature(null,Buffer.from(expectedMessageHash,'hex'),publicKey,proof))throw new Error('Proposer entropy proof signature verification failed');
 const output=createHash('sha256').update(proof).digest('hex');
 if(evidence.vrfOutput!==output)throw new Error('Proposer entropy output mismatch');
 return Object.freeze({verified:true as const,profileVersion:POVI_PROPOSER_PROFILE,chainId:evidence.chainId,height:evidence.height,round:evidence.round,proposerId:evidence.proposerId,selectionSeed:evidence.selectionSeed,vrfOutput:output,validatorSetRoot:computedValidatorSetRoot,vrfKeyRegistryRoot:computedVRFRoot,keyId:key.keyId});
}
