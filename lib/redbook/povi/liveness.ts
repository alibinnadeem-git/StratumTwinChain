import {createPublicKey,verify as verifySignature} from 'crypto';
import {canonicalHash} from '@/lib/server/hash';
import {requiredPoviQuorum} from './quorum';
import {activeConsensusKeyAtHeight,validatorActiveAtHeight,validatorSetRootAtHeight} from '../snapshot-trust';
import {snapshotValidatorSetSchema,type SnapshotValidatorSet} from '../schema/snapshot';
import {
 POVI_ROUND_CHANGE_DOMAIN,
 POVI_VERIFY_DOMAIN,
 ROUND_CHANGE_EVIDENCE_VERSION,
 roundChangeQuorumEvidenceSchema,
 verifyVoteProofSchema,
 type RoundChangeQuorumEvidence,
 type RoundChangeVoteProof,
 type VerifyVoteProof,
} from '../schema/liveness';

export function verifyVoteMessageHash(vote:VerifyVoteProof){
 return canonicalHash({
  domain:POVI_VERIFY_DOMAIN,
  chainId:vote.chainId,
  height:vote.height,
  round:vote.round,
  step:'VERIFY',
  proposalHash:vote.proposalHash,
  validatorId:vote.validatorId,
  validatorSetRoot:vote.validatorSetRoot,
  protocolVersion:vote.protocolVersion,
 });
}

export function roundChangeMessageHash(vote:RoundChangeVoteProof){
 return canonicalHash({
  domain:POVI_ROUND_CHANGE_DOMAIN,
  chainId:vote.chainId,
  height:vote.height,
  newRound:vote.newRound,
  validatorId:vote.validatorId,
  validatorSetRoot:vote.validatorSetRoot,
  protocolVersion:vote.protocolVersion,
  lockedDIR:vote.lockedDIR,
  lockedRound:vote.lockedRound,
  validDIR:vote.validDIR,
  validRound:vote.validRound,
  evidenceRefs:vote.evidenceRefs,
 });
}

function activeMemberMap(validatorSet:SnapshotValidatorSet,height:number){
 const active=validatorSet.members.filter(member=>validatorActiveAtHeight(member,height));
 return{active,byId:new Map(active.map(member=>[member.validatorId,member]))};
}

function verifyHashSignature(args:{validatorSet:SnapshotValidatorSet;height:number;validatorId:string;keyId:string;messageHash:string;signatureB64:string;}){
 const {byId}=activeMemberMap(args.validatorSet,args.height);
 const member=byId.get(args.validatorId);
 if(!member)return false;
 const key=activeConsensusKeyAtHeight(member,args.height);
 if(key.keyId!==args.keyId)return false;
 const publicKey=createPublicKey({key:Buffer.from(key.publicKeyDerB64,'base64'),format:'der',type:'spki'});
 if(publicKey.asymmetricKeyType!=='ed25519')return false;
 return verifySignature(null,Buffer.from(args.messageHash,'hex'),publicKey,Buffer.from(args.signatureB64,'base64'));
}

export function verifyNilVerifyQuorum(args:{
 validatorSet:unknown;
 votes:unknown[];
 expectedChainId:string;
 height:number;
 round:number;
 expectedValidatorSetRoot:string;
 expectedProtocolVersion?:string;
}){
 const validatorSet=snapshotValidatorSetSchema.parse(args.validatorSet);
 if(validatorSet.chainId!==args.expectedChainId)throw new Error('NIL VERIFY validator-set chainId mismatch');
 const computedRoot=validatorSetRootAtHeight(validatorSet,args.height);
 if(computedRoot!==args.expectedValidatorSetRoot)throw new Error(`NIL VERIFY trusted validator-set root mismatch: computed ${computedRoot}`);
 const parsed=args.votes.map(vote=>verifyVoteProofSchema.parse(vote));
 const seen=new Set<string>();
 const validSigners:string[]=[];
 for(const vote of parsed){
  if(vote.chainId!==args.expectedChainId||vote.height!==args.height||vote.round!==args.round||vote.proposalHash!=='NIL')continue;
  if(vote.validatorSetRoot!==computedRoot)continue;
  if(args.expectedProtocolVersion&&vote.protocolVersion!==args.expectedProtocolVersion)continue;
  if(seen.has(vote.validatorId))throw new Error(`Duplicate NIL VERIFY signer ${vote.validatorId}`);
  seen.add(vote.validatorId);
  const expectedHash=verifyVoteMessageHash(vote);
  if(vote.messageHash!==expectedHash)continue;
  if(verifyHashSignature({validatorSet,height:args.height,validatorId:vote.validatorId,keyId:vote.keyId,messageHash:expectedHash,signatureB64:vote.signatureB64}))validSigners.push(vote.validatorId);
 }
 const {active}=activeMemberMap(validatorSet,args.height);
 const required=requiredPoviQuorum(active.length);
 const unique=[...new Set(validSigners)].sort();
 if(unique.length<required)throw new Error(`NIL VERIFY quorum not met: ${unique.length}/${active.length}; ${required} required`);
 return{verified:true as const,chainId:args.expectedChainId,height:args.height,round:args.round,validatorSetRoot:computedRoot,activeValidatorCount:active.length,requiredQuorum:required,validSignerIds:unique};
}

export type VerifiedRoundChangeQuorumEvidence={
 readonly verified:true;
 readonly evidence:RoundChangeQuorumEvidence;
 readonly activeValidatorCount:number;
 readonly requiredQuorum:number;
 readonly validSignerIds:readonly string[];
 readonly nilQuorumVerified:boolean;
 readonly lockClaims:readonly {validatorId:string;lockedDIR:string;lockedRound:number;evidenceRefs:readonly string[]}[];
 readonly validValueClaims:readonly {validatorId:string;validDIR:string;validRound:number;evidenceRefs:readonly string[]}[];
 readonly safeUnlockAuthorized:false;
};

