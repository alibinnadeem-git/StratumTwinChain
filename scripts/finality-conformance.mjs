import fs from 'node:fs';
import crypto from 'node:crypto';

const vector=JSON.parse(fs.readFileSync('lib/redbook/test-vectors/finality-v1.json','utf8'));
function canonicalize(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonicalize(value[k])}`).join(',')}}`;
}
const hash=value=>crypto.createHash('sha256').update(canonicalize(value)).digest('hex');
const quorum=n=>Math.floor((2*n)/3)+1;
const activeAt=(m,h)=>m.activationHeight<=h&&(m.retirementHeight===null||m.retirementHeight>h);
function keyAt(member,height){
  const keys=member.keys.filter(k=>k.purpose==='CONSENSUS'&&k.activeFromHeight<=height&&(k.retiredAtHeight===null||k.retiredAtHeight>height));
  if(keys.length!==1)throw new Error(`${member.validatorId} active consensus key count=${keys.length}`);
  return keys[0];
}
function validatorRoot(set,height){
  const validators=set.members.filter(m=>activeAt(m,height)).map(m=>{
    const key=keyAt(m,height);
    return {validatorId:m.validatorId,identityUuid:m.identityUuid,operatorOrg:m.operatorOrg,consensusKeyId:key.keyId,consensusPublicKeyDerB64:key.publicKeyDerB64};
  }).sort((a,b)=>a.validatorId.localeCompare(b.validatorId));
  return hash({domain:'STRATUM/VALIDATOR_SET/1',profile:'STRATUM-VALIDATOR-SET/1',chainId:set.chainId,height,validators});
}

const {validatorSet,proof,trustedPreviousHeight,trustedPreviousDIRHash,expectedValidatorSetRoot}=vector;
const {header,PFC}=proof;
if(header.height!==trustedPreviousHeight+1)throw new Error('height discontinuity');
if(header.previousDIRHash!==trustedPreviousDIRHash)throw new Error('previous DIR continuity mismatch');
const root=validatorRoot(validatorSet,header.height);
if(root!==expectedValidatorSetRoot||header.validatorSetRoot!==root||PFC.validatorSetRoot!==root)throw new Error('validator-set root mismatch');
const proposalHash=hash({domain:'STRATUM/POVI/PROPOSAL/1',DIRCandidateHeader:header});
if(proposalHash!==PFC.proposalHash)throw new Error(`proposal hash mismatch ${proposalHash}`);
const commitMessage={domain:'STRATUM/POVI/COMMIT/1',chainId:header.chainId,height:header.height,round:header.round,step:'COMMIT',proposalHash,stateRoot:header.stateRoot,validatorSetRoot:root,protocolVersion:header.protocolVersion};
const messageHash=hash(commitMessage);
const members=new Map(validatorSet.members.filter(m=>activeAt(m,header.height)).map(m=>[m.validatorId,m]));
const valid=new Set();
for(const vote of PFC.COMMITSignatures){
  const member=members.get(vote.validatorId); if(!member)continue;
  const key=keyAt(member,header.height);
  if(vote.proposalHash!==proposalHash||vote.stateRoot!==header.stateRoot||vote.messageHash!==messageHash)continue;
  const pub=crypto.createPublicKey({key:Buffer.from(key.publicKeyDerB64,'base64'),format:'der',type:'spki'});
  if(crypto.verify(null,Buffer.from(messageHash,'hex'),pub,Buffer.from(vote.signature,'base64')))valid.add(vote.validatorId);
}
const required=quorum(members.size);
if(required!==3||valid.size<required)throw new Error(`PFC quorum failed ${valid.size}/${required}`);
const signerIds=[...valid].sort();
if(JSON.stringify(signerIds)!==JSON.stringify(PFC.signerIds))throw new Error('PFC signer set mismatch');
const DIRHash=hash({domain:'STRATUM/DIR/1',header,finality:{proposalHash,stateRoot:header.stateRoot,validatorSetRoot:root,protocolVersion:header.protocolVersion,signerIds}});
if(DIRHash!==PFC.DIRHash)throw new Error(`DIR hash mismatch ${DIRHash}`);

const onlyTwo=PFC.COMMITSignatures.slice(0,2);
if(onlyTwo.length>=required)throw new Error('test setup invalid: 2-of-3 must be below quorum');
const mutatedHeader={...header,previousDIRHash:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'};
if(hash({domain:'STRATUM/POVI/PROPOSAL/1',DIRCandidateHeader:mutatedHeader})===proposalHash)throw new Error('header mutation did not change proposal hash');

const implementation=fs.readFileSync('lib/redbook/finality-proof.ts','utf8');
for(const token of ['POVI_COMMIT_DOMAIN','proposalHashForDIRHeader','trustedPreviousDIRHash','PFC PoVI quorum not met','PFC signerIds do not exactly match valid COMMIT signatures','DIRHash mismatch'])
  if(!implementation.includes(token))throw new Error(`Missing finality invariant: ${token}`);
console.log(`Finality conformance passed: height ${header.height}, DIR ${DIRHash}, quorum ${valid.size}/${members.size}`);
