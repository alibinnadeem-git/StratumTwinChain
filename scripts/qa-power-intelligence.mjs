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
  {id:'room',source:'M-201 Mechanical Equipment.dxf',layer:'L1',kind:'room-label',name:'MECHANICAL ROOM',x:6,y:0,confidence:.9}
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

assert.ok(!result.requirements.some(item=>item.sourceEntityId==='room'));
assert.equal(result.truthBoundary,'EXPECTED_POWER_IS_ADVISORY_UNTIL_QUALIFIED_ENGINEERING_REVIEW');

const compiler=fs.readFileSync('components/CompilerWorkspace.tsx','utf8');
const viewer=fs.readFileSync('components/CompiledGraphViewer.tsx','utf8');
const engine=fs.readFileSync('components/SpatialProjectionEngine.tsx','utf8');
assert.match(compiler,/Render Spatial Environment/);
assert.match(viewer,/Discipline isolation/);
assert.match(engine,/enrichPowerIntelligence/);
console.log('✓ expected power discovery, missing-feed reconciliation, rating conflicts and truth boundaries passed');
