import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildCoordinationIntelligence} from '../lib/coordination-intelligence.ts';

const graph={
 createdAt:'2026-09-22T00:00:00.000Z',
 sources:[
  {name:'M-601 Schedule.csv',sha256:'a'.repeat(64),discipline:'Mechanical'},
  {name:'M-201 Plan.dxf',sha256:'b'.repeat(64),discipline:'Mechanical'},
  {name:'E-201 Power.dxf',sha256:'c'.repeat(64),discipline:'Electrical'},
  {name:'A-101 Plan.pdf',sha256:'d'.repeat(64),discipline:'Architectural'},
  {name:'A-101 Plan.pdf',sha256:'e'.repeat(64),discipline:'Architectural'}
 ],
 entities:[
  {id:'sched-ahu1',source:'M-601 Schedule.csv',layer:'L4',kind:'schedule-powered-equipment-candidate',name:'AHU-1 480V 3PH FLA 12',floor:'L2',zone:'MECH 201',confidence:.95,meta:{assetTag:'AHU-1',manufacturer:'TRANE',model:'XA100',nonSpatial:true,sourceSha256:'a'.repeat(64),voltage:480,phase:3,fla:12}},
  {id:'plan-ahu1',source:'M-201 Plan.dxf',layer:'L4',kind:'asset-candidate',name:'AHU-1 208V 3PH',floor:'ROOF',zone:'ROOF MECH',confidence:.9,meta:{assetTag:'AHU-1',manufacturer:'CARRIER',model:'CA200',sourceSha256:'b'.repeat(64)}},
  {id:'sched-p2',source:'M-601 Schedule.csv',layer:'L4',kind:'schedule-powered-equipment-candidate',name:'P-2 CHW PUMP 460V 3PH',floor:'L2',zone:'MECH 201',confidence:.9,meta:{assetTag:'P-2',nonSpatial:true,sourceSha256:'a'.repeat(64),voltage:460,phase:3}},
  {id:'elec-ahu1',source:'E-201 Power.dxf',layer:'L2',kind:'text-asset-candidate',name:'AHU-1 480V 3PH',floor:'L2',zone:'MECH 201',confidence:.9,meta:{assetTag:'AHU-1',sourceSha256:'c'.repeat(64)}}
 ],
 titleBlocks:[
  {sourceName:'A-101 Plan.pdf',sourceSha256:'d'.repeat(64),page:1,reviewState:'CONFIRMED',sheetNumber:{value:'A-101'},revision:{value:'3'},issueDate:{value:'2026-08-01'}},
  {sourceName:'A-101 Plan.pdf',sourceSha256:'e'.repeat(64),page:1,reviewState:'CONFIRMED',sheetNumber:{value:'A-101'},revision:{value:'4'},issueDate:{value:'2026-09-01'}}
 ]
};

const result=buildCoordinationIntelligence(graph);

assert.ok(result.findings.some(item=>item.findingType==='MISSING_SPATIAL_REPRESENTATION'&&item.title.includes('P-2')));
assert.ok(result.findings.some(item=>item.findingType==='MODEL_CONFLICT'&&item.title.includes('AHU-1')));
assert.ok(result.findings.some(item=>item.findingType==='RATING_CONFLICT'&&item.title.includes('AHU-1')));
assert.ok(result.findings.some(item=>item.findingType==='LOCATION_CONFLICT'&&item.title.includes('AHU-1')));
assert.ok(result.findings.some(item=>item.findingType==='SHEET_REVISION_CONFLICT'&&item.title.includes('A-101')));
assert.ok(result.findings.some(item=>item.findingType==='SOURCE_REVISION_AMBIGUITY'&&item.title.includes('A-101 Plan.pdf')));

const rating=result.findings.find(item=>item.findingType==='RATING_CONFLICT'&&item.title.includes('AHU-1'));
assert.ok(rating);
assert.ok(Array.isArray(rating.comparison.fields));
assert.ok(rating.comparison.fields.includes('voltage'));

const location=result.findings.find(item=>item.findingType==='LOCATION_CONFLICT'&&item.title.includes('AHU-1'));
assert.ok(location);assert.deepEqual(location.comparison.floors.sort(),['L2','ROOF']);

assert.equal(result.findings.some(item=>/GEOMETRIC_CLASH|PHYSICAL_CLASH/.test(item.findingType)),false);
assert.equal(result.truthBoundary,'COORDINATION_FINDINGS_DO_NOT_ESTABLISH_PHYSICAL_CLASH_CODE_COMPLIANCE_OR_ENGINEERING_APPROVAL');

const migration=fs.readFileSync('migrations/009_coordination_intelligence.sql','utf8');
for(const name of ['coordination_snapshots','coordination_findings','coordination_finding_dispositions','coordination_action_requests','stratum_prevent_coordination_snapshot_update','stratum_prevent_coordination_finding_update','stratum_prevent_coordination_disposition_update','stratum_prevent_coordination_action_request_update']){
 assert.ok(migration.includes(name),'Missing coordination persistence invariant: '+name);
}
const api=fs.readFileSync('app/api/coordination/findings/route.ts','utf8');
for(const boundary of ['ACTION_REQUEST_IS_NOT_AN_APPROVED_RFI_NCR_WORK_ORDER_CHANGE_OR_ENGINEERING_DECISION','DISPOSITION_DOES_NOT_REWRITE_SOURCE_EVIDENCE_OR_ESTABLISH_ENGINEERING_APPROVAL']){
 assert.ok(api.includes(boundary),'Missing coordination API truth boundary: '+boundary);
}
console.log('Coordination identity, rating, location, revision and action-request truth boundaries passed');
