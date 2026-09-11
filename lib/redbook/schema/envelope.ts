import {z} from 'zod';
import {
 STRATUM_SCHEMA_VERSION,
 canonicalIdSchema,
 canonicalRefSchema,
 recordStatusSchema,
 schemaVersionSchema,
 trustClassSchema,
 utcIsoTimestampSchema,
} from './common';

/**
 * STRATUM Redbook v1 implementation profile for the common first-class object envelope.
 * Scope fields are explicit and nullable because protocol/network objects may not belong to a tenant/project.
 * Exact field optionality remains governed by future normative schema revisions and test vectors.
 */
export const canonicalEnvelopeShape={
 objectId:canonicalIdSchema,
 objectType:z.string().trim().min(1).max(128),
 schemaVersion:schemaVersionSchema.default(STRATUM_SCHEMA_VERSION),
 tenantId:canonicalIdSchema.nullable(),
 organizationId:canonicalIdSchema.nullable(),
 projectId:canonicalIdSchema.nullable(),
 createdAt:utcIsoTimestampSchema,
 createdBy:canonicalRefSchema,
 updatedAt:utcIsoTimestampSchema,
 status:recordStatusSchema,
 trustClass:trustClassSchema,
 sourceRefs:z.array(canonicalRefSchema).default([]),
 DIRRefs:z.array(canonicalRefSchema).default([]),
} as const;

export const canonicalEnvelopeSchema=z.object(canonicalEnvelopeShape).strict().superRefine((value,ctx)=>{
 if(Date.parse(value.updatedAt)<Date.parse(value.createdAt)){
  ctx.addIssue({code:z.ZodIssueCode.custom,path:['updatedAt'],message:'updatedAt cannot precede createdAt'});
 }
});

export type CanonicalEnvelope=z.infer<typeof canonicalEnvelopeSchema>;
