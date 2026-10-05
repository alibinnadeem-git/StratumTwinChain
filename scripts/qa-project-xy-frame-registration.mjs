import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applyReviewedProjectXYFrameRegistration,restoreReviewedProjectXYFrameRegistration} from '../lib/project-xy-frame-registration.ts';
import {deriveSpatialEvidenceEnvelope} from '../lib/spatial-evidence-envelope.ts';

const shaA='a'.repeat(64),shaB='b'.repeat(64),shaC='c'.repeat(64);
const referenceKey=shaA+':1',movingKey=shaB+':1';
const transform={scale:2,rotationRadians:0,rotationDegrees:0,translateX:8,translateY:16,rmsResidual:.02};
const proposal={
 id:referenceKey+'->'+movingKey,referenceKey,movingKey,referenceSheet:'A1.01',movingSheet:'E1.01',
 anchors:[],transform,confidence:.92,eligible:true,reasons:[],warnings:[],crossChecks:{},reviewRequired:true,autoApply:false,verified:false
};

const reference={
 id:'ref',source:'Architectural.pdf',x:10,y:20,x2:14,y2:20,kind:'line',name:'wall',confidence:.99,
 meta:{sourceSha256:shaA,page:1,coordinateUnits:'m_reviewed_pdf',physicalTruth:false}
};
const moving={
 id:'mov',source:'Electrical.pdf',x:1,y:2,x2:3,y2:2,kind:'line',name:'feeder',confidence:.9,
 meta:{sourceSha256:shaB,page:1,coordinateUnits:'sheet',symbolAnchorStatus:'RESOLVED_REVIEW_CANDIDATE',spatialPlacementAuthority:'SOURCE_VECTOR_SYMBOL_ANCHOR',physicalTruth:false}
};

const applied=applyReviewedProjectXYFrameRegistration([reference,moving],proposal,'2026-10-05T00:00:00.000Z');
assert.equal(applied.registration.frameId,'PROJECT_XY:'+referenceKey);
assert.equal(applied.registration.coordinateUnits,'m_reviewed_pdf');
assert.equal(applied.registration.metric,true);
assert.equal(applied.registration.transformedEntities,1);
assert.equal(applied.registration.referenceEntities,1);

const refApplied=applied.entities.find(entity=>entity.id==='ref');
const movApplied=applied.entities.find(entity=>entity.id==='mov');
assert.equal(refApplied.meta.projectXYFrameId,'PROJECT_XY:'+referenceKey);
assert.deepEqual(refApplied.meta.projectXYReferenceForIds,[proposal.id]);
assert.deepEqual(refApplied.meta.projectXYRegistrationIds,[proposal.id]);
assert.equal(refApplied.meta.coordinateUnits,'m_reviewed_pdf');
assert.equal(movApplied.x,10);assert.equal(movApplied.y,20);assert.equal(movApplied.x2,14);assert.equal(movApplied.y2,20);
assert.equal(movApplied.meta.coordinateUnits,'m_reviewed_pdf','moving geometry must inherit reference-frame units after transform');
assert.equal(movApplied.meta.projectXYFrameId,refApplied.meta.projectXYFrameId);
assert.equal(movApplied.meta.projectXYFrameMetric,true);
assert.equal(movApplied.meta.projectXYRegistrationAuthority,'HUMAN_CONFIRMED_COMMON_ANCHOR_SIMILARITY');
assert.equal(movApplied.meta.projectXYRegistrationOriginal.x,1);
assert.equal(movApplied.meta.projectXYRegistrationOriginal.y,2);
assert.equal(movApplied.meta.projectXYRegistrationOriginal.coordinateUnits,'sheet');
assert.equal(movApplied.meta.physicalTruth,false);

const envelope=deriveSpatialEvidenceEnvelope({
 id:'mov',name:'EVSE-1',source:'Electrical.pdf',x:movApplied.x,y:movApplied.y,
 meta:{...movApplied.meta,zConstraintGraph:{status:'UNRESOLVED',baseZMeters:null,nodes:[],relations:[],conflicts:[],frameGaps:[]}}
},null);
assert.equal(envelope.horizontal.coordinateFrame,'PROJECT_XY:'+referenceKey);
assert.equal(envelope.horizontal.metricCoordinateKnown,true);
assert.equal(envelope.horizontal.state,'RESOLVED_CANDIDATE');
assert.ok(envelope.horizontal.sourceLineages.includes('ALIGNMENT:'+proposal.id));

const restored=restoreReviewedProjectXYFrameRegistration(applied.entities,proposal.id);
const refRestored=restored.entities.find(entity=>entity.id==='ref');
const movRestored=restored.entities.find(entity=>entity.id==='mov');
assert.equal(restored.restoredEntities,1);
assert.equal(movRestored.x,1);assert.equal(movRestored.y,2);assert.equal(movRestored.x2,3);assert.equal(movRestored.y2,2);
assert.equal(movRestored.meta.coordinateUnits,'sheet');
assert.equal(movRestored.meta.projectXYFrameId,undefined);
assert.equal(refRestored.meta.projectXYFrameId,undefined);

