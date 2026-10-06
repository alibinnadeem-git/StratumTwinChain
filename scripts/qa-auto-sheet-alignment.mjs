import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {proposeSheetAlignments} from '../lib/auto-sheet-alignment.ts';
import {fitSheetSimilarity,transformSheetPoint} from '../lib/sheet-similarity.ts';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const ok=(name,condition)=>{assert.ok(condition,name);console.log(`✓ ${name}`)};
const close=(a,b,tolerance=1e-6)=>Math.abs(a-b)<=tolerance;

const fitted=fitSheetSimilarity([{x:0,y:0},{x:1,y:0},{x:0,y:1}],[{x:10,y:20},{x:10,y:22},{x:8,y:20}]);
ok('similarity fit succeeds for three non-collinear anchors',Boolean(fitted));
ok('similarity fit recovers scale',close(fitted.scale,2));
ok('similarity fit recovers rotation',close(fitted.rotationDegrees,90));
ok('similarity fit recovers translation',close(fitted.translateX,10)&&close(fitted.translateY,20));
ok('similarity fit has negligible residual',fitted.rmsResidual<1e-8);
const transformed=transformSheetPoint({x:1,y:0},fitted);
ok('sheet point transform applies recovered similarity',close(transformed.x,10)&&close(transformed.y,22));

const refSha='a'.repeat(64),movingSha='b'.repeat(64);
const refMeta={sourceSha256:refSha,page:1,planFrameId:'frame-l1'};
const movingMeta={sourceSha256:movingSha,page:2,planFrameId:'frame-l1'};
const refLineMeta={...refMeta,drawingBasemap:true};
const movingLineMeta={...movingMeta,drawingBasemap:true};
const entities=[
 {id:'r1',name:'PANEL LP1',x:10,y:20,kind:'logical-tag',confidence:.9,meta:refMeta},
 {id:'r2',name:'TRANSFORMER T1',x:10,y:22,kind:'logical-tag',confidence:.9,meta:refMeta},
 {id:'r3',name:'ATS 1',x:8,y:20,kind:'logical-tag',confidence:.9,meta:refMeta},
 {id:'m1',name:'PANEL LP1',x:0,y:0,kind:'logical-tag',confidence:.9,meta:movingMeta},
 {id:'m2',name:'TRANSFORMER T1',x:1,y:0,kind:'logical-tag',confidence:.9,meta:movingMeta},
 {id:'m3',name:'ATS 1',x:0,y:1,kind:'logical-tag',confidence:.9,meta:movingMeta},
 {id:'rb1',name:'Reference boundary 1',x:10,y:20,x2:10,y2:24,kind:'line',confidence:1,meta:refLineMeta},
 {id:'rb2',name:'Reference boundary 2',x:10,y:24,x2:8,y2:24,kind:'line',confidence:1,meta:refLineMeta},
 {id:'rb3',name:'Reference boundary 3',x:8,y:24,x2:8,y2:20,kind:'line',confidence:1,meta:refLineMeta},
 {id:'rb4',name:'Reference boundary 4',x:8,y:20,x2:10,y2:20,kind:'line',confidence:1,meta:refLineMeta},
 {id:'mb1',name:'Moving boundary 1',x:0,y:0,x2:2,y2:0,kind:'line',confidence:1,meta:movingLineMeta},
 {id:'mb2',name:'Moving boundary 2',x:2,y:0,x2:2,y2:1,kind:'line',confidence:1,meta:movingLineMeta},
 {id:'mb3',name:'Moving boundary 3',x:2,y:1,x2:0,y2:1,kind:'line',confidence:1,meta:movingLineMeta},
 {id:'mb4',name:'Moving boundary 4',x:0,y:1,x2:0,y2:0,kind:'line',confidence:1,meta:movingLineMeta}
];
const sheets=[
 {sourceSha256:refSha,page:1,sheetNumber:{value:'E-101'},discipline:{value:'Electrical'},floor:{value:'L1'},drawingScale:{value:'1:100'},pageGeometry:{widthPoints:1000,heightPoints:700,maxDimensionPoints:1000},geometryScaleAuthority:false,reviewState:'CONFIRMED'},
 {sourceSha256:movingSha,page:2,sheetNumber:{value:'A-101'},discipline:{value:'Architectural'},floor:{value:'L1'},drawingScale:{value:'1:200'},pageGeometry:{widthPoints:1000,heightPoints:700,maxDimensionPoints:1000},geometryScaleAuthority:false,reviewState:'CONFIRMED'}
];
const proposals=proposeSheetAlignments(entities,sheets);
ok('three shared source-grounded anchors create one proposal',proposals.length===1&&proposals[0].anchors.length===3);
ok('well-fitted cross-discipline same-floor proposal remains reviewable',proposals[0].eligible===true&&proposals[0].crossChecks.discipline==='MISMATCH');
ok('proposal never auto-applies or self-verifies',proposals[0].autoApply===false&&proposals[0].verified===false&&proposals[0].reviewRequired===true);
ok('proposal transform remains anchor-derived',close(proposals[0].transform.scale,2)&&close(proposals[0].transform.rotationDegrees,90));
ok('title-block plus page geometry independently expects the same normalized scale ratio',close(proposals[0].crossChecks.expectedScale,2)&&proposals[0].crossChecks.scale==='CONSISTENT');
ok('confirmed floor is a safety match',proposals[0].crossChecks.floor==='MATCH');
ok('dominant matched plan frame scopes both source-grounded boundaries',proposals[0].crossChecks.referencePlanFrameId==='frame-l1'&&proposals[0].crossChecks.movingPlanFrameId==='frame-l1');
ok('transformed source footprints independently corroborate the alignment',proposals[0].crossChecks.boundary==='CONSISTENT'&&close(proposals[0].crossChecks.boundaryOverlapRatio,1)&&close(proposals[0].crossChecks.boundaryIou,1));
ok('cross-discipline warning remains visible even with excellent footprint overlap',proposals[0].warnings.some(warning=>warning.includes('disciplines differ')));

