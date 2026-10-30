import assert from 'node:assert/strict';
import fs from 'node:fs';
import {drawnPlanDimensions,drawnSymbolGeometry} from '../lib/drawn-footprint-placement.ts';
import {resolveAssetPlacement} from '../lib/asset-placement.ts';
import {enrichSpatialProjection} from '../lib/spatial-projection.ts';
import {DEFAULT_ELECTRICAL_MODEL_REGISTRY} from '../lib/electrical-model-registry.ts';

// Phase 21 contract (docs/SPATIAL_SOURCE_FIDELITY_PLAN.md): equipment sits on its drawn symbol and turns with
// it; at a reviewed drawing scale its plan size is the drawn size, height stays the library's; before that,
// sizes stay nominal. Geometry taken from the golden fixture's E-4 (lib/equipment-roster.ts output).
const ok=(label,condition)=>{assert.ok(condition,label);console.log(`✓ ${label}`)};
const near=(a,b,tolerance=1e-6)=>Math.abs(a-b)<=tolerance;
const SCALE=5.121;
const hp1={meta:{drawnFootprint:{x0:2.746,y0:-.8841,x1:2.8286,y1:-.8687,filled:true,relation:'BESIDE_LABEL',units:'SHEET'}}};
const unitPanel={meta:{drawnFootprint:{x0:-3.548,y0:-2.0975,x1:-3.533,y1:-2.0145,filled:true,relation:'BESIDE_LABEL',units:'SHEET'}}};
const ms1={meta:{drawnFootprint:{x0:2.3146,y0:-1.336,x1:2.4636,y1:-1.238,relation:'CONTAINS_LABEL',units:'SHEET'},
  lineupFootprint:{x0:2.1356,y0:-1.336,x1:2.6426,y1:-1.238},lineupSections:['DIST','MS1','P/S']}};
const metric=entity=>({...entity,meta:{...entity.meta,metricFrameMetersPerSheetUnit:SCALE}});

// 1. Where and which way, before any scale is confirmed: sheet units, the symbol's centre and long side.
const sheet=drawnSymbolGeometry(hp1);
ok('a panel bar is placed at its centre in sheet units',near(sheet.centerX,(2.746+2.8286)/2)&&near(sheet.centerY,(-.8841-.8687)/2)&&sheet.metric===false);
ok('a bar running along sheet x is not turned; one along sheet y is turned 90°',sheet.rotationDegrees===0&&drawnSymbolGeometry(unitPanel).rotationDegrees===90);
ok('a switchboard sits on its whole lineup, not just its own section',near(drawnSymbolGeometry(ms1).centerX,(2.1356+2.6426)/2)&&drawnSymbolGeometry(ms1).lineup&&drawnSymbolGeometry(ms1).sections.join('|')==='DIST|MS1|P/S');
ok('without a confirmed scale there is no drawn size: the library size stays',drawnPlanDimensions(hp1)===null);
ok('evidence in other units is not used',drawnSymbolGeometry({meta:{drawnFootprint:{...hp1.meta.drawnFootprint,units:'METERS'}}})===null);
ok('entities without a drawn symbol keep their own position',drawnSymbolGeometry({meta:{}})===null);

// 2. At the reviewed scale: metres, the same transform Apply drawing scale uses for x/y.
const ms1Metric=drawnSymbolGeometry(metric(ms1));
ok('the lineup centre scales with the sheet (x and y times the metres per sheet unit)',near(ms1Metric.centerX,(2.1356+2.6426)/2*SCALE)&&near(ms1Metric.centerY,(-1.336-1.238)/2*SCALE));
const ms1Size=drawnPlanDimensions(metric(ms1));
const inches=meters=>meters/.0254;
ok(`the MS1 lineup is ${inches(ms1Size.width).toFixed(1)}" × ${inches(ms1Size.depth).toFixed(1)}": DIST 36" + MS1 30" + P/S 36" by 20" deep, as on E-2`,Math.abs(inches(ms1Size.width)-102)<1.5&&Math.abs(inches(ms1Size.depth)-20)<.5);
const hp1Size=drawnPlanDimensions(metric(hp1));
ok(`the HP1 bar is ${inches(hp1Size.width).toFixed(1)}" × ${inches(hp1Size.depth).toFixed(1)}"`,Math.abs(inches(hp1Size.width)-16.7)<.5&&Math.abs(inches(hp1Size.depth)-3.1)<.3);
ok('a hairline depth is clamped to a 5 cm enclosure',drawnPlanDimensions(metric({meta:{drawnFootprint:{x0:0,y0:0,x1:.1,y1:.001,units:'SHEET'}}})).depth===.05);

