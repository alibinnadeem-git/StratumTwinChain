import assert from 'node:assert/strict';
import {spatialEntitySourceKey,spatialSourceKey,spatialSourceLayerLabels} from '../lib/spatial-source-layer.ts';

const sources=[
 {name:'E-201 Electrical Plan.dxf',sha256:'a'.repeat(64),discipline:'Electrical',ext:'dxf'},
 {name:'E-201 Electrical Plan.dxf',sha256:'b'.repeat(64),discipline:'Electrical',ext:'dxf'},
 {name:'A-101 Architectural Plan.dxf',sha256:'c'.repeat(64),discipline:'Architectural',ext:'dxf'}
];
assert.notEqual(spatialSourceKey(sources[0]),spatialSourceKey(sources[1]));
assert.equal(spatialEntitySourceKey({source:sources[0].name,meta:{sourceSha256:sources[0].sha256}}),sources[0].sha256);
assert.equal(spatialEntitySourceKey({source:'legacy-source.pdf'}),'legacy-source.pdf');
const labels=spatialSourceLayerLabels(sources);
assert.equal(labels.get(sources[0].sha256),'E-201 Electrical Plan.dxf · aaaaaaaa');
assert.equal(labels.get(sources[1].sha256),'E-201 Electrical Plan.dxf · bbbbbbbb');
assert.equal(labels.get(sources[2].sha256),'A-101 Architectural Plan.dxf');
const fs=await import('node:fs');
const viewer=fs.readFileSync('components/CompiledGraphViewer.tsx','utf8');
assert.match(viewer,/spatialSourceKey/);
assert.match(viewer,/spatialEntitySourceKey/);
assert.match(viewer,/spatialSourceLayerLabels/);
assert.match(viewer,/hiddenSourceSet\.has\(sourceKey\)/);
console.log('Spatial source layers distinguish same-named source revisions by SHA-256');
