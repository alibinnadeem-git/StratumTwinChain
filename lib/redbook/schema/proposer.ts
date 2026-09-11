import {z} from 'zod';

export const POVI_PROPOSER_PROFILE='STRATUM-POVI-PROPOSER/1' as const;
export const POVI_PROPOSER_ENTROPY_DOMAIN='STRATUM/POVI/PROPOSER/ENTROPY/1' as const;
export const POVI_PROPOSER_EVIDENCE_MODE='HASH_CHAINED_FINALIZED_ENTROPY' as const;

const sha256HexSchema=z.string().regex(/^[0-9a-f]{64}$/,'Must be a lowercase SHA-256 digest');

export const proposerSelectionContextSchema=z.object({
 profile:z.literal(POVI_PROPOSER_PROFILE),
 chainId:z.string().min(1),
 height:z.number().int().min(1),
 round:z.number().int().min(0),
 previousDIRHash:sha256HexSchema,
 validatorSetRoot:sha256HexSchema,
 protocolVersion:z.string().min(1),
}).strict();

export const proposerSelectionEvidenceSchema=z.object({
 profile:z.literal(POVI_PROPOSER_PROFILE),
 mode:z.literal(POVI_PROPOSER_EVIDENCE_MODE),
 seedHash:sha256HexSchema,
 activeValidatorIdsHash:sha256HexSchema,
 selectedIndex:z.number().int().min(0),
 proposerId:z.string().min(1),
}).strict();

export type ProposerSelectionContext=z.infer<typeof proposerSelectionContextSchema>;
export type ProposerSelectionEvidence=z.infer<typeof proposerSelectionEvidenceSchema>;
