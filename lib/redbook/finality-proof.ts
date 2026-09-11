import {createPublicKey,verify as verifySignature} from 'crypto';
import {canonicalHash} from '@/lib/server/hash';
import {requiredPoviQuorum} from './povi/quorum';
import {
 DIR_HASH_DOMAIN,
 POVI_COMMIT_DOMAIN,
 POVI_PROPOSAL_DOMAIN,
 dirFinalityProofSchema,
 type DIRFinalityProof,
} from './schema/finality';
import {snapshotValidatorSetSchema,type SnapshotValidatorSet} from './schema/snapshot';
import {activeConsensusKeyAtHeight,validatorActiveAtHeight,validatorSetRootAtHeight} from './snapshot-trust';

const VERIFIED_DIR_FINALITY=Symbol('STRATUM_VERIFIED_DIR_FINALITY');

export type VerifiedDIRFinalityResult={
 readonly valid:true;
 readonly chainId:string;
 readonly height:number;
 readonly round:number;
 readonly DIRHash:string;
 readonly proposalHash:string;
 readonly stateRoot:string;
 readonly validatorSetRoot:string;
 readonly protocolVersion:string;
 readonly activeValidatorCount:number;
 readonly requiredQuorum:number;
 readonly validSigners:string[];
 readonly trustedHead:{height:number;DIRHash:string;stateRoot:string;validatorSetRoot:string;protocolVersion:string};
 readonly [VERIFIED_DIR_FINALITY]:true;
};

export function assertVerifiedDIRFinalityResult(value:unknown):asserts value is VerifiedDIRFinalityResult{
 if(typeof value!=='object'||value===null||(value as {[VERIFIED_DIR_FINALITY]?:unknown})[VERIFIED_DIR_FINALITY]!==true){
  throw new Error('Cryptographically verified DIR finality result is required');
 }
}

export function proposalHashForDIRHeader(header:DIRFinalityProof['header']){
 return canonicalHash({domain:POVI_PROPOSAL_DOMAIN,DIRCandidateHeader:header});
}

export function commitMessageHash(args:{chainId:string;height:number;round:number;proposalHash:string;stateRoot:string;validatorSetRoot:string;protocolVersion:string;}){
 return canonicalHash({domain:POVI_COMMIT_DOMAIN,chainId:args.chainId,height:args.height,round:args.round,step:'COMMIT',proposalHash:args.proposalHash,stateRoot:args.stateRoot,validatorSetRoot:args.validatorSetRoot,protocolVersion:args.protocolVersion});
}

export function finalizedDIRHash(header:DIRFinalityProof['header'],args:{proposalHash:string;signerIds:string[]}){
 return canonicalHash({domain:DIR_HASH_DOMAIN,header,finality:{proposalHash:args.proposalHash,stateRoot:header.stateRoot,validatorSetRoot:header.validatorSetRoot,protocolVersion:header.protocolVersion,signerIds:args.signerIds}});
}

function sameStrings(a:string[],b:string[]){return a.length===b.length&&a.every((value,index)=>value===b[index]);}

