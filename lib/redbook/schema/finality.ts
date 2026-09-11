import {z} from 'zod';
import {canonicalHashSchema,canonicalIdSchema,schemaVersionSchema} from './common';
import {dirCandidateHeaderSchema} from './povi';

export const PFC_PROOF_VERSION='STRATUM-PFC-PROOF/1' as const;
export const PFC_PROOF_DOMAIN='STRATUM/PFC/PROOF/1' as const;
export const DIR_FINALITY_PROOF_VERSION='STRATUM-DIR-FINALITY-PROOF/1' as const;
export const POVI_PROPOSAL_DOMAIN='STRATUM/POVI/PROPOSAL/1' as const;
export const POVI_COMMIT_DOMAIN='STRATUM/POVI/COMMIT/1' as const;
export const DIR_HASH_DOMAIN='STRATUM/DIR/1' as const;

export const commitVoteProofSchema=z.object({
 validatorId:canonicalIdSchema,
 proposalHash:canonicalHashSchema,
 stateRoot:canonicalHashSchema,
 messageHash:canonicalHashSchema,
 signature:z.string().min(1),
}).strict();

export const pfcProofEnvelopeSchema=z.object({
 domain:z.literal(PFC_PROOF_DOMAIN),
 proofVersion:z.literal(PFC_PROOF_VERSION),
 chainId:canonicalIdSchema,
 height:z.number().int().positive(),
 round:z.number().int().nonnegative(),
 DIRHash:canonicalHashSchema,
 proposalHash:canonicalHashSchema,
 stateRoot:canonicalHashSchema,
 validatorSetRoot:canonicalHashSchema,
 protocolVersion:schemaVersionSchema,
 signerIds:z.array(canonicalIdSchema).min(1),
 COMMITSignatures:z.array(commitVoteProofSchema).min(1),
}).strict().superRefine((value,ctx)=>{
 const signerIds=new Set(value.signerIds);
 if(signerIds.size!==value.signerIds.length)ctx.addIssue({code:z.ZodIssueCode.custom,path:['signerIds'],message:'PFC signerIds must be unique'});
 const voteIds=new Set<string>();
 for(const vote of value.COMMITSignatures){
  if(voteIds.has(vote.validatorId))ctx.addIssue({code:z.ZodIssueCode.custom,path:['COMMITSignatures'],message:`Duplicate COMMIT signer ${vote.validatorId}`});
  voteIds.add(vote.validatorId);
 }
});

export const dirFinalityProofSchema=z.object({
 proofVersion:z.literal(DIR_FINALITY_PROOF_VERSION),
 header:dirCandidateHeaderSchema,
 PFC:pfcProofEnvelopeSchema,
}).strict();

export type PFCProofEnvelope=z.infer<typeof pfcProofEnvelopeSchema>;
export type DIRFinalityProof=z.infer<typeof dirFinalityProofSchema>;
