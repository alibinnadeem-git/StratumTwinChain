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
 {sourceSha256:refSha,page:1,sheetNumber:{value:'E-101'},discipline:{value:'Electrical'},reviewState:'CONFIRMED'},
 {sourceSha256:movingSha,page:2,sheetNumber:{value:'E-102'},discipline:{value:'Electrical'},reviewState:'CONFIRMED'}
];
const proposals=proposeSheetAlignments(entities,sheets);
ok('three shared source-grounded anchors create one proposal',proposals.length===1&&proposals[0].anchors.length===3);
ok('well-fitted same-discipline proposal is reviewable',proposals[0].eligible===true);
ok('proposal never auto-applies or self-verifies',proposals[0].autoApply===false&&proposals[0].verified===false&&proposals[0].reviewRequired===true);
ok('proposal transform matches fixture',close(proposals[0].transform.scale,2)&&close(proposals[0].transform.rotationDegrees,90));

const mismatch=proposeSheetAlignments(entities,[sheets[0],{...sheets[1],discipline:{value:'Mechanical'}}]);
ok('confirmed discipline mismatch blocks automatic proposal application',mismatch.length===1&&!mismatch[0].eligible&&mismatch[0].reasons.some(reason=>reason.includes('disciplines differ')));
const unconfirmed=proposeSheetAlignments(entities,[sheets[0],{...sheets[1],reviewState:'CANDIDATE'}]);
ok('unconfirmed sheet identity cannot participate in automatic alignment',unconfirmed.length===0);

const component=read('components/AutoSheetAlignmentReview.tsx');
const page=read('app/compiler/page.tsx');
ok('compiler mounts auto-alignment after title-block review and before persistence',page.indexOf('<TitleBlockIntelligence/>')<page.indexOf('<AutoSheetAlignmentReview/>')&&page.indexOf('<AutoSheetAlignmentReview/>')<page.indexOf('<SpatialCompilationPersistence/>'));
ok('alignment UI requires explicit apply action',component.includes('Apply reviewed proposal'));
ok('alignment UI preserves original coordinates before transforming',component.includes('autoSheetAlignmentOriginal'));
ok('alignment UI provides explicit coordinate restoration',component.includes('Restore original coordinates'));
ok('alignment UI records alignmentVerified false',component.includes('alignmentVerified:false'));
ok('alignment UI states no asset DIR PoVI or physical-truth promotion',component.includes('do not create STRATUM Assets')&&component.includes('PoVI finality')&&component.includes('physical truth'));
ok('alignment UI cannot call asset lifecycle chain or approval APIs',!/["'`]\/api\/(?:assets|lifecycle|chain|approvals)/.test(component));

console.log('\nAutomatic multi-sheet alignment proposal and HITL safety contract passed.');
