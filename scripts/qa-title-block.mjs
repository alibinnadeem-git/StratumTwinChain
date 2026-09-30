import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {declaredScaleMetersPerNormalizedSheetUnit,drawingScaleDenominator,extractSheetGeometryEvidence,extractSheetIdentity} from '../lib/title-block.ts';

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
ok('declared scale produces a review-only normalized-sheet metric candidate',close(labeled.scaleCalibration.metersPerNormalizedSheetUnit,96*1000*.0254/(72*20))&&labeled.scaleCalibration.autoApply===false&&labeled.scaleCalibration.physicalPositionVerified===false);
ok('title-block result is always review required',labeled.reviewRequired===true&&labeled.reviewState==='CANDIDATE');
ok('title-block result cannot enable alignment',labeled.alignmentEligible===false);
ok('parsed drawing scale cannot become geometry authority',labeled.geometryScaleAuthority===false);
ok('strong labeled fixture has useful confidence',labeled.confidence>=.7);

const audiPacific=extractSheetIdentity({page:1,sourceName:'Audi Pacific E4.0.pdf',sourceSha256:'c6b4c02f0b97d6eef947ff57f6863eddd16a6f769c13777af42e113905ded35c',pageWidthPoints:3024,pageHeightPoints:2160,items:[
 {text:'FIRST FLOOR - POWER PLAN',x:.72,y:.8,width:.22,height:.04},
 {text:'E4.0',x:.9,y:.9,width:.06,height:.03},
 {text:'19 Dec. 2023',x:.81,y:.87,width:.1,height:.02},
 {text:'Audi Pacific',x:.64,y:.76,width:.12,height:.03},
]});
ok('Audi Pacific title resolves electrical sheet number',audiPacific.sheetNumber.value==='E4.0');
ok('Audi Pacific day-first issue date is recognized',audiPacific.issueDate.value==='19 Dec. 2023');
ok('Audi Pacific power-plan title resolves discipline',audiPacific.discipline.value==='Electrical');
ok('Audi Pacific first-floor title resolves L1 candidate',audiPacific.floor.value==='L1');
ok('real drawing identity remains review-only and non-authoritative',audiPacific.reviewRequired===true&&audiPacific.alignmentEligible===false&&audiPacific.geometryScaleAuthority===false);

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
ok('standalone project-north label is preserved without inventing an angle',standalone.northOrientation.reference==='PROJECT_NORTH'&&standalone.northOrientation.angleDegreesFromPageUp===null);
ok('standalone inference remains review-only',standalone.reviewState==='CANDIDATE'&&standalone.alignmentEligible===false&&standalone.geometryScaleAuthority===false);

ok('NTS deliberately has no numeric scale denominator',drawingScaleDenominator('NTS')===null);
ok('mixed architectural scale denominator is normalized',close(drawingScaleDenominator('1 1/2" = 1\'-0"'),8));

ok('word-form architectural scale normalizes to denominator 120',drawingScaleDenominator('1 inch = 10 feet')===120&&drawingScaleDenominator('1 in = 10 ft')===120);

const civilFraction=extractSheetIdentity({page:1,sourceName:'civil.pdf',sourceSha256:'e'.repeat(64),items:[
 {text:'GRADING PLAN',x:.7,y:.86,width:.18,height:.04},
 {text:'1/1',x:.88,y:.94,width:.05,height:.03},
 {text:'SEE ARCHITECTURAL PLANS',x:.2,y:.45,width:.2,height:.02}
]});
ok('prefix-less civil sheet fraction resolves only in plausible title-block position',civilFraction.sheetNumber.value==='1/1'&&civilFraction.sheetNumber.method==='SHEET_FRACTION_STANDALONE');
ok('civil title evidence beats cross-discipline keyed-note reference',civilFraction.discipline.value==='Civil');

