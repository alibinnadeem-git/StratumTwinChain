import {z} from 'zod';
import {canonicalHashSchema,canonicalIdSchema,utcIsoTimestampSchema} from './common';
import {peerReplayStateSchema,readOnlyPeerMessageTypeSchema} from './peer-transport';

export const PEER_SESSION_PROFILE='STRATUM-PEER-SESSION/1' as const;

/**
 * STRATUM read-only peer-session implementation profile.
 *
 * This schema describes the candidate-only runtime/session state used before
 * live PoVI consensus networking is activated. It does not grant vote
 * authority and it does not authorize PROPOSAL/VERIFY/COMMIT/ROUND_CHANGE.
 */
export const peerSessionStateSchema=z.object({
 profileVersion:z.literal(PEER_SESSION_PROFILE),
 chainId:canonicalIdSchema,
 outboundSequence:z.number().int().nonnegative(),
 replay:peerReplayStateSchema,
 updatedAt:utcIsoTimestampSchema,
}).strict().superRefine((value,ctx)=>{
 if(value.replay.chainId!==value.chainId){
  ctx.addIssue({code:z.ZodIssueCode.custom,path:['replay','chainId'],message:'peer session replay state must be bound to the same chainId'});
 }
});

export const peerSessionCapabilitiesSchema=z.object({
 profileVersion:z.literal(PEER_SESSION_PROFILE),
 state:z.literal('CANDIDATE'),
 voteAuthority:z.literal(false),
 readOnly:z.literal(true),
 allowedMessageTypes:z.array(readOnlyPeerMessageTypeSchema).length(3),
 consensusBearingTrafficEnabled:z.literal(false),
 livePoviNetworkExecution:z.literal(false),
}).strict().superRefine((value,ctx)=>{
 const required=new Set(['PING','STATUS','TRUST_ROOTS']);
 const actual=new Set(value.allowedMessageTypes);
 if(actual.size!==required.size||[...required].some((message)=>!actual.has(message as typeof value.allowedMessageTypes[number]))){
  ctx.addIssue({code:z.ZodIssueCode.custom,path:['allowedMessageTypes'],message:'read-only peer session must allow exactly PING, STATUS, and TRUST_ROOTS'});
 }
});

export const peerSessionTrustContextSchema=z.object({
 profileVersion:z.literal(PEER_SESSION_PROFILE),
 chainId:canonicalIdSchema,
 GenesisDIRHash:canonicalHashSchema,
 protocolVersion:z.string().trim().min(1),
 validatorId:canonicalIdSchema,
 transportKeyId:canonicalIdSchema,
 peerRegistryRoot:canonicalHashSchema,
 trustedHeight:z.number().int().nonnegative(),
 state:z.literal('CANDIDATE'),
 voteAuthority:z.literal(false),
 readOnly:z.literal(true),
}).strict();

export type PeerSessionState=z.infer<typeof peerSessionStateSchema>;
export type PeerSessionCapabilities=z.infer<typeof peerSessionCapabilitiesSchema>;
export type PeerSessionTrustContext=z.infer<typeof peerSessionTrustContextSchema>;
