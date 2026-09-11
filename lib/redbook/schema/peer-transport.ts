import {z} from 'zod';
import {canonicalHashSchema,canonicalIdSchema,schemaVersionSchema,utcIsoTimestampSchema} from './common';

export const PEER_TRANSPORT_PROFILE='STRATUM-PEER-TRANSPORT/1' as const;
export const PEER_TRANSPORT_ENVELOPE_DOMAIN='STRATUM/PEER/ENVELOPE/1' as const;
export const PEER_TRANSPORT_REGISTRY_PROFILE='STRATUM-PEER-REGISTRY/1' as const;
export const PEER_TRANSPORT_REGISTRY_DOMAIN='STRATUM/PEER_REGISTRY/1' as const;

export const readOnlyPeerMessageTypes=['PING','STATUS','TRUST_ROOTS','SYNC_HEAD','SYNC_PROOF'] as const;
export const readOnlyPeerMessageTypeSchema=z.enum(readOnlyPeerMessageTypes);

export const peerTransportKeySchema=z.object({
 keyId:canonicalIdSchema,
 purpose:z.literal('TRANSPORT'),
 algorithm:z.literal('ED25519_TRANSPORT_IDENTITY'),
 publicKeyDerB64:z.string().min(1),
 activeFromHeight:z.number().int().nonnegative(),
 retiredAtHeight:z.number().int().positive().nullable(),
}).strict().superRefine((value,ctx)=>{
 if(value.retiredAtHeight!==null&&value.retiredAtHeight<=value.activeFromHeight){
  ctx.addIssue({code:z.ZodIssueCode.custom,path:['retiredAtHeight'],message:'retiredAtHeight must follow activeFromHeight'});
 }
});

export const peerTransportMemberSchema=z.object({
 validatorId:canonicalIdSchema,
 keys:z.array(peerTransportKeySchema).min(1),
}).strict().superRefine((value,ctx)=>{
 const ids=new Set<string>();
 for(const key of value.keys){
  if(ids.has(key.keyId))ctx.addIssue({code:z.ZodIssueCode.custom,path:['keys'],message:`Duplicate TRANSPORT keyId ${key.keyId}`});
  ids.add(key.keyId);
 }
});

export const peerTransportRegistrySchema=z.object({
 registryVersion:z.literal(PEER_TRANSPORT_REGISTRY_PROFILE),
 chainId:canonicalIdSchema,
 GenesisDIRHash:canonicalHashSchema,
 protocolVersion:schemaVersionSchema,
 members:z.array(peerTransportMemberSchema).min(1),
}).strict().superRefine((value,ctx)=>{
 const ids=new Set<string>();
 for(const member of value.members){
  if(ids.has(member.validatorId))ctx.addIssue({code:z.ZodIssueCode.custom,path:['members'],message:`Duplicate validatorId ${member.validatorId}`});
  ids.add(member.validatorId);
 }
});

export const peerEnvelopeSchema=z.object({
 profileVersion:z.literal(PEER_TRANSPORT_PROFILE),
 domain:z.literal(PEER_TRANSPORT_ENVELOPE_DOMAIN),
 chainId:canonicalIdSchema,
 networkName:z.string().trim().min(1).max(256),
 GenesisDIRHash:canonicalHashSchema,
 protocolVersion:schemaVersionSchema,
 senderValidatorId:canonicalIdSchema,
 senderKeyId:canonicalIdSchema,
 sequence:z.number().int().positive(),
 nonce:z.string().trim().min(8).max(256),
 issuedAt:utcIsoTimestampSchema,
 expiresAt:utcIsoTimestampSchema,
 messageType:readOnlyPeerMessageTypeSchema,
 payload:z.unknown(),
 payloadHash:canonicalHashSchema,
 messageHash:canonicalHashSchema,
 signatureB64:z.string().min(1),
}).strict().superRefine((value,ctx)=>{
 const issued=Date.parse(value.issuedAt);
 const expires=Date.parse(value.expiresAt);
 if(Number.isFinite(issued)&&Number.isFinite(expires)&&expires<=issued){
  ctx.addIssue({code:z.ZodIssueCode.custom,path:['expiresAt'],message:'expiresAt must follow issuedAt'});
 }
});

export const peerReplayStateSchema=z.object({
 profileVersion:z.literal(PEER_TRANSPORT_PROFILE),
 chainId:canonicalIdSchema,
 lastSequence:z.record(z.number().int().nonnegative()),
 seenNonces:z.record(utcIsoTimestampSchema),
 updatedAt:utcIsoTimestampSchema,
}).strict();

export type PeerTransportRegistry=z.infer<typeof peerTransportRegistrySchema>;
export type PeerEnvelope=z.infer<typeof peerEnvelopeSchema>;
export type PeerReplayState=z.infer<typeof peerReplayStateSchema>;
