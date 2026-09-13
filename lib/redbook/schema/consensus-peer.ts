import {z} from 'zod';
import {canonicalHashSchema,canonicalIdSchema,schemaVersionSchema,utcIsoTimestampSchema} from './common';

export const CONSENSUS_PEER_PROFILE='STRATUM-CONSENSUS-PEER/1' as const;
export const CONSENSUS_PEER_DOMAIN='STRATUM/POVI/PEER_MESSAGE/1' as const;
export const consensusPeerStepSchema=z.enum(['VERIFY','COMMIT','ROUND_CHANGE']);

export const consensusPeerPacketSchema=z.object({
 profileVersion:z.literal(CONSENSUS_PEER_PROFILE),
 domain:z.literal(CONSENSUS_PEER_DOMAIN),
 chainId:canonicalIdSchema,
 networkName:z.string().trim().min(1).max(256),
 GenesisDIRHash:canonicalHashSchema,
 protocolVersion:schemaVersionSchema,
 senderValidatorId:canonicalIdSchema,
 senderConsensusKeyId:canonicalIdSchema,
 senderTransportKeyId:canonicalIdSchema,
 height:z.number().int().positive(),
 round:z.number().int().nonnegative(),
 step:consensusPeerStepSchema,
 validatorSetRoot:canonicalHashSchema,
 peerRegistryRoot:canonicalHashSchema,
 issuedAt:utcIsoTimestampSchema,
 expiresAt:utcIsoTimestampSchema,
 sequence:z.number().int().positive(),
 nonce:z.string().trim().min(16).max(256),
 payload:z.unknown(),
 payloadHash:canonicalHashSchema,
 consensusMessageHash:canonicalHashSchema,
 consensusSignatureB64:z.string().min(1),
 safetyRecordHash:canonicalHashSchema,
 safetySequence:z.number().int().nonnegative(),
 packetHash:canonicalHashSchema,
 transportSignatureB64:z.string().min(1),
}).strict().superRefine((value,ctx)=>{
 const issued=Date.parse(value.issuedAt);
 const expires=Date.parse(value.expiresAt);
 if(Number.isFinite(issued)&&Number.isFinite(expires)&&expires<=issued){
  ctx.addIssue({code:z.ZodIssueCode.custom,path:['expiresAt'],message:'expiresAt must follow issuedAt'});
 }
});

export const consensusPeerVerificationSchema=z.object({
 valid:z.literal(true),
 senderValidatorId:canonicalIdSchema,
 height:z.number().int().positive(),
 round:z.number().int().nonnegative(),
 step:consensusPeerStepSchema,
 validatorSetRoot:canonicalHashSchema,
 peerRegistryRoot:canonicalHashSchema,
 consensusMessageHash:canonicalHashSchema,
 packetHash:canonicalHashSchema,
 safetyRecordHash:canonicalHashSchema,
 safetySequence:z.number().int().nonnegative(),
 safetyReferencePresent:z.literal(true),
 persistBeforeSignVerified:z.boolean(),
}).strict().superRefine((value,ctx)=>{
 if(value.persistBeforeSignVerified){
  ctx.addIssue({code:z.ZodIssueCode.custom,path:['persistBeforeSignVerified'],message:'STRATUM-CONSENSUS-PEER/1 packet verification alone cannot prove remote persist-before-sign; a separately verified signed safety-record proof is required'});
 }
});

export type ConsensusPeerPacket=z.infer<typeof consensusPeerPacketSchema>;
export type ConsensusPeerVerification=z.infer<typeof consensusPeerVerificationSchema>;
