import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseEquipmentScheduleText} from '../lib/equipment-schedule.ts';
import {buildPowerIntelligence} from '../lib/power-intelligence.ts';

const csv=[
 'TAG,DESCRIPTION,MANUFACTURER,MODEL,VOLTAGE,PHASE,FLA,MCA,MOCP,HP,LOCATION',
 'AHU-1,Air Handling Unit,Trane,XA100,480,3,12,15,20,,Mechanical Room',
 'P-2,CHW Pump,Bell & Gossett,1510,460,3,,18,25,10,Mechanical Room',
 'ROOM-1,Mechanical Room,,,,,,,,,Mechanical Room'
].join('\n');
const parsed=parseEquipmentScheduleText(csv,'M-601 Equipment Schedule.csv','Mechanical','L2');
assert.equal(parsed.entities.length,2);
const ahu=parsed.entities.find(entity=>entity.meta.assetTag==='AHU-1');
assert.ok(ahu);assert.equal(ahu.meta.nonSpatial,true);assert.equal(ahu.meta.voltage,480);assert.equal(ahu.meta.phase,3);assert.equal(ahu.meta.fla,12);assert.equal(ahu.zone,'Mechanical Room');
const pump=parsed.entities.find(entity=>entity.meta.assetTag==='P-2');
assert.ok(pump);assert.equal(pump.meta.mca,18);assert.equal(pump.meta.mocp,25);assert.equal(pump.meta.motorHp,10);
assert.equal(parsed.entities.some(entity=>entity.meta.assetTag==='ROOM-1'),false);

const graph={version:'fixture',createdAt:new Date().toISOString(),sources:[{name:'M-601 Equipment Schedule.csv',discipline:'Mechanical'}],entities:parsed.entities,links:[]};
const power=buildPowerIntelligence(graph);
assert.equal(power.requirements.length,2);
assert.ok(power.requirements.every(item=>item.status==='MISSING'));
assert.ok(power.findings.some(item=>item.sourceEntityId===ahu.id&&item.findingType==='MISSING_FEED'));
assert.ok(power.findings.some(item=>item.sourceEntityId===pump.id&&item.findingType==='MISSING_FEED'));
const pumpRequirement=power.requirements.find(item=>item.sourceEntityId===pump.id);
assert.ok(pumpRequirement);assert.equal(pumpRequirement.connectedLoadEstimateKva,null);
assert.match(pumpRequirement.assumptions.join(' '),/MCA is retained/);

const compiler=fs.readFileSync('components/CompilerWorkspace.tsx','utf8');
const viewer=fs.readFileSync('components/CompiledGraphViewer.tsx','utf8');
const projection=fs.readFileSync('lib/spatial-projection.ts','utf8');
assert.match(compiler,/parseEquipmentScheduleText/);
assert.match(compiler,/parseXlsxBytes/);
assert.match(compiler,/parseDocxBytes/);
assert.match(compiler,/Legacy XLS fingerprinted\. Binary BIFF adapter or conversion to XLSX is required; no structured engineering fields were invented/);
assert.match(viewer,/meta\?\.nonSpatial===true/);
assert.match(projection,/meta\?\.nonSpatial===true/);
console.log('Equipment schedules create non-spatial source evidence, feed Expected Power, and never invent XYZ geometry');
