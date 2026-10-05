import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applyReviewedPdfMetricFrame,derivePdfMetricFrameCandidates,restoreReviewedPdfMetricFrame} from '../lib/pdf-metric-frame.ts';

const sha='a'.repeat(64);
const validation={
 status:'CORROBORATED',
 declaredMetersPerNormalizedSheetUnit:.51,
 corroboratedMetersPerNormalizedSheetUnit:.5,
 confidence:.91,
 witnesses:[{type:'DIMENSION_STRING',label:'20\'-0"',observedMeters:6.096,sheetDistance:12.192,metersPerNormalizedSheetUnit:.5,deviationFactor:1.02,confidence:.9,evidence:['20\'-0"']}],
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

console.log('Reviewed PDF metric frame passed: only corroborated scale creates a reviewable candidate; X/Y convert to meters while Z is unchanged; source coordinates restore exactly; and compounded XY transforms fail closed.');
