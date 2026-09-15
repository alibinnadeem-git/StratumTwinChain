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
const entities=[
 {id:'r1',name:'PANEL LP1',x:10,y:20,kind:'logical-tag',confidence:.9,meta:{sourceSha256:refSha,page:1}},
 {id:'r2',name:'TRANSFORMER T1',x:10,y:22,kind:'logical-tag',confidence:.9,meta:{sourceSha256:refSha,page:1}},
 {id:'r3',name:'ATS 1',x:8,y:20,kind:'logical-tag',confidence:.9,meta:{sourceSha256:refSha,page:1}},
 {id:'m1',name:'PANEL LP1',x:0,y:0,kind:'logical-tag',confidence:.9,meta:{sourceSha256:movingSha,page:2}},
 {id:'m2',name:'TRANSFORMER T1',x:1,y:0,kind:'logical-tag',confidence:.9,meta:{sourceSha256:movingSha,page:2}},
 {id:'m3',name:'ATS 1',x:0,y:1,kind:'logical-tag',confidence:.9,meta:{sourceSha256:movingSha,page:2}}
];
const sheets=[
 {sourceSha256:refSha,page:1,sheetNumber:{value:'E-101'},discipline:{value:'Electrical'},floor:{value:'L1'},drawingScale:{value:'1:100'},pageGeometry:{widthPoints:1000,heightPoints:700,maxDimensionPoints:1000},geometryScaleAuthority:false,reviewState:'CONFIRMED'},
 {sourceSha256:movingSha,page:2,sheetNumber:{value:'E-102'},discipline:{value:'Electrical'},floor:{value:'L1'},drawingScale:{value:'1:200'},pageGeometry:{widthPoints:1000,heightPoints:700,maxDimensionPoints:1000},geometryScaleAuthority:false,reviewState:'CONFIRMED'}
];
const proposals=proposeSheetAlignments(entities,sheets);
ok('three shared source-grounded anchors create one proposal',proposals.length===1&&proposals[0].anchors.length===3);
ok('well-fitted same-discipline and same-floor proposal is reviewable',proposals[0].eligible===true);
ok('proposal never auto-applies or self-verifies',proposals[0].autoApply===false&&proposals[0].verified===false&&proposals[0].reviewRequired===true);
ok('proposal transform remains anchor-derived',close(proposals[0].transform.scale,2)&&close(proposals[0].transform.rotationDegrees,90));
ok('title-block plus page geometry independently expects the same normalized scale ratio',close(proposals[0].crossChecks.expectedScale,2)&&proposals[0].crossChecks.scale==='CONSISTENT');
ok('confirmed floor and discipline are safety matches',proposals[0].crossChecks.floor==='MATCH'&&proposals[0].crossChecks.discipline==='MATCH');

const mismatch=proposeSheetAlignments(entities,[sheets[0],{...sheets[1],discipline:{value:'Mechanical'}}]);
ok('confirmed discipline mismatch blocks automatic proposal application',mismatch.length===1&&!mismatch[0].eligible&&mismatch[0].crossChecks.discipline==='MISMATCH'&&mismatch[0].reasons.some(reason=>reason.includes('disciplines differ')));
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

const component=read('components/AutoSheetAlignmentReview.tsx');
const page=read('app/compiler/page.tsx');
ok('compiler mounts auto-alignment after title-block review and before persistence',page.indexOf('<TitleBlockIntelligence/>')<page.indexOf('<AutoSheetAlignmentReview/>')&&page.indexOf('<AutoSheetAlignmentReview/>')<page.indexOf('<SpatialCompilationPersistence/>'));
ok('alignment UI requires explicit apply action',component.includes('Apply reviewed proposal'));
ok('alignment UI states repeated anchors create the transform',component.includes('Repeated anchors create the transform'));
ok('title-block floor and scale are safety cross-checks only',component.includes('can only reject or flag a suspicious proposal')&&component.includes('never create or modify the transform'));
ok('alignment UI preserves original coordinates before transforming',component.includes('autoSheetAlignmentOriginal'));
ok('alignment UI provides explicit coordinate restoration',component.includes('Restore original coordinates'));
ok('alignment UI records alignmentVerified false',component.includes('alignmentVerified:false'));
ok('alignment review ledger stores cross-check evidence',component.includes('crossChecks:proposal.crossChecks'));
ok('alignment UI states no asset DIR PoVI or physical-truth promotion',component.includes('do not create STRATUM Assets')&&component.includes('PoVI finality')&&component.includes('physical truth'));
ok('alignment UI cannot call asset lifecycle chain or approval APIs',!/["'`]\/api\/(?:assets|lifecycle|chain|approvals)/.test(component));

console.log('\nAutomatic multi-sheet alignment proposal and HITL safety contract passed.');
