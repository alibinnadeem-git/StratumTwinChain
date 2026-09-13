import {canonicalHash} from '@/lib/server/hash';
import {
 PEER_TRANSPORT_REGISTRY_DOMAIN,
 PEER_TRANSPORT_REGISTRY_PROFILE,
 peerTransportRegistrySchema,
 type PeerTransportRegistry,
} from './schema/peer-transport';

export function peerTransportKeyActiveAtHeight(key:PeerTransportRegistry['members'][number]['keys'][number],height:number){
 return key.activeFromHeight<=height&&(key.retiredAtHeight===null||key.retiredAtHeight>height);
}

export function activePeerTransportKeyAtHeight(registryInput:PeerTransportRegistry|unknown,validatorId:string,height:number){
 const registry=peerTransportRegistrySchema.parse(registryInput);
 if(!Number.isInteger(height)||height<0)throw new Error('height must be a non-negative integer');
 const member=registry.members.find(item=>item.validatorId===validatorId);
 if(!member)throw new Error(`Unknown peer validator ${validatorId}`);
 const keys=member.keys.filter(key=>peerTransportKeyActiveAtHeight(key,height));
 if(keys.length!==1)throw new Error(`Validator ${validatorId} must have exactly one active TRANSPORT key at height ${height}; found ${keys.length}`);
 return keys[0];
}

export function canonicalPeerRegistryAtHeight(input:PeerTransportRegistry|unknown,height:number){
 const registry=peerTransportRegistrySchema.parse(input);
 if(!Number.isInteger(height)||height<0)throw new Error('height must be a non-negative integer');
 const members=registry.members.map(member=>{
  const key=activePeerTransportKeyAtHeight(registry,member.validatorId,height);
  return{
   validatorId:member.validatorId,
   keyId:key.keyId,
   algorithm:key.algorithm,
   publicKeyDerB64:key.publicKeyDerB64,
  };
 }).sort((a,b)=>a.validatorId.localeCompare(b.validatorId));
 return{
  domain:PEER_TRANSPORT_REGISTRY_DOMAIN,
  profile:PEER_TRANSPORT_REGISTRY_PROFILE,
  chainId:registry.chainId,
  GenesisDIRHash:registry.GenesisDIRHash.toLowerCase(),
  protocolVersion:registry.protocolVersion,
  height,
  members,
 };
}

export function peerRegistryRootAtHeight(input:PeerTransportRegistry|unknown,height:number){
 return canonicalHash(canonicalPeerRegistryAtHeight(input,height));
}
