import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 detectElectricalLegendPage,extractElectricalLegendEntries,
 detectElectricalSpecificationPage,extractElectricalSpecificationRequirements,
 detectPdfEquipmentMatrixPage,extractPdfEquipmentMatrixRecords,classifyElectricalLegendDescription,
 buildElectricalDesignIntelligence,enrichElectricalDesignIntelligence
} from '../lib/electrical-design-intelligence.ts';
import {buildLegendSymbolFingerprints,matchLegendSymbolFingerprints} from '../lib/electrical-symbol-fingerprint.ts';

const legendLabels=['ELECTRICAL SYMBOLS & ABBREVIATIONS','SYMBOL','ABBREVIATION','DESCRIPTION','ATS','AUTOMATIC TRANSFER SWITCH','XFMR','TRANSFORMER'];
const legendDetection=detectElectricalLegendPage(legendLabels);
assert.equal(legendDetection.isLegend,true);
const legendEntries=extractElectricalLegendEntries([
 {text:'ATS',x:1,y:8,page:1},{text:'AUTOMATIC TRANSFER SWITCH',x:3,y:8.02,page:1},
 {text:'XFMR',x:1,y:7.5,page:1},{text:'TRANSFORMER',x:3,y:7.51,page:1},
],1);
assert.equal(legendEntries.length,2);
assert.ok(legendEntries.some(entry=>entry.abbreviation==='ATS'&&entry.componentHint));
assert.ok(legendEntries.some(entry=>entry.abbreviation==='XFMR'&&entry.componentHint));

const denseLegend=extractElectricalLegendEntries([
 {text:'GENERAL NOTES',x:-8.4,y:6.4,page:1},
 {text:'GENERAL SYMBOLS',x:-3.4,y:6.4,page:1},
 {text:'ELECTRICAL ABBREVIATIONS',x:-.65,y:6.4,page:1},
 {text:'ELECTRICAL SHEET INDEX',x:5.4,y:6.4,page:1},
 {text:'E-1',x:4.6,y:6.1,page:1},{text:'NOTES & SYMBOLS',x:5.4,y:6.1,page:1},
 {text:'SD',x:-4.2,y:3.4,page:1},{text:'SMOKE DETECTOR',x:-3.2,y:3.4,page:1},
 {text:'CO',x:-4.2,y:3.1,page:1},{text:'CARBON MONOXIDE DETECTOR',x:-3.1,y:3.1,page:1},
],1);
assert.equal(denseLegend.some(entry=>entry.abbreviation==='E-1'),false,'sheet-index rows must not leak into project legend extraction');
assert.equal(denseLegend.some(entry=>entry.abbreviation==='SD'),true);
assert.equal(denseLegend.some(entry=>entry.abbreviation==='CO'),true);
assert.equal(classifyElectricalLegendDescription('DUPLEX RECEPTACLE (+18\")'),'RECEPTACLE_DUPLEX');
assert.equal(classifyElectricalLegendDescription('HARD-WIRED SMOKE DETECTOR W/ BATTERY BACK UP'),'SMOKE_DETECTOR');
assert.equal(classifyElectricalLegendDescription('JUNCTION BOX.'),'JUNCTION_BOX');

const specLabels=['SECTION 26 36 23','AUTOMATIC TRANSFER SWITCHES','PART 2 - PRODUCTS','MANUFACTURER: ASCO','ATS-1 480V 3PH 800A'];
const specDetection=detectElectricalSpecificationPage(specLabels);
assert.equal(specDetection.isSpecification,true);
const specRequirements=extractElectricalSpecificationRequirements(specLabels,9);
assert.ok(specRequirements.length>0);
assert.ok(specRequirements.some(item=>item.ratings.voltage===480));

