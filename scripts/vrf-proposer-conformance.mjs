import fs from 'node:fs';
import crypto from 'node:crypto';

const PROFILE='STRATUM-POVI-PROPOSER/1';
const SELECT_DOMAIN='STRATUM/POVI/PROPOSER_SELECTION/1';
const VRF_DOMAIN='STRATUM/POVI/VRF_EVIDENCE/1';
const REGISTRY_PROFILE='STRATUM-VRF-KEY-REGISTRY/1';
const REGISTRY_DOMAIN='STRATUM/VRF_KEY_REGISTRY/1';
const VALIDATOR_SET_PROFILE='STRATUM-VALIDATOR-SET/1';
const VALIDATOR_SET_DOMAIN='STRATUM/VALIDATOR_SET/1';

function canonicalize(value){
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return `[${value.map(canonicalize).join(',')}]`;
 return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
}
function hash(value){return crypto.createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:canonicalize(value)).digest('hex');}
function active(member,height){return member.activationHeight<=height&&(member.retirementHeight===null||member.retirementHeight>height);}
function activeConsensusKey(member,height){const keys=member.keys.filter(key=>key.activeFromHeight<=height&&(key.retiredAtHeight===null||key.retiredAtHeight>height));if(keys.length!==1)throw new Error(`invalid CONSENSUS key count for ${member.validatorId}`);return keys[0];}
function validatorSetRoot(set,height){
 const validators=set.members.filter(member=>active(member,height)).map(member=>{const key=activeConsensusKey(member,height);return{validatorId:member.validatorId,identityUuid:member.identityUuid,operatorOrg:member.operatorOrg,consensusKeyId:key.keyId,consensusPublicKeyDerB64:key.publicKeyDerB64};}).sort((a,b)=>a.validatorId.localeCompare(b.validatorId));
 return hash({domain:VALIDATOR_SET_DOMAIN,profile:VALIDATOR_SET_PROFILE,chainId:set.chainId,height,validators});
}
function activeVRFKey(registry,validatorId,height){const item=registry.validators.find(v=>v.validatorId===validatorId);if(!item)throw new Error(`missing VRF history ${validatorId}`);const keys=item.keys.filter(key=>key.activeFromHeight<=height&&(key.retiredAtHeight===null||key.retiredAtHeight>height));if(keys.length!==1)throw new Error(`invalid VRF key count for ${validatorId}`);return keys[0];}
function registryRoot(registry,height){const validators=registry.validators.map(item=>{const key=activeVRFKey(registry,item.validatorId,height);return{validatorId:item.validatorId,keyId:key.keyId,algorithm:key.algorithm,publicKeyDerB64:key.publicKeyDerB64};}).sort((a,b)=>a.validatorId.localeCompare(b.validatorId));return hash({domain:REGISTRY_DOMAIN,profile:REGISTRY_PROFILE,chainId:registry.chainId,height,validators});}
function selectionSeed(context){return hash({domain:SELECT_DOMAIN,profileVersion:PROFILE,chainId:context.chainId,height:context.height,round:context.round,previousDIRHash:context.previousDIRHash,previousEntropy:context.previousEntropy,validatorSetRoot:context.validatorSetRoot,vrfKeyRegistryRoot:context.vrfKeyRegistryRoot,protocolVersion:context.protocolVersion});}
function select(set,context){const ids=set.members.filter(member=>active(member,context.height)).map(member=>member.validatorId).sort();if(ids.length<1)throw new Error('no ACTIVE validators');const seed=selectionSeed(context);const index=Number(BigInt(`0x${seed}`)%BigInt(ids.length));return{seed,index,proposerId:ids[index],ids};}
function messageHash(e){return hash({domain:VRF_DOMAIN,profileVersion:PROFILE,chainId:e.chainId,height:e.height,round:e.round,previousDIRHash:e.previousDIRHash,previousEntropy:e.previousEntropy,validatorSetRoot:e.validatorSetRoot,vrfKeyRegistryRoot:e.vrfKeyRegistryRoot,protocolVersion:e.protocolVersion,proposerId:e.proposerId,keyId:e.keyId,selectionSeed:e.selectionSeed});}
function verify(vector){
 const {validatorSet:set,vrfKeyRegistry:registry,evidence:e}=vector;
 if(e.profileVersion!==PROFILE||e.domain!==VRF_DOMAIN)throw new Error('profile/domain mismatch');
 if(set.chainId!==e.chainId||registry.chainId!==e.chainId)throw new Error('chain mismatch');
 const vsRoot=validatorSetRoot(set,e.height);if(vsRoot!==vector.expectedValidatorSetRoot||e.validatorSetRoot!==vsRoot)throw new Error('validator-set root mismatch');
 const vrfRoot=registryRoot(registry,e.height);if(vrfRoot!==vector.expectedVRFKeyRegistryRoot||e.vrfKeyRegistryRoot!==vrfRoot)throw new Error('VRF registry root mismatch');
 const activeIds=set.members.filter(member=>active(member,e.height)).map(member=>member.validatorId).sort();const registryIds=registry.validators.map(v=>v.validatorId).sort();if(JSON.stringify(activeIds)!==JSON.stringify(registryIds))throw new Error('VRF registry coverage mismatch');
 const selected=select(set,{profileVersion:PROFILE,chainId:e.chainId,height:e.height,round:e.round,previousDIRHash:e.previousDIRHash,previousEntropy:e.previousEntropy,validatorSetRoot:e.validatorSetRoot,vrfKeyRegistryRoot:e.vrfKeyRegistryRoot,protocolVersion:e.protocolVersion});
 if(e.selectionSeed!==selected.seed||e.proposerId!==selected.proposerId)throw new Error('selected proposer mismatch');
 const key=activeVRFKey(registry,e.proposerId,e.height);if(e.keyId!==key.keyId)throw new Error('VRF key mismatch');
 const msg=messageHash(e);if(msg!==e.messageHash)throw new Error('message hash mismatch');
 const pub=crypto.createPublicKey({key:Buffer.from(key.publicKeyDerB64,'base64'),format:'der',type:'spki'});const proof=Buffer.from(e.proofB64,'base64');if(!crypto.verify(null,Buffer.from(msg,'hex'),pub,proof))throw new Error('proof signature invalid');
 const output=hash(proof);if(output!==e.vrfOutput)throw new Error('VRF output mismatch');
 return{selected,output,vsRoot,vrfRoot};
}
function mustFail(label,fn){let failed=false;try{fn();}catch{failed=true;}if(!failed)throw new Error(`negative test did not fail: ${label}`);}

