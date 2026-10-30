import assert from 'node:assert/strict';
import {auditParsedGraph} from '../lib/spatial-parse-audit.ts';
import {identifyLibraryComponents} from '../lib/library-component-identity.ts';
import {gateEquipmentCandidates} from '../lib/candidate-gating.ts';

// Unit test for the Phase 1 parse/symbol/library audit. Synthetic entities only; no customer data.
function ok(label,condition){if(!condition)throw new Error('FAIL: '+label);console.log('✓ '+label)}

const sources=[
  {name:'plan.dxf',ext:'dxf',sha256:'aaa',unitName:'inch',unitToMeters:0.0254,pages:1},
  {name:'plan.pdf',ext:'pdf',sha256:'bbb',pages:9,sldPages:1,nonSldPlanPages:5},
];

// Explicit minimal registry so the test is deterministic regardless of library-default drift:
// dry-transformer + main-switchboard are dimensioned; panelboard intentionally is not.
const registry=[
  {componentKey:'dry-transformer',dimensionsMeters:[1.35,1.485,0.882],format:'GLB',modelUrl:'',scale:1,rotation:[0,0,0],offset:[0,0,0]},
  {componentKey:'main-switchboard',dimensionsMeters:[2.4,2.12,0.72],format:'GLB',modelUrl:'',scale:1,rotation:[0,0,0],offset:[0,0,0]},
];

const entities=[
  // Dry Transformer resolves to key dry-transformer (registry dims [1.35,1.485,.882]); footprint ~agrees under metric DXF scale.
  {id:'t1',source:'plan.dxf',layer:'L2',kind:'equipment',name:'Dry Transformer T1',x:1,y:1,meta:{sourceSha256:'aaa',symbolAnchorStatus:'RESOLVED_REVIEW_CANDIDATE',symbolAnchorWidth:1.3,symbolAnchorHeight:0.9}},
  // Same class, footprint way off -> disagree.
  {id:'t2',source:'plan.dxf',layer:'L2',kind:'equipment',name:'Dry Transformer T2',x:2,y:2,meta:{sourceSha256:'aaa',symbolAnchorStatus:'AMBIGUOUS',symbolAnchorWidth:5,symbolAnchorHeight:5}},
  // Same class but PDF source has no metric scale -> footprint scaleUnavailable; symbol resolved.
  {id:'t3',source:'plan.pdf',layer:'L2',kind:'equipment',name:'Dry Transformer T3',x:3,y:3,meta:{sourceSha256:'bbb',symbolAnchorStatus:'RESOLVED_REVIEW_CANDIDATE',symbolAnchorWidth:1.3,symbolAnchorHeight:0.9}},
  // Panelboard resolves to class but has no registry dimensions -> nominalOnly; symbol unresolved.
  {id:'p1',source:'plan.pdf',layer:'L2',kind:'equipment',name:'Panelboard LP1',x:4,y:4,meta:{sourceSha256:'bbb',symbolAnchorStatus:'UNRESOLVED'}},
  // Source-spec dimensions authority counts as libraryDimensioned+sourceSpecDims.
  {id:'s1',source:'plan.dxf',layer:'L2',kind:'equipment',name:'Panelboard LP2',x:5,y:5,meta:{sourceSha256:'aaa',assetDimensionAuthority:'SOURCE_SPEC'}},
  // Unknown name -> classUnresolved AND not coarsely recognized -> unrecognized.
  {id:'u1',source:'plan.pdf',layer:'L2',kind:'equipment',name:'Zubzub Mystery Unit',x:6,y:6,meta:{sourceSha256:'bbb',symbolAnchorStatus:'TEXT_ABBREVIATION_REVIEW_CANDIDATE'}},
  // 'PNL-3' is coarsely recognized (PANEL) but has no library alias -> classUnresolved + bridgeable.
  {id:'b1',source:'plan.pdf',layer:'L2',kind:'equipment',name:'PNL-3',x:7,y:7,meta:{sourceSha256:'bbb'}},
  // Main Switchboard resolves (registry dims) but non-finite X -> nonFiniteXY; no symbol footprint.
  {id:'nf',source:'plan.pdf',layer:'L2',kind:'equipment',name:'Main Switchboard',x:NaN,y:5,meta:{sourceSha256:'bbb'}},
  // Drawing line is not an equipment candidate; carries a manual XY calibration id for the scale audit.
  {id:'l1',source:'plan.dxf',layer:'L1',kind:'line',name:'Drawing line',x:0,y:0,meta:{sheetXYCalibrationId:'xy:plan.dxf:1'}},
  // Non-spatial equipment-schedule candidate carrying an authoritative tag (for the schedule probe).
  {id:'sch1',source:'plan.pdf',layer:'L4',kind:'schedule-powered-equipment-candidate',name:'Panel LP-1',x:0,y:0,meta:{nonSpatial:true,scheduleKind:'EQUIPMENT',assetTag:'LP-1'}},
  // Per-sheet scale evidence (non-spatial L0): witness-corroborated -> sizing candidate.
  {id:'scale1',source:'plan.pdf',layer:'L0',kind:'scale-validation-candidate',name:'Scale validation p1',x:0,y:0,meta:{nonSpatial:true,page:1,scaleValidationEvidence:{status:'CORROBORATED',declaredMetersPerNormalizedSheetUnit:2.95,corroboratedMetersPerNormalizedSheetUnit:2.9,confidence:.82,independentWitnessCount:5}}},
  // Per-sheet scale evidence: declared-only -> evidence but NO sizing candidate.
  {id:'scale2',source:'plan.pdf',layer:'L0',kind:'scale-validation-candidate',name:'Scale validation p2',x:0,y:0,meta:{nonSpatial:true,page:2,scaleValidationEvidence:{status:'UNRESOLVED',declaredMetersPerNormalizedSheetUnit:5.12,corroboratedMetersPerNormalizedSheetUnit:null,confidence:.4,independentWitnessCount:0}}},
];

