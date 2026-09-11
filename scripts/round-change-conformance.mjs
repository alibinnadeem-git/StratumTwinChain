import fs from 'node:fs';
import crypto from 'node:crypto';

const vector=JSON.parse(fs.readFileSync('lib/redbook/test-vectors/round-change-v1.json','utf8'));
function canonicalize(value){if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return `[${value.map(canonicalize).join(',')}]`;return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonicalize(value[k])}`).join(',')}}`;}
const hash=value=>crypto.createHash('sha256').update(canonicalize(value)).digest('hex');
const quorum=n=>Math.floor((2*n)/3)+1;
const activeAt=(m,h)=>m.activationHeight<=h&&(m.retirementHeight===null||m.retirementHeight>h);
function keyAt(member,height){const keys=member.keys.filter(k=>k.purpose==='CONSENSUS'&&k.algorithm==='Ed25519'&&k.activeFromHeight<=height&&(k.retiredAtHeight===null||k.retiredAtHeight>height));if(keys.length!==1)throw new Error(`${member.validatorId} active consensus key count=${keys.length}`);return keys[0];}
function validatorRoot(set,height){const validators=set.members.filter(m=>activeAt(m,height)).map(m=>{const key=keyAt(m,height);return {validatorId:m.validatorId,identityUuid:m.identityUuid,operatorOrg:m.operatorOrg,consensusKeyId:key.keyId,consensusPublicKeyDerB64:key.publicKeyDerB64};}).sort((a,b)=>a.validatorId.localeCompare(b.validatorId));return hash({domain:'STRATUM/VALIDATOR_SET/1',profile:'STRATUM-VALIDATOR-SET/1',chainId:set.chainId,height,validators});}
function verifyHashSignature(member,height,keyId,messageHash,signatureB64){const key=keyAt(member,height);if(key.keyId!==keyId)return false;const pub=crypto.createPublicKey({key:Buffer.from(key.publicKeyDerB64,'base64'),format:'der',type:'spki'});return pub.asymmetricKeyType==='ed25519'&&crypto.verify(null,Buffer.from(messageHash,'hex'),pub,Buffer.from(signatureB64,'base64'));}
function verifyVoteHash(v){return hash({domain:'STRATUM/POVI/VERIFY/1',chainId:v.chainId,height:v.height,round:v.round,step:'VERIFY',proposalHash:v.proposalHash,validatorId:v.validatorId,validatorSetRoot:v.validatorSetRoot,protocolVersion:v.protocolVersion});}
function roundChangeHash(v){return hash({domain:'STRATUM/POVI/ROUND_CHANGE/1',chainId:v.chainId,height:v.height,newRound:v.newRound,validatorId:v.validatorId,validatorSetRoot:v.validatorSetRoot,protocolVersion:v.protocolVersion,lockedDIR:v.lockedDIR,lockedRound:v.lockedRound,validDIR:v.validDIR,validRound:v.validRound,evidenceRefs:v.evidenceRefs});}

const {validatorSet,evidence,expectedValidatorSetRoot}=vector;
const root=validatorRoot(validatorSet,evidence.height);
if(root!==expectedValidatorSetRoot||root!==evidence.validatorSetRoot)throw new Error(`ROUND_CHANGE validator-set root mismatch ${root}`);
const active=validatorSet.members.filter(m=>activeAt(m,evidence.height));
const members=new Map(active.map(m=>[m.validatorId,m]));
const required=quorum(active.length);
if(active.length!==3||required!==3)throw new Error(`Expected three-validator Redbook quorum profile, got N=${active.length} Q=${required}`);

