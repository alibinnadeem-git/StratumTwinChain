import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildEntityZConstraintGraph,solveZConstraintGraph} from '../lib/z-constraint-graph.ts';

const padMounted=buildEntityZConstraintGraph({
  id:'xfmr-1',name:'Transformer T1',source:'C-2.pdf',
  meta:{
    localReviewSurfaceZ:100,
    localReviewSurfaceKind:'GRADE',
    localReviewSurfaceAuthority:'SOURCE_ELEVATION_TRIANGLE',
    localReviewSurfaceConfidence:.9,
    supportBaseOffsetMeters:.1524,
    supportOffsetAuthority:'TAG_LINKED_SOURCE_SUPPORT_NOTE',
    supportOffsetConfidence:.94,
    supportOffsetEvidenceId:'support-1',
    supportOffsetEvidenceLabel:'XFMR T1 6" CONC PAD'
  }
});
assert.equal(padMounted.status,'RESOLVED_BASE_CANDIDATE');
assert.ok(Math.abs(Number(padMounted.baseZMeters)-100.1524)<1e-12);
assert.equal(padMounted.conflicts.length,0);
assert.equal(padMounted.frameGaps.length,0);
assert.ok(padMounted.relations.some(item=>item.id==='xfmr-1:support-to-base'&&Math.abs(item.deltaMeters-.1524)<1e-12));

const centerline=buildEntityZConstraintGraph({
  id:'panel-1',name:'Panel LP-1',source:'E-2.pdf',
  meta:{
    zCandidateMeters:5,
    zCandidateReferencePoint:'CENTERLINE',
    zResolutionStatus:'RESOLVED_DESIGN_CANDIDATE',
    zResolutionAuthority:'FLOOR_DATUM_PLUS_AFF_REFERENCE',
    zResolutionConfidence:.9,
    assetDimensionsMeters:[.8,2,.25],
    sourceZCoordinateFrame:'PROJECT_REVIEW_DATUM'
  }
});
assert.equal(centerline.status,'RESOLVED_BASE_CANDIDATE');
assert.ok(Math.abs(Number(centerline.baseZMeters)-4)<1e-12);
assert.ok(centerline.relations.some(item=>item.authority==='SOURCE_REFERENCE_TO_BASE:CENTERLINE'&&item.deltaMeters===-1));

const top=buildEntityZConstraintGraph({
  id:'panel-2',name:'Panel LP-2',source:'E-2.pdf',
  meta:{
    zCandidateMeters:6,
    zCandidateReferencePoint:'TOP',
    zResolutionStatus:'RESOLVED_DESIGN_CANDIDATE',
    zResolutionAuthority:'SOURCE_DIMENSION',
    zResolutionConfidence:.88,
    assetDimensionsMeters:[.8,1.5,.25]
  }
});
assert.ok(Math.abs(Number(top.baseZMeters)-4.5)<1e-12);

const sourceOrigin=buildEntityZConstraintGraph({
  id:'ifc-origin',name:'Pump P1',source:'model.ifc',
  meta:{
    sourceType:'IFC_STEP_PRODUCT',
    zCandidateMeters:1,
    zCandidateReferencePoint:'SOURCE_ORIGIN',
    zResolutionCoordinateFrame:'IFC_LOCAL_ENGINEERING:model.ifc',
    zResolutionAuthority:'SOURCE_IFC_DESIGN_PLACEMENT',
    zResolutionConfidence:.96
  }
});
assert.equal(sourceOrigin.status,'PARTIAL');
assert.equal(sourceOrigin.baseZMeters,null,'source origin must not silently become equipment base without an explicit origin-to-base transform');
assert.equal(sourceOrigin.relations.length,0);

const explicitOrigin=buildEntityZConstraintGraph({
  id:'ifc-origin-explicit',name:'Pump P2',source:'model.ifc',
  meta:{
    sourceType:'IFC_STEP_PRODUCT',
    zCandidateMeters:1,
    zCandidateReferencePoint:'SOURCE_ORIGIN',
    sourceOriginToBaseMeters:.25,
    zResolutionCoordinateFrame:'IFC_LOCAL_ENGINEERING:model.ifc',
    zResolutionAuthority:'SOURCE_IFC_DESIGN_PLACEMENT',
    zResolutionConfidence:.96
  }
});
assert.equal(explicitOrigin.status,'RESOLVED_BASE_CANDIDATE');
assert.ok(Math.abs(Number(explicitOrigin.baseZMeters)-1.25)<1e-12);

const conflicting=buildEntityZConstraintGraph({
  id:'conflict',name:'Equipment X',source:'E-3.pdf',
  meta:{
    localReviewSurfaceZ:100,
    localReviewSurfaceKind:'FINISHED_FLOOR',
    localReviewSurfaceAuthority:'SOURCE_ELEVATION_TRIANGLE',
    supportBaseOffsetMeters:.1,
    supportOffsetAuthority:'SOURCE_SUPPORT_BASE_OFFSET',
    zCandidateMeters:101,
    zCandidateReferencePoint:'BASE',
    zResolutionAuthority:'SOURCE_BASE_ELEVATION',
    zResolutionConfidence:.9,
    sourceZCoordinateFrame:'PROJECT_REVIEW_DATUM'
  }
},.15);
assert.equal(conflicting.status,'CONFLICT');
assert.ok(conflicting.conflicts.some(item=>item.deltaMeters>.8));
assert.equal(conflicting.baseZMeters,100.1,'first source-grounded path remains visible but conflict blocks authority');

