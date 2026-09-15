import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {drawingScaleDenominator,extractSheetIdentity} from '../lib/title-block.ts';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const ok=(name,condition)=>{assert.ok(condition,name);console.log(`✓ ${name}`)};
const close=(a,b,tolerance=1e-9)=>Math.abs(a-b)<=tolerance;

const labeled=extractSheetIdentity({page:2,sourceName:'electrical-set.pdf',sourceSha256:'a'.repeat(64),pageWidthPoints:1000,pageHeightPoints:700,items:[
 {text:'SHEET NO.',x:.72,y:.82,width:.08,height:.02},
 {text:'E-201',x:.83,y:.82,width:.08,height:.03},
 {text:'SHEET TITLE',x:.62,y:.76,width:.1,height:.02},
 {text:'LEVEL 2 ELECTRICAL POWER PLAN',x:.73,y:.76,width:.24,height:.035},
 {text:'SCALE',x:.62,y:.87,width:.05,height:.02},
 {text:'1/8" = 1\'-0"',x:.69,y:.87,width:.09,height:.02},
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
ok('sheet title resolves floor/level candidate',labeled.floor.value==='L2'&&labeled.floor.method==='SHEET_TITLE_LEVEL');
ok('labeled architectural scale is captured as review metadata',labeled.drawingScale.value==='1/8" = 1\'-0"'&&labeled.drawingScale.confidence>=.85);
ok('architectural scale converts to a dimensionless denominator',close(drawingScaleDenominator(labeled.drawingScale.value),96));
ok('page geometry retains the PDF normalization basis',labeled.pageGeometry.widthPoints===1000&&labeled.pageGeometry.heightPoints===700&&labeled.pageGeometry.maxDimensionPoints===1000);
ok('title-block result is always review required',labeled.reviewRequired===true&&labeled.reviewState==='CANDIDATE');
ok('title-block result cannot enable alignment',labeled.alignmentEligible===false);
ok('parsed drawing scale cannot become geometry authority',labeled.geometryScaleAuthority===false);
ok('strong labeled fixture has useful confidence',labeled.confidence>=.7);

const standalone=extractSheetIdentity({page:1,sourceName:'architectural.pdf',sourceSha256:'b'.repeat(64),pageWidthPoints:700,pageHeightPoints:1000,items:[
 {text:'A101',x:.88,y:.86,width:.07,height:.03},
 {text:'FIRST FLOOR ARCHITECTURAL PLAN',x:.62,y:.8,width:.28,height:.04},
 {text:'1:100',x:.9,y:.92,width:.06,height:.02},
 {text:'PROJECT NORTH',x:.15,y:.15,width:.1,height:.02}
]});
ok('standalone sheet pattern remains a lower-confidence candidate',standalone.sheetNumber.value==='A101'&&standalone.sheetNumber.confidence<.9);
ok('sheet prefix can infer architectural discipline',standalone.discipline.value==='Architectural');
ok('ordinal floor title normalizes to L1',standalone.floor.value==='L1');
ok('unique standalone metric scale remains lower-confidence review metadata',standalone.drawingScale.value==='1:100'&&standalone.drawingScale.confidence<.8);
ok('metric scale converts to its denominator',drawingScaleDenominator(standalone.drawingScale.value)===100);
ok('page geometry max dimension is orientation-independent',standalone.pageGeometry.maxDimensionPoints===1000);
ok('standalone inference remains review-only',standalone.reviewState==='CANDIDATE'&&standalone.alignmentEligible===false&&standalone.geometryScaleAuthority===false);

ok('NTS deliberately has no numeric scale denominator',drawingScaleDenominator('NTS')===null);
ok('mixed architectural scale denominator is normalized',close(drawingScaleDenominator('1 1/2" = 1\'-0"'),8));

const ambiguousScale=extractSheetIdentity({page:3,sourceName:'details.pdf',sourceSha256:'d'.repeat(64),items:[
 {text:'A-501',x:.86,y:.84,width:.08,height:.03},
 {text:'WALL DETAILS',x:.63,y:.78,width:.18,height:.04},
 {text:'1:20',x:.7,y:.86,width:.06,height:.02},
 {text:'1:10',x:.8,y:.9,width:.06,height:.02}
]});
ok('competing unlabeled scales fail closed as ambiguous',ambiguousScale.drawingScale.value===null&&ambiguousScale.drawingScale.method==='AMBIGUOUS_SCALE');
ok('ambiguous scales never authorize geometry scaling',ambiguousScale.geometryScaleAuthority===false&&ambiguousScale.alignmentEligible===false);

const unresolved=extractSheetIdentity({page:4,sourceName:'notes.pdf',sourceSha256:'c'.repeat(64),items:[{text:'GENERAL NOTES',x:.2,y:.2,width:.15,height:.04}]});
ok('unresolved page does not invent a sheet number',unresolved.sheetNumber.value===null);
ok('unresolved page does not invent floor or scale',unresolved.floor.value===null&&unresolved.drawingScale.value===null);
ok('missing page geometry remains explicitly unavailable',unresolved.pageGeometry.maxDimensionPoints===null);
ok('unresolved page remains review-only',unresolved.reviewRequired===true&&unresolved.alignmentEligible===false&&unresolved.geometryScaleAuthority===false);

const component=read('components/TitleBlockIntelligence.tsx');
const page=read('app/compiler/page.tsx');
const persistence=read('app/api/spatial/compilations/route.ts');
ok('compiler mounts title-block review before server persistence',page.indexOf('<TitleBlockIntelligence/>')>-1&&page.indexOf('<TitleBlockIntelligence/>')<page.indexOf('<SpatialCompilationPersistence/>'));
ok('reviewed title blocks are embedded in the compiled graph artifact',component.includes('graph.titleBlocks=next'));
ok('PDF page dimensions are persisted only as normalization context',component.includes('pageWidthPoints:viewport.width')&&component.includes('pageHeightPoints:viewport.height'));
ok('human confirmation keeps automatic alignment disabled',component.includes("alignmentEligible:false as const")&&component.includes('Automatic alignment and geometry scale remain disabled'));
ok('human confirmation keeps parsed scale non-authoritative',component.includes("geometryScaleAuthority:false as const")&&component.includes('SCALE IS NOT GEOMETRY AUTHORITY'));
ok('component states confirmation does not establish trust',component.includes('confirmation never establishes geometry scale, alignment, Verified state, DIR finality or physical truth.'));
ok('title-block component cannot call asset/lifecycle/chain mutation APIs',!/["'`]\/api\/(?:assets|lifecycle|chain|approvals)/.test(component));
ok('server compilation schema preserves reviewed extension fields',persistence.includes('}).passthrough();'));

console.log('\nTitle-block intelligence and review safety contract passed.');
