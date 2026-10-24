import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildPowerIntelligence} from '../lib/power-intelligence.ts';

const graph={
 version:'fixture',createdAt:'2026-09-21T00:00:00.000Z',
 sources:[
  {name:'M-201 Mechanical Equipment.dxf',discipline:'Mechanical'},
  {name:'E-201 Power Plan.dxf',discipline:'Electrical'},
  {name:'FP-101 Fire Protection.dxf',discipline:'Fire Protection'}
 ],
 entities:[
  {id:'ahu-mech',source:'M-201 Mechanical Equipment.dxf',layer:'L1',kind:'cad-block',name:'AHU-1 480V 3PH FLA 12',x:0,y:0,confidence:.95},
  {id:'ahu-elec',source:'E-201 Power Plan.dxf',layer:'L2',kind:'text-asset-candidate',name:'AHU-1 480V 3PH',x:1,y:0,confidence:.95},
  {id:'pump-missing',source:'M-201 Mechanical Equipment.dxf',layer:'L1',kind:'cad-block',name:'P-2 CHW PUMP 460V 3PH MCA 18 MOCP 25',x:2,y:0,confidence:.9},
  {id:'ahu2-mech',source:'M-201 Mechanical Equipment.dxf',layer:'L1',kind:'cad-block',name:'AHU-2 480V 3PH 10 KVA',x:3,y:0,confidence:.9},
  {id:'ahu2-elec',source:'E-201 Power Plan.dxf',layer:'L2',kind:'text-asset-candidate',name:'AHU-2 208V 3PH',x:4,y:0,confidence:.9},
  {id:'fp-mech',source:'FP-101 Fire Protection.dxf',layer:'L1',kind:'cad-block',name:'FIRE PUMP FP-1 480V 3PH 50 HP',x:5,y:0,confidence:.95},
  {id:'room',source:'M-201 Mechanical Equipment.dxf',layer:'L1',kind:'room-label',name:'MECHANICAL ROOM',x:6,y:0,confidence:.9},
  {id:'ahu-unrated',source:'M-201 Mechanical Equipment.dxf',layer:'L1',kind:'cad-block',name:'AHU-9',x:7,y:0,confidence:.8,meta:{voltage:null,fla:null,inputKw:null}}
 ]
};

const result=buildPowerIntelligence(graph);
const ahu=result.requirements.find(item=>item.sourceEntityId==='ahu-mech');
assert.ok(ahu);assert.equal(ahu.status,'MATCHED');assert.equal(ahu.voltage,480);assert.equal(ahu.phase,3);
assert.ok(ahu.connectedLoadEstimateKva&&ahu.connectedLoadEstimateKva>9&&ahu.connectedLoadEstimateKva<11);

const pump=result.requirements.find(item=>item.sourceEntityId==='pump-missing');
assert.ok(pump);assert.equal(pump.status,'MISSING');assert.equal(pump.connectedLoadEstimateKva,null);
assert.match(pump.assumptions.join(' '),/MCA is retained/);
assert.ok(result.findings.some(item=>item.sourceEntityId==='pump-missing'&&item.findingType==='MISSING_FEED'));

const ahu2=result.requirements.find(item=>item.sourceEntityId==='ahu2-mech');
assert.ok(ahu2);assert.equal(ahu2.status,'CONFLICTED');
assert.ok(result.findings.some(item=>item.sourceEntityId==='ahu2-mech'&&item.findingType==='VOLTAGE_PHASE_MISMATCH'));

const firePump=result.requirements.find(item=>item.sourceEntityId==='fp-mech');
assert.ok(firePump);assert.equal(firePump.status,'MISSING');
assert.ok(result.findings.some(item=>item.sourceEntityId==='fp-mech'&&item.findingType==='EMERGENCY_POWER_REVIEW'));

const unrated=result.requirements.find(item=>item.sourceEntityId==='ahu-unrated');
assert.ok(unrated);assert.equal(unrated.voltage,null);assert.equal(unrated.fla,null);assert.equal(unrated.inputKw,null);assert.equal(unrated.connectedLoadEstimateKva,null);

