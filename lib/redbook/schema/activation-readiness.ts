import {z} from 'zod';
import {canonicalIdSchema} from './common';

export const activationReadinessSchema=z.object({
 governanceProofValid:z.literal(true),
 validatorId:canonicalIdSchema,
 effectiveHeight:z.number().int().nonnegative(),
 currentHeight:z.number().int().nonnegative(),
 localIdentityMatch:z.literal(true),
 localConsensusKeyMatch:z.literal(true),
 governanceActivationDue:z.boolean(),
 voteAuthority:z.literal(false),
 remainingActivationBlockers:z.array(z.string().trim().min(1)),
 readyForVoteAuthority:z.boolean(),
}).strict().superRefine((value,ctx)=>{
 if(value.readyForVoteAuthority&&(!value.governanceActivationDue||value.remainingActivationBlockers.length!==0)){
  ctx.addIssue({code:z.ZodIssueCode.custom,path:['readyForVoteAuthority'],message:'vote-authority readiness requires effective height reached and zero remaining blockers'});
 }
 if(value.currentHeight<value.effectiveHeight&&value.governanceActivationDue){
  ctx.addIssue({code:z.ZodIssueCode.custom,path:['governanceActivationDue'],message:'activation cannot be due before effective height'});
 }
});

export type ActivationReadiness=z.infer<typeof activationReadinessSchema>;
