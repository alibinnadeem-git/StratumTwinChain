import {createPublicKey,verify as verifySignature} from 'crypto';
import {requiredPoviQuorum} from './quorum';
import {verifyVoteMessageHash} from './liveness';
import {activeConsensusKeyAtHeight,validatorActiveAtHeight,validatorSetRootAtHeight} from '../snapshot-trust';
import {snapshotValidatorSetSchema} from '../schema/snapshot';
import {poviLockCertificateProofSchema,type PoVILockCertificateProof} from '../schema/plc';

function sameStrings(a:readonly string[],b:readonly string[]){return a.length===b.length&&a.every((value,index)=>value===b[index]);}

export type VerifiedPoVILockCertificate={
 readonly verified:true;
 readonly PLC:PoVILockCertificateProof;
 readonly activeValidatorCount:number;
 readonly requiredQuorum:number;
 readonly validSignerIds:readonly string[];
};

export function verifyPoVILockCertificate(args:{validatorSet:unknown;PLC:unknown;expectedChainId:string;expectedValidatorSetRoot:string;expectedProtocolVersion?:string;}):VerifiedPoVILockCertificate{
 const validatorSet=snapshotValidatorSetSchema.parse(args.validatorSet);
 const PLC=poviLockCertificateProofSchema.parse(args.PLC);
 if(validatorSet.chainId!==args.expectedChainId||PLC.chainId!==args.expectedChainId)throw new Error('PLC chainId mismatch');
 if(args.expectedProtocolVersion&&PLC.protocolVersion!==args.expectedProtocolVersion)throw new Error('PLC protocolVersion mismatch');
 const computedRoot=validatorSetRootAtHeight(validatorSet,PLC.height);
 if(computedRoot!==args.expectedValidatorSetRoot)throw new Error(`PLC trusted validator-set root mismatch: computed ${computedRoot}`);
 if(PLC.validatorSetRoot!==computedRoot)throw new Error('PLC does not bind the trusted validator-set root');
 const active=validatorSet.members.filter(member=>validatorActiveAtHeight(member,PLC.height));
 const byId=new Map(active.map(member=>[member.validatorId,member]));
 const validSigners:string[]=[];
 for(const vote of PLC.VERIFYSignatures){
  const member=byId.get(vote.validatorId); if(!member)continue;
  if(vote.proposalHash==='NIL'||vote.proposalHash!==PLC.proposalHash)continue;
  const expectedHash=verifyVoteMessageHash(vote); if(vote.messageHash!==expectedHash)continue;
  const key=activeConsensusKeyAtHeight(member,PLC.height); if(vote.keyId!==key.keyId||vote.algorithm!=='Ed25519')continue;
  const publicKey=createPublicKey({key:Buffer.from(key.publicKeyDerB64,'base64'),format:'der',type:'spki'}); if(publicKey.asymmetricKeyType!=='ed25519')continue;
  if(verifySignature(null,Buffer.from(expectedHash,'hex'),publicKey,Buffer.from(vote.signatureB64,'base64')))validSigners.push(vote.validatorId);
 }
 const uniqueValid=[...new Set(validSigners)].sort();
 const required=requiredPoviQuorum(active.length);
 if(uniqueValid.length<required)throw new Error(`PLC PoVI quorum not met: ${uniqueValid.length}/${active.length}; ${required} required`);
 const declared=[...PLC.signerIds];
 const canonicalDeclared=[...new Set(declared)].sort();
 if(!sameStrings(declared,canonicalDeclared))throw new Error('PLC signerIds must be unique and canonically sorted');
 if(!sameStrings(declared,uniqueValid))throw new Error('PLC signerIds do not exactly match valid VERIFY signatures');
 return{verified:true,PLC,activeValidatorCount:active.length,requiredQuorum:required,validSignerIds:Object.freeze(uniqueValid)};
}