const matrixItems=[
 {text:'EQUIPMENT SCHEDULE',x:1,y:9,page:4},
 {text:'TAG',x:1,y:8,page:4},{text:'DESCRIPTION',x:3,y:8,page:4},{text:'MANUFACTURER',x:6,y:8,page:4},{text:'MODEL',x:9,y:8,page:4},{text:'VOLTAGE',x:11,y:8,page:4},{text:'PHASE',x:13,y:8,page:4},
 {text:'ATS-1',x:1,y:7.4,page:4},{text:'AUTOMATIC TRANSFER SWITCH',x:3,y:7.4,page:4},{text:'ASCO',x:6,y:7.4,page:4},{text:'300 SERIES',x:9,y:7.4,page:4},{text:'480V',x:11,y:7.4,page:4},{text:'3',x:13,y:7.4,page:4},
];
assert.equal(detectPdfEquipmentMatrixPage(matrixItems.map(item=>item.text)).isMatrix,true);
const matrixRecords=extractPdfEquipmentMatrixRecords(matrixItems,4);
assert.equal(matrixRecords.length,1);
assert.equal(matrixRecords[0].tag,'ATS-1');
assert.equal(matrixRecords[0].manufacturer,'ASCO');
assert.equal(matrixRecords[0].ratings.voltage,480);
assert.equal(matrixRecords[0].ratings.phase,3);

const fixtureSchedule=[
 {text:'COMMON AREA (HOUSE) LIGHT FIXTURE SCHEDULE',x:1,y:9,page:1},
 {text:'FIXTURE',x:1,y:8,page:1},{text:'DESCRIPTION',x:3,y:8,page:1},{text:'MANUFACTURER',x:6,y:8,page:1},{text:'CATALOG NUMBER',x:9,y:8,page:1},{text:'WATTS',x:11,y:8,page:1},{text:'VOLTS',x:13,y:8,page:1},
 {text:'A',x:1,y:7.4,page:1},{text:'LED WALL FIXTURE',x:3,y:7.4,page:1},{text:'ACME',x:6,y:7.4,page:1},{text:'LF-100',x:9,y:7.4,page:1},{text:'18',x:11,y:7.4,page:1},{text:'120',x:13,y:7.4,page:1},
];
const fixtureRecords=extractPdfEquipmentMatrixRecords(fixtureSchedule,1);
assert.equal(fixtureRecords[0]?.scheduleKind,'LIGHT_FIXTURE');
assert.equal(fixtureRecords[0]?.componentHint,'LIGHT_FIXTURE');
assert.equal(fixtureRecords[0]?.tag,'A');

const denseSchedule=[
 {text:'COMMON AREA (HOUSE) LIGHT FIXTURE SCHEDULE',x:.95,y:6.39,page:1},
 {text:'FIXTURE',x:.68,y:6.22,page:1},{text:'DESCRIPTION',x:1.14,y:6.22,page:1},
 {text:'MANUFACTURER',x:2.46,y:6.25,page:1},{text:'CATALOG NUMBER',x:2.46,y:6.18,page:1},
 {text:'WATTS',x:3.1,y:6.19,page:1},{text:'VOLTS',x:3.48,y:6.22,page:1},
 ...['A','B','C','D','E','F'].flatMap((text,i)=>[
  {text,x:.74,y:6.09-i*.14,page:1},
  {text:'E-'+(i+1),x:4.55,y:6.09-i*.14,page:1},
  {text:'UNRELATED SHEET INDEX',x:4.93,y:6.09-i*.14,page:1},
 ]),
 {text:'11',x:.65,y:2.16,page:1},{text:'ARTICLE 9, GENERAL BUILDING CODE:',x:.95,y:2.18,page:1},
 {text:'EM',x:.74,y:1,page:1},
 {text:'12',x:.65,y:-.3,page:1},{text:'RESIDENTIAL ENERGY NOTES',x:.95,y:-.29,page:1},
 {text:'SD',x:.74,y:-5.55,page:1},{text:'SD',x:2.46,y:-5.55,page:1},
];
const denseRecords=extractPdfEquipmentMatrixRecords(denseSchedule,1);
assert.deepEqual(denseRecords.map(item=>item.tag),['A','B','C','D','E','F'],'dense fixture rows stay separate, bounded to the table and above the next section');
assert.ok(denseRecords.every(item=>Object.keys(item.ratings).length===0),'sheet numbers must not become negative fixture voltages');
assert.ok(denseRecords.every(item=>!item.sourceEvidence.join(' ').includes('INDEX')),'evidence must exclude adjacent sheet-index cells');

