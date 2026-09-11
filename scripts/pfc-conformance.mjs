import fs from 'node:fs';
import crypto from 'node:crypto';

const vector=JSON.parse(fs.readFileSync('lib/redbook/test-vectors/pfc-v1.json','utf8'));
const expectedValidatorSetRoot='f0f2854ca630f6e6cf80e531100f449c6ba01a4f4755cb79d2240855a1604b83';
const expectedDIRHash='220b8c257e601e97386c55a36c866a53d3160a4e90d197ce463d238574c3beee';

function canonicalize(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonicalize(value[k])}`).join(',')}}`;
}
function sha256(value){return crypto.createHash('sha256').update(value).digest('hex');}
function hashCanonical(value){return sha256(canonicalize(value));}

const validators=[...vector.validators].sort((a,b)=>a.validatorId.localeCompare(b.validatorId));
if(validators.some(v=>v.state!=='ACTIVE'))throw new Error('PFC vector validator set must contain ACTIVE validators only');
const setRoot=hashCanonical({domain:'STRATUM/VALIDATOR/SET/1',profile:'STRATUM-VALIDATOR-SET-HASH/1',validators});
if(setRoot!==expectedValidatorSetRoot||vector.DIRCandidateHeader.validatorSetRoot!==setRoot||vector.PFC.validatorSetRoot!==setRoot)throw new Error(`Validator-set root mismatch: ${setRoot}`);

const candidateHash=hashCanonical({domain:'STRATUM/DIR/CANDIDATE/1',profile:'STRATUM-DIR-CANDIDATE-HASH/1',header:vector.DIRCandidateHeader});
if(candidateHash!==expectedDIRHash||vector.proposalHash!==candidateHash||vector.PFC.DIRHash!==candidateHash)throw new Error(`DIR candidate/proposal/PFC identity mismatch: ${candidateHash}`);
if(vector.PFC.stateRoot!==vector.DIRCandidateHeader.stateRoot)throw new Error('PFC stateRoot does not bind candidate stateRoot');

const required=Math.floor((2*validators.length)/3)+1;
const seen=new Set();
let valid=0;
for(const signature of vector.PFC.signerProof.signatures){
  if(seen.has(signature.signerId))throw new Error(`Duplicate PFC signer ${signature.signerId}`);seen.add(signature.signerId);
  const validator=validators.find(v=>v.validatorId===signature.signerId);
  if(!validator)throw new Error(`Unknown PFC signer ${signature.signerId}`);
  if(signature.algorithm!=='Ed25519'||signature.domain!=='STRATUM/POVI/COMMIT/1')throw new Error('Invalid PFC signature profile');
  const payload={
    domain:'STRATUM/POVI/COMMIT/1',chainId:vector.PFC.chainId,height:vector.PFC.height,round:vector.PFC.round,
    step:'COMMIT',proposalHash:vector.PFC.DIRHash,stateRoot:vector.PFC.stateRoot,validatorId:signature.signerId,
    validatorSetRoot:vector.PFC.validatorSetRoot,protocolVersion:vector.PFC.protocolVersion,
  };
  const key=crypto.createPublicKey({key:Buffer.from(validator.consensusPublicKey,'base64'),format:'der',type:'spki'});
  if(key.asymmetricKeyType!=='ed25519')throw new Error(`Non-Ed25519 consensus key for ${validator.validatorId}`);
  if(!crypto.verify(null,Buffer.from(canonicalize(payload),'utf8'),key,Buffer.from(signature.signature,'base64')))throw new Error(`Invalid COMMIT signature from ${signature.signerId}`);
  valid++;
}
if(valid<required)throw new Error(`PFC quorum not met: ${valid}/${validators.length}; ${required} required`);
if(new Set(vector.PFC.signerProof.signerIds).size!==vector.PFC.signerProof.signerIds.length)throw new Error('Duplicate PFC signerIds');
if([...vector.PFC.signerProof.signerIds].sort().join('\0')!==[...seen].sort().join('\0'))throw new Error('PFC signerIds/signatures disagree');

const tampered=structuredClone(vector);tampered.PFC.signerProof.signatures[0].signature='AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
const tamperedSig=tampered.PFC.signerProof.signatures[0];
const tamperedValidator=validators.find(v=>v.validatorId===tamperedSig.signerId);
const tamperedKey=crypto.createPublicKey({key:Buffer.from(tamperedValidator.consensusPublicKey,'base64'),format:'der',type:'spki'});
const tamperedPayload={domain:'STRATUM/POVI/COMMIT/1',chainId:tampered.PFC.chainId,height:tampered.PFC.height,round:tampered.PFC.round,step:'COMMIT',proposalHash:tampered.PFC.DIRHash,stateRoot:tampered.PFC.stateRoot,validatorId:tamperedSig.signerId,validatorSetRoot:tampered.PFC.validatorSetRoot,protocolVersion:tampered.PFC.protocolVersion};
if(crypto.verify(null,Buffer.from(canonicalize(tamperedPayload),'utf8'),tamperedKey,Buffer.from(tamperedSig.signature,'base64')))throw new Error('Tampered COMMIT signature unexpectedly verified');

const source=fs.readFileSync('lib/redbook/povi/finality.ts','utf8');
for(const token of [
  "VALIDATOR_SET_HASH_DOMAIN='STRATUM/VALIDATOR/SET/1'",
  "DIR_CANDIDATE_HASH_DOMAIN='STRATUM/DIR/CANDIDATE/1'",
  "POVI_COMMIT_DOMAIN='STRATUM/POVI/COMMIT/1'",
  'PFC.DIRHash!==candidateHash',
  "publicKey.asymmetricKeyType!=='ed25519'",
  'verifySignature(null',
  'requiredPoviQuorum(validators.length)',
  'aggregateProof verification is not yet defined'
]) if(!source.includes(token))throw new Error(`Missing PFC verifier invariant: ${token}`);
const stateMachine=fs.readFileSync('lib/redbook/povi/state-machine.ts','utf8');
if(!stateMachine.includes('verifiedPFC:VerifiedPoVIFinalityCertificate')||!stateMachine.includes('PFC.DIRHash!==state.lockedDIR'))throw new Error('State machine can still finalize without verified locked-proposal PFC binding');
console.log(`PoVI PFC conformance passed: ${valid}/${validators.length} signatures, quorum ${required}, DIR ${candidateHash}`);
