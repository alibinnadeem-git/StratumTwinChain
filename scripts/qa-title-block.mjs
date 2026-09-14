import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {extractSheetIdentity} from '../lib/title-block.ts';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const ok=(name,condition)=>{assert.ok(condition,name);console.log(`✓ ${name}`)};

const labeled=extractSheetIdentity({page:2,sourceName:'electrical-set.pdf',sourceSha256:'a'.repeat(64),items:[
 {text:'SHEET NO.',x:.72,y:.82,width:.08,height:.02},
 {text:'E-201',x:.83,y:.82,width:.08,height:.03},
 {text:'SHEET TITLE',x:.62,y:.76,width:.1,height:.02},
 {text:'LEVEL 2 ELECTRICAL POWER PLAN',x:.73,y:.76,width:.24,height:.035},
 {text:'REV',x:.72,y:.9,width:.04,height:.02},
 {text:'A',x:.79,y:.9,width:.02,height:.02},
 {text:'DATE',x:.82,y:.9,width:.04,height:.02},
 {text:'09/13/2026',x:.88,y:.9,width:.1,height:.02}
]});
ok('labeled fixture resolves sheet number',labeled.sheetNumber.value==='E-201');
ok('labeled fixture resolves sheet title',labeled.sheetTitle.value==='LEVEL 2 ELECTRICAL POWER PLAN');
ok('labeled fixture resolves revision',labeled.revision.value==='A');
ok('labeled fixture resolves issue date',labeled.issueDate.value==='09/13/2026');
ok('labeled fixture resolves discipline from evidence',labeled.discipline.value==='Electrical');
ok('title-block result is always review required',labeled.reviewRequired===true&&labeled.reviewState==='CANDIDATE');
ok('title-block result cannot enable alignment',labeled.alignmentEligible===false);
ok('strong labeled fixture has useful confidence',labeled.confidence>=.7);

const standalone=extractSheetIdentity({page:1,sourceName:'architectural.pdf',sourceSha256:'b'.repeat(64),items:[
 {text:'A101',x:.88,y:.86,width:.07,height:.03},
 {text:'FIRST FLOOR ARCHITECTURAL PLAN',x:.62,y:.8,width:.28,height:.04},
 {text:'PROJECT NORTH',x:.15,y:.15,width:.1,height:.02}
]});
ok('standalone sheet pattern remains a lower-confidence candidate',standalone.sheetNumber.value==='A101'&&standalone.sheetNumber.confidence<.9);
ok('sheet prefix can infer architectural discipline',standalone.discipline.value==='Architectural');
ok('standalone inference remains review-only',standalone.reviewState==='CANDIDATE'&&standalone.alignmentEligible===false);

const unresolved=extractSheetIdentity({page:4,sourceName:'notes.pdf',sourceSha256:'c'.repeat(64),items:[{text:'GENERAL NOTES',x:.2,y:.2,width:.15,height:.04}]});
ok('unresolved page does not invent a sheet number',unresolved.sheetNumber.value===null);
ok('unresolved page remains review-only',unresolved.reviewRequired===true&&unresolved.alignmentEligible===false);

const component=read('components/TitleBlockIntelligence.tsx');
const page=read('app/compiler/page.tsx');
const persistence=read('app/api/spatial/compilations/route.ts');
ok('compiler mounts title-block review before server persistence',page.indexOf('<TitleBlockIntelligence/>')>-1&&page.indexOf('<TitleBlockIntelligence/>')<page.indexOf('<SpatialCompilationPersistence/>'));
ok('reviewed title blocks are embedded in the compiled graph artifact',component.includes('graph.titleBlocks=next'));
ok('human confirmation keeps automatic alignment disabled',component.includes("alignmentEligible:false as const")&&component.includes('Automatic alignment is still disabled'));
ok('component states confirmation does not establish trust',component.includes('Confirmation never establishes geometry alignment, Verified state, DIR finality or physical truth.'));
ok('title-block component cannot call asset/lifecycle/chain mutation APIs',!/["'`]\/api\/(?:assets|lifecycle|chain|approvals)/.test(component));
ok('server compilation schema preserves reviewed extension fields',persistence.includes('}).passthrough();'));

console.log('\nTitle-block intelligence and review safety contract passed.');