const prefixVsReference=extractSheetIdentity({page:1,sourceName:'civil-prefix.pdf',sourceSha256:'f'.repeat(64),items:[
 {text:'C-1',x:.88,y:.94,width:.05,height:.03},
 {text:'SITE PLAN',x:.72,y:.84,width:.16,height:.04},
 {text:'SEE ARCHITECTURAL PLANS',x:.2,y:.45,width:.2,height:.02}
]});
ok('sheet prefix participates in weighted discipline evidence rather than fallback-only logic',prefixVsReference.discipline.value==='Civil');

const detailFraction=extractSheetIdentity({page:1,sourceName:'notes.pdf',sourceSha256:'9'.repeat(64),items:[
 {text:'GENERAL NOTES',x:.2,y:.2,width:.2,height:.03},
 {text:'1/1',x:.25,y:.3,width:.04,height:.02}
]});
ok('body detail fraction is not promoted to sheet identity',detailFraction.sheetNumber.value===null);

const compass=extractSheetGeometryEvidence({pageWidthPoints:2592,pageHeightPoints:1728,items:[
 {text:'N',x:.12,y:.08,width:.01,height:.01},
 {text:'S',x:.12,y:.20,width:.01,height:.01},
 {text:'E',x:.18,y:.14,width:.01,height:.01},
 {text:'W',x:.06,y:.14,width:.01,height:.01},
 {text:'SCALE: 1" = 20\'-0"',x:.08,y:.26,width:.12,height:.02}
]});
ok('compact cardinal compass yields a page-up north angle candidate',compass.northOrientation.reference==='CARDINAL_COMPASS'&&close(compass.northOrientation.angleDegreesFromPageUp,0,1e-6));
ok('G101-style 1 inch equals 20 feet scale yields denominator 240',compass.scaleCalibration.denominator===240);
ok('known PDF page points convert declared scale to normalized sheet meters',close(compass.scaleCalibration.metersPerNormalizedSheetUnit,240*2592*.0254/(72*20)));
const rasterOnly=extractSheetGeometryEvidence({items:[{text:'SCALE: 1" = 20\'-0"',x:.1,y:.1}]});
ok('raster-only scale retains denominator but refuses metric calibration without physical page geometry',rasterOnly.scaleCalibration.denominator===240&&rasterOnly.scaleCalibration.metersPerNormalizedSheetUnit===null&&rasterOnly.scaleCalibration.autoApply===false);
ok('direct scale helper fails closed without physical page geometry',declaredScaleMetersPerNormalizedSheetUnit('1" = 20\'-0"',null)===null);

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
ok('title-block review surfaces metric scale and north-orientation candidates',component.includes('North / orientation evidence')&&component.includes('m / normalized sheet unit'));
ok('PDF page dimensions are persisted only as normalization context',component.includes('pageWidthPoints:viewport.width')&&component.includes('pageHeightPoints:viewport.height'));
ok('human confirmation keeps automatic alignment disabled',component.includes("alignmentEligible:false as const")&&component.includes('Automatic alignment and geometry scale remain disabled'));
ok('human confirmation keeps parsed scale non-authoritative',component.includes("geometryScaleAuthority:false as const")&&component.includes('SCALE IS NOT GEOMETRY AUTHORITY'));
ok('sheet identity may confirm with explicit gaps when number or title exists',component.includes('identityGaps')&&component.includes("item.sheetNumber.value||item.sheetTitle.value"));
ok('human correction is available before publish and reopens review',component.includes('Correct extracted identity')&&component.includes('HUMAN_CORRECTED')&&component.includes("reviewState:'CANDIDATE'"));
ok('component states confirmation does not establish trust',component.includes('confirmation never establishes geometry scale, alignment, Verified state, DIR finality or physical truth.'));
ok('title-block component cannot call asset/lifecycle/chain mutation APIs',!/["'`]\/api\/(?:assets|lifecycle|chain|approvals)/.test(component));
ok('server compilation schema preserves reviewed extension fields',persistence.includes('}).passthrough();'));

console.log('\nTitle-block intelligence and review safety contract passed.');
