import {createPublicKey,verify as verifySignature} from 'crypto';
import {canonicalHash,canonicalize} from '@/lib/server/hash';
import {requiredPoviQuorum} from './povi/quorum';
import {
 SNAPSHOT_CERTIFICATE_DOMAIN,
 SNAPSHOT_CERTIFICATE_VERSION,
 VALIDATOR_SET_PROFILE,
 VALIDATOR_SET_ROOT_DOMAIN,
 snapshotTrustCertificateSchema,
 snapshotValidatorSetSchema,
 type SnapshotTrustCertificate,
 type SnapshotValidatorSet,
} from './schema/snapshot';

export function validatorActiveAtHeight(member:SnapshotValidatorSet['members'][number],height:number){
 return member.activationHeight<=height&&(member.retirementHeight===null||member.retirementHeight>height);
}

export function activeConsensusKeyAtHeight(member:SnapshotValidatorSet['members'][number],height:number){
 const keys=member.keys.filter(key=>key.activeFromHeight<=height&&(key.retiredAtHeight===null||key.retiredAtHeight>height));
 if(keys.length!==1)throw new Error(`Validator ${member.validatorId} must have exactly one active CONSENSUS key at height ${height}; found ${keys.length}`);
 return keys[0];
}

export function canonicalValidatorSetAtHeight(input:SnapshotValidatorSet|unknown,height:number){
 const set=snapshotValidatorSetSchema.parse(input);
 if(!Number.isInteger(height)||height<0)throw new Error('height must be a non-negative integer');
 const validators=set.members.filter(member=>validatorActiveAtHeight(member,height)).map(member=>{
  const key=activeConsensusKeyAtHeight(member,height);
  return{
   validatorId:member.validatorId,
   identityUuid:member.identityUuid,
   operatorOrg:member.operatorOrg,
   consensusKeyId:key.keyId,
   consensusPublicKeyDerB64:key.publicKeyDerB64,
  };
 }).sort((a,b)=>a.validatorId.localeCompare(b.validatorId));
 if(validators.length<1)throw new Error(`No ACTIVE validators at height ${height}`);
 return{domain:VALIDATOR_SET_ROOT_DOMAIN,profile:VALIDATOR_SET_PROFILE,chainId:set.chainId,height,validators};
}

export function validatorSetRootAtHeight(input:SnapshotValidatorSet|unknown,height:number){
 return canonicalHash(canonicalValidatorSetAtHeight(input,height));
}

export function snapshotCertificatePayload(input:SnapshotTrustCertificate|unknown){
 const certificate=snapshotTrustCertificateSchema.parse(input);
 const {signatures:_signatures,...payload}=certificate;
 return payload;
}

export function verifySnapshotTrustCertificate(args:{
 validatorSet:unknown;
 certificate:unknown;
 expectedChainId:string;
 expectedValidatorSetRoot:string;
 expectedProtocolVersion?:string;
}){
 const validatorSet=snapshotValidatorSetSchema.parse(args.validatorSet);
 const certificate=snapshotTrustCertificateSchema.parse(args.certificate);
 if(validatorSet.chainId!==args.expectedChainId||certificate.chainId!==args.expectedChainId)throw new Error('Snapshot chainId mismatch');
 if(args.expectedProtocolVersion&&certificate.protocolVersion!==args.expectedProtocolVersion)throw new Error('Snapshot protocolVersion mismatch');
 const computedValidatorSetRoot=validatorSetRootAtHeight(validatorSet,certificate.snapshotHeight);
 if(computedValidatorSetRoot!==args.expectedValidatorSetRoot)throw new Error(`Trusted validator-set root mismatch: computed ${computedValidatorSetRoot}`);
 if(certificate.validatorSetRoot!==computedValidatorSetRoot)throw new Error('Snapshot certificate does not bind the trusted validator-set root');

 const activeMembers=validatorSet.members.filter(member=>validatorActiveAtHeight(member,certificate.snapshotHeight));
 const byId=new Map(activeMembers.map(member=>[member.validatorId,member]));
 const payload=Buffer.from(canonicalize(snapshotCertificatePayload(certificate)),'utf8');
 const validSigners:string[]=[];
 for(const signature of certificate.signatures){
  const member=byId.get(signature.signerId);
  if(!member)continue;
  const key=activeConsensusKeyAtHeight(member,certificate.snapshotHeight);
  if(signature.keyId!==key.keyId||signature.algorithm!=='Ed25519'||signature.domain!==SNAPSHOT_CERTIFICATE_DOMAIN)continue;
  const publicKey=createPublicKey({key:Buffer.from(key.publicKeyDerB64,'base64'),format:'der',type:'spki'});
  const valid=verifySignature(null,payload,publicKey,Buffer.from(signature.signatureB64,'base64'));
  if(valid)validSigners.push(signature.signerId);
 }
 const uniqueValid=[...new Set(validSigners)].sort();
 const required=requiredPoviQuorum(activeMembers.length);
 if(uniqueValid.length<required)throw new Error(`Snapshot PoVI quorum not met: ${uniqueValid.length}/${activeMembers.length}; ${required} required`);
 return{
  valid:true as const,
  certificateVersion:SNAPSHOT_CERTIFICATE_VERSION,
  snapshotHeight:certificate.snapshotHeight,
  DIRHash:certificate.DIRHash,
  stateRoot:certificate.stateRoot,
  validatorSetRoot:computedValidatorSetRoot,
  protocolVersion:certificate.protocolVersion,
  activeValidatorCount:activeMembers.length,
  requiredQuorum:required,
  validSigners:uniqueValid,
 };
}
