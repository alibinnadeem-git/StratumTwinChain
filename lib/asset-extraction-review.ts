// Review surface for asset extraction candidates (PR-SPAT-004, A10).
// Reuses the review patterns of lib/candidate-gating.ts (candidates are
// stamped, never deleted) and the SpatialAssetInspector review flow
// (a decision is recorded; nothing is placed or promoted).
//
// Review-only, by construction: confirming a candidate records a review
// decision. It does not place equipment, switch model URLs, or promote
// anything to LIVE. Duplicates are never auto-merged; every resolution is
// an append-only decision with reviewer, timestamp, and reason.

import type {AssetExtractionCandidate} from './asset-extraction-candidates.ts';

export type CandidateReviewAction='CONFIRM_PRIMARY'|'MARK_DUPLICATE'|'SPLIT'|'REJECT';

export type CandidateReviewDecision={
  candidateId:string;
  action:CandidateReviewAction;
  reviewer:string;
  timestampIso:string;
  reason:string;
  primaryCandidateId?:string;
};

export type CandidateReviewRow={
  candidateId:string;
  componentKey:string;
  classId:string|null;
  modelId:string|null;
  modelIdReason:string;
  status:'CANDIDATE';
  evidenceCount:number;
  evidenceClasses:string[];
  confidences:AssetExtractionCandidate['confidences'];
  duplicateGroupId:string|null;
  groupSize:number;
  zMeters:number|null;
  zReason:string;
  scaleReason:string|null;
  feedsCandidateId:string|null;
  decisions:CandidateReviewDecision[];
  latestDecision:CandidateReviewDecision|null;
  availableActions:CandidateReviewAction[];
  placementEffect:'NONE';
  liveEffect:'NONE';
};

export const CANDIDATE_REVIEW_ACTIONS:CandidateReviewAction[]=[
  'CONFIRM_PRIMARY','MARK_DUPLICATE','SPLIT','REJECT',
];

function isValidIso(value:string):boolean{
  if(typeof value!=='string'||value.trim()==='')return false;
  const parsed=Date.parse(value);
  return Number.isFinite(parsed);
}

// Append one review decision. The input list is never mutated; a new list
// is returned with the decision appended. MARK_DUPLICATE needs the primary
// candidate id, and it must differ from the duplicate's own id. No action
// merges, deletes, places, or promotes anything: the decision is the audit
// trail, and the candidate itself is untouched.
export function applyCandidateReviewAction(
  decisions:CandidateReviewDecision[],
  input:{
    candidateId:string;
    action:CandidateReviewAction;
    reviewer:string;
    reason:string;
    primaryCandidateId?:string;
    timestampIso?:string;
  },
):CandidateReviewDecision[]{
  const candidateId=String(input.candidateId||'').trim();
  if(candidateId==='')throw new Error('A review decision needs a candidateId');
  if(!CANDIDATE_REVIEW_ACTIONS.includes(input.action)){
    throw new Error(`Unknown review action: ${String(input.action)}`);
  }
  const reviewer=String(input.reviewer||'').trim();
  if(reviewer==='')throw new Error('A review decision needs a reviewer');
  const reason=String(input.reason||'').trim();
  if(reason==='')throw new Error('A review decision needs a reason');
  const primaryCandidateId=input.primaryCandidateId===undefined
    ?undefined
    :String(input.primaryCandidateId).trim();
  if(input.action==='MARK_DUPLICATE'){
    if(!primaryCandidateId){
      throw new Error('MARK_DUPLICATE needs a primaryCandidateId');
    }
    if(primaryCandidateId===candidateId){
      throw new Error('MARK_DUPLICATE primaryCandidateId must differ from the duplicate candidateId');
    }
  }
  const timestampIso=input.timestampIso===undefined
    ?new Date().toISOString()
    :input.timestampIso;
  if(!isValidIso(timestampIso)){
    throw new Error(`Invalid timestampIso: ${String(timestampIso)}`);
  }
  const decision:CandidateReviewDecision={
    candidateId,
    action:input.action,
    reviewer,
    timestampIso,
    reason,
    ...(primaryCandidateId===undefined?{}:{primaryCandidateId}),
  };
  return [...decisions,decision];
}

// Build the review list for a set of candidates. One row per candidate, in
// input order, each carrying its evidence summary, per-dimension confidences,
// duplicate group, and the audit trail of decisions on it. The row states
// explicitly that review has no placement effect and no LIVE effect.
export function buildCandidateReviewList(
  candidates:AssetExtractionCandidate[],
  decisions:CandidateReviewDecision[],
):CandidateReviewRow[]{
  const groupSizes=new Map<string,number>();
  for(const candidate of candidates){
    if(candidate.duplicateGroupId===null)continue;
    groupSizes.set(
      candidate.duplicateGroupId,
      (groupSizes.get(candidate.duplicateGroupId)||0)+1,
    );
  }
  return candidates.map(candidate=>{
    const mine=decisions.filter(entry=>entry.candidateId===candidate.candidateId);
    return{
      candidateId:candidate.candidateId,
      componentKey:candidate.componentKey,
      classId:candidate.classId,
      modelId:candidate.modelId,
      modelIdReason:candidate.modelIdReason,
      status:'CANDIDATE',
      evidenceCount:candidate.evidence.length,
      evidenceClasses:[...new Set(candidate.evidence.map(entry=>entry.evidenceClass))],
      confidences:{...candidate.confidences},
      duplicateGroupId:candidate.duplicateGroupId,
      groupSize:candidate.duplicateGroupId===null
        ?1
        :(groupSizes.get(candidate.duplicateGroupId)||1),
      zMeters:candidate.zMeters,
      zReason:candidate.zReason,
      scaleReason:candidate.scaleReason,
      feedsCandidateId:candidate.feedsCandidateId,
      decisions:mine,
      latestDecision:mine.length===0?null:mine[mine.length-1],
      availableActions:[...CANDIDATE_REVIEW_ACTIONS],
      placementEffect:'NONE',
      liveEffect:'NONE',
    };
  });
}