const vector=JSON.parse(fs.readFileSync(new URL('../lib/redbook/test-vectors/vrf-proposer-v1.json',import.meta.url),'utf8'));
const result=verify(vector);
if(result.selected.seed!==vector.expectedSelection.selectionSeed||result.selected.proposerId!==vector.expectedSelection.proposerId||result.selected.index!==vector.expectedSelection.proposerIndex)throw new Error('fixed proposer vector mismatch');
mustFail('wrong proposer',()=>verify({...vector,evidence:{...vector.evidence,proposerId:'validator-a'}}));
mustFail('tampered proof',()=>verify({...vector,evidence:{...vector.evidence,proofB64:Buffer.alloc(64,7).toString('base64')}}));
mustFail('wrong VRF root',()=>verify({...vector,expectedVRFKeyRegistryRoot:'0'.repeat(64)}));
mustFail('incomplete VRF registry',()=>verify({...vector,vrfKeyRegistry:{...vector.vrfKeyRegistry,validators:vector.vrfKeyRegistry.validators.slice(0,2)}}));
mustFail('tampered previous entropy',()=>verify({...vector,evidence:{...vector.evidence,previousEntropy:'f'.repeat(64)}}));
const higherRound={...vector.context,round:2};const higherSelected=select(vector.validatorSet,higherRound);if(higherSelected.seed===result.selected.seed)throw new Error('round must domain-separate proposer seed');
console.log(`PoVI proposer profile conformance OK: round 0 proposer ${result.selected.proposerId}; round 2 proposer ${higherSelected.proposerId}`);
console.log('NOTE: Ed25519-Deterministic-Entropy-v1 is a STRATUM implementation profile, not RFC 9381 ECVRF.');
