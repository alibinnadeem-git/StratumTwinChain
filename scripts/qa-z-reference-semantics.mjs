import assert from 'node:assert/strict';
import fs from 'node:fs';
import {extractZEvidenceFromText,resolveEntityZ} from '../lib/z-resolver.ts';
import {resolveAssetPlacement} from '../lib/asset-placement.ts';

const floor='LEVEL 2 F.F. EL. 14\'-0"';

const ambiguousEvidence=extractZEvidenceFromText(
  floor+'\nPANEL LP-2 4\'-0" AFF',
  {source:'E-201.pdf',floor:'L2'}
);
const ambiguous=resolveEntityZ(
  {id:'panel-a',name:'PANEL LP-2',source:'E-201.pdf',floor:'L2',confidence:.9,meta:{}},
  ambiguousEvidence
);
assert.equal(ambiguous.status,'RELATIVE_ONLY');
assert.equal(ambiguous.authority,'AFF_REFERENCE_UNSPECIFIED');
assert.equal(ambiguous.referencePoint,'UNSPECIFIED');
assert.equal(ambiguous.zMeters,null);

const centerEvidence=extractZEvidenceFromText(
  floor+'\nPANEL LP-2 CENTERLINE 4\'-0" AFF',
  {source:'E-201.pdf',floor:'L2'}
);
const center=resolveEntityZ(
  {id:'panel-c',name:'PANEL LP-2',source:'E-201.pdf',floor:'L2',confidence:.9,meta:{}},
  centerEvidence
);
assert.equal(center.status,'RESOLVED_DESIGN_CANDIDATE');
assert.equal(center.referencePoint,'CENTERLINE');
assert.ok(Math.abs(Number(center.zMeters)-5.4864)<1e-6);

const panelMeta={
  assetDimensionAuthority:'SOURCE_SPEC',
  assetDimensionsMeters:[.8,1.2,.25],
  zResolutionStatus:center.status,
  zCandidateMeters:center.zMeters,
  zCandidateReferencePoint:center.referencePoint,
  zResolutionConfidence:center.confidence,
  zResolutionAuthority:center.authority
};
const centeredPlacement=resolveAssetPlacement({name:'PANEL LP-2',floor:'L2',z:0,meta:panelMeta});
assert.equal(centeredPlacement.zAuthority,'SOURCE_DESIGN_CANDIDATE');
assert.equal(centeredPlacement.referencePoint,'CENTERLINE');
assert.ok(Math.abs(Number(centeredPlacement.referenceZ)-5.4864)<1e-6);
assert.ok(Math.abs(centeredPlacement.baseZ-4.8864)<1e-6);
assert.ok(Math.abs(centeredPlacement.topZ-6.0864)<1e-6);

for(const [reference,z,expectedBase] of [
  ['BASE',5,5],
  ['BOTTOM',5,5],
  ['TOP',5,3.8]
]){
  const placement=resolveAssetPlacement({
    name:'PANEL LP-2',floor:'L2',z:0,
    meta:{...panelMeta,zCandidateMeters:z,zCandidateReferencePoint:reference}
  });
  assert.equal(placement.referencePoint,reference);
  assert.ok(Math.abs(placement.baseZ-expectedBase)<1e-9);
}

const mountUnknown=resolveAssetPlacement({
  name:'PANEL LP-2',floor:'L2',z:0,
  meta:{...panelMeta,zCandidateMeters:5,zCandidateReferencePoint:'MOUNTING_POINT'}
});
assert.notEqual(mountUnknown.zAuthority,'SOURCE_DESIGN_CANDIDATE');

const mountKnown=resolveAssetPlacement({
  name:'PANEL LP-2',floor:'L2',z:0,
  meta:{...panelMeta,zCandidateMeters:5,zCandidateReferencePoint:'MOUNTING_POINT',mountingPointFromBaseMeters:.2}
});
assert.equal(mountKnown.zAuthority,'SOURCE_DESIGN_CANDIDATE');
assert.equal(mountKnown.referencePoint,'MOUNTING_POINT');
assert.ok(Math.abs(mountKnown.baseZ-4.8)<1e-9);

const sourceOrigin=resolveAssetPlacement({
  name:'TRANSFORMER T1',floor:'L2',z:0,
  meta:{
    assetDimensionAuthority:'SOURCE_SPEC',
    assetDimensionsMeters:[1.7,1.6,1.25],
    zResolutionStatus:'RESOLVED_DESIGN_CANDIDATE',
    zCandidateMeters:8.25,
    zCandidateReferencePoint:'SOURCE_ORIGIN',
    zResolutionConfidence:.96,
    zResolutionAuthority:'SOURCE_IFC_DESIGN_PLACEMENT'
  }
});
assert.equal(sourceOrigin.zAuthority,'SOURCE_DESIGN_CANDIDATE');
assert.equal(sourceOrigin.referencePoint,'SOURCE_ORIGIN');
assert.equal(sourceOrigin.baseZ,8.25);

const compiler=fs.readFileSync('components/CompilerWorkspace.tsx','utf8');
assert.match(compiler,/zCandidateReferencePoint:resolution\.referencePoint/);

const inspector=fs.readFileSync('components/SpatialAssetInspector.tsx','utf8');
assert.match(inspector,/AFF HEIGHT FOUND · REFERENCE POINT REQUIRED/);
assert.match(inspector,/Source Z reference/);

const viewer=fs.readFileSync('components/CompiledGraphViewer.tsx','utf8');
assert.match(viewer,/Z REFERENCE CANDIDATE · REVIEW REQUIRED/);
assert.match(viewer,/resolveAssetPlacement\(\{name:e\.name,floor:e\.floor,z:e\.z,meta:e\.meta\}/);

console.log('Vertical Z reference semantics passed: unspecified AFF fails closed; base/bottom/centerline/top/mounting-point/source-origin references remain distinct and convert to reviewable equipment base Z without claiming physical truth.');
