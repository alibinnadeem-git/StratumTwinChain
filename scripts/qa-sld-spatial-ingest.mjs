import assert from 'node:assert/strict';
import {classifyElectricalLabel,detectSldPage,sldLogicalDepth} from '../lib/sld-recognition.ts';
import {buildSldVectorTopology} from '../lib/sld-vector-topology.ts';
import {enrichSpatialProjection} from '../lib/spatial-projection.ts';
import {resolveElectricalComponent} from '../lib/electrical-component-library.ts';
import {DEFAULT_ELECTRICAL_MODEL_REGISTRY} from '../lib/electrical-model-registry.ts';

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

const modelMappings=[
 ['XFMR-1','utility-transformer'],
 ['SWGR-1','utility-switchgear'],
 ['SWBD-1','main-switchboard'],
 ['MDP-1','main-switchboard'],
 ['MDB-1','main-switchboard'],
 ['CB-12','circuit-breaker'],
 ['MCCB-1','mccb'],
 ['GEN-1','generator'],
 ['PDU-1','power-distribution-unit'],
 ['PV-1','pv-array'],
 ['BESS-1','battery-bank'],
 ['PANEL-LP1','panelboard'],
 ['METER-1','power-meter'],
];
for(const [label,key] of modelMappings){
 const component=resolveElectricalComponent(label);
 assert.equal(component?.key,key,`${label} must resolve to the ${key} 3D family`);
 const model=DEFAULT_ELECTRICAL_MODEL_REGISTRY.find(item=>item.componentKey===key);
 assert.ok(model?.modelUrl,`${key} must have a non-empty representative model URL`);
}

const contentOnly=detectSldPage(['UTILITY SERVICE','XFMR-1','SWBD-1','MDP-1','CB-12','480V'],80);
assert.equal(contentOnly.isSld,true,'SLD must be recognized from electrical content/topology even without filename/title cues');
assert.ok(contentOnly.score>=5);

const titled=detectSldPage(['E-601 ELECTRICAL SINGLE LINE DIAGRAM','XFMR-1'],4);
assert.equal(titled.isSld,true,'explicit one-line title must be sufficient');

const ordinary=detectSldPage(['GENERAL NOTES','OFFICE 101','DOOR TYPE A'],120);
assert.equal(ordinary.isSld,false,'vector-heavy ordinary drawing must not become an SLD without electrical evidence');

const topology=buildSldVectorTopology(
 [
  {x:0,y:0,x2:0,y2:5},
  {x:0,y:5,x2:0,y2:10},
  {x:5,y:0,x2:6,y2:0},
 ],
 [
  {id:'utility',x:.1,y:.5},
  {id:'xfmr',x:.1,y:5},
  {id:'swbd',x:.1,y:9.5},
  {id:'isolated',x:5.2,y:.05},
 ],
);
const utilityAttachment=topology.attachments.find(item=>item.labelId==='utility');
const xfmrAttachment=topology.attachments.find(item=>item.labelId==='xfmr');
const swbdAttachment=topology.attachments.find(item=>item.labelId==='swbd');
const isolatedAttachment=topology.attachments.find(item=>item.labelId==='isolated');
assert.ok(utilityAttachment&&xfmrAttachment&&swbdAttachment&&isolatedAttachment);
assert.equal(utilityAttachment.component,xfmrAttachment.component);
assert.equal(xfmrAttachment.component,swbdAttachment.component);
assert.equal(utilityAttachment.componentAttachmentCount,3);
assert.equal(isolatedAttachment.componentAttachmentCount,1,'single-label decorative/isolated vector components must remain distinguishable from feeder networks');

const vectorComponent=utilityAttachment.component;
const projected=enrichSpatialProjection({
 entities:[
  {id:'u',source:'drawing.pdf',layer:'L2',kind:'text-asset-candidate',name:'UTILITY SERVICE',x:0,y:0,z:0,confidence:.9,meta:{page:1,sldCandidate:true,sldVectorComponent:vectorComponent}},
  {id:'t',source:'drawing.pdf',layer:'L2',kind:'text-asset-candidate',name:'XFMR-1',x:0,y:5,z:0,confidence:.9,meta:{page:1,sldCandidate:true,sldVectorComponent:vectorComponent}},
  {id:'s',source:'drawing.pdf',layer:'L2',kind:'text-asset-candidate',name:'SWBD-1',x:0,y:10,z:0,confidence:.9,meta:{page:1,sldCandidate:true,sldVectorComponent:vectorComponent}},
 ],links:[]
});
const vectorLinks=(projected.links||[]).filter(link=>link.type==='SLD_FEEDS');
assert.equal(vectorLinks.length,2);
assert.ok(vectorLinks.every(link=>link.meta?.inference==='PDF_VECTOR_CONNECTED_COMPONENT'));
assert.ok(vectorLinks.every(link=>link.confidence===.9));
assert.equal(projected.spatialProjection.sldVectorLinks,2);

console.log('SLD content recognition, source-vector topology and logical projection conformance passed.');
