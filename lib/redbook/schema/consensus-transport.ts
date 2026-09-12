import {z} from 'zod';
import {canonicalHashSchema,canonicalIdSchema,schemaVersionSchema} from './common';
import {verifyVoteProofSchema,roundChangeVoteProofSchema} from './liveness';

export const CONSENSUS_TRANSPORT_PROFILE='STRATUM-CONSENSUS-TRANSPORT/1' as const;
export const CONSENSUS_COMMIT_DOMAIN='STRATUM/POVI/COMMIT/1' as const;

export const consensusCommitVoteProofSchema=z.object({
 domain:z.literal(CONSENSUS_COMMIT_DOMAIN),
 chainId:canonicalIdSchema,
 height:z.number().int().positive(),
 round:z.number().int().nonnegative(),
 step:z.literal('COMMIT'),
 proposalHash:canonicalHashSchema,
 stateRoot:canonicalHashSchema,
 validatorId:canonicalIdSchema,
 validatorSetRoot:canonicalHashSchema,
 protocolVersion:schemaVersionSchema,
 keyId:canonicalIdSchema,
 algorithm:z.literal('Ed25519'),
 messageHash:canonicalHashSchema,
 signatureB64:z.string().min(1),
}).strict();

const wireBase={profileVersion:z.literal(CONSENSUS_TRANSPORT_PROFILE)} as const;

export const verifyConsensusWireSchema=z.object({
 ...wireBase,
 messageType:z.literal('VERIFY'),
 message:verifyVoteProofSchema,
}).strict();

export const commitConsensusWireSchema=z.object({
 ...wireBase,
 messageType:z.literal('COMMIT'),
 message:consensusCommitVoteProofSchema,
}).strict();

export const roundChangeConsensusWireSchema=z.object({
 ...wireBase,
 messageType:z.literal('ROUND_CHANGE'),
 triggerRound:z.number().int().nonnegative(),
 message:roundChangeVoteProofSchema,
}).strict().superRefine((value,ctx)=>{
 if(value.message.newRound<=value.triggerRound){
  ctx.addIssue({code:z.ZodIssueCode.custom,path:['triggerRound'],message:'ROUND_CHANGE newRound must be greater than triggerRound'});
 }
});

/**
 * Staged consensus-bearing wire profile. PROPOSAL is intentionally excluded
 * until a durable proposer-intent journal profile is implemented. These
 * schemas do not grant vote authority and do not activate a validator.
 *
 * z.union is intentional here: ROUND_CHANGE carries refined evidence and is
 * therefore a ZodEffects surface rather than a raw ZodObject.
 */
export const consensusWireMessageSchema=z.union([
 verifyConsensusWireSchema,
 commitConsensusWireSchema,
 roundChangeConsensusWireSchema,
]);

export type ConsensusCommitVoteProof=z.infer<typeof consensusCommitVoteProofSchema>;
export type ConsensusWireMessage=z.infer<typeof consensusWireMessageSchema>;
