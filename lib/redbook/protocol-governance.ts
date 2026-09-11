import {createPublicKey,verify as verifySignature} from 'crypto';
import {canonicalHash,canonicalize} from '@/lib/server/hash';
import {
 PROTOCOL_CHANGE_DOMAIN,
 protocolChangeProofSchema,
 protocolGovernancePolicySchema,
 type ProtocolChangeProof,
 type ProtocolGovernancePolicy,
 type ProtocolState,
} from './schema/protocol-governance';

function governanceMemberEligibleAtHeight(member:ProtocolGovernancePolicy['members'][number],height:number){
 return member.state==='ACTIVE'&&member.validFromHeight<=height&&(member.validUntilHeight===null||member.validUntilHeight>height);
}

export function canonicalProtocolGovernancePolicy(input:ProtocolGovernancePolicy|unknown){
 const policy=protocolGovernancePolicySchema.parse(input);
 return{
  ...policy,
  scope:[...policy.scope].sort(),
  members:[...policy.members].sort((a,b)=>a.authorityMemberId.localeCompare(b.authorityMemberId)||a.keyId.localeCompare(b.keyId)),
 };
}

export function protocolGovernancePolicyHash(input:ProtocolGovernancePolicy|unknown){return canonicalHash(canonicalProtocolGovernancePolicy(input));}
export function protocolStateHash(state:ProtocolState|unknown){return canonicalHash(state);}
export function protocolChangeManifestHash(manifest:ProtocolChangeProof['changeManifest']){return canonicalHash(manifest);}

export function requiredProtocolAuthority(policy:ProtocolGovernancePolicy,eligibleCount:number){
 if(!Number.isInteger(eligibleCount)||eligibleCount<1)throw new Error('Protocol governance requires at least one eligible authority member');
 let floor=1;
 if(policy.thresholdClass==='DUAL'||policy.thresholdClass==='MULTI_PARTY_HIGH_ASSURANCE')floor=2;
 if(policy.thresholdClass==='MAJORITY')floor=Math.floor(eligibleCount/2)+1;
 if(policy.thresholdClass==='SUPERMAJORITY')floor=Math.floor((2*eligibleCount)/3)+1;
 return Math.max(policy.threshold,floor);
}

function requireScope(policy:ProtocolGovernancePolicy,scope:ProtocolGovernancePolicy['scope'][number]){
 if(!policy.scope.includes(scope))throw new Error(`Protocol governance policy lacks ${scope} authority`);
}

function assertStateScopes(proof:ProtocolChangeProof){
 const {governancePolicy:policy,previousProtocolState:previous,nextProtocolState:next}=proof;
 requireScope(policy,'PROTOCOL_VERSION');
 if(previous.consensusRulesHash!==next.consensusRulesHash)requireScope(policy,'CONSENSUS_RULES');
 if(previous.canonicalSchemaVersion!==next.canonicalSchemaVersion)requireScope(policy,'CANONICAL_SCHEMA');
 if(previous.resourcePolicyHash!==next.resourcePolicyHash)requireScope(policy,'RESOURCE_POLICY');
}

export function verifyProtocolChangeProof(args:{
 proof:unknown;
 expectedChainId:string;
 expectedGovernancePolicyHash:string;
 expectedPreviousProtocolStateHash:string;
}){
 const proof=protocolChangeProofSchema.parse(args.proof);
 const {action,governancePolicy:policy,changeManifest:manifest,previousProtocolState:previous,nextProtocolState:next}=proof;
 if(action.chainId!==args.expectedChainId||policy.chainId!==args.expectedChainId||manifest.chainId!==args.expectedChainId||previous.chainId!==args.expectedChainId||next.chainId!==args.expectedChainId)throw new Error('Protocol governance chainId mismatch');
 if(action.activationHeight<=action.approvedAtHeight)throw new Error('Consensus-affecting protocol change must activate after approval height');
 if(policy.status!=='ACTIVE'||policy.effectiveFromHeight>action.approvedAtHeight||(policy.effectiveUntilHeight!==null&&policy.effectiveUntilHeight<=action.approvedAtHeight))throw new Error('PROTOCOL governance policy was not ACTIVE at approval height');
 const computedPolicyHash=protocolGovernancePolicyHash(policy);
 if(computedPolicyHash!==args.expectedGovernancePolicyHash||action.governancePolicyHash!==computedPolicyHash)throw new Error('Protocol governance policy hash does not match independently trusted policy');
 if(action.fromProtocolVersion!==previous.protocolVersion||action.toProtocolVersion!==next.protocolVersion||manifest.fromProtocolVersion!==previous.protocolVersion||manifest.toProtocolVersion!==next.protocolVersion)throw new Error('Protocol version transition is not consistently bound across action, manifest and states');
 if(previous.protocolVersion===next.protocolVersion)throw new Error('Protocol activation does not change protocolVersion');
 if(previous.activeFromHeight>action.activationHeight-1)throw new Error('Previous protocol state was not active before transition height');
 if(next.activeFromHeight!==action.activationHeight)throw new Error('Next protocol state must activate exactly at governed activationHeight');
 const previousHash=protocolStateHash(previous);const nextHash=protocolStateHash(next);
 if(previousHash!==args.expectedPreviousProtocolStateHash||action.previousProtocolStateHash!==previousHash)throw new Error('Previous protocol state hash does not match independently trusted state');
 if(action.nextProtocolStateHash!==nextHash)throw new Error('Next protocol state hash mismatch');
 const changeHash=protocolChangeManifestHash(manifest);
 if(action.changeHash!==changeHash)throw new Error('Protocol change manifest hash mismatch');
 assertStateScopes(proof);

 const eligible=policy.members.filter(member=>governanceMemberEligibleAtHeight(member,action.approvedAtHeight));
 const required=requiredProtocolAuthority(policy,eligible.length);
 if(required>eligible.length)throw new Error(`Protocol governance threshold ${required} exceeds ${eligible.length} eligible authority members`);
 const byId=new Map(eligible.map(member=>[member.authorityMemberId,member]));
 const payload=Buffer.from(canonicalize(action),'utf8');const validSigners:string[]=[];
 for(const signature of proof.signatures){
  const member=byId.get(signature.authorityMemberId);
  if(!member||signature.keyId!==member.keyId||signature.algorithm!=='Ed25519'||signature.domain!==PROTOCOL_CHANGE_DOMAIN)continue;
  const publicKey=createPublicKey({key:Buffer.from(member.publicKeyDerB64,'base64'),format:'der',type:'spki'});
  if(verifySignature(null,payload,publicKey,Buffer.from(signature.signatureB64,'base64')))validSigners.push(member.authorityMemberId);
 }
 const uniqueValid=[...new Set(validSigners)].sort();
 if(uniqueValid.length<required)throw new Error(`Protocol governance threshold not met: ${uniqueValid.length}/${eligible.length}; ${required} required`);
 return{
  valid:true as const,
  actionId:action.actionId,
  approvedAtHeight:action.approvedAtHeight,
  activationHeight:action.activationHeight,
  fromProtocolVersion:previous.protocolVersion,
  toProtocolVersion:next.protocolVersion,
  governancePolicyHash:computedPolicyHash,
  changeHash,
  previousProtocolStateHash:previousHash,
  nextProtocolStateHash:nextHash,
  eligibleAuthorityCount:eligible.length,
  requiredAuthority:required,
  validSigners:uniqueValid,
  trustedNextProtocolState:{activationHeight:action.activationHeight,protocolVersion:next.protocolVersion,stateHash:nextHash},
 };
}
