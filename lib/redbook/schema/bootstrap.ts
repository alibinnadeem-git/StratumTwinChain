import {z} from 'zod';
import {canonicalHashSchema,canonicalIdSchema,schemaVersionSchema,utcIsoTimestampSchema} from './common';

export const BOOTSTRAP_TRUST_BUNDLE_VERSION='STRATUM-BOOTSTRAP-TRUST/1' as const;
export const GENESIS_CERTIFICATE_VERSION='STRATUM-GENESIS-CERT/1' as const;
export const GENESIS_CERTIFICATE_DOMAIN='STRATUM/GENESIS/CERT/1' as const;

export const bootstrapRootKeySchema=z.object({
 rootId:canonicalIdSchema,
 keyId:canonicalIdSchema,
 purpose:z.literal('GOVERNANCE'),
 algorithm:z.literal('Ed25519'),
 publicKeyDerB64:z.string().min(1),
 state:z.enum(['ACTIVE','ROTATED','EXPIRED','REVOKED','COMPROMISED','RETIRED']),
 validFrom:utcIsoTimestampSchema,
 validUntil:utcIsoTimestampSchema.nullable(),
}).strict();

export const bootstrapTrustBundleSchema=z.object({
 bundleVersion:z.literal(BOOTSTRAP_TRUST_BUNDLE_VERSION),
 chainId:canonicalIdSchema,
 policyId:canonicalIdSchema,
 threshold:z.number().int().positive(),
 roots:z.array(bootstrapRootKeySchema).min(1),
 validFrom:utcIsoTimestampSchema,
 validUntil:utcIsoTimestampSchema.nullable(),
}).strict().superRefine((value,ctx)=>{
 const ids=new Set<string>();
 const keys=new Set<string>();
 for(const root of value.roots){
  if(ids.has(root.rootId))ctx.addIssue({code:z.ZodIssueCode.custom,path:['roots'],message:`Duplicate rootId ${root.rootId}`});
  if(keys.has(root.keyId))ctx.addIssue({code:z.ZodIssueCode.custom,path:['roots'],message:`Duplicate keyId ${root.keyId}`});
  ids.add(root.rootId);keys.add(root.keyId);
  if(root.validUntil&&Date.parse(root.validUntil)<=Date.parse(root.validFrom))ctx.addIssue({code:z.ZodIssueCode.custom,path:['roots'],message:`Root ${root.rootId} validUntil must follow validFrom`});
 }
 const eligible=value.roots.filter(root=>root.state==='ACTIVE').length;
 if(value.threshold>eligible)ctx.addIssue({code:z.ZodIssueCode.custom,path:['threshold'],message:'Threshold exceeds ACTIVE bootstrap roots'});
 if(value.validUntil&&Date.parse(value.validUntil)<=Date.parse(value.validFrom))ctx.addIssue({code:z.ZodIssueCode.custom,path:['validUntil'],message:'Bundle validUntil must follow validFrom'});
});

export const genesisCertificateSignatureSchema=z.object({
 rootId:canonicalIdSchema,
 keyId:canonicalIdSchema,
 algorithm:z.literal('Ed25519'),
 signatureB64:z.string().min(1),
}).strict();

export const genesisTrustCertificateSchema=z.object({
 domain:z.literal(GENESIS_CERTIFICATE_DOMAIN),
 certificateVersion:z.literal(GENESIS_CERTIFICATE_VERSION),
 chainId:canonicalIdSchema,
 GenesisDIRHash:canonicalHashSchema,
 protocolVersion:schemaVersionSchema,
 issuedAt:utcIsoTimestampSchema,
 trustBundleHash:canonicalHashSchema,
 signatures:z.array(genesisCertificateSignatureSchema).min(1),
}).strict().superRefine((value,ctx)=>{
 const seen=new Set<string>();
 for(const sig of value.signatures){
  if(seen.has(sig.rootId))ctx.addIssue({code:z.ZodIssueCode.custom,path:['signatures'],message:`Duplicate Genesis signer ${sig.rootId}`});
  seen.add(sig.rootId);
 }
});

export type BootstrapTrustBundle=z.infer<typeof bootstrapTrustBundleSchema>;
export type GenesisTrustCertificate=z.infer<typeof genesisTrustCertificateSchema>;