export function verifyDIRFinalityProof(args:{validatorSet:unknown;proof:unknown;expectedChainId:string;trustedPreviousHeight:number;trustedPreviousDIRHash:string;expectedValidatorSetRoot:string;expectedProtocolVersion?:string;}):VerifiedDIRFinalityResult{
 const validatorSet:SnapshotValidatorSet=snapshotValidatorSetSchema.parse(args.validatorSet);
 const proof=dirFinalityProofSchema.parse(args.proof);
 const {header,PFC}=proof;
 if(!Number.isInteger(args.trustedPreviousHeight)||args.trustedPreviousHeight<0)throw new Error('trustedPreviousHeight must be a non-negative integer');
 if(header.height!==args.trustedPreviousHeight+1)throw new Error(`DIR height discontinuity: expected ${args.trustedPreviousHeight+1}, received ${header.height}`);
 if(header.previousDIRHash!==args.trustedPreviousDIRHash)throw new Error('DIR previousDIRHash does not continue the trusted head');
 if(header.chainId!==args.expectedChainId||PFC.chainId!==args.expectedChainId||validatorSet.chainId!==args.expectedChainId)throw new Error('DIR/PFC chainId mismatch');
 if(args.expectedProtocolVersion&&(header.protocolVersion!==args.expectedProtocolVersion||PFC.protocolVersion!==args.expectedProtocolVersion))throw new Error('DIR/PFC protocolVersion mismatch');
 if(PFC.height!==header.height||PFC.round!==header.round)throw new Error('PFC height/round does not bind the DIR header');
 if(PFC.stateRoot!==header.stateRoot)throw new Error('PFC stateRoot does not bind the DIR header');
 const computedValidatorSetRoot=validatorSetRootAtHeight(validatorSet,header.height);
 if(computedValidatorSetRoot!==args.expectedValidatorSetRoot)throw new Error(`Trusted validator-set root mismatch: computed ${computedValidatorSetRoot}`);
 if(header.validatorSetRoot!==computedValidatorSetRoot||PFC.validatorSetRoot!==computedValidatorSetRoot)throw new Error('DIR/PFC does not bind the trusted validator-set root');
 const proposalHash=proposalHashForDIRHeader(header);
 if(PFC.proposalHash!==proposalHash)throw new Error('PFC proposalHash does not match the DIR candidate header');
 const expectedCommitMessageHash=commitMessageHash({chainId:header.chainId,height:header.height,round:header.round,proposalHash,stateRoot:header.stateRoot,validatorSetRoot:header.validatorSetRoot,protocolVersion:header.protocolVersion});
 const activeMembers=validatorSet.members.filter(member=>validatorActiveAtHeight(member,header.height));
 const memberById=new Map(activeMembers.map(member=>[member.validatorId,member]));
 const validSigners:string[]=[];
 for(const vote of PFC.COMMITSignatures){
  const member=memberById.get(vote.validatorId); if(!member)continue;
  if(vote.proposalHash!==proposalHash||vote.stateRoot!==header.stateRoot||vote.messageHash!==expectedCommitMessageHash)continue;
  const key=activeConsensusKeyAtHeight(member,header.height);
  const publicKey=createPublicKey({key:Buffer.from(key.publicKeyDerB64,'base64'),format:'der',type:'spki'});
  const valid=verifySignature(null,Buffer.from(expectedCommitMessageHash,'hex'),publicKey,Buffer.from(vote.signature,'base64'));
  if(valid)validSigners.push(vote.validatorId);
 }
 const uniqueValid=[...new Set(validSigners)].sort();
 const required=requiredPoviQuorum(activeMembers.length);
 if(uniqueValid.length<required)throw new Error(`PFC PoVI quorum not met: ${uniqueValid.length}/${activeMembers.length}; ${required} required`);
 const declared=[...PFC.signerIds];
 const sortedDeclared=[...new Set(declared)].sort();
 if(!sameStrings(declared,sortedDeclared))throw new Error('PFC signerIds must be unique and canonically sorted');
 if(!sameStrings(declared,uniqueValid))throw new Error('PFC signerIds do not exactly match valid COMMIT signatures');
 const computedDIRHash=finalizedDIRHash(header,{proposalHash,signerIds:declared});
 if(PFC.DIRHash!==computedDIRHash)throw new Error(`DIRHash mismatch: computed ${computedDIRHash}`);
 return{
  valid:true,
  chainId:header.chainId,
  height:header.height,
  round:header.round,
  DIRHash:computedDIRHash,
  proposalHash,
  stateRoot:header.stateRoot,
  validatorSetRoot:computedValidatorSetRoot,
  protocolVersion:header.protocolVersion,
  activeValidatorCount:activeMembers.length,
  requiredQuorum:required,
  validSigners:uniqueValid,
  trustedHead:{height:header.height,DIRHash:computedDIRHash,stateRoot:header.stateRoot,validatorSetRoot:computedValidatorSetRoot,protocolVersion:header.protocolVersion},
  [VERIFIED_DIR_FINALITY]:true,
 };
}
