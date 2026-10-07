import assert from 'node:assert/strict';
import fs from 'node:fs';
import {deriveRenderLocalOrigin,toRenderLocalXY,fromRenderLocalXY} from '../lib/render-local-origin.ts';

const entities=[
  {
    x:6_000_000,y:2_000_000,x2:6_000_000.025,y2:2_000_000,
    vertices:[
      {x:6_000_000,y:2_000_000},
      {x:6_000_000.025,y:2_000_000},
      {x:6_000_000.025,y:2_000_000.02},
      {x:6_000_000,y:2_000_000.02}
    ]
  }
];
const snapshot=JSON.stringify(entities);
const origin=deriveRenderLocalOrigin(entities);
assert.equal(origin.authority,'RENDER_ONLY_BOUNDING_CENTER');
assert.ok(origin.sourcePointCount>=6);
assert.equal(JSON.stringify(entities),snapshot,'deriving a render origin must never mutate authoritative geometry');

const authoritativeA={x:6_000_000,y:2_000_000};
const authoritativeB={x:6_000_000.025,y:2_000_000};
const directFloatSeparation=Math.fround(authoritativeB.x)-Math.fround(authoritativeA.x);
assert.ok(Math.abs(directFloatSeparation-.025)>.01,'large absolute coordinates should demonstrate meaningful Float32 precision loss');

const localA=toRenderLocalXY(authoritativeA,origin);
const localB=toRenderLocalXY(authoritativeB,origin);
const localFloatSeparation=Math.fround(localB.x)-Math.fround(localA.x);
assert.ok(Math.abs(localFloatSeparation-.025)<1e-6,'render-local coordinates must preserve the centimeter-scale separation through Float32');
const roundTrip=fromRenderLocalXY(localB,origin);
assert.ok(Math.abs(roundTrip.x-authoritativeB.x)<1e-9);
assert.ok(Math.abs(roundTrip.y-authoritativeB.y)<1e-9);

const zero=deriveRenderLocalOrigin([]);
assert.deepEqual(zero,{x:0,y:0,authority:'RENDER_ONLY_BOUNDING_CENTER',sourcePointCount:0});

const viewer=fs.readFileSync('components/CompiledGraphViewer.tsx','utf8');
assert.match(viewer,/deriveRenderLocalOrigin\(visible\)/);
assert.match(viewer,/STRATUM_RENDER_LOCAL_ROOT/);
assert.match(viewer,/spatialRoot\.position\.set\(-renderOrigin\.x,0,-renderOrigin\.y\)/);
assert.match(viewer,/dataset\.renderOriginAuthority=renderOrigin\.authority/);
assert.match(viewer,/forEach\(l=>spatialRoot\.add\(groups\[l\]\)\)/);
assert.match(viewer,/p\.x-renderOrigin\.x,ly=p\.y-renderOrigin\.y/,'room polygon vertices must be localized before ShapeGeometry Float32 upload');
assert.match(viewer,/verts\[0\]\.x-renderOrigin\.x[\s\S]*verts\[0\]\.y-renderOrigin\.y/,'terrain review triangles must use localized vertex buffers');
assert.match(viewer,/e\.x-renderOrigin\.x,height\(e\)\+\.08,e\.y-renderOrigin\.y/,'drawing line vertices must be localized');
assert.match(viewer,/a\.x-renderOrigin\.x,height\(a\)\+\.65,a\.y-renderOrigin\.y/,'logical link vertices must be localized');
assert.match(viewer,/absoluteCenter\.x-renderOrigin\.x/,'camera fit must target render-local world coordinates');
assert.match(viewer,/selected\.x-origin\.x[\s\S]*selected\.y-origin\.y/,'selected-asset focus must target render-local coordinates');
assert.match(viewer,/renderedBox\.translate\(new THREE\.Vector3\(renderOrigin\.x,0,renderOrigin\.y\)\)/,'async model bounds must be converted back to authoritative coordinates before union');
assert.doesNotMatch(viewer,/localStorage\.setItem\([^\n]*renderOrigin/,'render origin is view-only and must never persist into the authoritative graph');

console.log('Render-local origin passed: authoritative project coordinates remain unchanged, million-meter coordinate precision is rebased only for Three.js, centimeter-scale separations survive Float32 upload, and camera/picking geometry stays coherent.');
