import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applyAutomaticPdfMetricFrame,applyReviewedPdfMetricFrame,derivePdfMetricFrameCandidates,restoreReviewedPdfMetricFrame} from '../lib/pdf-metric-frame.ts';

const sha='a'.repeat(64);
const validation={
 status:'CORROBORATED',
 declaredMetersPerNormalizedSheetUnit:.51,
 corroboratedMetersPerNormalizedSheetUnit:.5,
 confidence:.91,
 witnesses:[{type:'DIMENSION_STRING',label:'20\'-0"',observedMeters:6.096,sheetDistance:12.192,metersPerNormalizedSheetUnit:.5,deviationFactor:1.02,confidence:.9,evidence:['20\'-0"']}],
 automationEligible:false,automationReason:'one witness only',independentWitnessCount:1,witnessTypeCount:1,
 reviewRequired:true,autoApply:false,geometryScaleAuthority:false,
 reason:'Declared scale and independent measured drawing evidence agree within 5%.'
};

const entities=[
 {id:'line',source:'E-101.pdf',x:2,y:-3,z:12.345,x2:4,y2:-1,z2:12.345,kind:'line',meta:{sourceSha256:sha,page:1,coordinateUnits:'sheet',sourceType:'PDF source-plan vector line',scaleValidationEvidence:validation}},
 {id:'surface',source:'E-101.pdf',x:1,y:1,z:30.48,kind:'elevation-review-surface-triangle',vertices:[{x:0,y:0},{x:2,y:0},{x:0,y:2}],meta:{sourceSha256:sha,page:1,coordinateUnits:'sheet',sourceType:'PDF_ELEVATION_TRIANGLE',scaleValidationEvidence:validation,elevationTriangle:{kind:'GRADE',zMeters:[30.48,30.6,30.72]}}}
];

const candidates=derivePdfMetricFrameCandidates(entities);
assert.equal(candidates.length,1);
assert.equal(candidates[0].eligible,true);
assert.equal(candidates[0].metersPerSheetUnit,.5);
assert.equal(candidates[0].witnessCount,1);
assert.equal(candidates[0].autoApply,false);
assert.equal(candidates[0].physicalPositionVerified,false);
assert.equal(candidates[0].zChanged,false);
assert.equal(candidates[0].autoApplyEligible,false);

const autoValidation={...validation,
 automationEligible:true,automationReason:'redundant strict corroboration',independentWitnessCount:3,witnessTypeCount:1,
 witnesses:[
  validation.witnesses[0],
  {...validation.witnesses[0],label:'20 FT DIM B',evidence:['20 FT DIM B']},
  {...validation.witnesses[0],label:'20 FT DIM C',evidence:['20 FT DIM C']}
 ]
};
const autoCandidate=derivePdfMetricFrameCandidates([{...entities[0],meta:{...entities[0].meta,scaleValidationEvidence:autoValidation}}])[0];
assert.equal(autoCandidate.autoApplyEligible,false,'corroborated scale still needs human-reviewed calibration');
assert.throws(()=>applyAutomaticPdfMetricFrame(entities[0],autoCandidate,'2026-10-09T00:00:00.000Z'),/Automatic PDF metric-frame application is prohibited/);

const scaled=applyReviewedPdfMetricFrame(entities[0],candidates[0],'2026-10-05T00:00:00.000Z');
assert.equal(scaled.x,1);
assert.equal(scaled.y,-1.5);
assert.equal(scaled.x2,2);
assert.equal(scaled.y2,-.5);
assert.equal(scaled.z,12.345,'metric XY review must never change entity Z');
assert.equal(scaled.z2,12.345,'metric XY review must never change endpoint Z');
assert.equal(scaled.meta?.coordinateUnits,'m_reviewed_pdf');
assert.equal(scaled.meta?.metricFrameAuthority,'HUMAN_REVIEWED_CORROBORATED_PDF_SCALE');
assert.equal(scaled.meta?.metricFrameZChanged,false);
assert.equal(scaled.meta?.metricFramePhysicalPositionVerified,false);
assert.deepEqual(scaled.meta?.pdfMetricFrameOriginal,{x:2,y:-3,x2:4,y2:-1,coordinateUnits:'sheet'});

