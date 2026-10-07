import assert from 'node:assert/strict';
import fs from 'node:fs';
import {deriveSpatialEvidenceEnvelope} from '../lib/spatial-evidence-envelope.ts';
import {resolveSpatialModel} from '../lib/spatial-model-resolution.ts';
import {DEFAULT_ELECTRICAL_MODEL_REGISTRY} from '../lib/electrical-model-registry.ts';

const zGraph={
  status:'RESOLVED_BASE_CANDIDATE',
  baseZMeters:10.15,
  nodes:[
    {id:'support',coordinateFrame:'PROJECT_REVIEW_DATUM',valueMeters:10,lineageGroup:'SUPPORT:surface-a'},
    {id:'base',coordinateFrame:'PROJECT_REVIEW_DATUM',valueMeters:10.15,lineageGroup:'ENTITY:evse-1'}
  ],
  relations:[
    {id:'offset',lineageGroup:'SUPPORT_OFFSET:pad-note-1'}
  ],
  conflicts:[],
  frameGaps:[]
};

const pdfEntity={
  id:'evse-1',name:'EVSE-1 EV CHARGER',source:'Electrical Plan.pdf',x:2.1,y:.95,z:0,
  meta:{
    sourceSha256:'a'.repeat(64),page:2,
    coordinateUnits:'m_reviewed_pdf',
    metricFrameMetersPerSheetUnit:.5,
    metricFrameAuthority:'HUMAN_REVIEWED_CORROBORATED_PDF_SCALE',
    scaleValidationEvidence:{
      status:'CORROBORATED',
      witnesses:[
        {confidence:.9,metersPerNormalizedSheetUnit:.5,type:'DIMENSION_STRING',label:'10 FT'},
        {confidence:.84,metersPerNormalizedSheetUnit:.51,type:'GRAPHIC_SCALE',label:'0-10-20 FT'}
      ]
    },
    symbolAnchorStatus:'RESOLVED_REVIEW_CANDIDATE',
    spatialPlacementAuthority:'SOURCE_VECTOR_SYMBOL_ANCHOR',
    manufacturer:'Tesla',model:'Universal Wall Connector Gen 3',
    zConstraintGraph:zGraph,
    physicalTruth:false,reviewRequired:true
  }
};
const model=resolveSpatialModel(pdfEntity,DEFAULT_ELECTRICAL_MODEL_REGISTRY);
assert.equal(model.componentKey,'evse-tesla-wall-connector-gen3');
const envelope=deriveSpatialEvidenceEnvelope(pdfEntity,model);
assert.equal(envelope.readiness,'DESIGN_3D_COORDINATION_CANDIDATE');
assert.equal(envelope.horizontal.state,'RESOLVED_CANDIDATE');
assert.equal(envelope.horizontal.metricCoordinateKnown,true);
assert.equal(envelope.horizontal.scaleWitnessCount,2);
assert.ok(Math.abs(envelope.horizontal.scaleRelativeDeviationMax-.02)<1e-12);
assert.ok(envelope.horizontal.scaleContributionMeters!==null&&envelope.horizontal.scaleContributionMeters>0);
assert.equal(envelope.horizontal.totalUncertaintyBoundMeters,null,'scale spread is not promoted into a fabricated total XY uncertainty');
assert.equal(envelope.vertical.state,'RESOLVED_CANDIDATE');
assert.equal(envelope.vertical.baseCandidateMeters,10.15);
assert.equal(envelope.vertical.lineageGroupCount,2);
assert.equal(envelope.vertical.totalUncertaintyBoundMeters,null,'resolved Z must not invent a vertical uncertainty bound');
assert.equal(envelope.geometry.state,'EXACT_PRODUCT_VISUALIZATION');
assert.equal(envelope.physicalTruth,false);
assert.equal(envelope.physicalClashAuthority,false);
assert.equal(envelope.asBuiltAuthority,false);

const explicitAccuracy=deriveSpatialEvidenceEnvelope({
  ...pdfEntity,id:'surveyed',
  meta:{...pdfEntity.meta,horizontalAccuracyMeters:.025,verticalAccuracyMeters:.04}
},model);
assert.equal(explicitAccuracy.horizontal.totalUncertaintyBoundMeters,.025);
assert.equal(explicitAccuracy.vertical.totalUncertaintyBoundMeters,.04);

