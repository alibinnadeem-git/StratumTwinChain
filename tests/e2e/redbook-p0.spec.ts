import {expect,test} from '@playwright/test';
import {
 acceptProposal,
 acceptProposalWithHigherRoundPLC,
 beginCommit,
 canonicalEventForLegacy,
 createLifecycleMicroDirCandidate,
 createPoVIHeightState,
 enterHigherRound,
 eventRegistry,
 finalizeWithPFC,
 hasPoviQuorum,
 nanoDirSchema,
 recordCommitVote,
 recordVerifyVote,
 requiredPoviQuorum,
 stateTransitionRegistry,
 validateStateTransition,
 type PoVIFinalityCertificate,
 type VerifiedPoVILockCertificate,
 type VerifiedRoundChangeQuorumEvidence,
} from '../../lib/redbook';

const h=(char:string)=>char.repeat(64);
const active=['validator-a','validator-b','validator-c'];

function verifiedRoundChange(chainId:string,height:number,triggerRound:number,newRound:number):VerifiedRoundChangeQuorumEvidence{
 return{
  verified:true,
  evidence:{evidenceVersion:'STRATUM-ROUND-CHANGE-EVIDENCE/1',chainId,height,triggerRound,newRound,validatorSetRoot:h('f'),protocolVersion:'POVI/1',roundChangeVotes:[],priorRoundNILVotes:[]},
  activeValidatorCount:3,requiredQuorum:3,validSignerIds:active,nilQuorumVerified:true,lockClaims:[],validValueClaims:[],safeUnlockAuthorized:false,
 };
}

function verifiedPLC(chainId:string,height:number,round:number,proposalHash:string):VerifiedPoVILockCertificate{
 return{
  verified:true,
  PLC:{domain:'STRATUM/PLC/PROOF/1',certificateVersion:'STRATUM-PLC-PROOF/1',chainId,height,round,proposalHash,validatorSetRoot:h('f'),protocolVersion:'POVI/1',signerIds:active,VERIFYSignatures:[]},
  activeValidatorCount:3,requiredQuorum:3,validSignerIds:active,
 };
}

test('Redbook locked PoVI quorum table is enforced',()=>{
 const expected:Record<number,number>={3:3,4:3,5:4,6:5,7:5,8:6,9:7,12:9};
 for(const [n,q] of Object.entries(expected))expect(requiredPoviQuorum(Number(n))).toBe(q);
 expect(hasPoviQuorum(3,2)).toBeFalsy();
 expect(hasPoviQuorum(3,3)).toBeTruthy();
});

test('Appendix B starter events are machine-readable and retain P0-P3 priorities',()=>{
 expect(eventRegistry.ASSET_REGISTERED.effect).toBe('REGISTERED');
 expect(eventRegistry.ENERGIZATION_AUTHORIZED.authority).toEqual(['H4','H5']);
 expect(eventRegistry.VALIDATOR_ACTIVATED.priority).toBe('P0');
 expect(eventRegistry.MAINTENANCE_COMPLETED.priority).toBe('P3');
 expect(stateTransitionRegistry.ASSET_REGISTERED?.targetState).toBe('REGISTERED');
});

test('legacy lifecycle verbs map to canonical event names without changing their meaning',()=>{
 expect(canonicalEventForLegacy('REGISTER_ASSET')).toBe('ASSET_REGISTERED');
 expect(canonicalEventForLegacy('INSPECT')).toBe('INSPECTION_COMPLETED');
 expect(canonicalEventForLegacy('TEST')).toBe('TEST_PASSED');
 expect(canonicalEventForLegacy('COMMISSION')).toBe('COMMISSIONING_COMPLETED');
 expect(canonicalEventForLegacy('AUTHORIZE_ENERGIZATION')).toBe('ENERGIZATION_AUTHORIZED');
 expect(canonicalEventForLegacy('ENERGIZE')).toBe('ASSET_ENERGIZED');
});

