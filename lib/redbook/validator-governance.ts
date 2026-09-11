import {createPublicKey,verify as verifySignature} from 'crypto';
import {canonicalHash,canonicalize} from '@/lib/server/hash';
import {activeConsensusKeyAtHeight,validatorActiveAtHeight,validatorSetRootAtHeight} from './snapshot-trust';
import {snapshotValidatorSetSchema,type SnapshotValidatorSet} from './schema/snapshot';
import {
 VALIDATOR_SET_CHANGE_DOMAIN,
 VALIDATOR_SET_STATE_DOMAIN,
 VALIDATOR_SET_STATE_PROFILE,
 VALIDATOR_SUBJECT_DOMAIN,
 validatorGovernancePolicySchema,
 validatorSetChangeProofSchema,
 type ValidatorGovernancePolicy,
 type ValidatorSetChangeProof,
} from './schema/validator-governance';

function governanceMemberEligibleAtHeight(member:ValidatorGovernancePolicy['members'][number],height:number){
 return member.state==='ACTIVE'&&member.validFromHeight<=height&&(member.validUntilHeight===null||member.validUntilHeight>height);
}

export function requiredGovernanceSupermajority(eligibleAuthorityCount:number){
 if(!Number.isInteger(eligibleAuthorityCount)||eligibleAuthorityCount<1)throw new Error('eligibleAuthorityCount must be a positive integer');
 return Math.floor((2*eligibleAuthorityCount)/3)+1;
}

export function canonicalGovernancePolicy(input:ValidatorGovernancePolicy|unknown){
 const policy=validatorGovernancePolicySchema.parse(input);
 return{
  ...policy,
  scope:[...policy.scope].sort(),
  members:[...policy.members].sort((a,b)=>a.authorityMemberId.localeCompare(b.authorityMemberId)||a.keyId.localeCompare(b.keyId)),
 };
}

export function governancePolicyHash(input:ValidatorGovernancePolicy|unknown){
 return canonicalHash(canonicalGovernancePolicy(input));
}

export function canonicalValidatorSetState(input:SnapshotValidatorSet|unknown){
 const set=snapshotValidatorSetSchema.parse(input);
 return{
  domain:VALIDATOR_SET_STATE_DOMAIN,
  profile:VALIDATOR_SET_STATE_PROFILE,
  setVersion:set.setVersion,
  chainId:set.chainId,
  members:[...set.members].map(member=>({...member,keys:[...member.keys].sort((a,b)=>a.keyId.localeCompare(b.keyId))})).sort((a,b)=>a.validatorId.localeCompare(b.validatorId)),
 };
}

export function validatorSetStateHash(input:SnapshotValidatorSet|unknown){
 return canonicalHash(canonicalValidatorSetState(input));
}

export function validatorSubjectIdentityHash(member:SnapshotValidatorSet['members'][number]){
 return canonicalHash({domain:VALIDATOR_SUBJECT_DOMAIN,validatorId:member.validatorId,identityUuid:member.identityUuid,operatorOrg:member.operatorOrg});
}

function requiredScope(actionType:ValidatorSetChangeProof['action']['actionType']){
 return actionType==='ROTATE_CONSENSUS_KEY'?'VALIDATOR_CONSENSUS_KEYS' as const:'VALIDATOR_MEMBERSHIP' as const;
}

function sameIdentity(a:SnapshotValidatorSet['members'][number],b:SnapshotValidatorSet['members'][number]){
 return a.validatorId===b.validatorId&&a.identityUuid===b.identityUuid&&a.operatorOrg===b.operatorOrg;
}

function byValidatorId(set:SnapshotValidatorSet){return new Map(set.members.map(member=>[member.validatorId,member]));}

function assertOnlyTargetChanged(previous:SnapshotValidatorSet,next:SnapshotValidatorSet,targetId:string){
 const before=byValidatorId(previous);const after=byValidatorId(next);
 const allIds=new Set([...before.keys(),...after.keys()]);
 for(const id of allIds){
  if(id===targetId)continue;
  const a=before.get(id);const b=after.get(id);
  if(!a||!b||canonicalHash(a)!==canonicalHash(b))throw new Error(`Unrelated validator ${id} changed in validator-set action`);
 }
}

