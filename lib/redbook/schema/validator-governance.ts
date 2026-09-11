import {z} from 'zod';
import {canonicalHashSchema,canonicalIdSchema} from './common';
import {snapshotValidatorSetSchema} from './snapshot';

export const VALIDATOR_GOVERNANCE_PROFILE='STRATUM-VALIDATOR-GOVERNANCE/1' as const;
export const VALIDATOR_SET_CHANGE_VERSION='STRATUM-VALIDATOR-SET-CHANGE/1' as const;
export const VALIDATOR_SET_CHANGE_DOMAIN='STRATUM/VALIDATOR_SET_CHANGE/1' as const;

export const validatorGovernanceMemberSchema=z.object({
 authorityMemberId:canonicalIdSchema,
 keyId:canonicalIdSchema,
 purpose:z.literal('GOVERNANCE'),
 algorithm:z.literal('Ed25519'),
 publicKeyDerB64:z.string().min(1),
 state:z.enum(['ACTIVE','ROTATED','EXPIRED','REVOKED','COMPROMISED','RETIRED']),
 validFromHeight:z.number().int().nonnegative(),
 validUntilHeight:z.number().int().positive().nullable(),
}).strict().superRefine((value,ctx)=>{
 if(value.validUntilHeight!==null&&value.validUntilHeight<=value.validFromHeight){
  ctx.addIssue({code:z.ZodIssueCode.custom,path:['validUntilHeight'],message:'validUntilHeight must follow validFromHeight'});
 }
});

export const validatorGovernancePolicySchema=z.object({
 profile:z.literal(VALIDATOR_GOVERNANCE_PROFILE),
 chainId:canonicalIdSchema,
 authorityId:canonicalIdSchema,
 authorityType:z.literal('VALIDATOR'),
 organizationId:canonicalIdSchema,
 jurisdiction:z.string().min(1).nullable(),
 scope:z.array(z.enum(['VALIDATOR_MEMBERSHIP','VALIDATOR_CONSENSUS_KEYS','VALIDATOR_RECOVERY'])).min(1),
 votingPolicy:z.literal('THRESHOLD'),
 threshold:z.number().int().positive(),
 effectiveFromHeight:z.number().int().nonnegative(),
 effectiveUntilHeight:z.number().int().positive().nullable(),
 status:z.enum(['ACTIVE','SUSPENDED','RETIRED']),
 members:z.array(validatorGovernanceMemberSchema).min(1),
}).strict().superRefine((value,ctx)=>{
 if(value.effectiveUntilHeight!==null&&value.effectiveUntilHeight<=value.effectiveFromHeight){
  ctx.addIssue({code:z.ZodIssueCode.custom,path:['effectiveUntilHeight'],message:'effectiveUntilHeight must follow effectiveFromHeight'});
 }
 const ids=new Set<string>();const keys=new Set<string>();
 for(const member of value.members){
  if(ids.has(member.authorityMemberId))ctx.addIssue({code:z.ZodIssueCode.custom,path:['members'],message:`Duplicate authorityMemberId ${member.authorityMemberId}`});
  if(keys.has(member.keyId))ctx.addIssue({code:z.ZodIssueCode.custom,path:['members'],message:`Duplicate governance keyId ${member.keyId}`});
  ids.add(member.authorityMemberId);keys.add(member.keyId);
 }
 if(value.threshold>value.members.length)ctx.addIssue({code:z.ZodIssueCode.custom,path:['threshold'],message:'Threshold exceeds governance member count'});
});

export const validatorSetChangeActionSchema=z.object({
 domain:z.literal(VALIDATOR_SET_CHANGE_DOMAIN),
 actionVersion:z.literal(VALIDATOR_SET_CHANGE_VERSION),
 chainId:canonicalIdSchema,
 actionId:canonicalIdSchema,
 actionType:z.enum(['ACTIVATE','QUARANTINE','REINSTATE','RETIRE','REVOKE','ROTATE_CONSENSUS_KEY']),
 validatorId:canonicalIdSchema,
 effectiveHeight:z.number().int().positive(),
 previousValidatorSetRoot:canonicalHashSchema,
 nextValidatorSetRoot:canonicalHashSchema,
 previousValidatorSetHash:canonicalHashSchema,
 nextValidatorSetHash:canonicalHashSchema,
 subjectIdentityHash:canonicalHashSchema,
 governancePolicyHash:canonicalHashSchema,
 reasonHash:canonicalHashSchema,
}).strict();

export const validatorSetChangeSignatureSchema=z.object({
 authorityMemberId:canonicalIdSchema,
 keyId:canonicalIdSchema,
 algorithm:z.literal('Ed25519'),
 domain:z.literal(VALIDATOR_SET_CHANGE_DOMAIN),
 signatureB64:z.string().min(1),
}).strict();

export const validatorSetChangeProofSchema=z.object({
 action:validatorSetChangeActionSchema,
 governancePolicy:validatorGovernancePolicySchema,
 previousValidatorSet:snapshotValidatorSetSchema,
 nextValidatorSet:snapshotValidatorSetSchema,
 signatures:z.array(validatorSetChangeSignatureSchema).min(1),
}).strict().superRefine((value,ctx)=>{
 const signers=new Set<string>();
 for(const signature of value.signatures){
  if(signers.has(signature.authorityMemberId))ctx.addIssue({code:z.ZodIssueCode.custom,path:['signatures'],message:`Duplicate governance signer ${signature.authorityMemberId}`});
  signers.add(signature.authorityMemberId);
 }
});

export type ValidatorGovernancePolicy=z.infer<typeof validatorGovernancePolicySchema>;
export type ValidatorSetChangeAction=z.infer<typeof validatorSetChangeActionSchema>;
export type ValidatorSetChangeProof=z.infer<typeof validatorSetChangeProofSchema>;
