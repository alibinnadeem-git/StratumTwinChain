import {createPublicKey,verify as verifySignature} from 'crypto';
import {canonicalHash,canonicalize} from '@/lib/server/hash';
import {
 BOOTSTRAP_TRUST_BUNDLE_VERSION,
 GENESIS_CERTIFICATE_DOMAIN,
 GENESIS_CERTIFICATE_VERSION,
 bootstrapTrustBundleSchema,
 genesisTrustCertificateSchema,
 type BootstrapTrustBundle,
 type GenesisTrustCertificate,
} from './schema/bootstrap';

export const BOOTSTRAP_TRUST_HASH_DOMAIN='STRATUM/BOOTSTRAP/TRUST/1' as const;
export const BOOTSTRAP_TRUST_HASH_PROFILE='STRATUM-BOOTSTRAP-TRUST-HASH/1' as const;

export function bootstrapTrustBundleHash(input:BootstrapTrustBundle|unknown){
 const bundle=bootstrapTrustBundleSchema.parse(input);
 return canonicalHash({domain:BOOTSTRAP_TRUST_HASH_DOMAIN,profile:BOOTSTRAP_TRUST_HASH_PROFILE,bundle});
}

export function genesisCertificatePayload(input:GenesisTrustCertificate|unknown){
 const cert=genesisTrustCertificateSchema.parse(input);
 return{
  domain:GENESIS_CERTIFICATE_DOMAIN,
  certificateVersion:GENESIS_CERTIFICATE_VERSION,
  chainId:cert.chainId,
  GenesisDIRHash:cert.GenesisDIRHash,
  protocolVersion:cert.protocolVersion,
  issuedAt:cert.issuedAt,
  trustBundleHash:cert.trustBundleHash,
 };
}

function atOrAfter(value:string,start:string){return Date.parse(value)>=Date.parse(start);}
function beforeOrEqual(value:string,end:string|null){return end===null||Date.parse(value)<=Date.parse(end);}

export function verifyGenesisTrustCertificate(args:{
 bundle:unknown;
 certificate:unknown;
 pinnedTrustBundleHash:string;
 expectedChainId:string;
 expectedGenesisDIRHash:string;
 expectedProtocolVersion?:string;
}){
 const bundle=bootstrapTrustBundleSchema.parse(args.bundle);
 const certificate=genesisTrustCertificateSchema.parse(args.certificate);
 const computedBundleHash=bootstrapTrustBundleHash(bundle);
 if(computedBundleHash!==args.pinnedTrustBundleHash)throw new Error(`Bootstrap trust bundle pin mismatch: computed ${computedBundleHash}`);
 if(certificate.trustBundleHash!==computedBundleHash)throw new Error('Genesis certificate does not bind the pinned bootstrap trust bundle');
 if(bundle.chainId!==args.expectedChainId||certificate.chainId!==args.expectedChainId)throw new Error('Genesis certificate/bundle chainId mismatch');
 if(certificate.GenesisDIRHash!==args.expectedGenesisDIRHash)throw new Error('Genesis certificate does not bind the expected GenesisDIRHash');
 if(args.expectedProtocolVersion&&certificate.protocolVersion!==args.expectedProtocolVersion)throw new Error('Genesis certificate protocolVersion mismatch');
 if(!atOrAfter(certificate.issuedAt,bundle.validFrom)||!beforeOrEqual(certificate.issuedAt,bundle.validUntil))throw new Error('Genesis certificate was issued outside bootstrap trust-bundle validity');

 const payload=Buffer.from(canonicalize(genesisCertificatePayload(certificate)),'utf8');
 const validSigners:string[]=[];
 for(const signature of certificate.signatures){
  const root=bundle.roots.find(candidate=>candidate.rootId===signature.rootId&&candidate.keyId===signature.keyId);
  if(!root||root.state!=='ACTIVE')continue;
  if(!atOrAfter(certificate.issuedAt,root.validFrom)||!beforeOrEqual(certificate.issuedAt,root.validUntil))continue;
  const publicKey=createPublicKey({key:Buffer.from(root.publicKeyDerB64,'base64'),format:'der',type:'spki'});
  const valid=verifySignature(null,payload,publicKey,Buffer.from(signature.signatureB64,'base64'));
  if(valid)validSigners.push(root.rootId);
 }
 const uniqueValid=[...new Set(validSigners)].sort();
 if(uniqueValid.length<bundle.threshold)throw new Error(`Genesis trust threshold not met: ${uniqueValid.length}/${bundle.threshold}`);
 return{
  valid:true as const,
  bundleVersion:BOOTSTRAP_TRUST_BUNDLE_VERSION,
  computedBundleHash,
  threshold:bundle.threshold,
  validSigners:uniqueValid,
  GenesisDIRHash:certificate.GenesisDIRHash,
  chainId:certificate.chainId,
 };
}