const legendEntities=legendEntries.map((entry,index)=>({
 id:'legend-'+index,source:'E-001.pdf',layer:'L0',kind:'electrical-legend-entry',name:entry.description,x:entry.anchor.x,y:entry.anchor.y,confidence:entry.confidence,
 meta:{nonSpatial:true,sourceType:'ELECTRICAL_LEGEND',legendEntry:entry}
}));
const specEntities=specRequirements.map((requirement,index)=>({
 id:'spec-'+index,source:'Project Specifications.pdf',layer:'L0',kind:'electrical-spec-requirement',name:requirement.title,x:0,y:0,confidence:requirement.confidence,
 meta:{nonSpatial:true,sourceType:'ELECTRICAL_SPECIFICATION',specRequirement:requirement}
}));
const entities=[
 ...legendEntities,...specEntities,
 {id:'plan-ats',source:'E-201.pdf',layer:'L2',kind:'text-asset-candidate',name:'ATS-1 AUTOMATIC TRANSFER SWITCH',x:4,y:3,floor:'L1',confidence:.9,meta:{page:2,nonSldPlan:true,planType:'ELECTRICAL_POWER_PLAN',electricalComponentHint:'ATS'}},
 {id:'sld-ats',source:'E-601.pdf',layer:'L2',kind:'text-asset-candidate',name:'ATS-1 AUTOMATIC TRANSFER SWITCH',x:2,y:2,floor:'L1',confidence:.9,meta:{page:6,sldCandidate:true,electricalComponentHint:'ATS'}},
 {id:'schedule-ats',source:'Equipment Matrix.xlsx',layer:'L4',kind:'schedule-powered-equipment-candidate',name:'ATS-1 AUTOMATIC TRANSFER SWITCH 480V 3PH',x:0,y:0,confidence:.95,meta:{nonSpatial:true,sourceType:'EQUIPMENT_SCHEDULE',assetTag:'ATS-1',manufacturer:'ASCO',model:'300 SERIES'}},
];
assert.equal((await import('../lib/sld-recognition.ts')).classifyElectricalLabel('MS1'),'SWITCHBOARD');
assert.equal((await import('../lib/sld-recognition.ts')).classifyElectricalLabel('MS2'),'SWITCHBOARD');

const brynhurstService=buildElectricalDesignIntelligence([
 {id:'plan-ms1',source:'E-3.pdf',layer:'L2',kind:'text-asset-candidate',name:'MS1',x:4,y:4,floor:'L1',confidence:.9,meta:{page:3,nonSldPlan:true,planType:'ELECTRICAL_SITE_PLAN',electricalComponentHint:'SWITCHBOARD'}},
 {id:'sld-ms1',source:'E-2.pdf',layer:'L2',kind:'text-asset-candidate',name:'MS1',x:1,y:1,confidence:.9,meta:{page:2,sldCandidate:true,electricalComponentHint:'SWITCHBOARD'}},
]);
assert.equal(brynhurstService.findings.some(finding=>finding.type==='PLAN_NOT_IN_SLD'||finding.type==='SLD_NOT_LOCATED'),false,'MS1 must reconcile across Brynhurst plan/SLD evidence');

const intelligence=buildElectricalDesignIntelligence(entities);
assert.equal(intelligence.takeoff.totalPhysicalEquipment,1);
assert.equal(intelligence.takeoff.rows.length,1);
assert.equal(intelligence.takeoff.rows[0].floor,'L1');
assert.equal(intelligence.takeoff.rows[0].count,1);
assert.equal(intelligence.takeoff.rows[0].scheduleRefs,1);
assert.equal(intelligence.takeoff.rows[0].sldRefs,1);
assert.ok(intelligence.legend.entries.length>=2);
assert.ok(intelligence.specifications.requirements.length>=1);

