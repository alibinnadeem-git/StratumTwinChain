import fs from 'node:fs';
import crypto from 'node:crypto';

const vector=JSON.parse(fs.readFileSync('lib/redbook/test-vectors/snapshot-v1.json','utf8'));
const DOMAIN='STRATUM/SNAPSHOT/CERT/1';
const SET_DOMAIN='STRATUM/VALIDATOR_SET/1';
const SET_PROFILE='STRATUM-VALIDATOR-SET/1';

function canonicalize(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonicalize(value[k])}`).join(',')}}`;
}
function sha256(value){return crypto.createHash('sha256').update(value).digest('hex');}
function requiredQuorum(n){if(!Number.isInteger(n)||n<1)throw new Error('invalid validator count');return Math.floor((2*n)/3)+1;}
function activeAt(member,height){return member.activationHeight<=height&&(member.retirementHeight===null||member.retirementHeight>height);}
function activeKey(member,height){
  const keys=member.keys.filter(k=>k.purpose==='CONSENSUS'&&k.activeFromHeight<=height&&(k.retiredAtHeight===null||k.retiredAtHeight>height));
  if(keys.length!==1)throw new Error(`${member.validatorId} must have exactly one active consensus key`);
  return keys[0];
}
function validatorSetRoot(set,height){
  const validators=set.members.filter(m=>activeAt(m,height)).map(m=>{
    const key=activeKey(m,height);
    return {validatorId:m.validatorId,identityUuid:m.identityUuid,operatorOrg:m.operatorOrg,consensusKeyId:key.keyId,consensusPublicKeyDerB64:key.publicKeyDerB64};
  }).sort((a,b)=>a.validatorId.localeCompare(b.validatorId));
  return sha256(canonicalize({domain:SET_DOMAIN,profile:SET_PROFILE,chainId:set.chainId,height,validators}));
}
function certificatePayload(cert){const {signatures,...payload}=cert;return payload;}
function countValid(set,cert){
  const payload=Buffer.from(canonicalize(certificatePayload(cert)),'utf8');
  const active=new Map(set.members.filter(m=>activeAt(m,cert.snapshotHeight)).map(m=>[m.validatorId,m]));
  const valid=new Set();
  for(const sig of cert.signatures){
    const member=active.get(sig.signerId); if(!member)continue;
    const key=activeKey(member,cert.snapshotHeight);
    if(sig.keyId!==key.keyId||sig.domain!==DOMAIN||sig.algorithm!=='Ed25519')continue;
    const publicKey=crypto.createPublicKey({key:Buffer.from(key.publicKeyDerB64,'base64'),format:'der',type:'spki'});
    if(crypto.verify(null,payload,publicKey,Buffer.from(sig.signatureB64,'base64')))valid.add(sig.signerId);
  }
  return {valid:[...valid].sort(),activeCount:active.size};
}

const {validatorSet,certificate,expectedValidatorSetRoot}=vector;
const root=validatorSetRoot(validatorSet,certificate.snapshotHeight);
if(root!==expectedValidatorSetRoot)throw new Error(`validator-set root mismatch: ${root}`);
if(certificate.validatorSetRoot!==root)throw new Error('certificate does not bind expected validator-set root');
const checked=countValid(validatorSet,certificate);
const quorum=requiredQuorum(checked.activeCount);
if(quorum!==3)throw new Error(`expected 3-of-3 quorum, got ${quorum}`);
if(checked.valid.length<quorum)throw new Error(`snapshot quorum failed: ${checked.valid.length}/${quorum}`);

const onlyTwo={...certificate,signatures:certificate.signatures.slice(0,2)};
const two=countValid(validatorSet,onlyTwo);
if(two.valid.length>=requiredQuorum(two.activeCount))throw new Error('2-of-3 snapshot signatures must not satisfy PoVI quorum');

const tampered={...certificate,stateRoot:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'};
const tamperedResult=countValid(validatorSet,tampered);
if(tamperedResult.valid.length!==0)throw new Error('tampered snapshot payload unexpectedly retained valid signatures');

const implementation=fs.readFileSync('lib/redbook/snapshot-trust.ts','utf8');
for(const token of [
  "SNAPSHOT_CERTIFICATE_DOMAIN",
  "VALIDATOR_SET_ROOT_DOMAIN",
  "requiredPoviQuorum",
  "expectedValidatorSetRoot",
  "exactly one active CONSENSUS key",
  "Snapshot PoVI quorum not met"
]) if(!implementation.includes(token))throw new Error(`Missing snapshot trust invariant: ${token}`);

console.log(`Snapshot conformance passed: height ${certificate.snapshotHeight}, root ${root}, quorum ${quorum}/${checked.activeCount}`);
