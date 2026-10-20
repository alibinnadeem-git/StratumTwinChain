import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 detectElectricalLegendPage,extractElectricalLegendEntries,
 detectElectricalSpecificationPage,extractElectricalSpecificationRequirements,
 detectPdfEquipmentMatrixPage,extractPdfEquipmentMatrixRecords,
 buildElectricalDesignIntelligence,enrichElectricalDesignIntelligence
} from '../lib/electrical-design-intelligence.ts';

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
const intelligence=buildElectricalDesignIntelligence(entities);
assert.equal(intelligence.takeoff.totalPhysicalEquipment,1);
assert.equal(intelligence.takeoff.rows.length,1);
assert.equal(intelligence.takeoff.rows[0].floor,'L1');
assert.equal(intelligence.takeoff.rows[0].count,1);
assert.equal(intelligence.takeoff.rows[0].scheduleRefs,1);
assert.equal(intelligence.takeoff.rows[0].sldRefs,1);
assert.ok(intelligence.legend.entries.length>=2);
assert.ok(intelligence.specifications.requirements.length>=1);

const enriched=enrichElectricalDesignIntelligence({entities});
const plan=enriched.entities.find(entity=>entity.id==='plan-ats');
assert.equal(plan?.meta?.electricalTakeoffIncluded,true);
assert.ok(['EVIDENCE_RECONCILED_REVIEW','EVIDENCE_PARTIAL_REVIEW'].includes(String(plan?.meta?.electricalEvidenceGate)));
assert.equal(plan?.meta?.physicalTruth,false);
assert.equal(plan?.meta?.reviewRequired,true);

const conflicting=buildElectricalDesignIntelligence([
 ...legendEntities,
 {id:'plan-ats-c',source:'E-201.pdf',layer:'L2',kind:'text-asset-candidate',name:'ATS-1 AUTOMATIC TRANSFER SWITCH',x:4,y:3,floor:'L1',confidence:.9,meta:{page:2,nonSldPlan:true,planType:'ELECTRICAL_POWER_PLAN',electricalComponentHint:'ATS'}},
 {id:'schedule-ats-c',source:'Equipment Matrix.xlsx',layer:'L4',kind:'schedule-powered-equipment-candidate',name:'ATS-1 AUTOMATIC TRANSFER SWITCH',x:0,y:0,confidence:.95,meta:{nonSpatial:true,sourceType:'EQUIPMENT_SCHEDULE',assetTag:'ATS-1',manufacturer:'EATON',voltage:208,phase:3}},
 ...specEntities
]);
assert.ok(conflicting.findings.some(finding=>finding.type==='PRODUCT_IDENTITY_CONFLICT'&&finding.blocking));
assert.ok(conflicting.findings.some(finding=>finding.type==='RATING_CONFLICT'&&finding.blocking));

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
assert.match(worker,/electrical-legend-entry/);
assert.match(worker,/electrical-spec-requirement/);
assert.match(compiler,/enrichElectricalDesignIntelligence/);
assert.match(panel,/Electrical evidence compiler/);

console.log('Electrical evidence compiler passed: project legend extraction, floor takeoff, equipment-matrix reconciliation, SLD cross-check, specification comparison, evidence gating, and fail-open review semantics are all active without inventing physical truth.');