const fixtureIntel=buildElectricalDesignIntelligence([
 {id:'fixture-a-plan',source:'E-401.pdf',layer:'L2',kind:'legend-symbol-match-candidate',name:'LIGHT FIXTURE A',x:2,y:2,floor:'L1',confidence:.86,meta:{page:4,nonSldPlan:true,planType:'ELECTRICAL_LIGHTING_PLAN',electricalComponentHint:'LIGHT_FIXTURE',fixtureMark:'A',legendBacked:true}},
 {id:'fixture-a-schedule',source:'E-001.pdf',layer:'L4',kind:'schedule-powered-equipment-candidate',name:'A LED WALL FIXTURE',x:0,y:0,confidence:.9,meta:{nonSpatial:true,sourceType:'EQUIPMENT_SCHEDULE',scheduleKind:'LIGHT_FIXTURE',fixtureMark:'A',electricalComponentHint:'LIGHT_FIXTURE',manufacturer:'ACME',model:'LF-100'}},
]);
assert.equal(fixtureIntel.takeoff.rows[0]?.scheduleRefs,1,'fixture mark A must reconcile to schedule row A');
assert.equal(fixtureIntel.findings.some(finding=>finding.type==='SCHEDULE_NOT_LOCATED'),false);

const enriched=enrichElectricalDesignIntelligence({entities});
const plan=enriched.entities.find(entity=>entity.id==='plan-ats');
assert.equal(plan?.meta?.electricalTakeoffIncluded,true);
assert.ok(['EVIDENCE_RECONCILED_REVIEW','EVIDENCE_PARTIAL_REVIEW'].includes(String(plan?.meta?.electricalEvidenceGate)));
assert.equal(plan?.meta?.physicalTruth,false);
assert.equal(plan?.meta?.reviewRequired,true);

const specOnlyEntity={
 id:'plan-ups-spec-only',source:'E-202.pdf',layer:'L2',kind:'text-asset-candidate',name:'UPS-1 UPS',x:5,y:5,floor:'L1',confidence:.88,
 meta:{page:3,nonSldPlan:true,planType:'ELECTRICAL_POWER_PLAN',electricalComponentHint:'UPS'}
};
const specOnlyRequirement={
 id:'spec-ups',source:'Division 26.pdf',layer:'L0',kind:'electrical-spec-requirement',name:'UPS PRODUCTS',x:0,y:0,confidence:.9,
 meta:{nonSpatial:true,sourceType:'ELECTRICAL_SPECIFICATION',specRequirement:{id:'req-ups',page:12,section:'26 33 53',title:'UPS PRODUCTS',componentHint:'UPS',manufacturer:'APC',model:'GALAXY VS',ratings:{},sourceEvidence:['Manufacturer: APC · Model: GALAXY VS'],confidence:.9,physicalTruth:false,reviewRequired:true}}
};
const specOnly=enrichElectricalDesignIntelligence({entities:[specOnlyEntity,specOnlyRequirement]});
const enrichedSpecOnly=specOnly.entities.find(entity=>entity.id==='plan-ups-spec-only');
assert.equal(enrichedSpecOnly?.meta?.manufacturer,'APC');
assert.equal(enrichedSpecOnly?.meta?.model,'GALAXY VS');
assert.equal(enrichedSpecOnly?.meta?.productIdentityAuthority,'DESIGN_SPECIFICATION');
assert.equal(enrichedSpecOnly?.meta?.productIdentityPhysicalAssetVerified,false);
assert.equal(enrichedSpecOnly?.meta?.electricalEvidenceGate,'EVIDENCE_PARTIAL_REVIEW','missing matrix/SLD must keep major equipment review-gated even when specs identify a product');