function assertMembershipTransition(proof:ValidatorSetChangeProof){
 const {action,previousValidatorSet:previous,nextValidatorSet:next}=proof;
 const before=byValidatorId(previous).get(action.validatorId);
 const after=byValidatorId(next).get(action.validatorId);
 const priorHeight=action.effectiveHeight-1;
 if(action.actionType==='ACTIVATE'){
  if(before)throw new Error('ACTIVATE v1 requires the target validator to be absent from the previous canonical set');
  if(!after||after.activationHeight!==action.effectiveHeight||after.retirementHeight!==null||!validatorActiveAtHeight(after,action.effectiveHeight))throw new Error('ACTIVATE does not produce an ACTIVE target at the effective height');
  activeConsensusKeyAtHeight(after,action.effectiveHeight);
  return after;
 }
 if(!before||!after)throw new Error(`${action.actionType} requires the target validator in both canonical set snapshots`);
 if(!sameIdentity(before,after))throw new Error('Validator permanent identity changed across governed action');
 if(action.actionType==='QUARANTINE'||action.actionType==='RETIRE'||action.actionType==='REVOKE'){
  if(!validatorActiveAtHeight(before,priorHeight))throw new Error(`${action.actionType} target was not ACTIVE before the effective height`);
  if(validatorActiveAtHeight(after,action.effectiveHeight)||after.retirementHeight!==action.effectiveHeight)throw new Error(`${action.actionType} does not remove the target from the ACTIVE set at the effective height`);
  return after;
 }
 if(action.actionType==='REINSTATE'){
  if(validatorActiveAtHeight(before,priorHeight))throw new Error('REINSTATE target was already ACTIVE before the effective height');
  if(after.activationHeight!==action.effectiveHeight||after.retirementHeight!==null||!validatorActiveAtHeight(after,action.effectiveHeight))throw new Error('REINSTATE does not restore the target at the effective height');
  activeConsensusKeyAtHeight(after,action.effectiveHeight);
  return after;
 }
 throw new Error(`Unsupported membership transition ${action.actionType}`);
}

function assertConsensusKeyRotation(proof:ValidatorSetChangeProof){
 const {action,previousValidatorSet:previous,nextValidatorSet:next}=proof;
 const before=byValidatorId(previous).get(action.validatorId);const after=byValidatorId(next).get(action.validatorId);
 if(!before||!after||!sameIdentity(before,after))throw new Error('ROTATE_CONSENSUS_KEY requires the same permanent validator identity in both sets');
 if(before.activationHeight!==after.activationHeight||before.retirementHeight!==after.retirementHeight)throw new Error('Consensus-key rotation must not change validator membership lifecycle');
 if(!validatorActiveAtHeight(before,action.effectiveHeight-1)||!validatorActiveAtHeight(after,action.effectiveHeight))throw new Error('Consensus-key rotation requires the validator ACTIVE across the effective height');
 const oldActive=activeConsensusKeyAtHeight(before,action.effectiveHeight-1);
 const newActive=activeConsensusKeyAtHeight(after,action.effectiveHeight);
 if(oldActive.keyId===newActive.keyId)throw new Error('Consensus-key rotation did not change the active key');
 const beforeKeys=new Map(before.keys.map(key=>[key.keyId,key]));const afterKeys=new Map(after.keys.map(key=>[key.keyId,key]));
 const retiredOld=afterKeys.get(oldActive.keyId);
 if(!retiredOld||retiredOld.publicKeyDerB64!==oldActive.publicKeyDerB64||retiredOld.retiredAtHeight!==action.effectiveHeight)throw new Error('Previous CONSENSUS key must retire exactly at the effective height');
 const newlyAdded=[...afterKeys.keys()].filter(keyId=>!beforeKeys.has(keyId));
 if(newlyAdded.length!==1||newlyAdded[0]!==newActive.keyId||newActive.activeFromHeight!==action.effectiveHeight)throw new Error('Exactly one replacement CONSENSUS key must activate at the effective height');
 for(const [keyId,key] of beforeKeys){
  if(keyId===oldActive.keyId)continue;
  const nextKey=afterKeys.get(keyId);
  if(!nextKey||canonicalHash(key)!==canonicalHash(nextKey))throw new Error(`Unrelated key history ${keyId} changed during rotation`);
 }
 return after;
}

