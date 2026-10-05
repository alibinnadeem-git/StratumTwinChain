import assert from 'node:assert/strict';
import fs from 'node:fs';
import {deriveRenderLocalOrigin,toRenderLocalXY,fromRenderLocalXY,renderLocalSpan} from '../lib/render-local-origin.ts';

const entities=[
  {x:600000.01,y:4100000.01,x2:600010.01,y2:4100000.01,vertices:[{x:600000.01,y:4100000.01},{x:600010.01,y:4100000.01},{x:600010.01,y:4100005.01}]},
  {x:600000.03,y:4100000.04,x2:600010.03,y2:4100005.04}
];
const snapshot=JSON.stringify(entities);
const origin=deriveRenderLocalOrigin(entities);
assert.equal(JSON.stringify(entities),snapshot,'render origin derivation must not mutate persisted/project entities');
assert.equal(origin.authority,'RENDER_ONLY_VISIBLE_BOUNDS_CENTER');
assert.equal(origin.translationOnly,true);
assert.equal(origin.persistedCoordinatesChanged,false);
assert.equal(origin.physicalTruth,false);
assert.ok(origin.x>600000&&origin.y>4100000);

const a={x:600000.01,y:4100000.01};
const b={x:600000.03,y:4100000.04};
const la=toRenderLocalXY(a,origin),lb=toRenderLocalXY(b,origin);
assert.ok(Math.abs((lb.x-la.x)-(b.x-a.x))<1e-12,'common origin subtraction must preserve X distance');
assert.ok(Math.abs((lb.y-la.y)-(b.y-a.y))<1e-12,'common origin subtraction must preserve Y distance');
const roundtrip=fromRenderLocalXY(la,origin);
assert.ok(Math.abs(roundtrip.x-a.x)<1e-12&&Math.abs(roundtrip.y-a.y)<1e-12,'render-local coordinate must round-trip to project coordinate');

const rawFloatDeltaX=Math.fround(b.x)-Math.fround(a.x);
const localFloatDeltaX=Math.fround(lb.x)-Math.fround(la.x);
const trueDeltaX=b.x-a.x;
assert.ok(Math.abs(localFloatDeltaX-trueDeltaX)<Math.abs(rawFloatDeltaX-trueDeltaX),'localization must improve Float32 precision at survey-scale coordinates');

const span=renderLocalSpan(entities,origin);
assert.ok(span.maxAbsX<6&&span.maxAbsY<3,'survey-scale coordinates should render near zero while preserving model span');

const zero=deriveRenderLocalOrigin([]);
assert.deepEqual({x:zero.x,y:zero.y,sourcePointCount:zero.sourcePointCount},{x:0,y:0,sourcePointCount:0});

const viewer=fs.readFileSync('components/CompiledGraphViewer.tsx','utf8');
assert.match(viewer,/deriveRenderLocalOrigin\(visible\)/);
assert.match(viewer,/dataset\.renderOriginX/);
assert.match(viewer,/dataset\.renderOriginY/);
assert.match(viewer,/dataset\.renderOriginAuthority/);
assert.match(viewer,/userData\.entity=e/,'clickable object must retain original engineering entity');
assert.match(viewer,/root\.position\.set\(rx\(e\.x\),placement\.baseZ,rz\(e\.y\)\)/);
assert.match(viewer,/rx\(verts\[0\]\.x\).*rz\(verts\[0\]\.y\)/s);
assert.match(viewer,/shape\.lineTo\(local\.x,local\.y\)/);
assert.match(viewer,/new THREE\.Vector3\(rx\(e\.x\),height\(e\)\+\.08,rz\(e\.y\)\)/);
assert.match(viewer,/selected\.x-origin\.x.*selected\.y-origin\.y/s);

for(const forbidden of [
  /position\.set\(e\.x/,
  /new THREE\.Vector3\(e\.x/,
  /new THREE\.Vector3\(a\.x/,
  /new THREE\.Vector3\(b\.x/,
  /shape\.(?:lineTo|moveTo)\(p\.x,p\.y\)/,
  /verts\[\d\]\.x,Number/
]){
  assert.doesNotMatch(viewer,forbidden,'GPU-facing geometry must not receive raw large project X/Y coordinates');
}
assert.doesNotMatch(viewer,/e\.x\s*=\s*e\.x-/,'render localization must never mutate entity coordinates');
assert.doesNotMatch(viewer,/e\.y\s*=\s*e\.y-/,'render localization must never mutate entity coordinates');

console.log('Render-local origin precision passed: survey-scale project X/Y remains authoritative and unchanged, GPU coordinates are translated near zero, relative geometry is preserved, Float32 precision improves, and Z/truth semantics are untouched.');
