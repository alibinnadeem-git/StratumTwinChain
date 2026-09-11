import {z} from 'zod';
import {canonicalHashSchema,canonicalIdSchema,schemaVersionSchema} from './common';

export const PROTOCOL_GOVERNANCE_PROFILE='STRATUM-PROTOCOL-GOVERNANCE/1' as const;
export const PROTOCOL_CHANGE_VERSION='STRATUM-PROTOCOL-CHANGE/1' as const;
export const PROTOCOL_CHANGE_DOMAIN='STRATUM/PROTOCOL_CHANGE/1' as const;
export const PROTOCOL_CHANGE_MANIFEST_VERSION='STRATUM-PROTOCOL-CHANGE-MANIFEST/1' as const;
export const PROTOCOL_STATE_PROFILE='STRATUM-PROTOCOL-STATE/1' as const;
export const PROTOCOL_STATE_DOMAIN='STRATUM/PROTOCOL_STATE/1' as const;

export const protocolGovernanceMemberSchema=z.object({
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

export const protocolGovernancePolicySchema=z.object({
 profile:z.literal(PROTOCOL_GOVERNANCE_PROFILE),
 chainId:canonicalIdSchema,
 authorityId:canonicalIdSchema,
 authorityType:z.literal('PROTOCOL'),
 organizationId:canonicalIdSchema,
 jurisdiction:z.string().min(1).nullable(),
 scope:z.array(z.enum(['PROTOCOL_VERSION','CONSENSUS_RULES','CANONICAL_SCHEMA','RESOURCE_POLICY'])).min(1),
 votingPolicy:z.literal('THRESHOLD'),
 thresholdClass:z.enum(['SIMPLE','DUAL','MAJORITY','SUPERMAJORITY','MULTI_PARTY_HIGH_ASSURANCE']),
 threshold:z.number().int().positive(),
 effectiveFromHeight:z.number().int().nonnegative(),
 effectiveUntilHeight:z.number().int().positive().nullable(),
 status:z.enum(['ACTIVE','SUSPENDED','RETIRED']),
 members:z.array(protocolGovernanceMemberSchema).min(1),
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

export const protocolStateSchema=z.object({
 profile:z.literal(PROTOCOL_STATE_PROFILE),
 chainId:canonicalIdSchema,
 protocolVersion:schemaVersionSchema,
 canonicalSchemaVersion:schemaVersionSchema,
 consensusRulesHash:canonicalHashSchema,
 resourcePolicyHash:canonicalHashSchema,
 moduleRegistryHash:canonicalHashSchema,
 activeFromHeight:z.number().int().nonnegative(),
}).strict();

export const protocolChangeManifestSchema=z.object({
 manifestVersion:z.literal(PROTOCOL_CHANGE_MANIFEST_VERSION),
 chainId:canonicalIdSchema,
 fromProtocolVersion:schemaVersionSchema,
 toProtocolVersion:schemaVersionSchema,
 rationaleHash:canonicalHashSchema,
 securityImpactHash:canonicalHashSchema,
 compatibilityImpactHash:canonicalHashSchema,
 migrationPlanHash:canonicalHashSchema,
 testEvidenceRoot:canonicalHashSchema,
 minimumValidatorVersion:schemaVersionSchema,
 resourceProfileHash:canonicalHashSchema,
}).strict();

export const protocolChangeActionSchema=z.object({
 domain:z.literal(PROTOCOL_CHANGE_DOMAIN),
 actionVersion:z.literal(PROTOCOL_CHANGE_VERSION),
 chainId:canonicalIdSchema,
 actionId:canonicalIdSchema,
 fromProtocolVersion:schemaVersionSchema,
 toProtocolVersion:schemaVersionSchema,
 approvedAtHeight:z.number().int().nonnegative(),
 activationHeight:z.number().int().positive(),
 previousProtocolStateHash:canonicalHashSchema,
 nextProtocolStateHash:canonicalHashSchema,
 governancePolicyHash:canonicalHashSchema,
 changeHash:canonicalHashSchema,
}).strict().superRefine((value,ctx)=>{
 if(value.activationHeight<=value.approvedAtHeight){
  ctx.addIssue({code:z.ZodIssueCode.custom,path:['activationHeight'],message:'Consensus-affecting protocol changes must activate at a future height'});
 }
 if(value.fromProtocolVersion===value.toProtocolVersion){
  ctx.addIssue({code:z.ZodIssueCode.custom,path:['toProtocolVersion'],message:'Protocol activation must change protocolVersion'});
 }
});

export const protocolChangeSignatureSchema=z.object({
 authorityMemberId:canonicalIdSchema,
 keyId:canonicalIdSchema,
 algorithm:z.literal('Ed25519'),
 domain:z.literal(PROTOCOL_CHANGE_DOMAIN),
 signatureB64:z.string().min(1),
}).strict();

export const protocolChangeProofSchema=z.object({
 action:protocolChangeActionSchema,
 governancePolicy:protocolGovernancePolicySchema,
 changeManifest:protocolChangeManifestSchema,
 previousProtocolState:protocolStateSchema,
 nextProtocolState:protocolStateSchema,
 signatures:z.array(protocolChangeSignatureSchema).min(1),
}).strict().superRefine((value,ctx)=>{
 const signers=new Set<string>();
 for(const signature of value.signatures){
  if(signers.has(signature.authorityMemberId))ctx.addIssue({code:z.ZodIssueCode.custom,path:['signatures'],message:`Duplicate protocol-governance signer ${signature.authorityMemberId}`});
  signers.add(signature.authorityMemberId);
 }
});

export type ProtocolGovernancePolicy=z.infer<typeof protocolGovernancePolicySchema>;
export type ProtocolState=z.infer<typeof protocolStateSchema>;
export type ProtocolChangeManifest=z.infer<typeof protocolChangeManifestSchema>;
export type ProtocolChangeAction=z.infer<typeof protocolChangeActionSchema>;
export type ProtocolChangeProof=z.infer<typeof protocolChangeProofSchema>;