assert.ok(!result.requirements.some(item=>item.sourceEntityId==='room'));
const reference=buildPowerIntelligence({...graph,entities:[...graph.entities,{id:'reference-only',source:'Tesla.glb',layer:'L2',kind:'imported-3d-model',name:'EV CHARGER EVSE-1',x:0,y:0,confidence:1,meta:{referenceOnly:true}}]});
assert.ok(!reference.requirements.some(item=>item.sourceEntityId==='reference-only'),'3D model library references must not become project power requirements');
const ambiguous=buildPowerIntelligence({sources:[{name:'combined.pdf',discipline:'Multi-discipline'}],entities:[
 {id:'fan-note',source:'combined.pdf',layer:'L4',kind:'powered-equipment-candidate',name:'FAN: 50 WATT OR AS NOTED ON PLAN',confidence:.9},
 {id:'fan-legend',source:'combined.pdf',layer:'L0',kind:'electrical-legend-entry',name:'FAN',confidence:.9,meta:{nonSpatial:true,sourceType:'ELECTRICAL_LEGEND'}},
 ...Array.from({length:5},(_,i)=>({id:'elevator-'+i,source:'combined.pdf',layer:'L4',kind:'powered-equipment-candidate',name:'Elevator',floor:'L'+(i+1),confidence:.72})),
 {id:'fire-label',source:'combined.pdf',layer:'L2',kind:'text-asset-candidate',name:'Fire Alarm',confidence:.72,meta:{planDiscipline:'Electrical'}},
 {id:'unknown-ef',source:'combined.pdf',layer:'L4',kind:'powered-equipment-candidate',name:'EXHAUST FAN EF-1',confidence:.9},
]});
assert.ok(!ambiguous.requirements.some(item=>item.sourceEntityId.startsWith('fan-')),'legend/instruction text cannot establish installed fans');
assert.ok(ambiguous.requirements.filter(item=>item.sourceEntityId.startsWith('elevator-')).every(item=>item.tag===null&&item.status==='EXPECTED'),'generic elevator labels cannot become numbered asset tags or missing feeds');
assert.equal(ambiguous.requirements.find(item=>item.sourceEntityId==='fire-label')?.sourceDiscipline,'Electrical');
assert.equal(ambiguous.requirements.find(item=>item.sourceEntityId==='unknown-ef')?.status,'EXPECTED','a mixed/unknown source discipline cannot establish a non-electrical missing feed');
assert.equal(ambiguous.summary.missing,0);assert.equal(ambiguous.findings.length,0);
const worksheet=buildPowerIntelligence({sources:[{name:'M-601-Equipment-Matrix.xlsx',discipline:'Unclassified'}],entities:[
 {id:'ahu-sheet',source:'M-601-Equipment-Matrix.xlsx',layer:'L4',kind:'schedule-powered-equipment-candidate',name:'AHU-12 Air Handling Unit',confidence:.9,meta:{nonSpatial:true,discipline:'Unclassified',workbookSheet:'Mechanical Equipment',assetTag:'AHU-12',voltage:480}},
]});
assert.equal(worksheet.requirements[0]?.sourceDiscipline,'Mechanical');assert.equal(worksheet.requirements[0]?.status,'MISSING','a named mechanical worksheet retains actionable tagged equipment evidence');
const prefixCollision=buildPowerIntelligence({...graph,entities:[
 graph.entities[0],{...graph.entities[1],name:'AHU-10 480V 3PH'},
]});
assert.equal(prefixCollision.requirements.find(item=>item.sourceEntityId==='ahu-mech')?.status,'MISSING','AHU-10 cannot satisfy AHU-1');
assert.equal(result.truthBoundary,'EXPECTED_POWER_IS_ADVISORY_UNTIL_QUALIFIED_ENGINEERING_REVIEW');

const compiler=fs.readFileSync('components/CompilerWorkspace.tsx','utf8');
const viewer=fs.readFileSync('components/CompiledGraphViewer.tsx','utf8');
const engine=fs.readFileSync('components/SpatialProjectionEngine.tsx','utf8');
// Projection enrichment moved into lib/graph-enrichment.ts (projectGraph) so it runs in the
// graph worker; the engine drives it off the main thread via projectGraphOffThread.
const enrichment=fs.readFileSync('lib/graph-enrichment.ts','utf8');
assert.match(compiler,/Render Spatial Environment/);
assert.match(viewer,/Discipline isolation/);
assert.match(enrichment,/enrichPowerIntelligence/);
assert.match(engine,/projectGraphOffThread/);
console.log('✓ expected power discovery, missing-feed reconciliation, rating conflicts and truth boundaries passed');
