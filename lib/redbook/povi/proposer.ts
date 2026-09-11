import {canonicalHash} from '@/lib/server/hash';
import {snapshotValidatorSetSchema} from '../schema/snapshot';
import {
 PROPOSER_SELECTION_DOMAIN,
 PROPOSER_SELECTION_PROFILE,
 proposerSelectionInputSchema,
 proposerSelectionResultSchema,
 type ProposerSelectionResult,
} from '../schema/proposer';
import {validatorActiveAtHeight,validatorSetRootAtHeight} from '../snapshot-trust';

export function proposerCandidateScore(args:{
 chainId:string;
 height:number;
 round:number;
 validatorSetRoot:string;
 protocolVersion:string;
 collectiveEntropy:string;
 validatorId:string;
 vrfOutput:string;
}){
 return canonicalHash({
  domain:PROPOSER_SELECTION_DOMAIN,
  profile:PROPOSER_SELECTION_PROFILE,
  chainId:args.chainId,
  height:args.height,
  round:args.round,
  validatorSetRoot:args.validatorSetRoot,
  protocolVersion:args.protocolVersion,
  collectiveEntropy:args.collectiveEntropy,
  validatorId:args.validatorId,
  vrfOutput:args.vrfOutput,
 });
}

/**
 * Deterministic engineering profile over already-verified VRF outputs.
 * This function does not verify the VRF proof itself; that remains a separate
 * cryptographic conformance gate. Equal eligibility is enforced by requiring
 * exactly one candidate for every ACTIVE validator and no others.
 */
export function selectProposerFromVerifiedVRF(args:{validatorSet:unknown;selection:unknown}):ProposerSelectionResult{
 const validatorSet=snapshotValidatorSetSchema.parse(args.validatorSet);
 const selection=proposerSelectionInputSchema.parse(args.selection);
 if(validatorSet.chainId!==selection.chainId)throw new Error('Proposer-selection chainId mismatch');
 const computedRoot=validatorSetRootAtHeight(validatorSet,selection.height);
 if(computedRoot!==selection.validatorSetRoot)throw new Error(`Proposer-selection validatorSetRoot mismatch: computed ${computedRoot}`);
 const activeIds=validatorSet.members.filter(member=>validatorActiveAtHeight(member,selection.height)).map(member=>member.validatorId).sort();
 const candidateIds=selection.candidates.map(candidate=>candidate.validatorId).sort();
 if(activeIds.length!==candidateIds.length||activeIds.some((id,index)=>id!==candidateIds[index])){
  throw new Error('Equal eligible opportunity requires exactly one externally verified VRF candidate for every ACTIVE validator and no non-ACTIVE candidates');
 }
 const candidateScores=selection.candidates.map(candidate=>({
  validatorId:candidate.validatorId,
  score:proposerCandidateScore({
   chainId:selection.chainId,
   height:selection.height,
   round:selection.round,
   validatorSetRoot:selection.validatorSetRoot,
   protocolVersion:selection.protocolVersion,
   collectiveEntropy:selection.collectiveEntropy,
   validatorId:candidate.validatorId,
   vrfOutput:candidate.vrfOutput,
  }),
 })).sort((a,b)=>a.score.localeCompare(b.score)||a.validatorId.localeCompare(b.validatorId));
 const selected=candidateScores[0];
 if(!selected)throw new Error('No eligible proposer candidates');
 return proposerSelectionResultSchema.parse({
  selectionProfile:PROPOSER_SELECTION_PROFILE,
  selectionDomain:PROPOSER_SELECTION_DOMAIN,
  chainId:selection.chainId,
  height:selection.height,
  round:selection.round,
  validatorSetRoot:selection.validatorSetRoot,
  protocolVersion:selection.protocolVersion,
  collectiveEntropy:selection.collectiveEntropy,
  selectedProposerId:selected.validatorId,
  selectedScore:selected.score,
  eligibleValidatorCount:activeIds.length,
  candidateScores,
  vrfProofVerification:'EXTERNAL_VERIFIED_INPUT',
  cryptographicVRFConformant:false,
 });
}
