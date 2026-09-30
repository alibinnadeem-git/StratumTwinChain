import assert from 'node:assert/strict';
import {inferEquipmentZ,inferenceMethodLabel} from '../lib/z-inference.ts';
import {clearConfirmedZ,historicalZConfidence,historicalZPrior,recordConfirmedZ} from '../lib/z-history.ts';

let passed=0;
const ok=(name,fn)=>{fn();passed++;console.log('ok -',name)};

ok('unknown equipment creates zero Z proposals',()=>{
 assert.equal(inferEquipmentZ({name:'XYZ Widget Thingamajig 9000',meta:{},projectId:'p1'}).length,0);
});

ok('disconnect prior without support stays relative and cannot render absolute Z',()=>{
 const inf=inferEquipmentZ({name:'Safety Switch Disconnect',meta:{},projectId:'p1'}).find(item=>item.method==='CLASS_MOUNTING_PRIOR');
 assert.ok(inf);assert.equal(inf.relativeOnly,true);assert.equal(inf.absoluteReferenceZMeters,null);assert.equal(inf.renderBaseZMeters,null);
 assert.equal(inf.referencePoint,'MOUNTING_POINT');assert.equal(inf.physicalTruth,false);assert.equal(inf.reviewRequired,true);
});

ok('disconnect mounting-point proposal does not become cabinet base without mounting offset',()=>{
 const inf=inferEquipmentZ({name:'Safety Switch Disconnect',projectId:'p1',meta:{reviewSurfaceZ:10,reviewSurfaceKind:'FINISHED_FLOOR',reviewSurfaceConfidence:.8}}).find(item=>item.method==='CLASS_MOUNTING_PRIOR');
 assert.ok(inf);assert.ok(Math.abs(inf.absoluteReferenceZMeters-11.22)<1e-9);assert.equal(inf.renderBaseZMeters,null);
});

ok('centerline prior converts to render base using current equipment height',()=>{
 const inf=inferEquipmentZ({name:'Fire Alarm Panel FACP',projectId:'p1',meta:{reviewSurfaceZ:10,reviewSurfaceKind:'FINISHED_FLOOR',reviewSurfaceConfidence:.8}}).find(item=>item.method==='CLASS_MOUNTING_PRIOR');
 assert.ok(inf);assert.equal(inf.referencePoint,'CENTERLINE');assert.ok(Math.abs(inf.absoluteReferenceZMeters-11.6)<1e-9);
 assert.ok(inf.renderBaseZMeters!==null&&inf.renderBaseZMeters<inf.absoluteReferenceZMeters);
});

ok('pad-mount transformer composes base offset with grade',()=>{
 const inf=inferEquipmentZ({name:'Pad-Mount Transformer',projectId:'p1',meta:{reviewSurfaceZ:245.1,reviewSurfaceKind:'FINISHED_GRADE',reviewSurfaceConfidence:.7}}).find(item=>item.method==='CLASS_MOUNTING_PRIOR');
 assert.ok(inf);assert.equal(inf.referencePoint,'BASE');assert.ok(Math.abs(inf.absoluteReferenceZMeters-245.22)<1e-9);assert.ok(Math.abs(inf.renderBaseZMeters-245.22)<1e-9);
});

ok('historical learning requires three unique project/entity decisions',()=>{
 clearConfirmedZ();
 const base={projectId:'project-a',componentKey:'disconnect',supportKind:'FINISHED_FLOOR',supportZMeters:10,referencePoint:'MOUNTING_POINT',inferenceMethod:'CLASS_MOUNTING_PRIOR',basis:['review'],sourceRefs:[]};
 recordConfirmedZ({...base,entityId:'d1',offsetMeters:1.2,absoluteReferenceZMeters:11.2,sourceInferenceId:'a'});
 recordConfirmedZ({...base,entityId:'d2',offsetMeters:1.25,absoluteReferenceZMeters:11.25,sourceInferenceId:'b'});
 assert.equal(historicalZPrior('disconnect',{projectId:'project-a',supportKind:'FINISHED_FLOOR'}),null);
 recordConfirmedZ({...base,entityId:'d3',offsetMeters:1.3,absoluteReferenceZMeters:11.3,sourceInferenceId:'c'});
 const prior=historicalZPrior('disconnect',{projectId:'project-a',supportKind:'FINISHED_FLOOR'});
 assert.ok(prior);assert.equal(prior.n,3);assert.ok(Math.abs(prior.medianOffsetMeters-1.25)<1e-9);
});

