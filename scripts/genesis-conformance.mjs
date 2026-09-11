import fs from 'node:fs';
import crypto from 'node:crypto';

const expected='51d5fd798fca7a43feb4904ba42ca4f15300ba630dab9ba19a61fba28a0bbe07';
const vector=JSON.parse(fs.readFileSync('lib/redbook/test-vectors/genesis-v1.json','utf8'));

function canonicalize(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonicalize(value[k])}`).join(',')}}`;
}

const {objectId,GenesisDIRHash,...genesis}=vector;
const preimage=canonicalize({domain:'STRATUM/GENESIS/DIR/1',profile:'STRATUM-GENESIS-HASH/1',genesis});
const computed=crypto.createHash('sha256').update(preimage).digest('hex');
if(computed!==expected)throw new Error(`Genesis vector mismatch: ${computed}`);
if(objectId!==computed||GenesisDIRHash!==computed)throw new Error('Genesis self-identifiers do not match computed hash');

const implementation=fs.readFileSync('lib/redbook/genesis.ts','utf8');
for(const token of [
  "GENESIS_HASH_DOMAIN='STRATUM/GENESIS/DIR/1'",
  "GENESIS_HASH_PROFILE='STRATUM-GENESIS-HASH/1'",
  'const {objectId:_objectId,GenesisDIRHash:_hash,...genesis}=parsed',
  'parsed.DIRRefs.length!==0',
  'parsed.GenesisDIRHash!==computedHash',
  'parsed.objectId!==computedHash'
]) if(!implementation.includes(token)) throw new Error(`Missing Genesis invariant: ${token}`);

console.log(`Genesis conformance passed: ${computed}`);
