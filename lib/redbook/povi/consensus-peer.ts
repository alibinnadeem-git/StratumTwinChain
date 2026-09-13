import {createPublicKey,verify as verifySignature} from 'crypto';
import {canonicalHash} from '@/lib/server/hash';
import {activeConsensusKeyAtHeight,validatorActiveAtHeight,validatorSetRootAtHeight} from '../snapshot-trust';
import {activePeerTransportKeyAtHeight,peerRegistryRootAtHeight} from '../peer-transport-trust';
import {snapshotValidatorSetSchema} from '../schema/snapshot';
import {peerTransportRegistrySchema} from '../schema/peer-transport';
import {consensusPeerPacketSchema,type ConsensusPeerVerification} from '../schema/consensus-peer';
import {verifyVoteProofSchema,roundChangeVoteProofSchema} from '../schema/liveness';
import {commitVoteProofSchema,POVI_COMMIT_DOMAIN} from '../schema/finality';
import {verifyVoteMessageHash,roundChangeMessageHash} from './liveness';

function verifyEd25519Hash(publicKeyDerB64:string,messageHash:string,signatureB64:string){
 const publicKey=createPublicKey({key:Buffer.from(publicKeyDerB64,'base64'),format:'der',type:'spki'});
 if(publicKey.asymmetricKeyType!=='ed25519')return false;
 return verifySignature(null,Buffer.from(messageHash,'hex'),publicKey,Buffer.from(signatureB64,'base64'));
}

function commitPeerMessageHash(args:{chainId:string;height:number;round:number;proposalHash:string;stateRoot:string;validatorSetRoot:string;protocolVersion:string}){
 return canonicalHash({
  domain:POVI_COMMIT_DOMAIN,
  chainId:args.chainId,
  height:args.height,
  round:args.round,
  step:'COMMIT',
  proposalHash:args.proposalHash,
  stateRoot:args.stateRoot,
  validatorSetRoot:args.validatorSetRoot,
  protocolVersion:args.protocolVersion,
 });
}

export function consensusPeerPacketHash(input:unknown){
 const packet=consensusPeerPacketSchema.parse(input);
 return canonicalHash({
  domain:packet.domain,
  profileVersion:packet.profileVersion,
  chainId:packet.chainId,
  networkName:packet.networkName,
  GenesisDIRHash:packet.GenesisDIRHash.toLowerCase(),
  protocolVersion:packet.protocolVersion,
  senderValidatorId:packet.senderValidatorId,
  senderConsensusKeyId:packet.senderConsensusKeyId,
  senderTransportKeyId:packet.senderTransportKeyId,
  height:packet.height,
  round:packet.round,
  step:packet.step,
  validatorSetRoot:packet.validatorSetRoot,
  peerRegistryRoot:packet.peerRegistryRoot,
  issuedAt:packet.issuedAt,
  expiresAt:packet.expiresAt,
  sequence:packet.sequence,
  nonce:packet.nonce,
  payloadHash:packet.payloadHash,
  consensusMessageHash:packet.consensusMessageHash,
  safetyRecordHash:packet.safetyRecordHash,
  safetySequence:packet.safetySequence,
 });
}

function innerConsensusProof(packet:ReturnType<typeof consensusPeerPacketSchema.parse>){
 if(packet.step==='VERIFY'){
  const vote=verifyVoteProofSchema.parse(packet.payload);
  if(vote.chainId!==packet.chainId||vote.height!==packet.height||vote.round!==packet.round||vote.validatorId!==packet.senderValidatorId||vote.keyId!==packet.senderConsensusKeyId||vote.validatorSetRoot!==packet.validatorSetRoot||vote.protocolVersion!==packet.protocolVersion){
   throw new Error('VERIFY payload does not bind consensus peer context');
  }
  const messageHash=verifyVoteMessageHash(vote);
  if(vote.messageHash!==messageHash)throw new Error('VERIFY canonical message hash mismatch');
  return{messageHash,signatureB64:vote.signatureB64};
 }
 if(packet.step==='COMMIT'){
  const vote=commitVoteProofSchema.parse(packet.payload);
  if(vote.validatorId!==packet.senderValidatorId)throw new Error('COMMIT payload sender mismatch');
  const messageHash=commitPeerMessageHash({chainId:packet.chainId,height:packet.height,round:packet.round,proposalHash:vote.proposalHash,stateRoot:vote.stateRoot,validatorSetRoot:packet.validatorSetRoot,protocolVersion:packet.protocolVersion});
  if(vote.messageHash!==messageHash)throw new Error('COMMIT canonical message hash mismatch');
  return{messageHash,signatureB64:vote.signature};
 }
 const vote=roundChangeVoteProofSchema.parse(packet.payload);
 if(vote.chainId!==packet.chainId||vote.height!==packet.height||vote.newRound!==packet.round||vote.validatorId!==packet.senderValidatorId||vote.keyId!==packet.senderConsensusKeyId||vote.validatorSetRoot!==packet.validatorSetRoot||vote.protocolVersion!==packet.protocolVersion){
  throw new Error('ROUND_CHANGE payload does not bind consensus peer context');
 }
 const messageHash=roundChangeMessageHash(vote);
 if(vote.messageHash!==messageHash)throw new Error('ROUND_CHANGE canonical message hash mismatch');
 return{messageHash,signatureB64:vote.signatureB64};
}