export function verifyValidatorSetChangeProof(args:{
 proof:unknown;
 expectedChainId:string;
 expectedGovernancePolicyHash:string;
 expectedPreviousValidatorSetRoot:string;
}){
 const proof=validatorSetChangeProofSchema.parse(args.proof);
 const {action,governancePolicy:policy,previousValidatorSet:previous,nextValidatorSet:next}=proof;
 if(action.chainId!==args.expectedChainId||policy.chainId!==args.expectedChainId||previous.chainId!==args.expectedChainId||next.chainId!==args.expectedChainId)throw new Error('Validator governance chainId mismatch');
 if(action.effectiveHeight<=action.approvedAtHeight)throw new Error('Validator-set changes must activate after their approval height');
 if(policy.status!=='ACTIVE'||policy.effectiveFromHeight>action.approvedAtHeight||(policy.effectiveUntilHeight!==null&&policy.effectiveUntilHeight<=action.approvedAtHeight))throw new Error('Validator governance policy was not ACTIVE at approval height');
 const scope=requiredScope(action.actionType);
 if(!policy.scope.includes(scope))throw new Error(`Validator governance policy lacks ${scope} authority`);
 const computedPolicyHash=governancePolicyHash(policy);
 if(computedPolicyHash!==args.expectedGovernancePolicyHash||action.governancePolicyHash!==computedPolicyHash)throw new Error('Validator governance policy hash does not match independently trusted policy');
 const previousHash=validatorSetStateHash(previous);const nextHash=validatorSetStateHash(next);
 if(action.previousValidatorSetHash!==previousHash||action.nextValidatorSetHash!==nextHash)throw new Error('Validator-set state hash mismatch');
 const computedPreviousRoot=validatorSetRootAtHeight(previous,action.effectiveHeight-1);
 if(computedPreviousRoot!==args.expectedPreviousValidatorSetRoot||action.previousValidatorSetRoot!==computedPreviousRoot)throw new Error('Previous validator-set root does not match independently trusted canonical root');
 const computedNextRoot=validatorSetRootAtHeight(next,action.effectiveHeight);
 if(action.nextValidatorSetRoot!==computedNextRoot)throw new Error('Next validator-set root mismatch');
 assertOnlyTargetChanged(previous,next,action.validatorId);
 const subject=action.actionType==='ROTATE_CONSENSUS_KEY'?assertConsensusKeyRotation(proof):assertMembershipTransition(proof);
 if(action.subjectIdentityHash!==validatorSubjectIdentityHash(subject))throw new Error('Validator subject identity hash mismatch');

 const eligible=policy.members.filter(member=>governanceMemberEligibleAtHeight(member,action.approvedAtHeight));
 if(eligible.length<1)throw new Error('No eligible VALIDATOR governance authority at approval height');
 const required=Math.max(policy.threshold,requiredGovernanceSupermajority(eligible.length));
 if(required>eligible.length)throw new Error(`Validator governance threshold ${required} exceeds ${eligible.length} eligible authority members`);
 const authorityById=new Map(eligible.map(member=>[member.authorityMemberId,member]));
 const payload=Buffer.from(canonicalize(action),'utf8');
 const validSigners:string[]=[];
 for(const signature of proof.signatures){
  const member=authorityById.get(signature.authorityMemberId);
  if(!member||signature.keyId!==member.keyId||signature.algorithm!=='Ed25519'||signature.domain!==VALIDATOR_SET_CHANGE_DOMAIN)continue;
  const publicKey=createPublicKey({key:Buffer.from(member.publicKeyDerB64,'base64'),format:'der',type:'spki'});
  if(verifySignature(null,payload,publicKey,Buffer.from(signature.signatureB64,'base64')))validSigners.push(member.authorityMemberId);
 }
 const uniqueValid=[...new Set(validSigners)].sort();
 if(uniqueValid.length<required)throw new Error(`Validator governance supermajority not met: ${uniqueValid.length}/${eligible.length}; ${required} required`);
 return{
  valid:true as const,
  actionId:action.actionId,
  actionType:action.actionType,
  validatorId:action.validatorId,
  approvedAtHeight:action.approvedAtHeight,
  effectiveHeight:action.effectiveHeight,
  governancePolicyHash:computedPolicyHash,
  previousValidatorSetRoot:computedPreviousRoot,
  nextValidatorSetRoot:computedNextRoot,
  previousValidatorSetHash:previousHash,
  nextValidatorSetHash:nextHash,
  eligibleAuthorityCount:eligible.length,
  requiredAuthority:required,
  validSigners:uniqueValid,
  trustedNextValidatorSet:{height:action.effectiveHeight,validatorSetRoot:computedNextRoot,stateHash:nextHash},
 };
}
