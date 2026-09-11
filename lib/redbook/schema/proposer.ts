import {z} from 'zod';
import {canonicalHashSchema,canonicalIdSchema,canonicalRefSchema,schemaVersionSchema} from './common';

export const PROPOSER_SELECTION_PROFILE='STRATUM-PROPOSER-SELECTION/1' as const;
export const PROPOSER_SELECTION_DOMAIN='STRATUM/POVI/PROPOSER_SELECTION/1' as const;

/**
 * Redbook P0 implementation profile for deterministic proposer reduction.
 * The Redbook locks collective entropy + per-validator VRF + equal eligible opportunity,
 * but does not lock the VRF algorithm or winner-reduction function. Therefore every
 * VRF output and the collective entropy must arrive as externally verified inputs.
 */
export const proposerCandidateSchema=z.object({
 validatorId:canonicalIdSchema,
 vrfOutput:canonicalHashSchema,
 vrfProofRef:canonicalRefSchema,
 vrfProofVerifiedExternally:z.literal(true),
}).strict();

export const proposerSelectionInputSchema=z.object({
 selectionProfile:z.literal(PROPOSER_SELECTION_PROFILE),
 chainId:canonicalIdSchema,
 height:z.number().int().positive(),
 round:z.number().int().nonnegative(),
 validatorSetRoot:canonicalHashSchema,
 protocolVersion:schemaVersionSchema,
 collectiveEntropy:canonicalHashSchema,
 collectiveEntropyProofRefs:z.array(canonicalRefSchema).min(1),
 collectiveEntropyVerifiedExternally:z.literal(true),
 candidates:z.array(proposerCandidateSchema).min(1),
}).strict().superRefine((value,ctx)=>{
 const ids=new Set<string>();
 for(const candidate of value.candidates){
  if(ids.has(candidate.validatorId))ctx.addIssue({code:z.ZodIssueCode.custom,path:['candidates'],message:`Duplicate proposer candidate ${candidate.validatorId}`});
  ids.add(candidate.validatorId);
 }
});

export const proposerSelectionResultSchema=z.object({
 selectionProfile:z.literal(PROPOSER_SELECTION_PROFILE),
 selectionDomain:z.literal(PROPOSER_SELECTION_DOMAIN),
 chainId:canonicalIdSchema,
 height:z.number().int().positive(),
 round:z.number().int().nonnegative(),
 validatorSetRoot:canonicalHashSchema,
 protocolVersion:schemaVersionSchema,
 collectiveEntropy:canonicalHashSchema,
 selectedProposerId:canonicalIdSchema,
 selectedScore:canonicalHashSchema,
 eligibleValidatorCount:z.number().int().positive(),
 candidateScores:z.array(z.object({validatorId:canonicalIdSchema,score:canonicalHashSchema}).strict()).min(1),
 vrfProofVerification:z.literal('EXTERNAL_VERIFIED_INPUT'),
 cryptographicVRFConformant:z.literal(false),
}).strict();

export type ProposerCandidate=z.infer<typeof proposerCandidateSchema>;
export type ProposerSelectionInput=z.infer<typeof proposerSelectionInputSchema>;
export type ProposerSelectionResult=z.infer<typeof proposerSelectionResultSchema>;