const conflicting=buildElectricalDesignIntelligence([
 ...legendEntities,
 {id:'plan-ats-c',source:'E-201.pdf',layer:'L2',kind:'text-asset-candidate',name:'ATS-1 AUTOMATIC TRANSFER SWITCH',x:4,y:3,floor:'L1',confidence:.9,meta:{page:2,nonSldPlan:true,planType:'ELECTRICAL_POWER_PLAN',electricalComponentHint:'ATS'}},
 {id:'schedule-ats-c',source:'Equipment Matrix.xlsx',layer:'L4',kind:'schedule-powered-equipment-candidate',name:'ATS-1 AUTOMATIC TRANSFER SWITCH',x:0,y:0,confidence:.95,meta:{nonSpatial:true,sourceType:'EQUIPMENT_SCHEDULE',assetTag:'ATS-1',manufacturer:'EATON',voltage:208,phase:3}},
 ...specEntities
]);
assert.ok(conflicting.findings.some(finding=>finding.type==='PRODUCT_IDENTITY_CONFLICT'&&finding.blocking));
assert.ok(conflicting.findings.some(finding=>finding.type==='RATING_CONFLICT'&&finding.blocking));

// PR #234 review: equipment in different PDFs that shares a page number and local coordinates is
// different equipment; only near-coincident candidates on the same sheet collapse to one.
const panelOn=(id,source,sha)=>({id,source,layer:'L2',kind:'text-asset-candidate',name:'PANEL',x:.42,y:.31,floor:id.includes('l2')?'L2':'L1',confidence:.9,meta:{page:2,sourceSha256:sha,nonSldPlan:true,planType:'ELECTRICAL_POWER_PLAN',electricalComponentHint:'PANEL'}});
const crossPdf=buildElectricalDesignIntelligence([panelOn('panel-l1','E-201 Level 1.pdf','a'.repeat(64)),panelOn('panel-l2','E-202 Level 2.pdf','b'.repeat(64))]);
assert.equal(crossPdf.takeoff.totalPhysicalEquipment,2,'panels in separate PDFs must not collapse on equal page/local coordinates');
const samePdf=buildElectricalDesignIntelligence([panelOn('panel-l1','E-201 Level 1.pdf','a'.repeat(64)),{...panelOn('panel-l1-dup','E-201 Level 1.pdf','a'.repeat(64)),x:.43}]);
assert.equal(samePdf.takeoff.totalPhysicalEquipment,1,'near-coincident candidates on one sheet remain one symbol');
const framed=(id,frame)=>({...panelOn(id,'E-201 Level 1.pdf','a'.repeat(64)),meta:{...panelOn(id,'E-201 Level 1.pdf','a'.repeat(64)).meta,planFrameId:frame}});
assert.equal(buildElectricalDesignIntelligence([framed('panel-f1','unit-a'),framed('panel-f2','unit-b')]).takeoff.totalPhysicalEquipment,2,'separate plan frames bound deduplication');

