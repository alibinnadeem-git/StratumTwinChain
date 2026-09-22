import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildPowerIntelligence} from '../lib/power-intelligence.ts';
import {parseEquipmentScheduleText} from '../lib/equipment-schedule.ts';

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


const scheduleCsv=`TAG,DESCRIPTION,VOLTAGE,PHASE,FLA,MCA,MOCP,HP,MANUFACTURER,MODEL
AHU-7,Air Handling Unit,480,3,14,16,20,,Acme,AHU-X
PMP-4,CHW Pump,460,3,,18,25,7.5,Acme,P-75
FP-1,Fire Pump,480,3,,,100,50,Acme,FP50
ROOM-1,Mechanical Room,,,,,,,,`;
const parsedSchedule=parseEquipmentScheduleText(scheduleCsv);
assert.equal(parsedSchedule.hasHeader,true);
assert.equal(parsedSchedule.records.length,3);
const ahu7=parsedSchedule.records.find(item=>item.tag==='AHU-7');
assert.ok(ahu7);assert.equal(ahu7.equipmentClass,'AIR_HANDLER');assert.equal(ahu7.voltage,480);assert.equal(ahu7.phase,3);assert.equal(ahu7.fla,14);
const pmp4=parsedSchedule.records.find(item=>item.tag==='PMP-4');
assert.ok(pmp4);assert.equal(pmp4.equipmentClass,'PUMP');assert.equal(pmp4.mca,18);assert.equal(pmp4.mocp,25);assert.equal(pmp4.motorHp,7.5);

const scheduleGraph={
 version:'fixture-schedule',createdAt:'2026-09-21T00:00:00.000Z',
 sources:[{name:'M-601 Equipment Schedule.csv',discipline:'Mechanical'},{name:'E-201 Power Plan.dxf',discipline:'Electrical'}],
 entities:[
  ...parsedSchedule.records.map((record,index)=>({id:`schedule-${index}`,source:'M-601 Equipment Schedule.csv',layer:'L4',kind:'equipment-schedule-candidate',name:record.rawText,x:0,y:0,confidence:record.confidence,meta:{assetTag:record.tag,voltage:record.voltage,phase:record.phase,fla:record.fla,mca:record.mca,mocp:record.mocp,motorHp:record.motorHp,spatialPlacementAuthority:'SCHEDULE_ONLY_NO_PHYSICAL_XYZ'}})),
  {id:'ahu7-elec',source:'E-201 Power Plan.dxf',layer:'L2',kind:'text-asset-candidate',name:'AHU-7 480V 3PH',x:1,y:1,confidence:.9}
 ]
};
const schedulePower=buildPowerIntelligence(scheduleGraph);
assert.equal(schedulePower.requirements.find(item=>item.tag==='AHU-7')?.status,'MATCHED');
assert.equal(schedulePower.requirements.find(item=>item.tag==='PMP-4')?.status,'MISSING');
assert.ok(schedulePower.findings.some(item=>item.findingType==='EMERGENCY_POWER_REVIEW'&&schedulePower.requirements.find(req=>req.id===item.expectedPowerRequirementId)?.tag==='FP-1'));

const compilerSchedule=fs.readFileSync('components/CompilerWorkspace.tsx','utf8');
const viewerSchedule=fs.readFileSync('components/CompiledGraphViewer.tsx','utf8');
assert.match(compilerSchedule,/parseEquipmentScheduleText/);
assert.match(compilerSchedule,/SCHEDULE_ONLY_NO_PHYSICAL_XYZ/);
assert.match(viewerSchedule,/SCHEDULE_ONLY_NO_PHYSICAL_XYZ/);
console.log('✓ equipment schedules contribute powered semantic records without inventing physical XYZ');
