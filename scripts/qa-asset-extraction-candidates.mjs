import {
  createAssetExtractionCandidate,
  deriveCandidateId,
  generic3dModelForClass,
  groupExtractionCandidates,
  modelIdFromModelUrl,
  normalizeSymbolKey,
} from '../lib/asset-extraction-candidates.ts';
import {
  applyCandidateReviewAction,
  buildCandidateReviewList,
} from '../lib/asset-extraction-review.ts';

// PR-SPAT-004 / A10 extraction-half contract. Deterministic fixtures only.
// No invented coordinates, no invented Z, no auto-merge, no auto-apply.
function ok(label,condition){if(!condition)throw new Error('FAIL: '+label);console.log('✓ '+label)}
function throws(label,fn){let caught=false;try{fn()}catch{caught=true}ok(label,caught)}

const EVIDENCE=[{evidenceClass:'SOURCE_SPEC',source:'E-101 panel schedule, sheet E-101'}];
const CONFIDENCES={x:.9,y:.9,z:0,geometry:.8,topology:.7,identity:.85};

function makeCandidate(overrides={}){
  return createAssetExtractionCandidate({
    sourceRef:{sourceId:'src-brynhurst-e101',sheet:'E-101',page:1,symbolKey:'MS1'},
    componentKey:'main-switchboard',
    classId:'E-02',
    confidences:{...CONFIDENCES},
    evidence:[...EVIDENCE],
    ...overrides,
  });
}

// 1. Same source twice yields the same candidateId.
const first=makeCandidate();
const second=makeCandidate();
ok('same source twice yields the same candidateId',first.candidateId===second.candidateId);
ok('candidateId is deterministic from source plus symbol key',first.candidateId===deriveCandidateId('src-brynhurst-e101','MS1'));
ok('symbol key normalization is stable (case and separators)',normalizeSymbolKey('ms-1')===normalizeSymbolKey('MS1')&&normalizeSymbolKey('MS 1')===normalizeSymbolKey('MS1'));

// 2. Duplicate fixtures group and never auto-merge.
const dupA=makeCandidate({sourceRef:{sourceId:'src-a',sheet:'E-101',page:1,symbolKey:'MS1'},planPosition:{x:10.2,y:5.1}});
const dupB=makeCandidate({sourceRef:{sourceId:'src-b',sheet:'E-101',page:1,symbolKey:'MS1'},planPosition:{x:10.6,y:5.4}});
const solo=makeCandidate({sourceRef:{sourceId:'src-c',sheet:'E-101',page:1,symbolKey:'LP3'},planPosition:{x:40,y:5}});
const grouped=groupExtractionCandidates([dupA,dupB,solo]);
const byId=Object.fromEntries(grouped.map(c=>[c.candidateId,c]));
ok('duplicates share one duplicateGroupId',byId[dupA.candidateId].duplicateGroupId!==null&&byId[dupA.candidateId].duplicateGroupId===byId[dupB.candidateId].duplicateGroupId);
ok('singleton keeps duplicateGroupId null',byId[solo.candidateId].duplicateGroupId===null);
ok('grouping never merges: three candidates stay three',grouped.length===3);
ok('grouping never changes status: all stay CANDIDATE',grouped.every(c=>c.status==='CANDIDATE'));
ok('grouping never invents truth: all stay physicalTruth false, reviewRequired true',grouped.every(c=>c.physicalTruth===false&&c.reviewRequired===true));
const far=makeCandidate({sourceRef:{sourceId:'src-d',sheet:'E-101',page:1,symbolKey:'MS1'},planPosition:{x:90,y:5}});
const regrouped=groupExtractionCandidates([dupA,far]);
ok('same symbol in a far bucket does not group',regrouped.every(c=>c.duplicateGroupId===null));

// 3. Unmapped class keeps modelId null.
const unmapped=makeCandidate({classId:'E-99'});
ok('unmapped class keeps modelId null',unmapped.modelId===null);
ok('unmapped class records UNRESOLVED_NEVER_GUESS',unmapped.modelIdReason==='UNRESOLVED_NEVER_GUESS');
const nullClass=makeCandidate({classId:null});
ok('null class keeps modelId null',nullClass.modelId===null&&nullClass.modelIdReason==='UNRESOLVED_NEVER_GUESS');
ok('legacy binding on main binds to null (registry not landed yet)',generic3dModelForClass('E-02').modelId===null&&generic3dModelForClass('E-02').reason==='UNRESOLVED_NEVER_GUESS');

// 4. OEM URL keeps modelId null; stlib paths resolve only when registered.
ok('OEM URL keeps modelId null',modelIdFromModelUrl('https://example.com/oem/switchboard.glb').modelId===null&&modelIdFromModelUrl('https://example.com/oem/switchboard.glb').reason==='OEM_URL_NO_STLIB_ID');
ok('legacy path keeps modelId null',modelIdFromModelUrl('/models/equipment/mv-switchgear-lineup.glb').modelId===null);
ok('registered stlib v1 path resolves once the registry lands',modelIdFromModelUrl('/models/equipment/stlib-ele-main-switchboard-v1.glb').modelId==='stlib-ele-main-switchboard-v1');
ok('unregistered T1 path stays null',modelIdFromModelUrl('/models/equipment/stlib-ele-mcb-t1-v1.glb').modelId===null&&modelIdFromModelUrl('/models/equipment/stlib-ele-mcb-t1-v1.glb').reason==='UNREGISTERED_T1');

