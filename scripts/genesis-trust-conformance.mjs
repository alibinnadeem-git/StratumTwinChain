import fs from 'node:fs';
import crypto from 'node:crypto';

const expectedBundleHash='3015412c19e6c1b7af0f362dad3b8089eed42c3aaba2f569e7008080891e315e';
const expectedGenesisHash='51d5fd798fca7a43feb4904ba42ca4f15300ba630dab9ba19a61fba28a0bbe07';
const bundle=JSON.parse(fs.readFileSync('lib/redbook/test-vectors/bootstrap-trust-v1.json','utf8'));
const cert=JSON.parse(fs.readFileSync('lib/redbook/test-vectors/genesis-certificate-v1.json','utf8'));

function canonicalize(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonicalize(value[k])}`).join(',')}}`;
}
function sha256(value){return crypto.createHash('sha256').update(value).digest('hex');}

const bundlePreimage=canonicalize({
  domain:'STRATUM/BOOTSTRAP/TRUST/1',
  profile:'STRATUM-BOOTSTRAP-TRUST-HASH/1',
  bundle,
});
const computedBundleHash=sha256(bundlePreimage);
if(computedBundleHash!==expectedBundleHash)throw new Error(`Bootstrap trust vector mismatch: ${computedBundleHash}`);
if(cert.trustBundleHash!==computedBundleHash)throw new Error('Genesis certificate does not bind the fixed trust-bundle vector');
if(cert.GenesisDIRHash!==expectedGenesisHash)throw new Error('Genesis certificate does not bind the fixed Genesis vector');
if(cert.domain!=='STRATUM/GENESIS/CERT/1'||cert.certificateVersion!=='STRATUM-GENESIS-CERT/1')throw new Error('Unexpected Genesis certificate domain/version');
if(bundle.threshold!==2)throw new Error('Fixed trust vector must be 2-of-3');

const payload=Buffer.from(canonicalize({
  domain:'STRATUM/GENESIS/CERT/1',
  certificateVersion:'STRATUM-GENESIS-CERT/1',
  chainId:cert.chainId,
  GenesisDIRHash:cert.GenesisDIRHash,
  protocolVersion:cert.protocolVersion,
  issuedAt:cert.issuedAt,
  trustBundleHash:cert.trustBundleHash,
}),'utf8');

function validSigners(certificate){
  const seen=new Set();
  const valid=[];
  for(const signature of certificate.signatures){
    if(seen.has(signature.rootId))throw new Error(`Duplicate Genesis signer ${signature.rootId}`);
    seen.add(signature.rootId);
    const root=bundle.roots.find(r=>r.rootId===signature.rootId&&r.keyId===signature.keyId);
    if(!root||root.state!=='ACTIVE'||root.purpose!=='GOVERNANCE'||root.algorithm!=='Ed25519'||signature.algorithm!=='Ed25519')continue;
    const key=crypto.createPublicKey({key:Buffer.from(root.publicKeyDerB64,'base64'),format:'der',type:'spki'});
    if(crypto.verify(null,payload,key,Buffer.from(signature.signatureB64,'base64')))valid.push(root.rootId);
  }
  return valid;
}
const valid=validSigners(cert);
if(valid.length<bundle.threshold)throw new Error(`Genesis trust threshold not met: ${valid.length}/${bundle.threshold}`);

const tampered=structuredClone(cert);
tampered.signatures[1].signatureB64='AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
if(validSigners(tampered).length>=bundle.threshold)throw new Error('Tampered signature unexpectedly met Genesis threshold');
const duplicate=structuredClone(cert);duplicate.signatures[1]=duplicate.signatures[0];
let duplicateRejected=false;try{validSigners(duplicate);}catch{duplicateRejected=true;}
if(!duplicateRejected)throw new Error('Duplicate Genesis signer was not rejected');

const source=fs.readFileSync('lib/redbook/genesis-trust.ts','utf8');
for(const token of [
  "BOOTSTRAP_TRUST_HASH_DOMAIN='STRATUM/BOOTSTRAP/TRUST/1'",
  "BOOTSTRAP_TRUST_HASH_PROFILE='STRATUM-BOOTSTRAP-TRUST-HASH/1'",
  'computedBundleHash!==args.pinnedTrustBundleHash',
  'certificate.trustBundleHash!==computedBundleHash',
  'createPublicKey',
  'verifySignature(null',
  'new Set(validSigners)',
  'Genesis trust threshold not met'
]) if(!source.includes(token))throw new Error(`Missing Genesis trust invariant: ${token}`);

console.log(`Genesis trust conformance passed: ${valid.length}/${bundle.threshold}, bundle ${computedBundleHash}`);