// Run the real identification + gating passes so the audit reflects the pipeline's stamped metadata.
const enriched=gateEquipmentCandidates(identifyLibraryComponents(entities));
const audit=auditParsedGraph(enriched,sources,registry);

ok('two sources audited',audit.sources.length===2);
ok('exactly one metric-scale source (DXF, not PDF)',audit.sources.filter(s=>s.metricScaleKnown).length===1);
ok('DXF metric scale known',audit.sources.find(s=>s.name==='plan.dxf').metricScaleKnown===true);
ok('PDF metric scale unknown',audit.sources.find(s=>s.name==='plan.pdf').metricScaleKnown===false);

ok('coordinate total counts all non-nonSpatial entities',audit.coordinates.total===9);
ok('one non-finite XY entity',audit.coordinates.nonFiniteXY===1);
ok('eight finite XY entities',audit.coordinates.finiteXY===8);

ok('eight equipment candidates',audit.classLinkage.equipment===8);
ok('six resolve to a library class',audit.classLinkage.classResolved===6);
ok('two classes unresolved',audit.classLinkage.classUnresolved===2);
ok('library-dimensioned + nominal-only = class resolved',audit.classLinkage.libraryDimensioned+audit.classLinkage.nominalOnly===audit.classLinkage.classResolved);
ok('five library-dimensioned (4 registry + 1 source-spec)',audit.classLinkage.libraryDimensioned===5);
ok('one nominal-only (panelboard)',audit.classLinkage.nominalOnly===1);
ok('one source-spec dimensioned',audit.classLinkage.sourceSpecDims===1);
ok('seven coarsely recognized (all but the mystery unit)',audit.classLinkage.coarseClassified===7);
ok('one bridgeable (PNL-3: coarse PANEL, no library alias)',audit.classLinkage.bridgeable===1);
ok('one unrecognized (mystery unit)',audit.classLinkage.unrecognized===1);
ok('bridgeable + unrecognized = class unresolved',audit.classLinkage.bridgeable+audit.classLinkage.unrecognized===audit.classLinkage.classUnresolved);

// Stamped identification outcome after identifyLibraryComponents (the Phase 2 result).
ok('seven equipment identified (6 alias + 1 bridge)',audit.classLinkage.identified===7);
ok('six identified by exact alias',audit.classLinkage.identifiedByAlias===6);
ok('one identified by coarse-class bridge (PNL-3)',audit.classLinkage.identifiedByBridge===1);
ok('one unidentified (mystery unit)',audit.classLinkage.unidentified===1);
ok('identified + unidentified = equipment',audit.classLinkage.identified+audit.classLinkage.unidentified===audit.classLinkage.equipment);
ok('bridge lifts identification above raw alias',audit.classLinkage.identified>audit.classLinkage.classResolved);