// 3. Placement: drawn plan size at a reviewed scale; library height; OEM/source dimensions win.
const registry=DEFAULT_ELECTRICAL_MODEL_REGISTRY.find(item=>item.componentKey==='main-switchboard');
const placed=resolveAssetPlacement({name:'MS1',meta:{...metric(ms1).meta,libraryComponentKey:'main-switchboard'}},registry);
ok('placement reports the drawn symbol as the size authority, with its source',placed.dimensions.authority==='DRAWN_SYMBOL'&&/DIST \| MS1 \| P\/S/.test(placed.dimensions.source)&&/102" × 20"/.test(placed.dimensions.source));
ok('width and depth are drawn; height is the library height',near(placed.dimensions.width,ms1Size.width)&&near(placed.dimensions.depth,ms1Size.depth)&&near(placed.dimensions.height,registry.dimensionsMeters[1]));
ok('before the scale is confirmed, placement keeps the library size',resolveAssetPlacement({name:'MS1',meta:{...ms1.meta,libraryComponentKey:'main-switchboard'}},registry).dimensions.authority==='MODEL_REGISTRY');
ok('source or OEM dimensions beat a drawing',resolveAssetPlacement({name:'MS1',meta:{...metric(ms1).meta,dimensionsMeters:[2.7,2.29,.6]}},registry).dimensions.authority==='SOURCE_SPEC');

// 4. Projection stamps the drawn size on the graph, so the inspector and exports see the same numbers.
const projected=enrichSpatialProjection({entities:[{id:'ms1',name:'MS1',layer:'L2',kind:'text-asset-candidate',x:2.4*SCALE,y:-1.29*SCALE,floor:'L1',meta:{...metric(ms1).meta,page:4}}],links:[]},DEFAULT_ELECTRICAL_MODEL_REGISTRY);
const stamped=projected.entities[0].meta;
ok('projection records the drawn size and its authority',stamped.assetDimensionAuthority==='DRAWN_SYMBOL'&&near(stamped.assetDimensionsMeters[0],ms1Size.width)&&near(stamped.assetDimensionsMeters[2],ms1Size.depth));

// 5. Wiring in the viewer.
const viewer=fs.readFileSync('components/CompiledGraphViewer.tsx','utf8');
ok('library models and procedural envelopes are placed and turned from the drawn symbol',(viewer.match(/root\.rotation\.y=THREE\.MathUtils\.degToRad\(-at\.rotation\)/g)||[]).length===2&&/const placedAt=\(e:Entity\)=>\{const drawn=drawnSymbolGeometry\(e\)/.test(viewer));
ok('selecting equipment points the camera at its drawn symbol, with the review-layout offset',/drawn=drawnSymbolGeometry\(selected\),shown=drawn\?\{x:drawn\.centerX\+displayed\.x-selected\.x,y:drawn\.centerY\+displayed\.y-selected\.y\}:displayed/.test(viewer));
ok('in the entire-project layout a drawn symbol takes its entity\'s display offset',/return\{x:drawn\.centerX\+e\.x-source\.x,y:drawn\.centerY\+e\.y-source\.y,rotation:drawn\.rotationDegrees\}/.test(viewer));
ok('the banner says when sizes come from drawn symbols',/SIZED FROM DRAWN SYMBOLS · DRAWING SCALE APPLIED/.test(viewer)&&/Drawn, not measured — not physical truth\./.test(viewer));

console.log('\nDrawn-symbol placement, direction and size contract passed.');
