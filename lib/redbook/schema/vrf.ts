import {z} from 'zod';
import {canonicalHashSchema,canonicalIdSchema,schemaVersionSchema} from './common';

export const POVI_PROPOSER_PROFILE='STRATUM-POVI-PROPOSER/1' as const;
export const POVI_PROPOSER_SELECTION_DOMAIN='STRATUM/POVI/PROPOSER_SELECTION/1' as const;
export const POVI_VRF_EVIDENCE_DOMAIN='STRATUM/POVI/VRF_EVIDENCE/1' as const;
export const POVI_VRF_KEY_REGISTRY_PROFILE='STRATUM-VRF-KEY-REGISTRY/1' as const;
export const POVI_VRF_KEY_REGISTRY_ROOT_DOMAIN='STRATUM/VRF_KEY_REGISTRY/1' as const;

export const vrfKeySchema=z.object({
 keyId:canonicalIdSchema,
 purpose:z.literal('VRF'),
 algorithm:z.literal('Ed25519-Deterministic-Entropy-v1'),
 publicKeyDerB64:z.string().min(1),
 activeFromHeight:z.number().int().nonnegative(),
 retiredAtHeight:z.number().int().positive().nullable(),
}).strict().superRefine((value,ctx)=>{
 if(value.retiredAtHeight!==null&&value.retiredAtHeight<=value.activeFromHeight){
  ctx.addIssue({code:z.ZodIssueCode.custom,path:['retiredAtHeight'],message:'retiredAtHeight must follow activeFromHeight'});
 }
});

export const vrfValidatorKeyHistorySchema=z.object({
 validatorId:canonicalIdSchema,
 keys:z.array(vrfKeySchema).min(1),
}).strict().superRefine((value,ctx)=>{
 const ids=new Set<string>();
 for(const key of value.keys){
  if(ids.has(key.keyId))ctx.addIssue({code:z.ZodIssueCode.custom,path:['keys'],message:`Duplicate VRF keyId ${key.keyId}`});
  ids.add(key.keyId);
 }
});

export const vrfKeyRegistrySchema=z.object({
 registryVersion:z.literal(POVI_VRF_KEY_REGISTRY_PROFILE),
 chainId:canonicalIdSchema,
 validators:z.array(vrfValidatorKeyHistorySchema).min(1),
}).strict().superRefine((value,ctx)=>{
 const ids=new Set<string>();
 for(const validator of value.validators){
  if(ids.has(validator.validatorId))ctx.addIssue({code:z.ZodIssueCode.custom,path:['validators'],message:`Duplicate validatorId ${validator.validatorId}`});
  ids.add(validator.validatorId);
 }
});

export const proposerSelectionContextSchema=z.object({
 profileVersion:z.literal(POVI_PROPOSER_PROFILE),
 chainId:canonicalIdSchema,
 height:z.number().int().positive(),
 round:z.number().int().nonnegative(),
 previousDIRHash:canonicalHashSchema,
 previousEntropy:canonicalHashSchema,
 validatorSetRoot:canonicalHashSchema,
 vrfKeyRegistryRoot:canonicalHashSchema,
 protocolVersion:schemaVersionSchema,
}).strict();

export const proposerEntropyEvidenceSchema=z.object({
 profileVersion:z.literal(POVI_PROPOSER_PROFILE),
 domain:z.literal(POVI_VRF_EVIDENCE_DOMAIN),
 chainId:canonicalIdSchema,
 height:z.number().int().positive(),
 round:z.number().int().nonnegative(),
 previousDIRHash:canonicalHashSchema,
 previousEntropy:canonicalHashSchema,
 validatorSetRoot:canonicalHashSchema,
 vrfKeyRegistryRoot:canonicalHashSchema,
 protocolVersion:schemaVersionSchema,
 proposerId:canonicalIdSchema,
 keyId:canonicalIdSchema,
 selectionSeed:canonicalHashSchema,
 messageHash:canonicalHashSchema,
 proofB64:z.string().min(1),
 vrfOutput:canonicalHashSchema,
}).strict();

export type VRFKeyRegistry=z.infer<typeof vrfKeyRegistrySchema>;
export type ProposerSelectionContext=z.infer<typeof proposerSelectionContextSchema>;
export type ProposerEntropyEvidence=z.infer<typeof proposerEntropyEvidenceSchema>;