ok('repeat acceptance on one entity is idempotent for historical sample count',()=>{
 const before=historicalZPrior('disconnect',{projectId:'project-a',supportKind:'FINISHED_FLOOR'});
 recordConfirmedZ({projectId:'project-a',entityId:'d1',componentKey:'disconnect',supportKind:'FINISHED_FLOOR',supportZMeters:10,offsetMeters:1.2,referencePoint:'MOUNTING_POINT',absoluteReferenceZMeters:11.2,inferenceMethod:'CLASS_MOUNTING_PRIOR',sourceInferenceId:'a',basis:['review'],sourceRefs:[]});
 const after=historicalZPrior('disconnect',{projectId:'project-a',supportKind:'FINISHED_FLOOR'});
 assert.equal(before?.n,3);assert.equal(after?.n,3);
});

ok('historical priors do not leak across projects',()=>{
 assert.equal(historicalZPrior('disconnect',{projectId:'project-b',supportKind:'FINISHED_FLOOR'}),null);
});

ok('historical prior never mixes base and centerline reference semantics',()=>{
 clearConfirmedZ();
 const common={projectId:'project-mixed',componentKey:'disconnect',supportKind:'FINISHED_FLOOR',supportZMeters:0,inferenceMethod:'CLASS_MOUNTING_PRIOR',basis:['review'],sourceRefs:[]};
 recordConfirmedZ({...common,entityId:'b1',offsetMeters:1,referencePoint:'BASE',absoluteReferenceZMeters:1,sourceInferenceId:'b1'});
 recordConfirmedZ({...common,entityId:'b2',offsetMeters:1.1,referencePoint:'BASE',absoluteReferenceZMeters:1.1,sourceInferenceId:'b2'});
 recordConfirmedZ({...common,entityId:'c1',offsetMeters:1.4,referencePoint:'CENTERLINE',absoluteReferenceZMeters:1.4,sourceInferenceId:'c1'});
 recordConfirmedZ({...common,entityId:'c2',offsetMeters:1.5,referencePoint:'CENTERLINE',absoluteReferenceZMeters:1.5,sourceInferenceId:'c2'});
 assert.equal(historicalZPrior('disconnect',{projectId:'project-mixed',supportKind:'FINISHED_FLOOR'}),null);
});

ok('history confidence is capped and penalized by dispersion',()=>{
 assert.ok(historicalZConfidence(20,0)<=.78);
 assert.ok(historicalZConfidence(5,.4)<historicalZConfidence(5,.01));
});

ok('inference uses project-scoped reviewed history only when support is resolved',()=>{
 const withHistory=inferEquipmentZ({name:'Safety Switch Disconnect',projectId:'project-a',meta:{reviewSurfaceZ:20,reviewSurfaceKind:'FINISHED_FLOOR',reviewSurfaceConfidence:.8}});
 assert.ok(withHistory.some(item=>item.method==='HISTORICAL_CLASS_PRIOR'));
 const withoutSupport=inferEquipmentZ({name:'Safety Switch Disconnect',projectId:'project-a',meta:{}});
 assert.ok(!withoutSupport.some(item=>item.method==='HISTORICAL_CLASS_PRIOR'));
});

ok('all proposals remain inferred and non-physical',()=>{
 const all=inferEquipmentZ({name:'Pad-Mount Transformer',projectId:'p1',meta:{reviewSurfaceZ:100,reviewSurfaceKind:'GRADE',reviewSurfaceConfidence:.8}});
 assert.ok(all.length>0);
 for(const item of all){assert.equal(item.inferenceClass,'INFERRED');assert.equal(item.physicalTruth,false);assert.equal(item.reviewRequired,true)}
});

ok('method labels communicate reviewed history and OEM boundaries',()=>{
 assert.ok(inferenceMethodLabel('HISTORICAL_CLASS_PRIOR').includes('Reviewed'));
 assert.ok(inferenceMethodLabel('OEM_MOUNTING_REFERENCE').includes('OEM'));
});

console.log(`\n${passed} Z inference safety checks passed`);
