import fs from 'node:fs';
import crypto from 'node:crypto';

const vector=JSON.parse(fs.readFileSync('lib/redbook/test-vectors/proposer-selection-v1.json','utf8'));
function canonicalize(value){if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return `[${value.map(canonicalize).join(',')}]`;return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonicalize(value[k])}`).join(',')}}`;}
const hash=value=>crypto.createHash('sha256').update(canonicalize(value)).digest('hex');
const activeAt=(m,h)=>m.activationHeight<=h&&(m.retirementHeight===null||m.retirementHeight>h);
function keyAt(member,height){const keys=member.keys.filter(k=>k.purpose==='CONSENSUS'&&k.algorithm==='Ed25519'&&k.activeFromHeight<=height&&(k.retiredAtHeight===null||k.retiredAtHeight>height));if(keys.length!==1)throw new Error(`${member.validatorId} active consensus key count=${keys.length}`);return keys[0];}
function validatorRoot(set,height){const validators=set.members.filter(m=>activeAt(m,height)).map(m=>{const key=keyAt(m,height);return{validatorId:m.validatorId,identityUuid:m.identityUuid,operatorOrg:m.operatorOrg,consensusKeyId:key.keyId,consensusPublicKeyDerB64:key.publicKeyDerB64};}).sort((a,b)=>a.validatorId.localeCompare(b.validatorId));return hash({domain:'STRATUM/VALIDATOR_SET/1',profile:'STRATUM-VALIDATOR-SET/1',chainId:set.chainId,height,validators});}
function score(selection,candidate){return hash({domain:'STRATUM/POVI/PROPOSER_SELECTION/1',profile:'STRATUM-PROPOSER-SELECTION/1',chainId:selection.chainId,height:selection.height,round:selection.round,validatorSetRoot:selection.validatorSetRoot,protocolVersion:selection.protocolVersion,collectiveEntropy:selection.collectiveEntropy,validatorId:candidate.validatorId,vrfOutput:candidate.vrfOutput});}
function select(set,selection){
 if(selection.collectiveEntropyVerifiedExternally!==true)throw new Error('collective entropy must be externally verified');
 if(!Array.isArray(selection.collectiveEntropyProofRefs)||selection.collectiveEntropyProofRefs.length<1)throw new Error('collective entropy proof reference required');
 const root=validatorRoot(set,selection.height);if(root!==selection.validatorSetRoot)throw new Error('validator-set root mismatch');
 const activeIds=set.members.filter(m=>activeAt(m,selection.height)).map(m=>m.validatorId).sort();
 const seen=new Set();for(const c of selection.candidates){if(c.vrfProofVerifiedExternally!==true)throw new Error(`VRF output for ${c.validatorId} is not externally verified`);if(!c.vrfProofRef)throw new Error(`VRF proof reference missing for ${c.validatorId}`);if(seen.has(c.validatorId))throw new Error(`duplicate proposer candidate ${c.validatorId}`);seen.add(c.validatorId);}
 const candidateIds=[...seen].sort();if(activeIds.length!==candidateIds.length||activeIds.some((id,i)=>id!==candidateIds[i]))throw new Error('equal eligible opportunity requires exactly one candidate per ACTIVE validator');
 const scores=selection.candidates.map(c=>({validatorId:c.validatorId,score:score(selection,c)})).sort((a,b)=>a.score.localeCompare(b.score)||a.validatorId.localeCompare(b.validatorId));
 return{root,scores,winner:scores[0]};
}

const {validatorSet,selection,expected}=vector;
const got=select(validatorSet,selection);
if(got.root!==selection.validatorSetRoot)throw new Error(`validator-set root mismatch ${got.root}`);
if(got.winner.validatorId!==expected.selectedProposerId||got.winner.score!==expected.selectedScore)throw new Error(`unexpected proposer ${got.winner.validatorId}/${got.winner.score}`);
for(const item of got.scores)if(expected.candidateScores[item.validatorId]!==item.score)throw new Error(`candidate score drift for ${item.validatorId}`);
if(got.scores.length!==expected.eligibleValidatorCount)throw new Error('eligible validator count drift');

let rejected=false;try{select(validatorSet,{...selection,candidates:selection.candidates.slice(0,2)});}catch{rejected=true;}if(!rejected)throw new Error('missing ACTIVE validator candidate was not rejected');
rejected=false;try{select(validatorSet,{...selection,candidates:[...selection.candidates,selection.candidates[0]]});}catch{rejected=true;}if(!rejected)throw new Error('duplicate proposer candidate was not rejected');
rejected=false;try{select(validatorSet,{...selection,collectiveEntropyVerifiedExternally:false});}catch{rejected=true;}if(!rejected)throw new Error('unverified collective entropy was not rejected');
rejected=false;try{const candidates=structuredClone(selection.candidates);candidates[1].vrfProofVerifiedExternally=false;select(validatorSet,{...selection,candidates});}catch{rejected=true;}if(!rejected)throw new Error('unverified VRF output was not rejected');
const changedEntropy={...selection,collectiveEntropy:'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'};const changed=select(validatorSet,changedEntropy);if(changed.scores.every((item,i)=>item.score===got.scores[i].score))throw new Error('collective entropy does not affect selection scores');
const roundChanged=select(validatorSet,{...selection,round:selection.round+1});if(roundChanged.scores.every((item,i)=>item.score===got.scores[i].score))throw new Error('round does not bind proposer selection scores');

const schema=fs.readFileSync('lib/redbook/schema/proposer.ts','utf8');
for(const token of ['STRATUM-PROPOSER-SELECTION/1','STRATUM/POVI/PROPOSER_SELECTION/1','vrfProofVerifiedExternally:z.literal(true)','collectiveEntropyVerifiedExternally:z.literal(true)','cryptographicVRFConformant:z.literal(false)'])if(!schema.includes(token))throw new Error(`Missing proposer schema invariant: ${token}`);
const implementation=fs.readFileSync('lib/redbook/povi/proposer.ts','utf8');
for(const token of ['exactly one externally verified VRF candidate for every ACTIVE validator','vrfProofVerification:\'EXTERNAL_VERIFIED_INPUT\'','cryptographicVRFConformant:false'])if(!implementation.includes(token))throw new Error(`Missing proposer implementation invariant: ${token}`);
console.log(`Proposer-selection implementation-profile conformance passed: ${got.winner.validatorId}, score ${got.winner.score}, N=${got.scores.length}; cryptographic VRF proof verification remains external`);
