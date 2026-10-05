import assert from 'node:assert/strict';
import {applyReviewedProjectXYFrameRegistration,restoreReviewedProjectXYFrameRegistration} from '../lib/project-xy-frame-registration.ts';
import {buildSourceBoundary,measureBoundaryOverlap} from '../lib/sheet-boundary-overlap.ts';
import {deriveSpatialEvidenceEnvelope} from '../lib/spatial-evidence-envelope.ts';

const shaA='a'.repeat(64),shaE='e'.repeat(64),shaC='c'.repeat(64);
const keyA=shaA+':1',keyE=shaE+':1',keyC=shaC+':1';
const identity={scale:1,rotationRadians:0,rotationDegrees:0,translateX:0,translateY:0,rmsResidual:0};

const line=(id,source,sha,x,y,x2,y2,units='sheet')=>({
 id,source,kind:'line',name:id,x,y,x2,y2,confidence:.99,
 meta:{sourceSha256:sha,page:1,coordinateUnits:units,physicalTruth:false,reviewRequired:true}
});
const square=(prefix,source,sha,minX,minY,maxX,maxY,units)=>[
 line(prefix+'-1',source,sha,minX,minY,maxX,minY,units),
 line(prefix+'-2',source,sha,maxX,minY,maxX,maxY,units),
 line(prefix+'-3',source,sha,maxX,maxY,minX,maxY,units),
 line(prefix+'-4',source,sha,minX,maxY,minX,minY,units)
];

const architectural=square('A','Architectural.pdf',shaA,0,0,20,10,'m_reviewed_pdf');
const electrical=square('E','Electrical.pdf',shaE,0,0,10,5,'sheet');
const civil=square('C','Civil.pdf',shaC,100,200,110,205,'sheet');
const equipment={
 id:'E-EVSE-1',source:'Electrical.pdf',kind:'text-asset-candidate',name:'EVSE-1',
 x:5,y:2.5,confidence:.9,
 meta:{sourceSha256:shaE,page:1,coordinateUnits:'sheet',symbolAnchorStatus:'RESOLVED_REVIEW_CANDIDATE',spatialPlacementAuthority:'SOURCE_VECTOR_SYMBOL_ANCHOR',physicalTruth:false,reviewRequired:true}
};
const civilControl={
 id:'C-FG-1',source:'Civil.pdf',kind:'elevation-control-point',name:'FG 100.00',
 x:105,y:202.5,confidence:.9,
 meta:{sourceSha256:shaC,page:1,coordinateUnits:'sheet',physicalTruth:false,reviewRequired:true}
};

const proposal=(id,movingKey,movingSheet,transform)=>({
 id,referenceKey:keyA,movingKey,referenceSheet:'A1.01',movingSheet,
 anchors:[{name:'GRID A',referenceEntityId:'A-1',movingEntityId:'x'}],
 transform,confidence:.95,eligible:true,reasons:[],warnings:[],crossChecks:{boundary:'CONSISTENT',boundaryOverlapRatio:1},
 reviewRequired:true,autoApply:false,verified:false
});

const electricalProposal=proposal(keyA+'->'+keyE,keyE,'E1.01',{scale:2,rotationRadians:0,rotationDegrees:0,translateX:0,translateY:0,rmsResidual:.01});
const civilProposal=proposal(keyA+'->'+keyC,keyC,'C1.01',{scale:2,rotationRadians:0,rotationDegrees:0,translateX:-200,translateY:-400,rmsResidual:.015});

let entities=[...architectural,...electrical,...civil,equipment,civilControl];
const electricalRegistered=applyReviewedProjectXYFrameRegistration(entities,electricalProposal);
entities=electricalRegistered.entities;
const civilRegistered=applyReviewedProjectXYFrameRegistration(entities,civilProposal);
entities=civilRegistered.entities;

const frameId='PROJECT_XY:'+keyA;
for(const entity of entities.filter(item=>[keyA,keyE,keyC].includes(String(item.meta.sourceSha256)+':'+item.meta.page))){
 assert.equal(entity.meta.projectXYFrameId,frameId,'all registered disciplines must share one project frame');
 assert.equal(entity.meta.coordinateUnits,'m_reviewed_pdf','moving disciplines inherit the metric reference-frame units');
}
const evse=entities.find(item=>item.id==='E-EVSE-1');
const fg=entities.find(item=>item.id==='C-FG-1');
assert.ok(Math.abs(evse.x-10)<1e-12&&Math.abs(evse.y-5)<1e-12);
assert.ok(Math.abs(fg.x-10)<1e-12&&Math.abs(fg.y-5)<1e-12,'civil and electrical evidence at the same physical location must converge to the same project XY coordinate');

const aBoundary=buildSourceBoundary(entities,keyA);
const eBoundary=buildSourceBoundary(entities,keyE);
const cBoundary=buildSourceBoundary(entities,keyC);
assert.ok(aBoundary&&eBoundary&&cBoundary);
const ae=measureBoundaryOverlap(aBoundary,eBoundary,identity);
const ac=measureBoundaryOverlap(aBoundary,cBoundary,identity);
assert.ok(ae&&ac);
assert.ok(ae.overlapOfSmaller>.999999&&ae.iou>.999999,'Architectural and Electrical footprints must overlap in the registered project frame');
assert.ok(ac.overlapOfSmaller>.999999&&ac.iou>.999999,'Architectural and Civil footprints must overlap in the registered project frame');

const envelope=deriveSpatialEvidenceEnvelope({
 id:evse.id,name:evse.name,source:evse.source,x:evse.x,y:evse.y,
 meta:{...evse.meta,zConstraintGraph:{status:'UNRESOLVED',baseZMeters:null,nodes:[],relations:[],conflicts:[],frameGaps:[]}}
},null);
assert.equal(envelope.horizontal.coordinateFrame,frameId);
assert.equal(envelope.horizontal.metricCoordinateKnown,true);
assert.equal(envelope.horizontal.state,'RESOLVED_CANDIDATE');
assert.equal(envelope.readiness,'DESIGN_2D_COORDINATION_CANDIDATE');
assert.equal(envelope.physicalTruth,false);
assert.equal(envelope.physicalClashAuthority,false);

const referenceEntity=entities.find(item=>item.id==='A-1');
assert.equal(referenceEntity.meta.projectXYRegistrationIds.length,2,'reference frame must retain both Civil and Electrical registrations');

const restoreElectrical=restoreReviewedProjectXYFrameRegistration(entities,electricalProposal.id);
const eRestored=restoreElectrical.entities.find(item=>item.id==='E-1');
const cStill=restoreElectrical.entities.find(item=>item.id==='C-1');
const aStill=restoreElectrical.entities.find(item=>item.id==='A-1');
assert.equal(eRestored.meta.coordinateUnits,'sheet');assert.equal(eRestored.x,0);assert.equal(eRestored.x2,10);
assert.equal(cStill.meta.projectXYFrameId,frameId,'restoring Electrical must not detach Civil');
assert.equal(aStill.meta.projectXYFrameId,frameId,'reference project frame must remain while Civil is still registered');
assert.deepEqual(aStill.meta.projectXYRegistrationIds,[civilProposal.id]);

console.log('Multi-discipline project-frame golden path passed: Architectural, Electrical and Civil source frames converge to one metric project XY frame with coincident boundaries/evidence, reversible source provenance, and no physical/as-built truth promotion.');