const floorMismatch=proposeSheetAlignments(entities,[sheets[0],{...sheets[1],floor:{value:'L2'}}]);
ok('confirmed floor mismatch blocks automatic proposal application',floorMismatch.length===1&&!floorMismatch[0].eligible&&floorMismatch[0].crossChecks.floor==='MISMATCH'&&floorMismatch[0].reasons.some(reason=>reason.includes('floors differ')));
const scaleMismatch=proposeSheetAlignments(entities,[sheets[0],{...sheets[1],drawingScale:{value:'1:100'}}]);
ok('strong title-block/page-geometry scale disagreement blocks the anchor proposal',scaleMismatch.length===1&&!scaleMismatch[0].eligible&&scaleMismatch[0].crossChecks.scale==='MISMATCH'&&scaleMismatch[0].reasons.some(reason=>reason.includes('strongly disagrees')));
ok('scale mismatch does not rewrite the anchor-derived transform',close(scaleMismatch[0].transform.scale,2));
const nts=proposeSheetAlignments(entities,[sheets[0],{...sheets[1],drawingScale:{value:'NTS'}}]);
ok('NTS scale is unavailable rather than invented and does not block a good anchor fit',nts.length===1&&nts[0].eligible&&nts[0].crossChecks.scale==='UNAVAILABLE'&&nts[0].crossChecks.expectedScale===null);
const geometryAuthority=proposeSheetAlignments(entities,[sheets[0],{...sheets[1],geometryScaleAuthority:true}]);
ok('any attempt to grant title-block scale geometry authority fails closed',geometryAuthority.length===1&&!geometryAuthority[0].eligible&&geometryAuthority[0].reasons.some(reason=>reason.includes('cannot hold geometry authority')));
const unconfirmed=proposeSheetAlignments(entities,[sheets[0],{...sheets[1],reviewState:'CANDIDATE'}]);
ok('unconfirmed sheet identity cannot participate in automatic alignment',unconfirmed.length===0);