const dxf2d=deriveSpatialEvidenceEnvelope({
  id:'dxf-panel',name:'PANELBOARD LP-1',source:'Electrical.dxf',x:30.48,y:15.24,z:0,
  meta:{
    sourceType:'DXF',coordinateUnits:'m_dxf_design',
    xyCoordinateFrame:'CAD_LOCAL_ENGINEERING:Electrical.dxf',
    xyPlacementAuthority:'SOURCE_DXF_INSUNITS',
    zConstraintGraph:{status:'UNRESOLVED',baseZMeters:null,nodes:[],relations:[],conflicts:[],frameGaps:[]},
    physicalTruth:false,reviewRequired:true
  }
},resolveSpatialModel({name:'PANELBOARD LP-1',meta:{}},DEFAULT_ELECTRICAL_MODEL_REGISTRY));
assert.equal(dxf2d.horizontal.state,'RESOLVED_CANDIDATE');
assert.equal(dxf2d.vertical.state,'UNRESOLVED');
assert.equal(dxf2d.readiness,'DESIGN_2D_COORDINATION_CANDIDATE');

const ambiguous=deriveSpatialEvidenceEnvelope({
  ...pdfEntity,id:'ambiguous',
  meta:{...pdfEntity.meta,symbolAnchorStatus:'AMBIGUOUS'}
},model);
assert.equal(ambiguous.horizontal.state,'CONFLICT');
assert.equal(ambiguous.readiness,'REVIEW_BLOCKED');
assert.match(ambiguous.blockingReasons.join(' '),/ambiguous/i);

const frameGap=deriveSpatialEvidenceEnvelope({
  ...pdfEntity,id:'frame-gap',
  meta:{...pdfEntity.meta,zConstraintGraph:{...zGraph,baseZMeters:null,status:'PARTIAL',frameGaps:[{reason:'registration needed',fromFrame:'IFC_LOCAL',toFrame:'NAVD88'}]}}
},model);
assert.equal(frameGap.vertical.frameGapCount,1);
assert.equal(frameGap.readiness,'REVIEW_BLOCKED');

const zConflict=deriveSpatialEvidenceEnvelope({
  ...pdfEntity,id:'z-conflict',
  meta:{...pdfEntity.meta,zConstraintGraph:{...zGraph,status:'CONFLICT',baseZMeters:null,conflicts:[{deltaMeters:.42,reason:'same-frame chains disagree'}]}}
},model);
assert.equal(zConflict.vertical.state,'CONFLICT');
assert.equal(zConflict.vertical.observedConflictSpreadMaxMeters,.42);
assert.equal(zConflict.vertical.totalUncertaintyBoundMeters,null,'conflict spread is evidence disagreement, not statistical uncertainty');
assert.equal(zConflict.readiness,'REVIEW_BLOCKED');

const unitless=deriveSpatialEvidenceEnvelope({
  id:'unitless',name:'MCC-1',source:'Legacy.dxf',x:4,y:-2,z:0,
  meta:{sourceType:'DXF',coordinateUnits:'dxf_unitless_display',xyPlacementAuthority:'UNITLESS_NORMALIZED_REVIEW_ONLY'}
},null);
assert.equal(unitless.horizontal.metricCoordinateKnown,false);
assert.equal(unitless.readiness,'SOURCE_ONLY');

const inspector=fs.readFileSync('components/SpatialAssetInspector.tsx','utf8');
const viewer=fs.readFileSync('components/CompiledGraphViewer.tsx','utf8');
assert.match(inspector,/deriveSpatialEvidenceEnvelope/);
assert.match(inspector,/SPATIAL EVIDENCE ·/);
assert.match(inspector,/Spatial evidence envelope/);
assert.match(inspector,/Physical clash authority remains false/);
assert.match(inspector,/does not fabricate ± tolerances/);
assert.match(viewer,/attachSpatialEvidence/);
assert.match(viewer,/coordinationReadiness/);
assert.match(viewer,/horizontalUncertaintyBoundMeters/);
assert.match(viewer,/verticalUncertaintyBoundMeters/);
assert.match(viewer,/physicalClashAuthority=false/);

console.log('Spatial evidence envelope passed: design-coordinate readiness is separated from physical truth, conflicts/frame gaps block 3D coordination, scale residual is reported only as a contribution, explicit source accuracy is preserved, and no synthetic total XY/Z uncertainty is invented.');