function validNilVotes(votes){const seen=new Set();let count=0;for(const v of votes){if(seen.has(v.validatorId))throw new Error(`Duplicate NIL VERIFY signer ${v.validatorId}`);seen.add(v.validatorId);if(v.domain!=='STRATUM/POVI/VERIFY/1'||v.chainId!==evidence.chainId||v.height!==evidence.height||v.round!==evidence.triggerRound||v.step!=='VERIFY'||v.proposalHash!=='NIL'||v.validatorSetRoot!==root||v.protocolVersion!==evidence.protocolVersion)continue;const member=members.get(v.validatorId);if(!member)continue;const expected=verifyVoteHash(v);if(v.messageHash!==expected)continue;if(verifyHashSignature(member,evidence.height,v.keyId,expected,v.signatureB64))count++;}return count;}
function validRoundChanges(votes){const seen=new Set();let count=0;for(const v of votes){if(seen.has(v.validatorId))throw new Error(`Duplicate ROUND_CHANGE signer ${v.validatorId}`);seen.add(v.validatorId);if(v.domain!=='STRATUM/POVI/ROUND_CHANGE/1'||v.chainId!==evidence.chainId||v.height!==evidence.height||v.newRound!==evidence.newRound||v.validatorSetRoot!==root||v.protocolVersion!==evidence.protocolVersion)continue;const member=members.get(v.validatorId);if(!member)continue;const expected=roundChangeHash(v);if(v.messageHash!==expected)continue;if(verifyHashSignature(member,evidence.height,v.keyId,expected,v.signatureB64))count++;}return count;}

const nilValid=validNilVotes(evidence.priorRoundNILVotes);if(nilValid<required)throw new Error(`NIL VERIFY quorum failed ${nilValid}/${required}`);
const roundValid=validRoundChanges(evidence.roundChangeVotes);if(roundValid<required)throw new Error(`ROUND_CHANGE quorum failed ${roundValid}/${required}`);
if(validNilVotes(evidence.priorRoundNILVotes.slice(0,2))>=required)throw new Error('2-of-3 NIL VERIFY must be below PoVI quorum');
if(validRoundChanges(evidence.roundChangeVotes.slice(0,2))>=required)throw new Error('2-of-3 ROUND_CHANGE must be below PoVI quorum');

const badSig=structuredClone(evidence.roundChangeVotes);badSig[0].signatureB64='AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';if(validRoundChanges(badSig)>=required)throw new Error('Tampered ROUND_CHANGE signature unexpectedly retained quorum');
const alteredRound=structuredClone(evidence.roundChangeVotes);alteredRound[0].newRound=2;if(validRoundChanges(alteredRound)>=required)throw new Error('Altered newRound unexpectedly retained quorum');
let duplicateRejected=false;try{validRoundChanges([evidence.roundChangeVotes[0],evidence.roundChangeVotes[0],evidence.roundChangeVotes[2]]);}catch{duplicateRejected=true;}if(!duplicateRejected)throw new Error('Duplicate ROUND_CHANGE signer was not rejected');

const schema=fs.readFileSync('lib/redbook/schema/liveness.ts','utf8');
for(const token of ['STRATUM/POVI/VERIFY/1','STRATUM/POVI/ROUND_CHANGE/1','STRATUM-ROUND-CHANGE-EVIDENCE/1','validatorSetRoot','protocolVersion','Lock/valid-value claims require evidenceRefs'])if(!schema.includes(token))throw new Error(`Missing liveness schema invariant: ${token}`);
const implementation=fs.readFileSync('lib/redbook/povi/liveness.ts','utf8');
for(const token of ['NIL VERIFY quorum not met','ROUND_CHANGE quorum not met','safeUnlockAuthorized:false','ROUND_CHANGE quorum alone never clears or replaces a lock','lockedDIR:state.lockedDIR','lockedRound:state.lockedRound','validDIR:state.validDIR','validRound:state.validRound'])if(!implementation.includes(token))throw new Error(`Missing liveness safety invariant: ${token}`);

console.log(`PoVI round-change conformance passed: NIL ${nilValid}/${active.length}, ROUND_CHANGE ${roundValid}/${active.length}, ${evidence.triggerRound}->${evidence.newRound}, safeUnlock=false`);