export function verifyConsensusPeerPacket(args:{
 validatorSet:unknown;
 peerRegistry:unknown;
 packet:unknown;
 expectedChainId:string;
 expectedNetworkName:string;
 expectedGenesisDIRHash:string;
 expectedProtocolVersion:string;
 expectedValidatorSetRoot:string;
 expectedPeerRegistryRoot:string;
 now?:Date;
 maxClockSkewMs?:number;
 lastAcceptedSequence:number;
 seenNonces:ReadonlySet<string>;
}):ConsensusPeerVerification{
 const validatorSet=snapshotValidatorSetSchema.parse(args.validatorSet);
 const peerRegistry=peerTransportRegistrySchema.parse(args.peerRegistry);
 const packet=consensusPeerPacketSchema.parse(args.packet);
 if(!Number.isInteger(args.lastAcceptedSequence)||args.lastAcceptedSequence<0)throw new Error('lastAcceptedSequence must be a non-negative integer');
 if(packet.chainId!==args.expectedChainId||validatorSet.chainId!==args.expectedChainId||peerRegistry.chainId!==args.expectedChainId)throw new Error('Consensus peer chainId mismatch');
 if(packet.networkName!==args.expectedNetworkName)throw new Error('Consensus peer networkName mismatch');
 if(packet.GenesisDIRHash.toLowerCase()!==args.expectedGenesisDIRHash.toLowerCase()||peerRegistry.GenesisDIRHash.toLowerCase()!==args.expectedGenesisDIRHash.toLowerCase())throw new Error('Consensus peer Genesis DIR mismatch');
 if(packet.protocolVersion!==args.expectedProtocolVersion||peerRegistry.protocolVersion!==args.expectedProtocolVersion)throw new Error('Consensus peer protocolVersion mismatch');
 if(packet.sequence<=args.lastAcceptedSequence)throw new Error(`Consensus peer replay/rollback: sequence ${packet.sequence} is not greater than durable watermark ${args.lastAcceptedSequence}`);
 if(args.seenNonces.has(packet.nonce))throw new Error('Consensus peer nonce replay detected');
 const now=(args.now??new Date()).getTime();
 const maxSkew=args.maxClockSkewMs??30_000;
 if(!Number.isFinite(maxSkew)||maxSkew<0)throw new Error('maxClockSkewMs must be non-negative');
 const issued=Date.parse(packet.issuedAt); const expires=Date.parse(packet.expiresAt);
 if(issued>now+maxSkew)throw new Error('Consensus peer packet issuedAt is too far in the future');
 if(now>expires+maxSkew)throw new Error('Consensus peer packet is stale or expired');
 const validatorSetRoot=validatorSetRootAtHeight(validatorSet,packet.height);
 if(validatorSetRoot!==args.expectedValidatorSetRoot||packet.validatorSetRoot!==validatorSetRoot)throw new Error('Consensus peer validator-set root mismatch');
 const peerRegistryRoot=peerRegistryRootAtHeight(peerRegistry,packet.height);
 if(peerRegistryRoot!==args.expectedPeerRegistryRoot||packet.peerRegistryRoot!==peerRegistryRoot)throw new Error('Consensus peer transport-registry root mismatch');
 const member=validatorSet.members.find(item=>item.validatorId===packet.senderValidatorId&&validatorActiveAtHeight(item,packet.height));
 if(!member)throw new Error('Consensus peer sender is not ACTIVE at height');
 const consensusKey=activeConsensusKeyAtHeight(member,packet.height);
 if(consensusKey.keyId!==packet.senderConsensusKeyId)throw new Error('Consensus peer CONSENSUS keyId mismatch');
 const transportKey=activePeerTransportKeyAtHeight(peerRegistry,packet.senderValidatorId,packet.height);
 if(transportKey.keyId!==packet.senderTransportKeyId)throw new Error('Consensus peer TRANSPORT keyId mismatch');
 const payloadHash=canonicalHash(packet.payload);
 if(payloadHash!==packet.payloadHash)throw new Error('Consensus peer payload hash mismatch');
 const inner=innerConsensusProof(packet);
 if(inner.messageHash!==packet.consensusMessageHash)throw new Error('Consensus peer inner messageHash mismatch');
 if(inner.signatureB64!==packet.consensusSignatureB64)throw new Error('Consensus peer packet signature does not exactly match inner PoVI proof');
 if(!verifyEd25519Hash(consensusKey.publicKeyDerB64,inner.messageHash,packet.consensusSignatureB64))throw new Error('Consensus peer CONSENSUS signature verification failed');
 const packetHash=consensusPeerPacketHash(packet);
 if(packetHash!==packet.packetHash)throw new Error('Consensus peer packet hash mismatch');
 if(!verifyEd25519Hash(transportKey.publicKeyDerB64,packetHash,packet.transportSignatureB64))throw new Error('Consensus peer TRANSPORT signature verification failed');
 return Object.freeze({
  valid:true,
  senderValidatorId:packet.senderValidatorId,
  height:packet.height,
  round:packet.round,
  step:packet.step,
  validatorSetRoot,
  peerRegistryRoot,
  consensusMessageHash:inner.messageHash,
  packetHash,
  safetyRecordHash:packet.safetyRecordHash,
  safetySequence:packet.safetySequence,
  safetyReferencePresent:true,
  persistBeforeSignVerified:false,
 });
}
