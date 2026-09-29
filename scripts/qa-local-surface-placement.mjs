import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolveAssetPlacement} from '../lib/asset-placement.ts';
import {resolveElectricalComponent} from '../lib/electrical-component-library.ts';

const surfaceMeta={
  localReviewSurfaceZ:30.7848,
  localReviewSurfaceKind:'GRADE',
  localReviewSurfaceAuthority:'SOURCE_ELEVATION_TRIANGLE',
  localReviewSurfaceConfidence:.74,
  physicalElevationKnown:false,
  elevationKnown:false
};

const pedestal=resolveAssetPlacement({
  name:'EVSE-1',
  floor:'UNRESOLVED',
  z:0,
  meta:{...surfaceMeta,mountingType:'pedestal'}
});
assert.equal(pedestal.zAuthority,'SOURCE_SUPPORT_SURFACE_CANDIDATE');
assert.ok(Math.abs(pedestal.baseZ-30.7848)<1e-9);
assert.equal(pedestal.physicalTruth,false);
assert.equal(pedestal.recommendation?.kind,'EVSE_PEDESTAL_BASE_ON_SUPPORT_SURFACE');

const transformer=resolveAssetPlacement({
  name:'PAD MOUNT TRANSFORMER T-1',
  floor:'UNRESOLVED',
  z:0,
  meta:surfaceMeta
});
assert.equal(transformer.zAuthority,'SOURCE_SUPPORT_SURFACE_CANDIDATE');
assert.ok(Math.abs(transformer.baseZ-30.7848)<1e-9);

assert.equal(resolveElectricalComponent('Tesla Universal Wall Connector')?.twinShape,'evse');
assert.equal(resolveElectricalComponent('Tesla Universal Wall Connector')?.key,'evse-tesla-wall-connector-gen3');

const tesla=resolveAssetPlacement({
  name:'Tesla Universal Wall Connector',
  floor:'UNRESOLVED',
  z:0,
  meta:{...surfaceMeta,manufacturer:'Tesla',model:'Universal Wall Connector',mountingType:'wall-mounted',installationEnvironment:'outdoor'}
});
assert.equal(tesla.zAuthority,'SUPPORT_SURFACE_PLUS_MOUNTING_GUIDANCE');
assert.ok(Math.abs(tesla.baseZ-(30.7848+1.15))<1e-9);
assert.equal(tesla.physicalTruth,false);

const sourceOffset=resolveAssetPlacement({
  name:'PANEL LP-1',
  floor:'L1',
  z:0,
  meta:{...surfaceMeta,mountingBaseFromFloorMeters:1.2,mountingInstructionSource:'Approved project submittal'}
});
assert.equal(sourceOffset.zAuthority,'SUPPORT_SURFACE_PLUS_MOUNTING_GUIDANCE');
assert.ok(Math.abs(sourceOffset.baseZ-(30.7848+1.2))<1e-9);
assert.equal(sourceOffset.recommendation?.kind,'SOURCE_INSTALLATION_BASE_ON_REVIEW_SURFACE');

const designWins=resolveAssetPlacement({
  name:'PANEL LP-2',
  floor:'L2',
  z:0,
  meta:{...surfaceMeta,zResolutionStatus:'RESOLVED_DESIGN_CANDIDATE',zCandidateMeters:12.345,zResolutionConfidence:.91,zResolutionAuthority:'FLOOR_DATUM_PLUS_AFF'}
});
assert.equal(designWins.zAuthority,'SOURCE_DESIGN_CANDIDATE');
assert.ok(Math.abs(designWins.baseZ-12.345)<1e-9);

const unresolved=resolveAssetPlacement({
  name:'PAD MOUNT TRANSFORMER T-2',
  floor:'UNRESOLVED',
  z:0,
  meta:{physicalElevationKnown:false,elevationKnown:false}
});
assert.equal(unresolved.zAuthority,'UNRESOLVED');
assert.equal(unresolved.baseZ,0);

const viewer=fs.readFileSync('components/CompiledGraphViewer.tsx','utf8');
assert.match(viewer,/root\.position\.set\(e\.x,placement\.baseZ,e\.y\)/);
assert.match(viewer,/placement\.baseZ\+cfg\.offset\[1\]/);
assert.match(viewer,/zPlacementAuthority=placement\.zAuthority/);

const inspector=fs.readFileSync('components/SpatialAssetInspector.tsx','utf8');
assert.match(inspector,/Placement base candidate/);
assert.match(inspector,/Placement authority/);
assert.match(inspector,/placement\.zAuthority/);

console.log('Local support-surface placement passed: pedestal/floor-standing base placement, wall/OEM mounting composition, source offset composition, design-Z precedence, unresolved fail-closed behavior, and placement-driven rendering.');