const movingC={...moving,id:'mov-c',source:'Civil.pdf',meta:{...moving.meta,sourceSha256:shaC}};
const proposalC={...proposal,id:referenceKey+'->'+shaC+':1',movingKey:shaC+':1',movingSheet:'C1.01'};
const first=applyReviewedProjectXYFrameRegistration([reference,moving,movingC],proposal);
const second=applyReviewedProjectXYFrameRegistration(first.entities,proposalC);
const refTwice=second.entities.find(entity=>entity.id==='ref');
assert.equal(refTwice.meta.projectXYRegistrationIds.length,2);
const restoreOne=restoreReviewedProjectXYFrameRegistration(second.entities,proposal.id);
const refAfterOne=restoreOne.entities.find(entity=>entity.id==='ref');
assert.equal(refAfterOne.meta.projectXYFrameId,'PROJECT_XY:'+referenceKey,'reference frame must persist while another discipline registration remains');
assert.deepEqual(refAfterOne.meta.projectXYRegistrationIds,[proposalC.id]);

assert.throws(()=>applyReviewedProjectXYFrameRegistration([
 reference,
 {...moving,meta:{...moving.meta,sheetXYCalibrationId:'xy:manual'}}
],proposal),/Restore manual XY calibration/);

assert.throws(()=>applyReviewedProjectXYFrameRegistration([
 reference,
 {...reference,id:'ref-2',meta:{...reference.meta,coordinateUnits:'sheet'}},
 moving
],proposal),/inconsistent coordinate units/);

const nonMetricReference={...reference,id:'ref-sheet',meta:{...reference.meta,coordinateUnits:'sheet'}};
const nonMetric=applyReviewedProjectXYFrameRegistration([nonMetricReference,moving],proposal);
assert.equal(nonMetric.registration.metric,false);
assert.equal(nonMetric.entities.find(entity=>entity.id==='mov').meta.coordinateUnits,'sheet');

const legacyReference={...reference,id:'ref-legacy',meta:{...reference.meta}};
delete legacyReference.meta.coordinateUnits;
const legacy=applyReviewedProjectXYFrameRegistration([legacyReference,moving],proposal);
assert.equal(legacy.registration.coordinateUnits,'sheet');
assert.equal(legacy.registration.metric,false);
assert.equal(legacy.entities.find(entity=>entity.id==='mov').meta.coordinateUnits,'sheet','legacy PDF/source-sheet coordinates remain non-metric when units are absent');

const nativeHintReference={...reference,id:'ref-native-hint',meta:{...reference.meta,sourceType:'DXF',unitToMeters:.3048}};
delete nativeHintReference.meta.coordinateUnits;
assert.throws(()=>applyReviewedProjectXYFrameRegistration([nativeHintReference,moving],proposal),/metric\/native coordinate hints but no explicit coordinate-units authority/);

const autoSync=fs.readFileSync('components/SpatialAutoSync.tsx','utf8');
const spatialPage=fs.readFileSync('app/spatial/page.tsx','utf8');
const compilationApi=fs.readFileSync('app/api/spatial/compilations/route.ts','utf8');
const hydrator=fs.readFileSync('components/SpatialServerHydrator.tsx','utf8');
assert.match(autoSync,/addEventListener\('stratum:graph-updated',schedule\)/,'every reviewed graph update must schedule authenticated server sync');
assert.match(autoSync,/fetch\('\/api\/spatial\/compilations',[\s\S]*method:'POST'/,'auto-sync must submit the complete working graph to the compilation API');
assert.match(spatialPage,/\{session&&<SpatialAutoSync\/>\}/,'authenticated Spatial must mount auto-sync');
assert.match(compilationApi,/const Graph=z\.object\([\s\S]*\)\.passthrough\(\)/,'server compilation schema must preserve projectFrameRegistrations and other top-level graph review metadata');
assert.match(compilationApi,/JSON\.stringify\(graph\)/,'server snapshot must persist the complete graph JSON');
assert.match(hydrator,/body\.latest\?\.graph_json/);
assert.match(hydrator,/replaceCurrentSpatialGraph\(restoredGraph\)/,'server hydration must restore the persisted full graph into the browser workspace');

const component=fs.readFileSync('components/AutoSheetAlignmentReview.tsx','utf8');
assert.match(component,/applyReviewedProjectXYFrameRegistration/);
assert.match(component,/restoreReviewedProjectXYFrameRegistration/);
assert.match(component,/projectFrameRegistrations/);
assert.match(component,/projectXYFrameId/);
assert.match(component,/explicitly inherit/);
assert.doesNotMatch(component,/transformSheetPoint/,'component-local coordinate mutation must be replaced by the durable registration library');

console.log('Project XY frame registration passed: reviewed Architectural/Civil/Electrical transforms share one explicit frame, moving geometry inherits reference units, exact source coordinates/units restore, multiple registrations coexist safely, compounded/manual frame semantics fail closed, and authenticated auto-sync/server hydration preserve the full registration graph.');
