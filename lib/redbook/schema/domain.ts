import {z} from 'zod';
import {canonicalEnvelopeShape} from './envelope';
import {canonicalHashSchema,canonicalIdSchema,canonicalRefSchema,signatureSchema,utcIsoTimestampSchema} from './common';

export const relationshipTypes=[
 'PART_OF','LOCATED_IN','FEEDS','FED_BY','CONNECTED_TO','PROTECTS','CONTROLLED_BY','BACKED_UP_BY',
 'MAINTAINED_BY','OWNED_BY','REPLACED_BY','DEPENDS_ON',
] as const;
export const relationshipTypeSchema=z.enum(relationshipTypes);

export const relationshipSchema=z.object({
 relationshipType:relationshipTypeSchema,
 fromRef:canonicalRefSchema,
 toRef:canonicalRefSchema,
 sourceRefs:z.array(canonicalRefSchema).default([]),
}).strict();

export const engineeringValueSchema=z.object({
 propertyName:z.string().trim().min(1).max(128),
 sourceValue:z.union([z.string(),z.number(),z.boolean()]),
 sourceUnit:z.string().trim().min(1).max(64).nullable(),
 normalizedValue:z.union([z.string(),z.number(),z.boolean()]),
 normalizedUnit:z.string().trim().min(1).max(64).nullable(),
 conversionVersion:z.string().trim().min(1).max(128).nullable(),
 sourceRef:canonicalRefSchema.nullable(),
}).strict();

export const assetSchema=z.object({
 ...canonicalEnvelopeShape,
 objectType:z.literal('Asset'),
 assetId:canonicalIdSchema,
 assetCode:z.string().trim().min(1).max(128),
 assetType:z.string().trim().min(1).max(128),
 name:z.string().trim().min(1).max(256),
 portfolioRef:canonicalRefSchema.nullable(),
 campusRef:canonicalRefSchema.nullable(),
 siteRef:canonicalRefSchema,
 buildingRef:canonicalRefSchema.nullable(),
 levelRef:canonicalRefSchema.nullable(),
 roomZoneRef:canonicalRefSchema.nullable(),
 systemRef:canonicalRefSchema.nullable(),
 SpatialRef:canonicalRefSchema.nullable(),
 manufacturerRef:canonicalRefSchema.nullable(),
 model:z.string().trim().max(256).nullable(),
 serialNumber:z.string().trim().max(256).nullable(),
 lifecycleState:z.string().trim().min(1).max(128),
 properties:z.array(engineeringValueSchema).default([]),
 relationships:z.array(relationshipSchema).default([]),
}).strict().superRefine((value,ctx)=>{
 if(value.objectId!==value.assetId){
  ctx.addIssue({code:z.ZodIssueCode.custom,path:['objectId'],message:'objectId must equal assetId'});
 }
});

export const evidenceSchema=z.object({
 ...canonicalEnvelopeShape,
 objectType:z.literal('Evidence'),
 evidenceId:canonicalIdSchema,
 evidenceType:z.string().trim().min(1).max(128),
 contentHash:canonicalHashSchema,
 artifact:z.object({
  artifactRef:canonicalRefSchema.nullable(),
  fileName:z.string().trim().min(1).max(512).nullable(),
  mimeType:z.string().trim().min(1).max(256).nullable(),
  storageRef:canonicalRefSchema.nullable(),
 }).strict(),
 source:z.object({
  sourceRef:canonicalRefSchema,
  sourceType:z.string().trim().min(1).max(128),
 }).strict(),
 capture:z.object({
  capturedAt:utcIsoTimestampSchema,
  capturedBy:canonicalRefSchema,
  originalTimezoneOffset:z.string().trim().max(16).nullable(),
 }).strict(),
 retention:z.object({
  retentionClass:z.enum(['R0','R1','R2','R3','R4']),
  policyRef:canonicalRefSchema.nullable(),
 }).strict(),
 relationships:z.array(relationshipSchema).default([]),
 signatures:z.array(signatureSchema).default([]),
}).strict().superRefine((value,ctx)=>{
 if(value.objectId!==value.evidenceId){
  ctx.addIssue({code:z.ZodIssueCode.custom,path:['objectId'],message:'objectId must equal evidenceId'});
 }
});

export type CanonicalAsset=z.infer<typeof assetSchema>;
export type CanonicalEvidence=z.infer<typeof evidenceSchema>;
