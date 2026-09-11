import {z} from 'zod';
import {canonicalHashSchema,canonicalIdSchema,canonicalRefSchema,schemaVersionSchema} from './common';

export const POVI_VERIFY_DOMAIN='STRATUM/POVI/VERIFY/1' as const;
export const POVI_ROUND_CHANGE_DOMAIN='STRATUM/POVI/ROUND_CHANGE/1' as const;
export const ROUND_CHANGE_EVIDENCE_VERSION='STRATUM-ROUND-CHANGE-EVIDENCE/1' as const;

export const verifyVoteProofSchema=z.object({domain:z.literal(POVI_VERIFY_DOMAIN),chainId:canonicalIdSchema,height:z.number().int().positive(),round:z.number().int().nonnegative(),step:z.literal('VERIFY'),proposalHash:z.union([canonicalHashSchema,z.literal('NIL')]),validatorId:canonicalIdSchema,validatorSetRoot:canonicalHashSchema,protocolVersion:schemaVersionSchema,keyId:canonicalIdSchema,algorithm:z.literal('Ed25519'),messageHash:canonicalHashSchema,signatureB64:z.string().min(1)}).strict();

export const roundChangeVoteProofSchema=z.object({domain:z.literal(POVI_ROUND_CHANGE_DOMAIN),chainId:canonicalIdSchema,height:z.number().int().positive(),newRound:z.number().int().positive(),validatorId:canonicalIdSchema,validatorSetRoot:canonicalHashSchema,protocolVersion:schemaVersionSchema,lockedDIR:canonicalHashSchema.nullable(),lockedRound:z.number().int().nonnegative().nullable(),validDIR:canonicalHashSchema.nullable(),validRound:z.number().int().nonnegative().nullable(),evidenceRefs:z.array(canonicalRefSchema).default([]),keyId:canonicalIdSchema,algorithm:z.literal('Ed25519'),messageHash:canonicalHashSchema,signatureB64:z.string().min(1)}).strict().superRefine((value,ctx)=>{
 const lockedPair=(value.lockedDIR===null)===(value.lockedRound===null); if(!lockedPair)ctx.addIssue({code:z.ZodIssueCode.custom,path:['lockedDIR'],message:'lockedDIR and lockedRound must be supplied together'});
 const validPair=(value.validDIR===null)===(value.validRound===null); if(!validPair)ctx.addIssue({code:z.ZodIssueCode.custom,path:['validDIR'],message:'validDIR and validRound must be supplied together'});
 if(value.lockedRound!==null&&value.lockedRound>=value.newRound)ctx.addIssue({code:z.ZodIssueCode.custom,path:['lockedRound'],message:'lockedRound must precede newRound'});
 if(value.validRound!==null&&value.validRound>=value.newRound)ctx.addIssue({code:z.ZodIssueCode.custom,path:['validRound'],message:'validRound must precede newRound'});
 if((value.lockedDIR!==null||value.validDIR!==null)&&value.evidenceRefs.length===0)ctx.addIssue({code:z.ZodIssueCode.custom,path:['evidenceRefs'],message:'Lock/valid-value claims require evidenceRefs; ROUND_CHANGE alone never proves an unlock'});
});

export const roundChangeQuorumEvidenceSchema=z.object({evidenceVersion:z.literal(ROUND_CHANGE_EVIDENCE_VERSION),chainId:canonicalIdSchema,height:z.number().int().positive(),triggerRound:z.number().int().nonnegative(),newRound:z.number().int().positive(),validatorSetRoot:canonicalHashSchema,protocolVersion:schemaVersionSchema,roundChangeVotes:z.array(roundChangeVoteProofSchema).min(1),priorRoundNILVotes:z.array(verifyVoteProofSchema).default([])}).strict().superRefine((value,ctx)=>{
 if(value.newRound<=value.triggerRound)ctx.addIssue({code:z.ZodIssueCode.custom,path:['newRound'],message:'newRound must be greater than triggerRound'});
 for(const vote of value.roundChangeVotes)if(vote.chainId!==value.chainId||vote.height!==value.height||vote.newRound!==value.newRound||vote.validatorSetRoot!==value.validatorSetRoot||vote.protocolVersion!==value.protocolVersion)ctx.addIssue({code:z.ZodIssueCode.custom,path:['roundChangeVotes'],message:`ROUND_CHANGE context mismatch for ${vote.validatorId}`});
 for(const vote of value.priorRoundNILVotes)if(vote.chainId!==value.chainId||vote.height!==value.height||vote.round!==value.triggerRound||vote.proposalHash!=='NIL'||vote.validatorSetRoot!==value.validatorSetRoot||vote.protocolVersion!==value.protocolVersion)ctx.addIssue({code:z.ZodIssueCode.custom,path:['priorRoundNILVotes'],message:`NIL VERIFY context mismatch for ${vote.validatorId}`});
});

export type VerifyVoteProof=z.infer<typeof verifyVoteProofSchema>;
export type RoundChangeVoteProof=z.infer<typeof roundChangeVoteProofSchema>;
export type RoundChangeQuorumEvidence=z.infer<typeof roundChangeQuorumEvidenceSchema>;