// 5. All confidences stay within 0 to 1.
ok('confidences stay within 0 to 1',Object.values(first.confidences).every(v=>typeof v==='number'&&v>=0&&v<=1));
ok('six independent confidences, never collapsed to one number',Object.keys(first.confidences).length===6);
throws('confidence above 1 is rejected',()=>makeCandidate({confidences:{...CONFIDENCES,x:1.2}}));
throws('confidence below 0 is rejected',()=>makeCandidate({confidences:{...CONFIDENCES,y:-0.1}}));
throws('non-finite confidence is rejected',()=>makeCandidate({confidences:{...CONFIDENCES,z:Number.NaN}}));

// 6. Every candidate carries at least one evidence entry with a source ref.
ok('candidate carries evidence with a source ref',first.evidence.length>=1&&first.evidence.every(e=>typeof e.source==='string'&&e.source.trim()!==''));
throws('empty evidence is rejected',()=>makeCandidate({evidence:[]}));
throws('evidence without a source ref is rejected',()=>makeCandidate({evidence:[{evidenceClass:'SOURCE_SPEC',source:'  '}]}));
throws('missing sourceId is rejected',()=>makeCandidate({sourceRef:{sourceId:'',sheet:'E-101'}}));
throws('missing componentKey is rejected',()=>makeCandidate({componentKey:''}));

// Z doctrine (TR-206): null when unknown; finite Z needs a governed source.
ok('unknown Z stays null with Z_NOT_STATED',first.zMeters===null&&first.zReason==='Z_NOT_STATED');
const governed=makeCandidate({zMeters:3.2,zSource:'GOVERNED_B2_SURFACE'});
ok('governed B2 Z is recorded, still not physical truth',governed.zMeters===3.2&&governed.physicalTruth===false&&governed.reviewRequired===true);
throws('finite Z without a governed source is rejected',()=>makeCandidate({zMeters:3.2}));
throws('finite Z with an ungoverned source is rejected',()=>makeCandidate({zMeters:3.2,zSource:'GUESS'}));
ok('scale is never auto-applied: unconfirmed scale stays unresolved',first.scaleReason==='SCALE_NOT_CONFIRMED');
ok('confirmed scale clears the reason',makeCandidate({scaleConfirmed:true}).scaleReason===null);

// FEEDS link is by id only; the resolver is not duplicated here.
const linked=makeCandidate({feedsCandidateId:'feeds-ms1-001'});
ok('FEEDS candidate links by id',linked.feedsCandidateId==='feeds-ms1-001');
ok('unlinked candidate keeps feedsCandidateId null',first.feedsCandidateId===null);

// Review actions: append-only, never auto-merge, no placement or LIVE effect.
const decisions0=[];
const decisions1=applyCandidateReviewAction(decisions0,{
  candidateId:dupA.candidateId,action:'MARK_DUPLICATE',reviewer:'ali@stratumpower.ai',
  reason:'Same MS1 symbol on E-101, second occurrence',primaryCandidateId:dupB.candidateId,
  timestampIso:'2026-11-13T16:30:00.000Z',
});
ok('review decision appends without mutating the input list',decisions0.length===0&&decisions1.length===1);
ok('review decision keeps the audit trail',decisions1[0].reviewer==='ali@stratumpower.ai'&&decisions1[0].reason.length>0);
throws('MARK_DUPLICATE without a primary is rejected',()=>applyCandidateReviewAction(decisions1,{
  candidateId:dupA.candidateId,action:'MARK_DUPLICATE',reviewer:'ali@stratumpower.ai',reason:'no primary',
}));
throws('MARK_DUPLICATE with self as primary is rejected',()=>applyCandidateReviewAction(decisions1,{
  candidateId:dupA.candidateId,action:'MARK_DUPLICATE',reviewer:'ali@stratumpower.ai',reason:'self',primaryCandidateId:dupA.candidateId,
}));
throws('review decision without a reviewer is rejected',()=>applyCandidateReviewAction(decisions1,{
  candidateId:dupA.candidateId,action:'REJECT',reviewer:'',reason:'no reviewer',
}));
throws('review decision without a reason is rejected',()=>applyCandidateReviewAction(decisions1,{
  candidateId:dupA.candidateId,action:'REJECT',reviewer:'ali@stratumpower.ai',reason:'',
}));

const rows=buildCandidateReviewList(grouped,decisions1);
const rowA=rows.find(r=>r.candidateId===dupA.candidateId);
ok('review list carries evidence summary and confidences',rowA.evidenceCount===1&&rowA.confidences.identity===0.85);
ok('review list carries the duplicate group size',rowA.groupSize===2);
ok('review list carries the audit trail',rowA.decisions.length===1&&rowA.latestDecision.action==='MARK_DUPLICATE');
ok('review has no placement effect and no LIVE effect',rowA.placementEffect==='NONE'&&rowA.liveEffect==='NONE');
ok('review list keeps candidates in input order',rows.map(r=>r.candidateId).join(',')===grouped.map(c=>c.candidateId).join(','));

console.log('\nAsset-extraction-candidates contract passed.');
