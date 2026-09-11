import fs from 'node:fs';
import crypto from 'node:crypto';

const vector=JSON.parse(fs.readFileSync(new URL('../lib/redbook/test-vectors/proposer-v1.json',import.meta.url),'utf8'));

function canonicalize(value){
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return `[${value.map(canonicalize).join(',')}]`;
 return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
}
function hash(value){return crypto.createHash('sha256').update(canonicalize(value)).digest('hex');}
function activeAt(member,height){return member.activationHeight<=height&&(member.retirementHeight===null||member.retirementHeight>height);}
function keyAt(member,height){
 const keys=member.keys.filter(key=>key.activeFromHeight<=height&&(key.retiredAtHeight===null||key.retiredAtHeight>height));
 if(keys.length!==1)throw new Error(`Expected exactly one active CONSENSUS key for ${member.validatorId}`);
 return keys[0];
}
function canonicalSet(set,height){
 const validators=set.members.filter(member=>activeAt(member,height)).map(member=>{
  const key=keyAt(member,height);
  return {validatorId:member.validatorId,identityUuid:member.identityUuid,operatorOrg:member.operatorOrg,consensusKeyId:key.keyId,consensusPublicKeyDerB64:key.publicKeyDerB64};
 }).sort((a,b)=>a.validatorId.localeCompare(b.validatorId));
 return {domain:'STRATUM/VALIDATOR_SET/1',profile:'STRATUM-VALIDATOR-SET/1',chainId:set.chainId,height,validators};
}
function calculate(context,set){
 const validatorSetRoot=hash(canonicalSet(set,context.height));
 if(validatorSetRoot!==context.validatorSetRoot)throw new Error(`validatorSetRoot mismatch: ${validatorSetRoot}`);
 const ids=canonicalSet(set,context.height).validators.map(v=>v.validatorId);
 const seedHash=hash({
  domain:'STRATUM/POVI/PROPOSER/ENTROPY/1',profile:context.profile,chainId:context.chainId,height:context.height,round:context.round,
  previousDIRHash:context.previousDIRHash,validatorSetRoot:context.validatorSetRoot,protocolVersion:context.protocolVersion,
 });
 const selectedIndex=Number(BigInt(`0x${seedHash}`)%BigInt(ids.length));
 return {profile:'STRATUM-POVI-PROPOSER/1',mode:'HASH_CHAINED_FINALIZED_ENTROPY',seedHash,activeValidatorIdsHash:hash(ids),selectedIndex,proposerId:ids[selectedIndex]};
}

const actual=calculate(vector.context,vector.validatorSet);
if(canonicalize(actual)!==canonicalize(vector.expectedEvidence))throw new Error(`Proposer vector mismatch\nexpected ${canonicalize(vector.expectedEvidence)}\nactual   ${canonicalize(actual)}`);

for(const mutation of [
 {...vector.context,round:vector.context.round+1},
 {...vector.context,height:vector.context.height+1},
 {...vector.context,previousDIRHash:'2'.repeat(64)},
]){
 const seed=hash({domain:'STRATUM/POVI/PROPOSER/ENTROPY/1',profile:mutation.profile,chainId:mutation.chainId,height:mutation.height,round:mutation.round,previousDIRHash:mutation.previousDIRHash,validatorSetRoot:mutation.validatorSetRoot,protocolVersion:mutation.protocolVersion});
 if(seed===vector.expectedEvidence.seedHash)throw new Error('Context mutation did not alter proposer seed');
}

console.log(`OK: proposer profile selects ${actual.proposerId} at height ${vector.context.height} round ${vector.context.round}`);
console.log('OK: chain/height/round/previous-DIR context is domain-separated into the selection seed');
console.log('NOTE: HASH_CHAINED_FINALIZED_ENTROPY is a deterministic P0 test profile, not production VRF conformance.');
