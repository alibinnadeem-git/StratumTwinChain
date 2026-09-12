import {z} from 'zod';
import {canonicalHashSchema,canonicalIdSchema,schemaVersionSchema,utcIsoTimestampSchema} from './common';
import {snapshotTrustCertificateSchema,snapshotValidatorSetSchema} from './snapshot';
import {dirFinalityProofSchema} from './finality';
import {validatorSetChangeProofSchema} from './validator-governance';

export const PEER_SYNC_PROFILE='STRATUM-PEER-SYNC/1' as const;

export const peerSyncTrustedHeadSchema=z.object({
 profileVersion:z.literal(PEER_SYNC_PROFILE),
 chainId:canonicalIdSchema,
 GenesisDIRHash:canonicalHashSchema,
 protocolVersion:schemaVersionSchema,
 height:z.number().int().nonnegative(),
 DIRHash:canonicalHashSchema,
 stateRoot:canonicalHashSchema,
 validatorSetRoot:canonicalHashSchema,
 verifiedAt:utcIsoTimestampSchema,
 sourcePeerValidatorId:canonicalIdSchema,
}).strict();

export const peerSyncHeadRequestSchema=z.object({
 profileVersion:z.literal(PEER_SYNC_PROFILE),
 requestType:z.literal('SYNC_HEAD'),
 trustedHeight:z.number().int().nonnegative(),
 trustedDIRHash:canonicalHashSchema.nullable(),
}).strict();

export const peerSyncHeadResponseSchema=z.object({
 profileVersion:z.literal(PEER_SYNC_PROFILE),
 responseType:z.literal('SYNC_HEAD'),
 chainId:canonicalIdSchema,
 GenesisDIRHash:canonicalHashSchema,
 protocolVersion:schemaVersionSchema,
 latestHeight:z.number().int().nonnegative(),
 latestDIRHash:canonicalHashSchema,
 latestStateRoot:canonicalHashSchema,
 validatorSetRoot:canonicalHashSchema,
 snapshotHeight:z.number().int().nonnegative().nullable(),
}).strict();

export const peerSyncProofRequestSchema=z.object({
 profileVersion:z.literal(PEER_SYNC_PROFILE),
 requestType:z.literal('SYNC_PROOF'),
 fromHeight:z.number().int().nonnegative(),
 toHeight:z.number().int().positive(),
}).strict().superRefine((value,ctx)=>{
 if(value.toHeight<=value.fromHeight)ctx.addIssue({code:z.ZodIssueCode.custom,path:['toHeight'],message:'toHeight must be greater than fromHeight'});
});

export const peerSyncProofBundleSchema=z.object({
 profileVersion:z.literal(PEER_SYNC_PROFILE),
 responseType:z.literal('SYNC_PROOF'),
 chainId:canonicalIdSchema,
 GenesisDIRHash:canonicalHashSchema,
 protocolVersion:schemaVersionSchema,
 validatorSet:snapshotValidatorSetSchema,
 snapshotCertificate:snapshotTrustCertificateSchema.nullable(),
 validatorSetTransitions:z.array(validatorSetChangeProofSchema).max(64).optional().default([]),
 finalityProofs:z.array(dirFinalityProofSchema).min(1).max(512),
 generatedAt:utcIsoTimestampSchema,
}).strict().superRefine((value,ctx)=>{
 let previousHeight=-1;
 for(const [index,proof] of value.finalityProofs.entries()){
  const height=proof.header.height;
  if(height<=previousHeight)ctx.addIssue({code:z.ZodIssueCode.custom,path:['finalityProofs',index],message:'finalityProofs must be strictly height-ordered'});
  previousHeight=height;
 }
 const transitionHeights=new Set<number>();
 for(const [index,transition] of value.validatorSetTransitions.entries()){
  const height=transition.action.effectiveHeight;
  if(transitionHeights.has(height))ctx.addIssue({code:z.ZodIssueCode.custom,path:['validatorSetTransitions',index],message:`Duplicate validator-set transition at effective height ${height}`});
  transitionHeights.add(height);
 }
});

export type PeerSyncTrustedHead=z.infer<typeof peerSyncTrustedHeadSchema>;
export type PeerSyncHeadRequest=z.infer<typeof peerSyncHeadRequestSchema>;
export type PeerSyncHeadResponse=z.infer<typeof peerSyncHeadResponseSchema>;
export type PeerSyncProofRequest=z.infer<typeof peerSyncProofRequestSchema>;
export type PeerSyncProofBundle=z.infer<typeof peerSyncProofBundleSchema>;