ok('unidentified sample captures the mystery unit',audit.samples.unidentified.includes('Zubzub Mystery Unit'));
ok('bridged example captures PNL-3 -> panelboard',audit.samples.bridgedExamples.some(x=>x.name==='PNL-3'&&x.key==='panelboard'));
ok('bridgedByKey histogram counts panelboard',audit.samples.bridgedByKey.panelboard===1);

ok('candidate total equals equipment',audit.candidates.total===audit.classLinkage.equipment);
ok('no derived duplicates in this synthetic set',audit.candidates.derivedDuplicates===0);
ok('eight distinct candidate names',audit.candidates.distinctNames===8);
ok('byKind sums to total',Object.values(audit.candidates.byKind).reduce((a,b)=>a+b,0)===audit.candidates.total);

// Candidate gating: tagged items are INSTANCEs; bare class words (Zubzub, Main Switchboard) are LABELs.
ok('six instances (tagged/designator)',audit.candidates.instances===6);
ok('two labels (bare, no tag/anchor)',audit.candidates.labels===2);
ok('no registration shadows in this set',audit.candidates.shadows===0);
ok('instances + labels + shadows = total',audit.candidates.instances+audit.candidates.labels+audit.candidates.shadows===audit.candidates.total);
ok('six identified instances',audit.classLinkage.identifiedInstances===6);

ok('two sheets have scale evidence',audit.scale.sheetsWithEvidence===2);
ok('only the corroborated sheet yields a sizing candidate',audit.scale.sheetsWithCandidate===1);
const corroboratedSheet=audit.scale.sheets.find(s=>s.candidate);
ok('sizing candidate is witness-corroborated',corroboratedSheet.candidate.authority==='INDEPENDENT_WITNESS_CORROBORATED');
ok('declared-only sheet records evidence but no candidate',audit.scale.sheets.some(s=>s.declared&&!s.candidate));
ok('manual XY calibration is observed (one entity, one calibration)',audit.scale.manualXYCalibratedEntities===1&&audit.scale.manualXYCalibrations===1);
ok('schedule probe surfaces equipment-schedule tags',audit.scheduleProbe.scheduleCandidates===1&&audit.scheduleProbe.tags.includes('LP-1'));

ok('five symbol-anchor statuses present',audit.symbolAnchors.eligible===5);
ok('two symbols resolved',audit.symbolAnchors.resolved===2);
ok('one symbol ambiguous',audit.symbolAnchors.ambiguous===1);
ok('one symbol unresolved',audit.symbolAnchors.unresolved===1);
ok('one text-abbreviation anchor',audit.symbolAnchors.textAbbreviation===1);
ok('symbol-anchor buckets sum to eligible',audit.symbolAnchors.resolved+audit.symbolAnchors.ambiguous+audit.symbolAnchors.unresolved+audit.symbolAnchors.textAbbreviation===audit.symbolAnchors.eligible);

ok('three footprint checks',audit.footprint.checked===3);
ok('one footprint agrees',audit.footprint.agree===1);
ok('one footprint disagrees',audit.footprint.disagree===1);
ok('one footprint has no metric scale',audit.footprint.scaleUnavailable===1);

// Phase 20a: OCR coverage from embedded drawing images is reported, and OCR text never counts as equipment.
const ocrAudit=auditParsedGraph([
  {id:'r1',name:'OCR region · page 2 · 2 lines',layer:'L0',kind:'ocr-region',meta:{nonSpatial:true,ocrReader:'tesseract',ocrReaderVersion:'v',ocrFailedTiles:1,ocrCachedTiles:2}},
  {id:'l1',name:'PANEL HP1',layer:'L0',kind:'ocr-text-line',meta:{nonSpatial:true,ocrConfidence:90}},
  {id:'l2',name:'100 AMPERE PANEL',layer:'L0',kind:'ocr-text-line',meta:{nonSpatial:true,ocrConfidence:70}},
],sources,registry);
ok('OCR regions, lines and mean confidence are audited',ocrAudit.ocr.regions===1&&ocrAudit.ocr.lines===2&&ocrAudit.ocr.meanConfidence===80);
ok('OCR failed and cached tiles are audited',ocrAudit.ocr.failedTiles===1&&ocrAudit.ocr.cachedTiles===2&&ocrAudit.ocr.readers[0]==='tesseract@v');
ok('OCR text is not an equipment candidate',ocrAudit.candidates.total===0);
ok('graphs without OCR report zero coverage',audit.ocr.regions===0&&audit.ocr.lines===0&&audit.ocr.meanConfidence===null);

console.log('\nSpatial parse/symbol/library audit contract passed.');
