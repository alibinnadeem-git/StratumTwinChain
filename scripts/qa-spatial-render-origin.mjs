import assert from 'node:assert/strict';
import fs from 'node:fs';
import {deriveSpatialRenderOrigin,renderXY} from '../lib/spatial-render-origin.ts';

const survey=[
 {id:'a',layer:'L1',x:6000000,y:2000000,x2:6000020,y2:2000000,meta:{projectXYFrameId:'PROJECT_XY:survey',projectXYFrameMetric:true,coordinateUnits:'m_reviewed_pdf'}},
 {id:'b',layer:'L2',x:6000010,y:2000005,meta:{projectXYFrameId:'PROJECT_XY:survey',projectXYFrameMetric:true,coordinateUnits:'m_reviewed_pdf'}},
 {id:'c',layer:'L1',x:6000000,y:2000010,x2:6000020,y2:2000010,meta:{projectXYFrameId:'PROJECT_XY:survey',projectXYFrameMetric:true,coordinateUnits:'m_reviewed_pdf'}}
];
const before=JSON.stringify(survey);
const origin=deriveSpatialRenderOrigin(survey);
assert.equal(origin.enabled,true);
assert.equal(origin.frameId,'PROJECT_XY:survey');
assert.ok(Math.abs(origin.x-6000010)<1e-12);
assert.ok(Math.abs(origin.y-2000005)<1e-12);
assert.equal(origin.extentMeters,20);
const p0=renderXY(6000000,2000000,origin),p1=renderXY(6000020,2000000,origin);
assert.ok(Math.abs(p0.x+10)<1e-12);
assert.ok(Math.abs(p0.y+5)<1e-12);
assert.ok(Math.abs(p1.x-10)<1e-12);
assert.ok(Math.abs((p1.x-p0.x)-20)<1e-12,'render localization must preserve exact horizontal distances');
assert.equal(JSON.stringify(survey),before,'deriving/rendering a local origin must never mutate authoritative graph coordinates');

const small=deriveSpatialRenderOrigin([
 {id:'s1',layer:'L1',x:0,y:0,x2:20,y2:10,meta:{projectXYFrameId:'PROJECT_XY:local',projectXYFrameMetric:true,coordinateUnits:'m_reviewed_pdf'}}
]);
assert.equal(small.enabled,false);
assert.equal(small.reason,'COORDINATES_ALREADY_RENDER_SAFE');
assert.deepEqual(renderXY(10,5,small),{x:10,y:5});

const mixedFrames=deriveSpatialRenderOrigin([
 {id:'m1',layer:'L1',x:6000000,y:2000000,meta:{xyCoordinateFrame:'CAD_LOCAL_ENGINEERING:A',coordinateUnits:'m_dxf_design'}},
 {id:'m2',layer:'L1',x:500000,y:4200000,meta:{xyCoordinateFrame:'CAD_LOCAL_ENGINEERING:B',coordinateUnits:'m_dxf_design'}}
]);
assert.equal(mixedFrames.enabled,false);
assert.equal(mixedFrames.reason,'MULTIPLE_UNREGISTERED_METRIC_FRAMES');

const mixedUnits=deriveSpatialRenderOrigin([
 {id:'metric',layer:'L1',x:6000000,y:2000000,meta:{xyCoordinateFrame:'CAD_LOCAL_ENGINEERING:A',coordinateUnits:'m_dxf_design'}},
 {id:'sheet',layer:'L1',x:4,y:2,meta:{coordinateUnits:'sheet'}}
]);
assert.equal(mixedUnits.enabled,false);
assert.equal(mixedUnits.reason,'MIXED_OR_NON_METRIC_RENDER_GEOMETRY');

const nonSpatialIgnored=deriveSpatialRenderOrigin([
 ...survey,
 {id:'evidence',layer:'L0',x:0,y:0,meta:{nonSpatial:true,coordinateUnits:'sheet'}}
]);
assert.equal(nonSpatialIgnored.enabled,true,'non-spatial review records must not disable a valid render-local origin');

const viewer=fs.readFileSync('components/CompiledGraphViewer.tsx','utf8');
assert.match(viewer,/deriveSpatialRenderOrigin\(graph\.entities\)/);
assert.match(viewer,/dataset\.renderOriginEnabled/);
assert.match(viewer,/dataset\.renderOriginFrame/);
assert.match(viewer,/const rp=\(x:number,y:number\)=>renderXY\(x,y,renderOrigin\)/);
assert.match(viewer,/const render=rp\(e\.x,e\.y\)/);
assert.match(viewer,/verts\.map\(vertex=>rp\(vertex\.x,vertex\.y\)\)/);
assert.match(viewer,/visible\.flatMap\(e=>\{const a=rp\(e\.x,e\.y\)/);
assert.match(viewer,/horizontal=renderXY\(selected\.x,selected\.y,r\.renderOrigin/);
assert.doesNotMatch(viewer,/position\.set\(e\.x,/,'Three.js roots must not receive authoritative large X directly');
assert.doesNotMatch(viewer,/new THREE\.Vector3\(e\.x,/,'Three.js vector buffers must not receive authoritative large X directly');

console.log('Spatial render-local origin passed: one comparable large metric frame is localized near zero for WebGL, exact relative distances are preserved, authoritative coordinates are untouched, mixed/unregistered frames fail closed, and small coordinates remain unchanged.');