export function verifyRoundChangeQuorumEvidence(args:{
 validatorSet:unknown;
 evidence:unknown;
 expectedChainId:string;
 expectedValidatorSetRoot:string;
 expectedProtocolVersion?:string;
 expectedCurrentRound?:number;
}):VerifiedRoundChangeQuorumEvidence{
 const validatorSet=snapshotValidatorSetSchema.parse(args.validatorSet);
 const evidence=roundChangeQuorumEvidenceSchema.parse(args.evidence);
 if(evidence.evidenceVersion!==ROUND_CHANGE_EVIDENCE_VERSION)throw new Error('Unsupported ROUND_CHANGE evidence version');
 if(validatorSet.chainId!==args.expectedChainId||evidence.chainId!==args.expectedChainId)throw new Error('ROUND_CHANGE chainId mismatch');
 if(args.expectedCurrentRound!==undefined&&evidence.triggerRound!==args.expectedCurrentRound)throw new Error(`ROUND_CHANGE triggerRound mismatch: expected ${args.expectedCurrentRound}`);
 if(args.expectedProtocolVersion&&evidence.protocolVersion!==args.expectedProtocolVersion)throw new Error('ROUND_CHANGE protocolVersion mismatch');
 const computedRoot=validatorSetRootAtHeight(validatorSet,evidence.height);
 if(computedRoot!==args.expectedValidatorSetRoot)throw new Error(`ROUND_CHANGE trusted validator-set root mismatch: computed ${computedRoot}`);
 if(evidence.validatorSetRoot!==computedRoot)throw new Error('ROUND_CHANGE evidence does not bind the trusted validator-set root');
 const {active}=activeMemberMap(validatorSet,evidence.height);
 const required=requiredPoviQuorum(active.length);
 const seen=new Set<string>();
 const validSigners:string[]=[];
 const lockClaims:VerifiedRoundChangeQuorumEvidence['lockClaims'][number][]=[];
 const validValueClaims:VerifiedRoundChangeQuorumEvidence['validValueClaims'][number][]=[];
 for(const vote of evidence.roundChangeVotes){
  if(seen.has(vote.validatorId))throw new Error(`Duplicate ROUND_CHANGE signer ${vote.validatorId}`);
  seen.add(vote.validatorId);
  const expectedHash=roundChangeMessageHash(vote);
  if(vote.messageHash!==expectedHash)continue;
  if(!verifyHashSignature({validatorSet,height:evidence.height,validatorId:vote.validatorId,keyId:vote.keyId,messageHash:expectedHash,signatureB64:vote.signatureB64}))continue;
  validSigners.push(vote.validatorId);
  if(vote.lockedDIR!==null&&vote.lockedRound!==null)lockClaims.push({validatorId:vote.validatorId,lockedDIR:vote.lockedDIR,lockedRound:vote.lockedRound,evidenceRefs:Object.freeze([...vote.evidenceRefs])});
  if(vote.validDIR!==null&&vote.validRound!==null)validValueClaims.push({validatorId:vote.validatorId,validDIR:vote.validDIR,validRound:vote.validRound,evidenceRefs:Object.freeze([...vote.evidenceRefs])});
 }
 const unique=[...new Set(validSigners)].sort();
 if(unique.length<required)throw new Error(`ROUND_CHANGE quorum not met: ${unique.length}/${active.length}; ${required} required`);
 let nilQuorumVerified=false;
 if(evidence.priorRoundNILVotes.length>0){
  verifyNilVerifyQuorum({validatorSet,votes:evidence.priorRoundNILVotes,expectedChainId:args.expectedChainId,height:evidence.height,round:evidence.triggerRound,expectedValidatorSetRoot:computedRoot,expectedProtocolVersion:evidence.protocolVersion});
  nilQuorumVerified=true;
 }
 return{
  verified:true,
  evidence,
  activeValidatorCount:active.length,
  requiredQuorum:required,
  validSignerIds:Object.freeze(unique),
  nilQuorumVerified,
  lockClaims:Object.freeze(lockClaims),
  validValueClaims:Object.freeze(validValueClaims),
  safeUnlockAuthorized:false,
 };
}

export function nextRoundStateFromVerifiedEvidence<T extends {chainId:string;height:number;round:number;phase:string;proposalHash:string|null;proposedStateRoot:string|null;verifyVotes:Record<string,unknown>;commitVotes:Record<string,unknown>;lockedDIR:string|null;lockedRound:number|null;validDIR:string|null;validRound:number|null;}>(state:T,verified:VerifiedRoundChangeQuorumEvidence):T{
 if(!verified.verified)throw new Error('Verified ROUND_CHANGE evidence is required');
 const evidence=verified.evidence;
 if(state.chainId!==evidence.chainId||state.height!==evidence.height||state.round!==evidence.triggerRound)throw new Error('ROUND_CHANGE evidence does not match local consensus state');
 if(state.phase==='FINALIZED')throw new Error('Finalized height cannot enter a new round');
 return{
  ...state,
  round:evidence.newRound,
  phase:'PROPOSE',
  proposalHash:null,
  proposedStateRoot:null,
  verifyVotes:{},
  commitVotes:{},
  // Safety: ROUND_CHANGE quorum alone never clears or replaces a lock/valid value.
  lockedDIR:state.lockedDIR,
  lockedRound:state.lockedRound,
  validDIR:state.validDIR,
  validRound:state.validRound,
 };
}
