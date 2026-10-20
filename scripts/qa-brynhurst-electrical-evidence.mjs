import assert from 'node:assert/strict';
import fs from 'node:fs';
import {detectElectricalLegendPage,classifyElectricalLegendDescription,detectPdfEquipmentMatrixPage,buildElectricalDesignIntelligence} from '../lib/electrical-design-intelligence.ts';
import {classifyElectricalLabel,detectSldPage} from '../lib/sld-recognition.ts';

const fixture=JSON.parse(fs.readFileSync('tests/fixtures/brynhurst-electrical-golden.json','utf8'));
assert.equal(fixture.source.sha256,'9ad7aea4dccfe584dd3837796d4b5ba04588aeea8e2b1a90cc547575d4c323ec');
const e1=fixture.pages.find(page=>page.page===1);
const e2=fixture.pages.find(page=>page.page===2);
assert.ok(e1&&e2);

const legendLabels=[...e1.labels,'GENERAL SYMBOLS','ELECTRICAL ABBREVIATIONS','DUPLEX RECEPTACLE','HARD-WIRED SMOKE DETECTOR W/ BATTERY BACK UP','JUNCTION BOX.','COMMON AREA (HOUSE) LIGHT FIXTURE SCHEDULE','FIXTURE','DESCRIPTION','MANUFACTURER','CATALOG NUMBER','WATTS','VOLTS'];
assert.equal(detectElectricalLegendPage(legendLabels).isLegend,true);
assert.equal(classifyElectricalLegendDescription('DUPLEX RECEPTACLE'),'RECEPTACLE_DUPLEX');
assert.equal(classifyElectricalLegendDescription('HALF-HOT (SWITCHED) DUPLEX RECEPTACLE'),'RECEPTACLE_SWITCHED');
assert.equal(classifyElectricalLegendDescription('220/208 VOLT, 1ph (2 POLE) RECEPTACLE'),'RECEPTACLE_208V');
assert.equal(classifyElectricalLegendDescription('HARD-WIRED SMOKE DETECTOR W/ BATTERY BACK UP'),'SMOKE_DETECTOR');
assert.equal(classifyElectricalLegendDescription('CARBON MONOXIDE DETECTOR'),'CO_DETECTOR');
assert.equal(classifyElectricalLegendDescription('JUNCTION BOX.'),'JUNCTION_BOX');
assert.equal(detectPdfEquipmentMatrixPage(legendLabels).isMatrix,true,'E-1 light fixture schedule must be recognized as schedule evidence');

const oneLineLabels=[...e2.labels,'MS1','MS2','800A BUS 120/208V 3PH 4W','400A BUS 3PH 4W','FAULT CURRENT=42,000A','MS - ONE LINE DIAGRAM'];
assert.equal(detectSldPage(oneLineLabels,e2.vectorOps||20).isSld,true);
assert.equal(classifyElectricalLabel('MS1'),'SWITCHBOARD');
assert.equal(classifyElectricalLabel('MS2'),'SWITCHBOARD');

const partial=buildElectricalDesignIntelligence([
 {id:'legend-panel',source:fixture.source.fileName,layer:'L0',kind:'electrical-legend-entry',name:'PANEL',x:0,y:0,confidence:.9,meta:{nonSpatial:true,sourceType:'ELECTRICAL_LEGEND',legendEntry:{id:'l1',page:1,abbreviation:'',description:'SUB-PANEL (LOAD CENTER) SURFACE MOUNTED',componentHint:'PANEL',anchor:{x:0,y:0},confidence:.9,sourceEvidence:['SUB-PANEL'],physicalTruth:false,reviewRequired:true}}},
 {id:'plan-panel',source:fixture.source.fileName,layer:'L2',kind:'text-asset-candidate',name:'ELEC PANEL',x:4,y:4,floor:'L1',confidence:.86,meta:{page:4,nonSldPlan:true,planType:'ELECTRICAL_POWER_PLAN',electricalComponentHint:'PANEL'}},
 {id:'sld-ms1',source:fixture.source.fileName,layer:'L2',kind:'text-asset-candidate',name:'MS1',x:1,y:1,confidence:.86,meta:{page:2,sldCandidate:true,electricalComponentHint:'SWITCHBOARD'}},
]);
assert.equal(partial.summary.readiness,'PARTIAL_EVIDENCE');
assert.equal(partial.summary.coverage.legend,true);
assert.equal(partial.summary.coverage.physicalPlans,true);
assert.equal(partial.summary.coverage.sld,true);
assert.equal(partial.summary.coverage.specifications,false);
assert.ok(partial.findings.some(item=>item.type==='SPEC_SOURCE_MISSING'));

console.log('Brynhurst audio-workflow evidence gate passed: E-1 legend/device semantics, fixture schedule recognition, E-2 MS1/MS2 switchboard classification, and missing-source fail-closed readiness are locked.');
