import {assertVerifiedDIRFinalityResult,type VerifiedDIRFinalityResult} from '../finality-proof';
import type {VerifiedRoundChangeQuorumEvidence} from './liveness';
import type {VerifiedPoVILockCertificate} from './plc';
import {hasPoviQuorum} from './quorum';

export type PoVIPhase='PROPOSE'|'VERIFY'|'LOCK'|'COMMIT'|'FINALIZE'|'FINALIZED';
export type VerifyChoice=string|'NIL';

export type PoVIHeightState={chainId:string;height:number;round:number;phase:PoVIPhase;proposalHash:string|null;proposedStateRoot:string|null;lockedDIR:string|null;lockedRound:number|null;validDIR:string|null;validRound:number|null;verifyVotes:Record<string,VerifyChoice>;commitVotes:Record<string,string>;finalizedDIRHash:string|null;};

export function createPoVIHeightState(chainId:string,height:number):PoVIHeightState{
 if(!chainId)throw new Error('chainId is required');
 if(!Number.isInteger(height)||height<1)throw new Error('height must be a positive integer');
 return{chainId,height,round:0,phase:'PROPOSE',proposalHash:null,proposedStateRoot:null,lockedDIR:null,lockedRound:null,validDIR:null,validRound:null,verifyVotes:{},commitVotes:{},finalizedDIRHash:null};
}

export function acceptProposal(state:PoVIHeightState,args:{proposalHash:string;stateRoot:string;round:number}):PoVIHeightState{
 if(state.phase==='FINALIZED')throw new Error('Finalized height cannot accept another proposal');
 if(args.round!==state.round)throw new Error(`Proposal round ${args.round} does not match local round ${state.round}`);
 if(state.lockedDIR&&state.lockedDIR!==args.proposalHash)throw new Error('Validator is locked on another proposal; higher-round safe-unlock evidence is required');
 return{...state,phase:'VERIFY',proposalHash:args.proposalHash,proposedStateRoot:args.stateRoot,verifyVotes:{},commitVotes:{}};
}

export function acceptProposalWithHigherRoundPLC(state:PoVIHeightState,args:{proposalHash:string;stateRoot:string;round:number;verifiedPLC:VerifiedPoVILockCertificate}):PoVIHeightState{
 if(!args.verifiedPLC.verified)throw new Error('Verified PLC is required for safe higher-round reproposal');
 if(state.phase==='FINALIZED')throw new Error('Finalized height cannot accept another proposal');
 if(args.round!==state.round)throw new Error(`Proposal round ${args.round} does not match local round ${state.round}`);
 if(!state.lockedDIR||state.lockedDIR===args.proposalHash)return acceptProposal(state,args);
 if(state.lockedRound===null)throw new Error('Locked proposal is missing lockedRound');
 const PLC=args.verifiedPLC.PLC;
 if(PLC.chainId!==state.chainId||PLC.height!==state.height)throw new Error('PLC consensus context does not match local height state');
 if(PLC.proposalHash!==args.proposalHash)throw new Error('PLC does not bind the proposed higher-round value');
 if(PLC.round<=state.lockedRound)throw new Error('PLC round must be strictly higher than the existing lockedRound');
 if(PLC.round>=state.round)throw new Error('Safe reproposal requires a verified PLC from a prior round lower than the current round');
 return{...state,phase:'VERIFY',proposalHash:args.proposalHash,proposedStateRoot:args.stateRoot,validDIR:args.proposalHash,validRound:PLC.round,verifyVotes:{},commitVotes:{},lockedDIR:state.lockedDIR,lockedRound:state.lockedRound};
}

