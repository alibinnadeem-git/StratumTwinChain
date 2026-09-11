import {canonicalHash,canonicalize} from '@/lib/server/hash';
import {genesisDIRSchema,type GenesisDIR} from './schema/povi';

export const GENESIS_HASH_DOMAIN='STRATUM/GENESIS/DIR/1' as const;
export const GENESIS_HASH_PROFILE='STRATUM-GENESIS-HASH/1' as const;

export type GenesisHashMaterial=Omit<GenesisDIR,'objectId'|'GenesisDIRHash'>;

function assertCanonicalGenesisValue(value:unknown,path='$'):void{
 if(value===null||typeof value==='string'||typeof value==='boolean')return;
 if(typeof value==='number'){
  if(!Number.isSafeInteger(value))throw new Error(`Genesis v1 numeric value at ${path} must be a finite safe integer; encode decimal/high-precision values as canonical strings`);
  return;
 }
 if(Array.isArray(value)){
  value.forEach((item,index)=>assertCanonicalGenesisValue(item,`${path}[${index}]`));
  return;
 }
 if(typeof value==='object'){
  for(const [key,item] of Object.entries(value as Record<string,unknown>))assertCanonicalGenesisValue(item,`${path}.${key}`);
  return;
 }
 throw new Error(`Unsupported Genesis v1 canonical value at ${path}: ${typeof value}`);
}

/**
 * Genesis is self-identifying: objectId === GenesisDIRHash. Those two fields are
 * therefore excluded from their own preimage. Every other canonical field is
 * included under an explicit domain/profile wrapper before deterministic JSON
 * canonicalization and SHA-256.
 */
export function genesisHashMaterial(input:GenesisDIR|unknown){
 const parsed=genesisDIRSchema.parse(input);
 const {objectId:_objectId,GenesisDIRHash:_hash,...genesis}=parsed;
 assertCanonicalGenesisValue(genesis);
 return{domain:GENESIS_HASH_DOMAIN,profile:GENESIS_HASH_PROFILE,genesis};
}

export function canonicalGenesisPreimage(input:GenesisDIR|unknown){
 return canonicalize(genesisHashMaterial(input));
}

export function computeGenesisDIRHash(input:GenesisDIR|unknown){
 return canonicalHash(genesisHashMaterial(input));
}

export function verifyGenesisDIR(input:unknown){
 const parsed=genesisDIRSchema.parse(input);
 if(parsed.DIRRefs.length!==0)throw new Error('Genesis DIR must not reference later DIRs');
 const computedHash=computeGenesisDIRHash(parsed);
 if(parsed.GenesisDIRHash!==computedHash)throw new Error(`GenesisDIRHash mismatch: computed ${computedHash}`);
 if(parsed.objectId!==computedHash)throw new Error(`Genesis objectId mismatch: computed ${computedHash}`);
 return{valid:true as const,computedHash,preimage:canonicalGenesisPreimage(parsed),genesis:parsed};
}
