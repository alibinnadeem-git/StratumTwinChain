import assert from 'node:assert/strict';
import {extractZEvidenceFromText} from '../lib/z-resolver.ts';
import {buildProjectDatumSurfaces} from '../lib/project-datum.ts';
import {enrichZRecovery,summarizeZRecovery} from '../lib/z-recovery.ts';
import {resolveAssetPlacement} from '../lib/asset-placement.ts';
import {buildZSolution} from '../lib/z-solution-chain.ts';

const evidence=extractZEvidenceFromText([
 "1st Story","195' - 1\"",
 "3rd Story","215' - 1\"",
 "FLOOR TO FLOOR 10'-0\""
].join('\n'),{source:'Real-project section.pdf'});
const surfaces=buildProjectDatumSurfaces(evidence);
const summary=summarizeZRecovery(evidence,surfaces);
assert.equal(summary.mode,'SOURCE_STORY_INTERVAL');
assert.ok(Math.abs(Number(summary.storyIntervalMeters)-3.048)<1e-6);

const l2={id:'msb-l2',name:'MAIN SWITCHBOARD MSB-1',source:'E-202.pdf',floor:'L2',confidence:.9,meta:{sourceType:'PDF text object',physicalTruth:false}};
const [recovered]=enrichZRecovery([l2],evidence,surfaces);
assert.ok(Math.abs(Number(recovered.meta?.inferredProjectDatumZ)-(205+1/12)*.3048)<1e-6);
assert.equal(recovered.meta?.zRecoveryAbsoluteCandidate,true);
const placement=resolveAssetPlacement(recovered);
assert.equal(placement.zAuthority,'INFERRED_PROJECT_DATUM_CANDIDATE');
assert.ok(placement.baseZ>60);
assert.equal(placement.physicalTruth,false);
const solution=buildZSolution(recovered);
assert.equal(solution.status,'RESOLVED_CANDIDATE');
assert.equal(solution.physicalTruth,false);
assert.equal(solution.reviewRequired,true);

const explicitOnly=extractZEvidenceFromText("STORY HEIGHT: 12'-0\"",{source:'section-note.pdf'});
const explicitSummary=summarizeZRecovery(explicitOnly,[]);
assert.equal(explicitSummary.mode,'RELATIVE_EXPLICIT_STORY_HEIGHT');
assert.ok(Math.abs(Number(explicitSummary.storyIntervalMeters)-3.6576)<1e-6);

const noEvidence=[
 {id:'l1',name:'MAIN SWITCHBOARD MSB-1',source:'flat-plan.pdf',floor:'L1',confidence:.9,meta:{}},
 {id:'l3',name:'MAIN SWITCHBOARD MSB-3',source:'flat-plan.pdf',floor:'L3',confidence:.9,meta:{relativeReviewSurfaceZ:6,relativeReviewSurfaceAuthority:'VISUALIZATION_STORY_STACK_ONLY'}}
];
const relative=enrichZRecovery(noEvidence,[],[]);
assert.equal(summarizeZRecovery([],[]).mode,'NONE');
assert.equal(summarizeZRecovery([],[]).storyIntervalMeters,null);
assert.ok(relative.every(entity=>entity.meta?.zRecoveryMode==='NONE'));
assert.ok(relative.every(entity=>!('relativeReviewSurfaceZ' in (entity.meta||{}))),'stale visualization Z must be removed');
assert.ok(relative.every(entity=>!('inferredProjectDatumZ' in (entity.meta||{}))));
assert.equal(relative[1].meta?.zRecoveryAbsoluteCandidate,false);
const relativePlacement=resolveAssetPlacement(relative[1]);
assert.equal(relativePlacement.zAuthority,'UNRESOLVED');
const relativeSolution=buildZSolution(relative[1]);
assert.equal(relativeSolution.status,'UNRESOLVED');
assert.equal(relativeSolution.baseZ,null);
assert.equal(relativeSolution.physicalTruth,false);
const [heightWithoutAnchor]=enrichZRecovery([l2],explicitOnly,[]);
assert.equal(heightWithoutAnchor.meta?.zRecoveryMode,'RELATIVE_EXPLICIT_STORY_HEIGHT');
assert.equal(heightWithoutAnchor.meta?.relativeReviewSurfaceZ,undefined,'story-height evidence without floor control cannot supply Z');

console.log('Z recovery passed: anchored project story intervals can infer missing absolute design datums, explicit story-height evidence can build a relative stack, and evidence-free flat plans stay UNRESOLVED without a fabricated story spacing.');