const surface=applyReviewedPdfMetricFrame(entities[1],candidates[0]);
assert.deepEqual(surface.vertices,[{x:0,y:0},{x:1,y:0},{x:0,y:1}]);
assert.equal(surface.z,30.48);
assert.deepEqual(surface.meta?.elevationTriangle?.zMeters,[30.48,30.6,30.72],'terrain Z controls remain in meters and are not rescaled');

const idempotent=applyReviewedPdfMetricFrame(scaled,candidates[0]);
assert.equal(idempotent,scaled,'reapplying the identical reviewed metric candidate is idempotent');

const restored=restoreReviewedPdfMetricFrame(scaled);
assert.equal(restored.x,2);
assert.equal(restored.y,-3);
assert.equal(restored.x2,4);
assert.equal(restored.y2,-1);
assert.equal(restored.z,12.345);
assert.equal(restored.meta?.coordinateUnits,'sheet');
assert.equal(restored.meta?.pdfMetricFrameOriginal,undefined);
assert.equal(restored.meta?.metricFrameAuthority,undefined);

assert.throws(()=>applyReviewedPdfMetricFrame({...entities[0],meta:{...entities[0].meta,autoSheetAlignmentCandidateId:'alignment-1'}},candidates[0]),/Restore automatic sheet alignment/);
assert.throws(()=>applyReviewedPdfMetricFrame({...entities[0],meta:{...entities[0].meta,sheetXYCalibrationId:'manual-1'}},candidates[0]),/Restore manual XY calibration/);

const mismatchValidation={...validation,status:'MISMATCH',confidence:.25};
const mismatch=derivePdfMetricFrameCandidates([{...entities[0],meta:{...entities[0].meta,scaleValidationEvidence:mismatchValidation}}]);
assert.equal(mismatch.length,1);
assert.equal(mismatch[0].eligible,false);
assert.ok(mismatch[0].reasons.some(reason=>reason.includes('MISMATCH')));

// Real parser layout: a page's scale evidence sits on a non-spatial scale-validation record (no sheet
// units), while the sheet geometry carries none. The page must still produce its candidate.
const set='b'.repeat(64),declared=5.120640,corroboratedValidation={...validation,declaredMetersPerNormalizedSheetUnit:declared,corroboratedMetersPerNormalizedSheetUnit:5.1206,confidence:.9};
const evidence=(sha,page,scaleValidationEvidence)=>({id:`${sha}:pdf-scale-validation-${page}`,source:'Set.pdf',kind:'scale-validation-candidate',x:0,y:0,z:0,meta:{sourceSha256:sha,page,nonSpatial:true,scaleValidationEvidence}});
const sheetLine=(sha,page,x,y)=>({id:`${sha}:line-${page}-${x}`,source:'Set.pdf',kind:'line',x,y,z:0,x2:x+1,y2:y,z2:0,meta:{sourceSha256:sha,page,coordinateUnits:'sheet',sourceType:'PDF source-plan vector line'}});
const unresolvedDeclared={...validation,status:'UNRESOLVED',declaredMetersPerNormalizedSheetUnit:declared,corroboratedMetersPerNormalizedSheetUnit:null,confidence:0,witnesses:[],independentWitnessCount:0};
const setEntities=[
 evidence(set,3,corroboratedValidation),sheetLine(set,3,0,0),
 evidence(set,4,unresolvedDeclared),sheetLine(set,4,1.7575,-.9115),sheetLine(set,4,2.352,-1.2956),
 evidence(set,5,{...unresolvedDeclared,declaredMetersPerNormalizedSheetUnit:declared*2}),sheetLine(set,5,0,0),
 evidence(set,6,{...unresolvedDeclared,status:'MISMATCH'}),sheetLine(set,6,0,0),
 evidence('c'.repeat(64),4,unresolvedDeclared),sheetLine('c'.repeat(64),4,0,0),
];
const setCandidates=derivePdfMetricFrameCandidates(setEntities),forPage=(sha,page)=>setCandidates.find(c=>c.frameKey===`${sha}:${page}`);
assert.equal(forPage(set,3).eligible,true,'evidence on a non-spatial page record still yields the page candidate');
assert.equal(forPage(set,3).basis,'OWN_WITNESSES');
const sameSet=forPage(set,4);
assert.equal(sameSet.eligible,true,'a page without dimensions borrows corroboration from a same-set page with the same printed scale');
assert.equal(sameSet.basis,'SAME_SET_CORROBORATED_SHEET');
assert.equal(sameSet.corroboratedByPage,3);
assert.equal(sameSet.metersPerSheetUnit,declared,'the page applies its own printed scale');
assert.ok(sameSet.confidence<=.75,'borrowed corroboration is capped below own-witness confidence');
assert.equal(sameSet.autoApplyEligible,false);
assert.equal(forPage(set,5).eligible,false,'a different printed scale or page size is not corroborated by the sibling');
assert.equal(forPage(set,6).eligible,false,'a page whose own evidence disagrees never borrows corroboration');
assert.equal(forPage('c'.repeat(64),4).eligible,false,'corroboration never crosses into another PDF');