test('canonical state transition registry rejects missing prerequisites',()=>{
 const rejected=validateStateTransition({eventType:'COMMISSIONING_COMPLETED',currentState:'INSTALLED',finalizedEvents:['ASSET_REGISTERED','ASSET_INSTALLED']});
 expect(rejected.ok).toBeFalsy();
 expect(rejected.errors.join(' ')).toContain('INSPECTION_COMPLETED');
 expect(rejected.errors.join(' ')).toContain('TEST_PASSED');
 const accepted=validateStateTransition({eventType:'COMMISSIONING_COMPLETED',currentState:'TESTED',finalizedEvents:['ASSET_REGISTERED','ASSET_INSTALLED','INSPECTION_COMPLETED','TEST_PASSED']});
 expect(accepted.ok).toBeTruthy();
});

test('existing lifecycle submission can be projected into a valid MDIR candidate',()=>{
 const candidate=createLifecycleMicroDirCandidate({
  microDirId:'mdir-1',tenantId:'org-1',organizationId:'org-1',projectId:'project-1',assetId:'asset-1',actorRef:'user-1',
  legacyEventType:'INSPECT',eventOccurredAt:'2026-09-11T00:00:00.000Z',submittedAt:'2026-09-11T00:00:01.000Z',payloadHash:h('a'),
  currentState:'INSTALLED',transitionValidated:true,
 });
 expect(candidate.objectType).toBe('MDIR');
 expect(candidate.eventType).toBe('INSPECTION_COMPLETED');
 expect(candidate.priorityClass).toBe('P2');
 expect(candidate.proposedStateTransition).toEqual({fromState:'INSTALLED',toState:'INSPECTED'});
 expect(candidate.status).toBe('RECEIVED');
 expect(candidate.trustClass).toBe('UNVERIFIED');
});

test('NDIR schema preserves source time, sequence, quality and signature provenance',()=>{
 const ndir=nanoDirSchema.parse({
  objectId:'ndir-1',objectType:'NDIR',schemaVersion:'STRATUM-SCHEMA/1',tenantId:'org-1',organizationId:'org-1',projectId:'project-1',
  createdAt:'2026-09-11T00:00:01.000Z',createdBy:'device-1',updatedAt:'2026-09-11T00:00:01.000Z',status:'RECEIVED',trustClass:'SOURCE_VERIFIED',sourceRefs:['opc:node:1'],DIRRefs:[],
  nanoDirId:'ndir-1',sourceId:'device-1',sourceSequence:42,eventOccurredAt:'2026-09-11T00:00:00.000Z',recordedAt:'2026-09-11T00:00:01.000Z',
  dataType:'Double',engineeringUnit:'V',payloadHash:h('b'),payloadRef:'artifact-1',quality:'GOOD',contextRefs:['asset-1'],
  sourceSignature:{signerId:'device-1',signature:'sig'},aggregationRef:null,
 });
 expect(ndir.sourceSequence).toBe(42);
 expect(ndir.quality).toBe('GOOD');
});

test('PoVI state reducer requires 3-of-3 for a three-validator network',()=>{
 let state=createPoVIHeightState('stratum-test',1);
 state=acceptProposal(state,{proposalHash:h('c'),stateRoot:h('d'),round:0});
 state=recordVerifyVote(state,{validatorId:'validator-a',proposalHash:h('c'),activeValidatorIds:active});
 state=recordVerifyVote(state,{validatorId:'validator-b',proposalHash:h('c'),activeValidatorIds:active});
 expect(state.phase).toBe('VERIFY');
 state=recordVerifyVote(state,{validatorId:'validator-c',proposalHash:h('c'),activeValidatorIds:active});
 expect(state.phase).toBe('LOCK');
 state=beginCommit(state);
 state=recordCommitVote(state,{validatorId:'validator-a',proposalHash:h('c'),activeValidatorIds:active});
 state=recordCommitVote(state,{validatorId:'validator-b',proposalHash:h('c'),activeValidatorIds:active});
 expect(state.phase).toBe('COMMIT');
 state=recordCommitVote(state,{validatorId:'validator-c',proposalHash:h('c'),activeValidatorIds:active});
 expect(state.phase).toBe('FINALIZE');
 const pfc:PoVIFinalityCertificate={chainId:'stratum-test',height:1,round:0,DIRHash:h('e'),stateRoot:h('d'),validatorSetRoot:h('f'),protocolVersion:'POVI/1',signerProof:{signerIds:active,aggregateProof:'test-proof'}};
 state=finalizeWithPFC(state,{PFC:pfc,activeValidatorIds:active});
 expect(state.phase).toBe('FINALIZED');
 expect(state.finalizedDIRHash).toBe(h('e'));
});

