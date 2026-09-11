import {canonicalHash} from '@/lib/server/hash';
import {canonicalValidatorSetAtHeight,validatorSetRootAtHeight} from '@/lib/redbook/snapshot-trust';
import {snapshotValidatorSetSchema} from '@/lib/redbook/schema/snapshot';
import {
 POVI_PROPOSER_ENTROPY_DOMAIN,
 POVI_PROPOSER_EVIDENCE_MODE,
 POVI_PROPOSER_PROFILE,
 proposerSelectionContextSchema,
 proposerSelectionEvidenceSchema,
 type ProposerSelectionContext,
 type ProposerSelectionEvidence,
} from '@/lib/redbook/schema/proposer';

export function proposerEntropyPayload(input:ProposerSelectionContext|unknown){
 const context=proposerSelectionContextSchema.parse(input);
 return{
  domain:POVI_PROPOSER_ENTROPY_DOMAIN,
  profile:context.profile,
  chainId:context.chainId,
  height:context.height,
  round:context.round,
  previousDIRHash:context.previousDIRHash,
  validatorSetRoot:context.validatorSetRoot,
  protocolVersion:context.protocolVersion,
 };
}

export function proposerSeedHash(input:ProposerSelectionContext|unknown){
 return canonicalHash(proposerEntropyPayload(input));
}

function selectionIndex(seedHash:string,validatorCount:number){
 if(!Number.isInteger(validatorCount)||validatorCount<1)throw new Error('validatorCount must be a positive integer');
 return Number(BigInt(`0x${seedHash}`)%BigInt(validatorCount));
}

/**
 * Deterministic pre-production proposer profile.
 *
 * This deliberately does NOT claim VRF security. It makes proposer selection
 * independently recomputable for P0 distributed-network testing while the
 * production VRF primitive remains an explicit activation blocker.
 */
export function selectDeterministicProposer(args:{
 context:ProposerSelectionContext|unknown;
 validatorSet:unknown;
 expectedValidatorSetRoot:string;
}):ProposerSelectionEvidence{
 const context=proposerSelectionContextSchema.parse(args.context);
 const validatorSet=snapshotValidatorSetSchema.parse(args.validatorSet);
 if(validatorSet.chainId!==context.chainId)throw new Error('Proposer validator-set chainId mismatch');
 const computedRoot=validatorSetRootAtHeight(validatorSet,context.height);
 if(computedRoot!==args.expectedValidatorSetRoot||computedRoot!==context.validatorSetRoot)throw new Error('Proposer validator-set root does not match independently trusted root');
 const active=canonicalValidatorSetAtHeight(validatorSet,context.height).validators;
 const activeValidatorIds=active.map(member=>member.validatorId);
 const seedHash=proposerSeedHash(context);
 const selectedIndex=selectionIndex(seedHash,activeValidatorIds.length);
 return proposerSelectionEvidenceSchema.parse({
  profile:POVI_PROPOSER_PROFILE,
  mode:POVI_PROPOSER_EVIDENCE_MODE,
  seedHash,
  activeValidatorIdsHash:canonicalHash(activeValidatorIds),
  selectedIndex,
  proposerId:activeValidatorIds[selectedIndex],
 });
}

export function verifyDeterministicProposer(args:{
 context:ProposerSelectionContext|unknown;
 evidence:ProposerSelectionEvidence|unknown;
 validatorSet:unknown;
 expectedValidatorSetRoot:string;
}){
 const supplied=proposerSelectionEvidenceSchema.parse(args.evidence);
 const expected=selectDeterministicProposer({
  context:args.context,
  validatorSet:args.validatorSet,
  expectedValidatorSetRoot:args.expectedValidatorSetRoot,
 });
 if(canonicalHash(supplied)!==canonicalHash(expected))throw new Error('Proposer evidence does not match deterministic selection');
 return Object.freeze({
  valid:true as const,
  profile:expected.profile,
  mode:expected.mode,
  proposerId:expected.proposerId,
  seedHash:expected.seedHash,
  activeValidatorIdsHash:expected.activeValidatorIdsHash,
  selectedIndex:expected.selectedIndex,
  vrfConformant:false as const,
  productionActivationAllowed:false as const,
 });
}