// Brynhurst E-4: MS2 and MS1 sit 0.708 sheet units apart; at the printed 1/8" = 1'-0" that is 3.63 m.
const [ms2,ms1]=[setEntities[3],setEntities[4]].map(entity=>applyReviewedPdfMetricFrame(entity,sameSet,'2026-10-27T00:00:00.000Z'));
assert.ok(Math.abs(Math.hypot(ms1.x-ms2.x,ms1.y-ms2.y)-3.63)<.01,'E-4 MS1↔MS2 renders about 3.6 m once the scale is confirmed');
assert.equal(ms1.meta?.metricFrameAuthority,'HUMAN_REVIEWED_SAME_SET_PDF_SCALE');
assert.equal(ms1.meta?.metricFrameBasis,'SAME_SET_CORROBORATED_SHEET');
assert.equal(ms1.meta?.metricFrameCorroboratedByPage,3);
assert.equal(ms1.meta?.coordinateUnits,'m_reviewed_pdf');
const undone=restoreReviewedPdfMetricFrame(ms1);
assert.equal(undone.x,2.352);
assert.equal(undone.meta?.metricFrameBasis,undefined);
assert.equal(undone.meta?.metricFrameCorroboratedByPage,undefined);

const component=fs.readFileSync('components/PdfMetricFrameReview.tsx','utf8');
assert.match(component,/Put reviewed PDF X\/Y into the same meter world as Z/);
assert.match(component,/Z is never rescaled or changed/);
assert.match(component,/pdfMetricFrameReviews/);
assert.match(component,/Restore source sheet X\/Y/);
assert.match(component,/autoSheetAlignmentCandidateId/);
assert.match(component,/sheetXYCalibrationId/);

const page=fs.readFileSync('app/compiler/page.tsx','utf8');
assert.ok(page.indexOf('<PdfMetricFrameReview/>')<page.indexOf('<AutoSheetAlignmentReview/>'),'metric frame review must precede automatic cross-sheet alignment');
assert.ok(page.indexOf('<PdfMetricFrameReview/>')<page.indexOf('<ManualSheetXYCalibrationReview/>'),'metric frame review must precede manual XY calibration');

console.log('PDF metric frame passed: reviewable corroboration remains reversible, even redundant scale evidence cannot auto-convert X/Y to meters, Z is never rescaled, and physical-position truth remains false.');
