import {z} from 'zod';
import {canonicalHashSchema,canonicalIdSchema,schemaVersionSchema} from './common';
import {verifyVoteProofSchema} from './liveness';

export const PLC_PROOF_VERSION='STRATUM-PLC-PROOF/1' as const;
export const PLC_PROOF_DOMAIN='STRATUM/PLC/PROOF/1' as const;

export const poviLockCertificateProofSchema=z.object({
 domain:z.literal(PLC_PROOF_DOMAIN),
 certificateVersion:z.literal(PLC_PROOF_VERSION),
 chainId:canonicalIdSchema,
 height:z.number().int().positive(),
 round:z.number().int().nonnegative(),
 proposalHash:canonicalHashSchema,
 validatorSetRoot:canonicalHashSchema,
 protocolVersion:schemaVersionSchema,
 signerIds:z.array(canonicalIdSchema).min(1),
 VERIFYSignatures:z.array(verifyVoteProofSchema).min(1),
}).strict().superRefine((value,ctx)=>{
 const signerIds=new Set(value.signerIds);
 if(signerIds.size!==value.signerIds.length)ctx.addIssue({code:z.ZodIssueCode.custom,path:['signerIds'],message:'PLC signerIds must be unique'});
 const voteIds=new Set<string>();
 for(const vote of value.VERIFYSignatures){
  if(voteIds.has(vote.validatorId))ctx.addIssue({code:z.ZodIssueCode.custom,path:['VERIFYSignatures'],message:`Duplicate PLC VERIFY signer ${vote.validatorId}`});
  voteIds.add(vote.validatorId);
  if(vote.proposalHash==='NIL')ctx.addIssue({code:z.ZodIssueCode.custom,path:['VERIFYSignatures'],message:'PLC cannot be formed from NIL VERIFY votes'});
  if(vote.chainId!==value.chainId||vote.height!==value.height||vote.round!==value.round||vote.proposalHash!==value.proposalHash||vote.validatorSetRoot!==value.validatorSetRoot||vote.protocolVersion!==value.protocolVersion){
   ctx.addIssue({code:z.ZodIssueCode.custom,path:['VERIFYSignatures'],message:`PLC VERIFY context mismatch for ${vote.validatorId}`});
  }
 }
});

export type PoVILockCertificateProof=z.infer<typeof poviLockCertificateProofSchema>;
