import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  associateTerrainBreaklines,
  buildConstrainedElevationTriangles,
  constrainElevationTriangles,
  extractPositionedTerrainSlopeEvidence,
  resolveSlopeDerivedZ
} from '../lib/terrain-constraints.ts';
import {buildElevationTriangles} from '../lib/elevation-surface.ts';

const base=(id,x,y,zMeters,semantic='FINISHED_GRADE',triangulationEligible=true)=>({
  id,source:'C-2.pdf',page:1,x,y,zMeters,label:id,kind:'GRADE',semantic,triangulationEligible,
  confidence:.9,unit:'ft',unitAuthority:'EXPLICIT_LABEL',associationAuthority:'INLINE_TEXT',
  physicalTruth:false,reviewRequired:true
});

const controls=[
  base('fg-a',-2,-2,30.00),
  base('fg-b', 2,-2,30.10),
  base('fg-c', 2, 2,30.20),
  base('fg-d',-2, 2,30.10),
  base('tc-a', 0,-2,30.25,'TOP_OF_CURB',false),
  base('tc-b', 0, 2,30.35,'TOP_OF_CURB',false),
  base('fl-a',-1,-2,29.90,'FLOWLINE',false),
  base('fl-b',-1, 2,30.00,'FLOWLINE',false)
];

const unconstrained=buildElevationTriangles(controls,'GRADE');
assert.ok(unconstrained.length>=2,'finished-grade controls should form a review TIN before breakline filtering');

const breaklines=associateTerrainBreaklines({
  controls,
  segments:[
    {x:0,y:-2,x2:0,y2:2},
    {x:-1,y:-2,x2:-1,y2:2},
    {x:8,y:8,x2:9,y2:9}
  ],
  source:'C-2.pdf',page:1,maxEndpointDistance:.05
});
assert.equal(breaklines.length,2);
assert.equal(breaklines.find(line=>line.semantic==='TOP_OF_CURB')?.zMeters,30.25);
assert.equal(breaklines.find(line=>line.semantic==='TOP_OF_CURB')?.z2Meters,30.35);
assert.equal(breaklines.find(line=>line.semantic==='FLOWLINE')?.zMeters,29.90);
assert.ok(breaklines.every(line=>line.authority==='SOURCE_VECTOR_BETWEEN_TYPED_ELEVATION_CONTROLS'));
assert.ok(breaklines.every(line=>line.physicalTruth===false&&line.reviewRequired===true));

const constrained=constrainElevationTriangles(unconstrained,breaklines);
assert.ok(constrained.length<unconstrained.length,'grade triangles crossing typed curb/flowline breaklines must be removed');
assert.deepEqual(buildConstrainedElevationTriangles(controls,'GRADE',breaklines),constrained);

const noAssociation=associateTerrainBreaklines({
  controls,
  segments:[{x:5,y:5,x2:6,y2:6}],
  source:'C-2.pdf',page:1,maxEndpointDistance:.05
});
assert.equal(noAssociation.length,0,'an arbitrary source vector must not become a breakline without typed endpoint controls');

const slopeItems=[
  {text:'SLOPE 2.0%',x:.2,y:.2},
  {text:'RAMP SLOPE 1:12',x:.4,y:.3},
  {text:'DRAINAGE SLOPE 1/4" PER FT',x:.6,y:.4},
  {text:'20%',x:.7,y:.6},
  {text:'25% OPEN AREA',x:.8,y:.7}
];
const slopes=extractPositionedTerrainSlopeEvidence({
  items:slopeItems,source:'C-2.pdf',page:2,planeWidth:20,planeHeight:14
});
assert.equal(slopes.length,3,'generic percentages without slope/grade/ramp/drain semantics must not become terrain constraints');
assert.ok(Math.abs(slopes.find(item=>item.format==='PERCENT').slopeFraction-.02)<1e-12);
assert.ok(Math.abs(slopes.find(item=>item.format==='RATIO').slopeFraction-(1/12))<1e-12);
assert.ok(Math.abs(slopes.find(item=>item.format==='INCH_PER_FOOT').slopeFraction-(.25/12))<1e-12);
assert.ok(slopes.every(item=>item.directionKnown===false&&item.propagationEligible===false));
assert.ok(slopes.every(item=>item.authority==='SOURCE_SLOPE_TEXT_DIRECTION_UNRESOLVED'));

const unresolvedDirection=resolveSlopeDerivedZ({
  anchor:{x:0,y:0,zMeters:100,authority:'FG_CONTROL'},
  target:{x:10,y:0},
  slopeFraction:.02,
  direction:null,directionAuthority:null,
  xyUnits:'m_reviewed_pdf'
});
assert.equal(unresolvedDirection.status,'UNRESOLVED');
assert.match(unresolvedDirection.reason,/will not invent a direction/i);

const unresolvedUnits=resolveSlopeDerivedZ({
  anchor:{x:0,y:0,zMeters:100,authority:'FG_CONTROL'},
  target:{x:10,y:0},
  slopeFraction:.02,
  direction:'DOWNHILL',directionAuthority:'SOURCE_SLOPE_ARROW',
  xyUnits:'sheet'
});
assert.equal(unresolvedUnits.status,'UNRESOLVED');
assert.match(unresolvedUnits.reason,/metric XY frame/i);

const downhill=resolveSlopeDerivedZ({
  anchor:{x:0,y:0,zMeters:100,authority:'FG_CONTROL'},
  target:{x:10,y:0},
  slopeFraction:.02,
  direction:'DOWNHILL',directionAuthority:'SOURCE_SLOPE_ARROW',
  xyUnits:'m_reviewed_pdf'
});
assert.equal(downhill.status,'RESOLVED_REVIEW_CANDIDATE');
assert.ok(Math.abs(Number(downhill.zMeters)-99.8)<1e-12);
assert.ok(Math.abs(Number(downhill.horizontalDistanceMeters)-10)<1e-12);
assert.ok(Math.abs(Number(downhill.deltaZMeters)+.2)<1e-12);
assert.equal(downhill.authority,'SOURCE_ANCHORED_SLOPE_RELATION');
assert.equal(downhill.physicalTruth,false);
assert.equal(downhill.reviewRequired,true);

const uphill=resolveSlopeDerivedZ({
  anchor:{x:0,y:0,zMeters:100,authority:'FG_CONTROL'},
  target:{x:3,y:4},
  slopeFraction:.1,
  direction:'UPHILL',directionAuthority:'SOURCE_RAMP_ARROW',
  xyUnits:'m'
});
assert.ok(Math.abs(Number(uphill.zMeters)-100.5)<1e-12);

const compiler=fs.readFileSync('components/CompilerWorkspace.tsx','utf8');
assert.match(compiler,/associateTerrainBreaklines/);
assert.match(compiler,/buildConstrainedElevationTriangles/);
assert.match(compiler,/extractPositionedTerrainSlopeEvidence/);
assert.match(compiler,/terrain-breakline-candidate/);
assert.match(compiler,/terrain-slope-evidence/);
assert.match(compiler,/SOURCE_TYPED_BREAKLINE_ELEVATIONS/);
assert.match(compiler,/RELATIVE_SLOPE_ONLY/);

console.log('Constrained terrain passed: FG/FS build review surfaces, typed TC/FL source vectors become breaklines that block unsafe TIN interpolation, arbitrary vectors do not, slope text is preserved without direction invention, and Z propagates only from a source anchor through a metric XY run plus source-grounded direction.');
