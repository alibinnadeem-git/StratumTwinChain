import assert from 'node:assert/strict';
import fs from 'node:fs';
import {discoverElectricalRelationshipCandidates} from '../lib/electrical-relationship-resolver.ts';

const assets=[
 {
  id:'11111111-1111-4111-8111-111111111111',project_id:'33333333-3333-4333-8333-333333333333',
  asset_code:'MSB-01',asset_type:'SWITCHBOARD',name:'Main Switchboard MSB-01',model:null,serial_number:null,
  location_label:null,status:'REGISTERED',system_name:null,manufacturer_name:null,ledger_network:null,ledger_tx_hash:null,ledger_block_height:null,
 },
 {
  id:'22222222-2222-4222-8222-222222222222',project_id:'33333333-3333-4333-8333-333333333333',
  asset_code:'MCC-01',asset_type:'MCC',name:'MCC-01',model:null,serial_number:null,
  location_label:null,status:'REGISTERED',system_name:null,manufacturer_name:null,ledger_network:null,ledger_tx_hash:null,ledger_block_height:null,
 },
];

const sha='a'.repeat(64);
const graph={
 sources:[{name:'E-601 SLD.pdf',sha256:sha,discipline:'Electrical'},{name:'E-602 SLD.pdf',sha256:'b'.repeat(64),discipline:'Electrical'}],
 entities:[
  {id:'msb',source:'E-601 SLD.pdf',layer:'L2',kind:'text-asset-candidate',name:'MSB-01',x:0,y:0,confidence:.96,meta:{registeredAssetId:assets[0].id,sourceSha256:sha,page:1,sheet:'E-601',sldSpatialProjection:true}},
  {id:'mcc',source:'E-601 SLD.pdf',layer:'L2',kind:'text-asset-candidate',name:'MCC-01',x:0,y:4,confidence:.94,meta:{assetCode:'MCC-01',sourceSha256:sha,page:1,sheet:'E-601',sldSpatialProjection:true}},
  {id:'unknown',source:'E-601 SLD.pdf',layer:'L2',kind:'text-asset-candidate',name:'UNBOUND LOAD',x:0,y:8,confidence:.72,meta:{sourceSha256:sha,page:1,sheet:'E-601',sldSpatialProjection:true}},
  {id:'same',source:'E-601 SLD.pdf',layer:'L2',kind:'text-asset-candidate',name:'MSB-01 duplicate label',x:2,y:2,confidence:.8,meta:{registeredAssetId:assets[0].id,sourceSha256:sha,page:1,sheet:'E-601'}},
  {id:'cross',source:'E-602 SLD.pdf',layer:'L2',kind:'text-asset-candidate',name:'MCC-01',x:3,y:3,confidence:.8,meta:{assetCode:'MCC-01',sourceSha256:'b'.repeat(64),page:1,sheet:'E-602'}},
 ],
 links:[
  {id:'vector',from:'msb',to:'mcc',type:'SLD_FEEDS',confidence:.9,meta:{inference:'PDF_VECTOR_CONNECTED_COMPONENT',reviewRequired:true,physicalTruth:false}},
  {id:'unknown-target',from:'mcc',to:'unknown',type:'SLD_FEEDS',confidence:.72,meta:{inference:'DETERMINISTIC_HIERARCHY_NEAREST_UPSTREAM',reviewRequired:true,physicalTruth:false}},
  {id:'same-asset',from:'msb',to:'same',type:'SLD_FEEDS',confidence:.9,meta:{inference:'PDF_VECTOR_CONNECTED_COMPONENT'}},
  {id:'cross-source',from:'msb',to:'cross',type:'SLD_FEEDS',confidence:.9,meta:{inference:'PDF_VECTOR_CONNECTED_COMPONENT'}},
 ],
};

const result=discoverElectricalRelationshipCandidates(graph,assets);
assert.equal(result.inspectedSldLinks,4);
assert.equal(result.candidates.length,1,'only the unambiguous registered-asset SLD edge may become a relationship candidate');
const candidate=result.candidates[0];
assert.equal(candidate.sourceAssetId,assets[0].id);
assert.equal(candidate.targetAssetId,assets[1].id);
assert.equal(candidate.relationshipType,'FEEDS');
assert.equal(candidate.confidence,.9);
assert.equal(candidate.sourceBinding.method,'EXPLICIT_ID');
assert.equal(candidate.targetBinding.method,'EXPLICIT_CODE');
assert.equal(candidate.evidence.sourceSha256,sha);
assert.equal(candidate.evidence.sourceFileName,'E-601 SLD.pdf');
assert.equal(candidate.evidence.sheetReference,'E-601');
assert.equal(candidate.evidence.pageNumber,1);
assert.equal(candidate.evidence.extractionMethod,'SLD_VECTOR_CONNECTIVITY');
assert.equal(result.unresolved.find(item=>item.linkId==='unknown-target')?.reason,'TARGET_ASSET_UNRESOLVED');
assert.equal(result.unresolved.find(item=>item.linkId==='same-asset')?.reason,'SAME_REGISTERED_ASSET');
assert.equal(result.unresolved.find(item=>item.linkId==='cross-source')?.reason,'CROSS_SOURCE_SLD_LINK');

const logical=discoverElectricalRelationshipCandidates({
 sources:graph.sources,
 entities:graph.entities.slice(0,2),
 links:[{id:'logical',from:'msb',to:'mcc',type:'SLD_FEEDS',confidence:.72,meta:{inference:'DETERMINISTIC_HIERARCHY_NEAREST_UPSTREAM'}}],
},assets);
assert.equal(logical.candidates[0].evidence.extractionMethod,'SLD_LOGICAL_HIERARCHY');
assert.equal(logical.candidates[0].confidence,.72);
assert.equal(logical.truthBoundary,'SLD_RELATIONSHIPS_ARE_REVIEW_CANDIDATES_NOT_OPERATIONAL_TRUTH_UNTIL_EVIDENCE_BACKED_HUMAN_VERIFIED');

const route=fs.readFileSync('app/api/relationships/discover/electrical/route.ts','utf8');
assert.match(route,/spatial_compilations/);
assert.match(route,/discoverElectricalRelationshipCandidates/);
assert.match(route,/createRelationshipCandidate/);
assert.match(route,/discoveryAuthority:'DERIVED_CONNECTIVITY'/);
assert.match(route,/compilationId:compilation\.rows\[0\]\.id/);
assert.match(route,/SLD_DISCOVERY_CREATES_REVIEW_REQUIRED_RELATIONSHIP_CANDIDATES_ONLY/);
assert.doesNotMatch(route,/reviewRelationship|action:\s*['"]VERIFY['"]/,'electrical discovery must never auto-verify a relationship');

console.log('Electrical relationship resolver passed: existing SLD_FEEDS topology yields evidence-backed review candidates only when both endpoints resolve to durable Assets.');