export function recordVerifyVote(state:PoVIHeightState,args:{validatorId:string;proposalHash:VerifyChoice;activeValidatorIds:Iterable<string>}):PoVIHeightState{
 if(state.phase!=='VERIFY'&&state.phase!=='LOCK')throw new Error(`VERIFY vote is invalid during ${state.phase}`);
 const active=new Set(args.activeValidatorIds); if(!active.has(args.validatorId))throw new Error('Only ACTIVE validators may vote');
 const previous=state.verifyVotes[args.validatorId]; if(previous&&previous!==args.proposalHash)throw new Error(`Equivocation detected: ${args.validatorId} already VERIFY-voted ${previous}`);
 const verifyVotes={...state.verifyVotes,[args.validatorId]:args.proposalHash}; const proposal=state.proposalHash; if(!proposal)return{...state,verifyVotes};
 const proposalSignerCount=Object.entries(verifyVotes).filter(([,vote])=>vote===proposal).length;
 if(hasPoviQuorum(active.size,proposalSignerCount))return{...state,phase:'LOCK',verifyVotes,lockedDIR:proposal,lockedRound:state.round,validDIR:proposal,validRound:state.round};
 return{...state,verifyVotes};
}

export function beginCommit(state:PoVIHeightState):PoVIHeightState{if(state.phase!=='LOCK'||!state.lockedDIR)throw new Error('COMMIT requires a valid current-round lock');return{...state,phase:'COMMIT',commitVotes:{}};}

export function recordCommitVote(state:PoVIHeightState,args:{validatorId:string;proposalHash:string;activeValidatorIds:Iterable<string>}):PoVIHeightState{
 if(state.phase!=='COMMIT'&&state.phase!=='FINALIZE')throw new Error(`COMMIT vote is invalid during ${state.phase}`);
 if(!state.lockedDIR||args.proposalHash!==state.lockedDIR)throw new Error('COMMIT must bind the locked proposal');
 const active=new Set(args.activeValidatorIds); if(!active.has(args.validatorId))throw new Error('Only ACTIVE validators may vote');
 const previous=state.commitVotes[args.validatorId]; if(previous&&previous!==args.proposalHash)throw new Error(`Equivocation detected: ${args.validatorId} already COMMIT-voted ${previous}`);
 const commitVotes={...state.commitVotes,[args.validatorId]:args.proposalHash}; const signerCount=Object.entries(commitVotes).filter(([,vote])=>vote===args.proposalHash).length;
 return{...state,phase:hasPoviQuorum(active.size,signerCount)?'FINALIZE':'COMMIT',commitVotes};
}

export function finalizeWithVerifiedDIRProof(state:PoVIHeightState,verified:VerifiedDIRFinalityResult):PoVIHeightState{
 if(state.phase!=='FINALIZE')throw new Error('DIR cannot finalize before a COMMIT quorum exists');
 assertVerifiedDIRFinalityResult(verified);
 if(verified.chainId!==state.chainId||verified.height!==state.height||verified.round!==state.round)throw new Error('Verified DIR finality proof does not match local consensus context');
 if(!state.proposedStateRoot||verified.stateRoot!==state.proposedStateRoot)throw new Error('Verified DIR finality stateRoot does not match the proposal');
 if(!state.proposalHash||verified.proposalHash!==state.proposalHash)throw new Error('Verified DIR finality proposalHash does not match the local proposal');
 if(!state.lockedDIR||verified.proposalHash!==state.lockedDIR)throw new Error('Verified DIR finality proposalHash does not match the locked proposal');
 return{...state,phase:'FINALIZED',finalizedDIRHash:verified.DIRHash};
}

export function enterHigherRound(state:PoVIHeightState,verified:VerifiedRoundChangeQuorumEvidence):PoVIHeightState{
 if(!verified.verified)throw new Error('Verified ROUND_CHANGE evidence is required'); const evidence=verified.evidence;
 if(state.phase==='FINALIZED')throw new Error('Finalized height cannot enter a new round');
 if(state.chainId!==evidence.chainId||state.height!==evidence.height||state.round!==evidence.triggerRound)throw new Error('ROUND_CHANGE evidence does not match local consensus state');
 if(evidence.newRound<=state.round)throw new Error('ROUND_CHANGE must advance the round');
 return{...state,round:evidence.newRound,phase:'PROPOSE',proposalHash:null,proposedStateRoot:null,verifyVotes:{},commitVotes:{},lockedDIR:state.lockedDIR,lockedRound:state.lockedRound,validDIR:state.validDIR,validRound:state.validRound};
}
