import {readFileSync} from 'node:fs';
import {expect,test} from '@playwright/test';
import {
 consensusPeerPacketHash,
 peerRegistryRootAtHeight,
 validatorSetRootAtHeight,
 verifyConsensusPeerPacket,
} from '../../lib/redbook';

const vector=JSON.parse(readFileSync('lib/redbook/test-vectors/consensus-peer-v1.json','utf8')) as {
 validatorSet:unknown;
 peerRegistry:unknown;
 packet:{height:number;sequence:number;nonce:string;payload:{proposalHash:string};packetHash:string};
 expected:{validatorSetRoot:string;peerRegistryRoot:string;consensusMessageHash:string;packetHash:string};
};
const now=new Date('2026-09-13T23:00:30.000Z');

function verify(packet:unknown,lastAcceptedSequence=0,seenNonces:ReadonlySet<string>=new Set()){
 return verifyConsensusPeerPacket({
  validatorSet:vector.validatorSet,
  peerRegistry:vector.peerRegistry,
  packet,
  expectedChainId:'stratum-devnet-1',
  expectedNetworkName:'STRATUM Devnet',
  expectedGenesisDIRHash:'1'.repeat(64),
  expectedProtocolVersion:'POVI/1',
  expectedValidatorSetRoot:vector.expected.validatorSetRoot,
  expectedPeerRegistryRoot:vector.expected.peerRegistryRoot,
  now,
  maxClockSkewMs:30_000,
  lastAcceptedSequence,
  seenNonces,
 });
}

test('consensus peer verifier authenticates PoVI CONSENSUS and TRANSPORT signatures without overclaiming persist-before-sign',()=>{
 expect(validatorSetRootAtHeight(vector.validatorSet,12)).toBe(vector.expected.validatorSetRoot);
 expect(peerRegistryRootAtHeight(vector.peerRegistry,12)).toBe(vector.expected.peerRegistryRoot);
 expect(consensusPeerPacketHash(vector.packet)).toBe(vector.expected.packetHash);
 const result=verify(vector.packet);
 expect(result.valid).toBeTruthy();
 expect(result.consensusMessageHash).toBe(vector.expected.consensusMessageHash);
 expect(result.packetHash).toBe(vector.expected.packetHash);
 expect(result.safetyReferencePresent).toBeTruthy();
 expect(result.persistBeforeSignVerified).toBeFalsy();
});

test('consensus peer verifier rejects replay watermark and nonce replay',()=>{
 expect(()=>verify(vector.packet,vector.packet.sequence)).toThrow(/replay\/rollback/i);
 expect(()=>verify(vector.packet,0,new Set([vector.packet.nonce]))).toThrow(/nonce replay/i);
});

test('consensus peer verifier rejects payload tampering before consensus processing',()=>{
 const tampered=structuredClone(vector.packet);
 tampered.payload.proposalHash='4'.repeat(64);
 expect(()=>verify(tampered)).toThrow(/payload hash mismatch/i);
});

test('consensus peer verifier rejects forged PoVI and transport signatures',()=>{
 const badConsensus=structuredClone(vector.packet) as any;
 badConsensus.payload.signatureB64='AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
 badConsensus.consensusSignatureB64=badConsensus.payload.signatureB64;
 expect(()=>verify(badConsensus)).toThrow(/CONSENSUS signature verification failed|payload hash mismatch/i);

 const badTransport=structuredClone(vector.packet) as any;
 badTransport.transportSignatureB64='AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
 expect(()=>verify(badTransport)).toThrow(/TRANSPORT signature verification failed/i);
});

test('consensus peer verifier rejects wrong network trust context',()=>{
 expect(()=>verifyConsensusPeerPacket({
  validatorSet:vector.validatorSet,
  peerRegistry:vector.peerRegistry,
  packet:vector.packet,
  expectedChainId:'stratum-devnet-1',
  expectedNetworkName:'wrong-network',
  expectedGenesisDIRHash:'1'.repeat(64),
  expectedProtocolVersion:'POVI/1',
  expectedValidatorSetRoot:vector.expected.validatorSetRoot,
  expectedPeerRegistryRoot:vector.expected.peerRegistryRoot,
  now,lastAcceptedSequence:0,seenNonces:new Set<string>(),
 })).toThrow(/networkName mismatch/i);
});
