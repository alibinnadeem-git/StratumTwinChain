import {z} from 'zod';
import {trustStates} from '@/lib/redbook/terminology';

export const STRATUM_SCHEMA_VERSION='STRATUM-SCHEMA/1' as const;
export const POVI_PROTOCOL_VERSION='POVI/1' as const;

export const canonicalIdSchema=z.string().trim().min(1).max(256);
export const schemaVersionSchema=z.string().trim().min(1).max(128);
export const utcIsoTimestampSchema=z.string().datetime({offset:false});
export const lowercaseHexSchema=z.string().regex(/^[0-9a-f]+$/,'Must be lowercase hexadecimal');
export const canonicalHashSchema=lowercaseHexSchema.min(32).max(256);
export const canonicalRefSchema=canonicalIdSchema;
export const trustClassSchema=z.enum(trustStates);

export const signatureSchema=z.object({
 signerId:canonicalIdSchema,
 signature:z.string().min(1),
}).strict();

export const signerProofSchema=z.object({
 signerIds:z.array(canonicalIdSchema).min(1),
 signerBitmap:z.string().min(1).optional(),
 signatures:z.array(signatureSchema).optional(),
 aggregateProof:z.string().min(1).optional(),
}).strict().superRefine((value,ctx)=>{
 if(!value.signatures?.length&&!value.aggregateProof){
  ctx.addIssue({code:z.ZodIssueCode.custom,message:'Either signatures or aggregateProof is required'});
 }
});

export const stateTransitionSchema=z.object({
 fromState:z.string().min(1),
 toState:z.string().min(1),
}).strict();

export const priorityClassSchema=z.enum(['LOW','NORMAL','HIGH','CRITICAL','SAFETY']);

export type CanonicalSignature=z.infer<typeof signatureSchema>;
export type SignerProof=z.infer<typeof signerProofSchema>;
