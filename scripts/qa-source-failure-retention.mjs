import assert from 'node:assert/strict';
import {withFailedImportSource} from '../lib/source-failure-snapshot.ts';

const source={name:'original.pdf',sha256:'good',state:'parsed',summary:'Reviewed source'};
const graph={createdAt:'stable-revision',sources:[source],entities:[{id:'asset',meta:{zConstraintGraphStatus:'UNRESOLVED',relativeReviewSurfaceZ:3.2,review:{reviewer:'engineer'}}}],links:[{id:'reviewed-link'}],stats:{L0:1,L1:0,L2:1,L3:0,L4:0},reviewState:'REVIEW_REQUIRED',projection:{retained:true}};
const failure={name:'new.pdf',sha256:'failed',state:'failed',summary:'worker error'};
const next=withFailedImportSource(graph,failure);
assert.equal(next.entities,graph.entities);assert.equal(next.links,graph.links);
assert.equal(next.projection,graph.projection);assert.equal(next.createdAt,graph.createdAt);
assert.equal(next.sources[0],source);assert.equal(next.sources[1],failure);
assert.deepEqual(next.stats,{...graph.stats,L0:2});assert.equal(graph.sources.length,1);
assert.equal(withFailedImportSource(graph,{...source,state:'failed'}),graph,'failed reprocess must preserve the complete latest good revision');
const retried=withFailedImportSource(next,{...failure,summary:'second failure'});
assert.equal(retried.sources.length,2);assert.equal(retried.sources[1].summary,'second failure');
assert.equal(retried.entities,graph.entities);
const reviewed={...graph,entities:[{...graph.entities[0],meta:{...graph.entities[0].meta,concurrentReview:'latest'}}]};
assert.equal(withFailedImportSource(reviewed,failure).entities,reviewed.entities,'failure merge must preserve the current model supplied by the compare-and-write loop');
console.log('Failed-source retention passed: model/reviews/projection/revision unchanged, successful source protected, failed attempts updated without duplication.');
