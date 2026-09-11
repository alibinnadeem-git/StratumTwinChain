import {z} from 'zod';
import {canonicalEnvelopeShape} from './envelope';
import {
 canonicalHashSchema,
 canonicalIdSchema,
 canonicalRefSchema,
 eventConstantSchema,
 priorityClassSchema,
 qualitySchema,
 schemaVersionSchema,
 signatureSchema,
 stateTransitionSchema,
 utcIsoTimestampSchema,
} from './common';

export const nanoDirSchema=z.object({
 ...canonicalEnvelopeShape,
 objectType:z.literal('NDIR'),
 nanoDirId:canonicalIdSchema,
 schemaVersion:schemaVersionSchema,
 sourceId:canonicalIdSchema,
 sourceSequence:z.number().int().nonnegative(),
 eventOccurredAt:utcIsoTimestampSchema,
 recordedAt:utcIsoTimestampSchema,
 dataType:z.string().trim().min(1).max(128),
 engineeringUnit:z.string().trim().min(1).max(128).nullable(),
 valueHash:canonicalHashSchema.optional(),
 payloadHash:canonicalHashSchema.optional(),
 payloadRef:canonicalRefSchema.nullable(),
 quality:qualitySchema,
 contextRefs:z.array(canonicalRefSchema).default([]),
 sourceSignature:signatureSchema,
 gatewaySignature:signatureSchema.optional(),
 aggregationRef:canonicalRefSchema.nullable(),
}).strict().superRefine((value,ctx)=>{
 if(value.objectId!==value.nanoDirId){
  ctx.addIssue({code:z.ZodIssueCode.custom,path:['objectId'],message:'objectId must equal nanoDirId'});
 }
 if(!value.valueHash&&!value.payloadHash){
  ctx.addIssue({code:z.ZodIssueCode.custom,path:['payloadHash'],message:'NDIR requires valueHash or payloadHash'});
 }
 if(Date.parse(value.recordedAt)<Date.parse(value.eventOccurredAt)){
  ctx.addIssue({code:z.ZodIssueCode.custom,path:['recordedAt'],message:'recordedAt cannot precede eventOccurredAt in this implementation profile'});
 }
});

export const microDirSchema=z.object({
 ...canonicalEnvelopeShape,
 objectType:z.literal('MDIR'),
 microDirId:canonicalIdSchema,
 eventType:eventConstantSchema,
 eventVersion:schemaVersionSchema,
 subjectRefs:z.array(canonicalRefSchema).min(1),
 actorRef:canonicalRefSchema,
 eventOccurredAt:utcIsoTimestampSchema,
 submittedAt:utcIsoTimestampSchema,
 acceptedSequence:z.number().int().nonnegative().nullable(),
 priorityClass:priorityClassSchema,
 dependencies:z.array(canonicalRefSchema).default([]),
 evidenceRefs:z.array(canonicalRefSchema).default([]),
 NDIRRoots:z.array(canonicalHashSchema).default([]),
 NDIRRefs:z.array(canonicalRefSchema).default([]),
 payloadHash:canonicalHashSchema,
 proposedStateTransition:stateTransitionSchema.nullable(),
 signatures:z.array(signatureSchema).default([]),
}).strict().superRefine((value,ctx)=>{
 if(value.objectId!==value.microDirId){
  ctx.addIssue({code:z.ZodIssueCode.custom,path:['objectId'],message:'objectId must equal microDirId'});
 }
 if(value.status==='FINALIZED'&&value.signatures.length===0){
  ctx.addIssue({code:z.ZodIssueCode.custom,path:['signatures'],message:'Finalized MDIR requires at least one signature'});
 }
 if(Date.parse(value.submittedAt)<Date.parse(value.eventOccurredAt)){
  ctx.addIssue({code:z.ZodIssueCode.custom,path:['submittedAt'],message:'submittedAt cannot precede eventOccurredAt in this implementation profile'});
 }
});

export type NanoDIR=z.infer<typeof nanoDirSchema>;
export type MicroDIR=z.infer<typeof microDirSchema>;