// PR #234 review: readiness is COMPLETE_REVIEW only when a source shows the indexed drawing set is
// complete; an UNRESOLVED or unreported set keeps it partial.
const completeEvidence=[
 {id:'legend-panel',source:'E-001.pdf',layer:'L0',kind:'electrical-legend-entry',name:'PANELBOARD',x:0,y:0,confidence:.9,meta:{nonSpatial:true,sourceType:'ELECTRICAL_LEGEND',legendEntry:{id:'l-panel',page:1,abbreviation:'',description:'PANELBOARD',componentHint:'PANEL',anchor:{x:0,y:0},confidence:.9,sourceEvidence:['PANELBOARD'],physicalTruth:false,reviewRequired:true}}},
 {id:'spec-panel',source:'Division 26.pdf',layer:'L0',kind:'electrical-spec-requirement',name:'PANELBOARDS',x:0,y:0,confidence:.9,meta:{nonSpatial:true,sourceType:'ELECTRICAL_SPECIFICATION',specRequirement:{id:'req-panel',page:4,section:'26 24 16',title:'PANELBOARDS',componentHint:'PANEL',manufacturer:'',model:'',ratings:{},sourceEvidence:['PANELBOARDS'],physicalTruth:false,reviewRequired:true}}},
 {id:'plan-lp1',source:'E-201.pdf',layer:'L2',kind:'text-asset-candidate',name:'PANEL LP1',x:4,y:3,floor:'L1',confidence:.9,meta:{page:2,nonSldPlan:true,planType:'ELECTRICAL_POWER_PLAN',electricalComponentHint:'PANEL',assetTag:'LP1'}},
 {id:'sld-lp1',source:'E-601.pdf',layer:'L2',kind:'text-asset-candidate',name:'PANEL LP1',x:2,y:2,floor:'L1',confidence:.9,meta:{page:6,sldCandidate:true,electricalComponentHint:'PANEL',assetTag:'LP1'}},
 {id:'sched-lp1',source:'Equipment Matrix.xlsx',layer:'L4',kind:'schedule-powered-equipment-candidate',name:'PANEL LP1',x:0,y:0,confidence:.95,meta:{nonSpatial:true,sourceType:'EQUIPMENT_SCHEDULE',assetTag:'LP1',electricalComponentHint:'PANEL'}},
];
const readinessFor=sources=>enrichElectricalDesignIntelligence({entities:completeEvidence,sources}).electricalIntelligence;
assert.equal(readinessFor([{name:'E.pdf',setCompleteness:{status:'COMPLETE'}}]).summary.readiness,'COMPLETE_REVIEW');
for(const sources of [[{name:'E.pdf',setCompleteness:{status:'UNRESOLVED'}}],[{name:'E.pdf'}],[{name:'E.pdf',setCompleteness:{status:'COMPLETE'}},{name:'F.pdf',setCompleteness:{status:'UNRESOLVED'}}]]){
 const unresolved=readinessFor(sources);
 assert.equal(unresolved.summary.readiness,'PARTIAL_EVIDENCE','unknown drawing-set completeness must never become COMPLETE_REVIEW');
 assert.equal(unresolved.summary.coverage.drawingSet,false);
 assert.ok(unresolved.findings.some(item=>item.type==='DRAWING_SET_UNRESOLVED'));
}

const withoutSpec=buildElectricalDesignIntelligence(entities.filter(entity=>entity.kind!=='electrical-spec-requirement'));
assert.ok(withoutSpec.findings.some(finding=>finding.type==='SPEC_SOURCE_MISSING'));
assert.equal(withoutSpec.findings.find(finding=>finding.type==='SPEC_SOURCE_MISSING')?.blocking,false);

const orphanSld=buildElectricalDesignIntelligence([
 ...legendEntities,
 {id:'sld-mdp',source:'E-601.pdf',layer:'L2',kind:'text-asset-candidate',name:'MDP-1 MAIN DISTRIBUTION PANEL',x:1,y:1,confidence:.9,meta:{sldCandidate:true,electricalComponentHint:'SWITCHBOARD'}}
]);
assert.ok(orphanSld.findings.some(finding=>finding.type==='SLD_NOT_LOCATED'));

const worker=fs.readFileSync('workers/pdf-native-parser.worker.ts','utf8');
const compiler=fs.readFileSync('components/CompilerWorkspace.tsx','utf8');
const panel=fs.readFileSync('components/ElectricalEvidencePanel.tsx','utf8');
// Graph compilation (including electrical enrichment) runs in the graph worker via lib/graph-enrichment.ts.
const enrichment=fs.readFileSync('lib/graph-enrichment.ts','utf8');
const geometryPolicy=fs.readFileSync('lib/spatial-viewer-geometry-policy.ts','utf8');
assert.match(worker,/electrical-legend-entry/);
assert.match(worker,/electrical-spec-requirement/);
assert.match(worker,/PDF_POSITIONAL_TABLE/);
assert.match(enrichment,/export function compileGraph[\s\S]*enrichElectricalDesignIntelligence/);
assert.match(compiler,/compileGraphOffThread/);
assert.match(compiler,/electricalIntelligence:compiled\.electricalIntelligence/);
assert.match(panel,/Electrical evidence compiler/);
assert.match(geometryPolicy,/BLOCKED · ELECTRICAL SOURCE CONFLICT/);
assert.match(geometryPolicy,/EVIDENCE CHAIN INCOMPLETE/);

console.log('Electrical evidence compiler passed: project legend extraction, floor takeoff, equipment-matrix reconciliation, SLD cross-check, specification comparison, evidence gating, and fail-open review semantics are all active without inventing physical truth.');