const footprintMismatchEntities=entities.map(entity=>{
 if(!String(entity.id).startsWith('mb'))return entity;
 return{...entity,x:entity.x+20,x2:Number(entity.x2)+20};
});
const footprintMismatch=proposeSheetAlignments(footprintMismatchEntities,sheets);
ok('matching labels cannot override a displaced drawing footprint',footprintMismatch.length===1&&!footprintMismatch[0].eligible&&footprintMismatch[0].crossChecks.boundary==='MISMATCH');
ok('footprint mismatch explains why coordination is blocked',footprintMismatch[0].reasons.some(reason=>reason.includes('drawing footprints overlap only')));

const noBoundary=proposeSheetAlignments(entities.filter(entity=>!String(entity.id).match(/^[rm]b/)),sheets);
ok('missing footprint evidence stays explicitly unavailable rather than invented',noBoundary.length===1&&noBoundary[0].crossChecks.boundary==='UNAVAILABLE'&&noBoundary[0].warnings.some(warning=>warning.includes('footprint overlap is unavailable')));

const sharedFrame='PROJECT_XY:'+refSha+':1';
const alreadyRegistered=entities.map(entity=>{
 const key=String(entity.meta?.sourceSha256||'')+':'+Number(entity.meta?.page||0);
 return key===refSha+':1'||key===movingSha+':2'
  ?{...entity,meta:{...entity.meta,projectXYFrameId:sharedFrame}}
  :entity;
});
ok('sheets already registered in the same project XY frame do not receive another transform proposal',proposeSheetAlignments(alreadyRegistered,sheets).length===0);

const movingOtherFrame=entities.map(entity=>String(entity.meta?.sourceSha256||'')===movingSha
 ?{...entity,meta:{...entity.meta,projectXYFrameId:'PROJECT_XY:other'}}
 :entity);
const otherFrameProposal=proposeSheetAlignments(movingOtherFrame,sheets);
ok('moving sheet already registered to a different project frame is blocked',otherFrameProposal.length===1&&!otherFrameProposal[0].eligible&&otherFrameProposal[0].reasons.some(reason=>reason.includes('different project XY frame')));

const manualMoving=entities.map(entity=>String(entity.meta?.sourceSha256||'')===movingSha
 ?{...entity,meta:{...entity.meta,sheetXYCalibrationId:'xy:manual'}}
 :entity);
const manualMovingProposal=proposeSheetAlignments(manualMoving,sheets);
ok('moving sheet manual XY calibration blocks project-frame proposal',manualMovingProposal.length===1&&!manualMovingProposal[0].eligible&&manualMovingProposal[0].reasons.some(reason=>reason.includes('Moving sheet has an active manual XY calibration')));

const fullMoving=entities.map(entity=>String(entity.meta?.sourceSha256||'')===movingSha
 ?{...entity,meta:{...entity.meta,sheetTransform:{a:1,b:0,tx:0,ty:0,floor:'L1',elevation:0}}}
 :entity);
const fullMovingProposal=proposeSheetAlignments(fullMoving,sheets);
ok('moving sheet full alignment blocks project-frame proposal',fullMovingProposal.length===1&&!fullMovingProposal[0].eligible&&fullMovingProposal[0].reasons.some(reason=>reason.includes('Moving sheet has an active full sheet alignment')));

const manualReference=entities.map(entity=>String(entity.meta?.sourceSha256||'')===refSha
 ?{...entity,meta:{...entity.meta,sheetXYCalibrationId:'xy:reference'}}
 :entity);
const manualReferenceProposal=proposeSheetAlignments(manualReference,sheets);
ok('reference sheet manual XY calibration blocks project-frame proposal',manualReferenceProposal.length===1&&!manualReferenceProposal[0].eligible&&manualReferenceProposal[0].reasons.some(reason=>reason.includes('Reference sheet has an active manual XY calibration')));

