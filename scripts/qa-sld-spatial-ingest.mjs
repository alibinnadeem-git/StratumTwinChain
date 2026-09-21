import assert from 'node:assert/strict';
import {classifyElectricalLabel,detectSldPage,sldLogicalDepth} from '../lib/sld-recognition.ts';

const expected=[
 ['XFMR-1','TRANSFORMER',1],
 ['SWBD-1','SWITCHBOARD',2],
 ['MDB-1','SWITCHBOARD',2],
 ['MDP-1','SWITCHBOARD',2],
 ['CB-12','BREAKER',3],
 ['MCCB-1','BREAKER',3],
 ['UTILITY SERVICE','UTILITY_SOURCE',0],
 ['GEN-1','GENERATOR_SOURCE',0],
 ['PV-1','PV_SOURCE',0],
 ['ATS-1','ATS',3],
 ['PANEL LP-1','PANEL',4],
 ['VFD-2','VFD',5],
];
for(const [label,kind,depth] of expected){
 assert.equal(classifyElectricalLabel(label),kind,`${label} must be recognized as ${kind}`);
 assert.equal(sldLogicalDepth(label),depth,`${label} logical depth`);
}

const contentOnly=detectSldPage(['UTILITY SERVICE','XFMR-1','SWBD-1','MDP-1','CB-12','480V'],80);
assert.equal(contentOnly.isSld,true,'SLD must be recognized from electrical content/topology even without filename/title cues');
assert.ok(contentOnly.score>=5);

const titled=detectSldPage(['E-601 ELECTRICAL SINGLE LINE DIAGRAM','XFMR-1'],4);
assert.equal(titled.isSld,true,'explicit one-line title must be sufficient');

const ordinary=detectSldPage(['GENERAL NOTES','OFFICE 101','DOOR TYPE A'],120);
assert.equal(ordinary.isSld,false,'vector-heavy ordinary drawing must not become an SLD without electrical evidence');

console.log('SLD content recognition and logical projection conformance passed.');
