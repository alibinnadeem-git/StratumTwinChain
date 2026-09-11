import {z} from 'zod';
import {canonicalHashSchema,canonicalIdSchema,schemaVersionSchema} from './common';

export const SNAPSHOT_CERTIFICATE_VERSION='STRATUM-SNAPSHOT-CERT/1' as const;
export const SNAPSHOT_CERTIFICATE_DOMAIN='STRATUM/SNAPSHOT/CERT/1' as const;
export const VALIDATOR_SET_PROFILE='STRATUM-VALIDATOR-SET/1' as const;
export const VALIDATOR_SET_ROOT_DOMAIN='STRATUM/VALIDATOR_SET/1' as const;

export const validatorConsensusKeySchema=z.object({
 keyId:canonicalIdSchema,
 purpose:z.literal('CONSENSUS'),
 algorithm:z.literal('Ed25519'),
 publicKeyDerB64:z.string().min(1),
 activeFromHeight:z.number().int().nonnegative(),
 retiredAtHeight:z.number().int().positive().nullable(),
}).strict().superRefine((value,ctx)=>{
 if(value.retiredAtHeight!==null&&value.retiredAtHeight<=value.activeFromHeight){
  ctx.addIssue({code:z.ZodIssueCode.custom,path:['retiredAtHeight'],message:'retiredAtHeight must follow activeFromHeight'});
 }
});

export const snapshotValidatorSchema=z.object({
 validatorId:canonicalIdSchema,
 identityUuid:canonicalIdSchema,
 operatorOrg:canonicalIdSchema,
 activationHeight:z.number().int().nonnegative(),
 retirementHeight:z.number().int().positive().nullable(),
 keys:z.array(validatorConsensusKeySchema).min(1),
}).strict().superRefine((value,ctx)=>{
 if(value.retirementHeight!==null&&value.retirementHeight<=value.activationHeight){
  ctx.addIssue({code:z.ZodIssueCode.custom,path:['retirementHeight'],message:'retirementHeight must follow activationHeight'});
 }
 const keyIds=new Set<string>();
 for(const key of value.keys){
  if(keyIds.has(key.keyId))ctx.addIssue({code:z.ZodIssueCode.custom,path:['keys'],message:`Duplicate keyId ${key.keyId}`});
  keyIds.add(key.keyId);
 }
});

export const snapshotValidatorSetSchema=z.object({
 setVersion:z.literal(VALIDATOR_SET_PROFILE),
 chainId:canonicalIdSchema,
 members:z.array(snapshotValidatorSchema).min(1),
}).strict().superRefine((value,ctx)=>{
 const validatorIds=new Set<string>();
 const identities=new Set<string>();
 for(const member of value.members){
  if(validatorIds.has(member.validatorId))ctx.addIssue({code:z.ZodIssueCode.custom,path:['members'],message:`Duplicate validatorId ${member.validatorId}`});
  if(identities.has(member.identityUuid))ctx.addIssue({code:z.ZodIssueCode.custom,path:['members'],message:`Duplicate validator identity ${member.identityUuid}`});
  validatorIds.add(member.validatorId);identities.add(member.identityUuid);
 }
});

export const snapshotSignatureSchema=z.object({
 signerId:canonicalIdSchema,
 keyId:canonicalIdSchema,
 algorithm:z.literal('Ed25519'),
 domain:z.literal(SNAPSHOT_CERTIFICATE_DOMAIN),
 signatureB64:z.string().min(1),
}).strict();

export const snapshotTrustCertificateSchema=z.object({
 domain:z.literal(SNAPSHOT_CERTIFICATE_DOMAIN),
 certificateVersion:z.literal(SNAPSHOT_CERTIFICATE_VERSION),
 chainId:canonicalIdSchema,
 snapshotHeight:z.number().int().nonnegative(),
 DIRHash:canonicalHashSchema,
 stateRoot:canonicalHashSchema,
 validatorSetRoot:canonicalHashSchema,
 protocolVersion:schemaVersionSchema,
 stateManifestRoot:canonicalHashSchema,
 SpatialManifestRoot:canonicalHashSchema,
 evidenceManifestRoot:canonicalHashSchema,
 signatures:z.array(snapshotSignatureSchema).min(1),
}).strict().superRefine((value,ctx)=>{
 const signers=new Set<string>();
 for(const signature of value.signatures){
  if(signers.has(signature.signerId))ctx.addIssue({code:z.ZodIssueCode.custom,path:['signatures'],message:`Duplicate snapshot signer ${signature.signerId}`});
  signers.add(signature.signerId);
 }
});

export type SnapshotValidatorSet=z.infer<typeof snapshotValidatorSetSchema>;
export type SnapshotTrustCertificate=z.infer<typeof snapshotTrustCertificateSchema>;