const crossFrame=buildEntityZConstraintGraph({
  id:'ifc-cross',name:'IFC Transformer',source:'site.ifc',
  meta:{
    sourceType:'IFC_STEP_PRODUCT',
    localReviewSurfaceZ:100,
    localReviewSurfaceKind:'GRADE',
    localReviewSurfaceAuthority:'SOURCE_ELEVATION_TRIANGLE',
    supportBaseOffsetMeters:.15,
    supportOffsetAuthority:'SOURCE_SUPPORT_BASE_OFFSET',
    zCandidateMeters:1,
    zCandidateReferencePoint:'BASE',
    zResolutionCoordinateFrame:'IFC_LOCAL_ENGINEERING:site.ifc',
    zResolutionAuthority:'SOURCE_IFC_DESIGN_PLACEMENT',
    zResolutionConfidence:.96,
    ifcMapZCandidateMeters:101,
    ifcMapZAuthority:'SOURCE_IFC_MAP_CONVERSION',
    ifcMapCrsName:'EPSG:26910',
    ifcMapVerticalDatum:'NAVD88',
    ifcMapConversionAuthority:'IFC_MAP_CONVERSION'
  }
});
assert.equal(crossFrame.status,'RESOLVED_BASE_CANDIDATE');
assert.ok(Math.abs(Number(crossFrame.baseZMeters)-100.15)<1e-12);
assert.equal(crossFrame.conflicts.length,0,'local IFC and project support Z must not create a false numeric conflict across frames');
assert.ok(crossFrame.frameGaps.some(item=>item.fromFrame.includes('IFC_LOCAL_ENGINEERING')&&item.toFrame==='PROJECT_REVIEW_DATUM'));
assert.ok(crossFrame.relations.some(item=>item.kind==='FRAME_OFFSET'&&item.allowCrossFrame===true),'IFC map transform is an explicit correlated frame relation');

const direct=solveZConstraintGraph({
  entityId:'direct',
  baseNodeId:'base',
  toleranceMeters:.05,
  nodes:[
    {id:'a',kind:'SUPPORT_SURFACE',label:'A',valueMeters:10,coordinateFrame:'PROJECT',authority:'A',confidence:.9,lineageGroup:'A',physicalTruth:false,reviewRequired:true},
    {id:'b',kind:'SUPPORT_SURFACE',label:'B',valueMeters:11,coordinateFrame:'PROJECT',authority:'B',confidence:.9,lineageGroup:'B',physicalTruth:false,reviewRequired:true},
    {id:'base',kind:'ASSET_BASE',label:'Base',valueMeters:null,coordinateFrame:'PROJECT',authority:'DERIVED',confidence:0,lineageGroup:'X',physicalTruth:false,reviewRequired:true}
  ],
  relations:[
    {id:'a-base',from:'a',to:'base',kind:'EQUALS',deltaMeters:0,authority:'A_CHAIN',confidence:.9,lineageGroup:'A',evidence:['A'],allowCrossFrame:false,physicalTruth:false,reviewRequired:true},
    {id:'b-base',from:'b',to:'base',kind:'EQUALS',deltaMeters:0,authority:'B_CHAIN',confidence:.9,lineageGroup:'B',evidence:['B'],allowCrossFrame:false,physicalTruth:false,reviewRequired:true}
  ]
});
assert.equal(direct.status,'CONFLICT');
assert.ok(direct.conflicts.length>=1);

const compiler=fs.readFileSync('components/CompilerWorkspace.tsx','utf8');
assert.match(compiler,/buildEntityZConstraintGraph/);
assert.match(compiler,/zConstraintGraphStatus/);
assert.match(compiler,/zConstraintBaseCandidateMeters/);
assert.match(compiler,/zConstraintConflictCount/);
assert.match(compiler,/zConstraintFrameGapCount/);

const inspector=fs.readFileSync('components/SpatialAssetInspector.tsx','utf8');
assert.match(inspector,/Z constraint graph/);
assert.match(inspector,/Constraint nodes \/ relations/);
assert.match(inspector,/CONSTRAINT CONFLICT · REVIEW REQUIRED/);
assert.match(inspector,/VERTICAL FRAME REGISTRATION REQUIRED/);
assert.match(inspector,/does not establish measured\/as-built physical elevation/);

console.log('Z constraint graph passed: support+pad and reference-point relations solve explicitly, source-origin stays fail-closed without a transform, independent same-frame chains conflict, cross-frame chains stay un-compared without registration, IFC map conversion remains correlated source evidence, and Spatial exposes the complete review graph.');