test('PoVI higher round requires verified evidence and preserves an existing lock',()=>{
 let state=createPoVIHeightState('stratum-test',2);
 state=acceptProposal(state,{proposalHash:h('1'),stateRoot:h('2'),round:0});
 for(const validatorId of active)state=recordVerifyVote(state,{validatorId,proposalHash:h('1'),activeValidatorIds:active});
 expect(state.lockedDIR).toBe(h('1'));
 state=enterHigherRound(state,verifiedRoundChange('stratum-test',2,0,1));
 expect(state.round).toBe(1);
 expect(state.lockedDIR).toBe(h('1'));
 expect(()=>acceptProposal(state,{proposalHash:h('3'),stateRoot:h('4'),round:1})).toThrow(/safe-unlock evidence/i);
});

test('higher-round PLC authorizes reproposal without clearing the old lock until fresh VERIFY quorum',()=>{
 let state=createPoVIHeightState('stratum-test',20);
 state=acceptProposal(state,{proposalHash:h('1'),stateRoot:h('2'),round:0});
 for(const validatorId of active)state=recordVerifyVote(state,{validatorId,proposalHash:h('1'),activeValidatorIds:active});
 expect(state.lockedDIR).toBe(h('1'));
 expect(state.lockedRound).toBe(0);

 state=enterHigherRound(state,verifiedRoundChange('stratum-test',20,0,1));
 state=enterHigherRound(state,verifiedRoundChange('stratum-test',20,1,2));
 expect(state.round).toBe(2);

 const equalRoundPLC=verifiedPLC('stratum-test',20,0,h('3'));
 expect(()=>acceptProposalWithHigherRoundPLC(state,{proposalHash:h('3'),stateRoot:h('4'),round:2,verifiedPLC:equalRoundPLC})).toThrow(/strictly higher/i);
 const currentRoundPLC=verifiedPLC('stratum-test',20,2,h('3'));
 expect(()=>acceptProposalWithHigherRoundPLC(state,{proposalHash:h('3'),stateRoot:h('4'),round:2,verifiedPLC:currentRoundPLC})).toThrow(/prior round/i);

 const higherPriorPLC=verifiedPLC('stratum-test',20,1,h('3'));
 state=acceptProposalWithHigherRoundPLC(state,{proposalHash:h('3'),stateRoot:h('4'),round:2,verifiedPLC:higherPriorPLC});
 expect(state.phase).toBe('VERIFY');
 expect(state.lockedDIR).toBe(h('1'));
 expect(state.lockedRound).toBe(0);
 expect(state.validDIR).toBe(h('3'));
 expect(state.validRound).toBe(1);

 state=recordVerifyVote(state,{validatorId:'validator-a',proposalHash:h('3'),activeValidatorIds:active});
 state=recordVerifyVote(state,{validatorId:'validator-b',proposalHash:h('3'),activeValidatorIds:active});
 expect(state.lockedDIR).toBe(h('1'));
 state=recordVerifyVote(state,{validatorId:'validator-c',proposalHash:h('3'),activeValidatorIds:active});
 expect(state.phase).toBe('LOCK');
 expect(state.lockedDIR).toBe(h('3'));
 expect(state.lockedRound).toBe(2);
});