const fullReference=entities.map(entity=>String(entity.meta?.sourceSha256||'')===refSha
 ?{...entity,meta:{...entity.meta,sheetOriginal:{x:entity.x,y:entity.y}}}
 :entity);
const fullReferenceProposal=proposeSheetAlignments(fullReference,sheets);
ok('reference sheet full alignment blocks project-frame proposal',fullReferenceProposal.length===1&&!fullReferenceProposal[0].eligible&&fullReferenceProposal[0].reasons.some(reason=>reason.includes('Reference sheet has an active full sheet alignment')));

const component=read('components/AutoSheetAlignmentReview.tsx');
const registration=read('lib/project-xy-frame-registration.ts');
const overlap=read('lib/sheet-boundary-overlap.ts');
const page=read('app/compiler/page.tsx');
ok('compiler mounts auto-alignment after title-block review and before persistence',page.indexOf('<TitleBlockIntelligence/>')<page.indexOf('<AutoSheetAlignmentReview/>')&&page.indexOf('<AutoSheetAlignmentReview/>')<page.indexOf('<SpatialCompilationPersistence/>'));
ok('alignment UI requires explicit apply action',component.includes('Apply reviewed proposal'));
ok('alignment UI states repeated anchors create the transform',component.includes('Repeated anchors create the transform'));
ok('alignment UI explains independent source-grounded footprint verification',component.includes('Source-grounded drawing geometry independently checks')&&component.includes('Drawing footprint overlap'));
ok('alignment UI explains one durable project XY frame and reference-unit inheritance',component.includes('one durable project XY frame')&&component.includes("inherits the reference frame's coordinate units"));
ok('title-block floor and scale are safety cross-checks only',component.includes('can only reject or flag a suspicious proposal')&&component.includes('never create or modify the transform'));
ok('alignment UI delegates coordinate mutation to the durable registration library',component.includes('applyReviewedProjectXYFrameRegistration')&&component.includes('restoreReviewedProjectXYFrameRegistration'));
ok('registration library preserves original coordinates and units before transforming',registration.includes('projectXYRegistrationOriginal')&&registration.includes('coordinateUnits:meta.coordinateUnits'));
ok('registration transforms endpoints and polygon vertices centrally',registration.includes('x2:end.x')&&registration.includes('original.vertices?.map')&&registration.includes('transformSheetPoint'));
ok('registration assigns one explicit frame id and reference coordinate units',registration.includes("frameId='PROJECT_XY:'")&&registration.includes('coordinateUnits:referenceUnits'));
ok('alignment can derive review-only cross-sheet Z and clears it on restore',component.includes('enrichCrossSheetElevationSurfaces')&&component.includes('clearCrossSheetElevationForAlignment'));
ok('alignment UI provides explicit coordinate restoration',component.includes('Restore original coordinates'));
ok('registration records alignmentVerified false',registration.includes('alignmentVerified:false'));
ok('alignment review ledger stores cross-check evidence',component.includes('crossChecks:proposal.crossChecks'));
ok('cross-discipline coordination warnings are surfaced to the reviewer',component.includes('proposal.warnings')&&component.includes('COORDINATION REVIEW'));
ok('boundary engine uses convex source geometry and geometric clipping rather than title text as geometry authority',overlap.includes('convexHull')&&overlap.includes('clipConvex')&&overlap.includes("entity.meta?.drawingBasemap===true"));
ok('alignment UI states no asset DIR PoVI or physical-truth promotion',component.includes('do not create STRATUM Assets')&&component.includes('PoVI finality')&&component.includes('physical truth'));
ok('alignment UI cannot call asset lifecycle chain or approval APIs',!/["'\x60]\/api\/(?:assets|lifecycle|chain|approvals)/.test(component));

console.log('\nAutomatic multi-sheet alignment now requires anchor-derived transforms plus independent source-footprint evidence, refuses double registration, and delegates reviewed application to the durable shared project-frame layer.');
