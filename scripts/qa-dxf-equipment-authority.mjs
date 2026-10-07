import assert from 'node:assert/strict';
import fs from 'node:fs';
import {dxfEquipmentSpatialAuthority} from '../lib/dxf-equipment-authority.ts';
import {isActionableReviewEntity,isIdentifiedProjectEquipment} from '../lib/spatial-ui-counts.ts';

const insert=dxfEquipmentSpatialAuthority('INSERT',90,true);
assert.equal(insert.kind,'cad-block');
assert.equal(insert.physicalAnchor,true);
assert.equal(insert.allowEntityZAsEquipmentZ,true);
assert.equal(insert.rotationDegrees,90);
assert.equal(insert.meta.spatialPlacementAuthority,'SOURCE_DXF_INSERT');
assert.equal(insert.meta.rotationAuthority,'SOURCE_DXF_INSERT_ROTATION');
assert.equal(insert.meta.cadPhysicalAnchor,true);

const unitlessInsert=dxfEquipmentSpatialAuthority('INSERT',-30,false);
assert.equal(unitlessInsert.physicalAnchor,true);
assert.equal(unitlessInsert.meta.spatialPlacementAuthority,'SOURCE_DXF_INSERT_UNITLESS_REVIEW_ONLY');
assert.equal(unitlessInsert.rotationDegrees,-30);

for(const type of ['TEXT','MTEXT']){
  const text=dxfEquipmentSpatialAuthority(type,37,true);
  assert.equal(text.kind,'cad-text');
  assert.equal(text.physicalAnchor,false);
  assert.equal(text.allowEntityZAsEquipmentZ,false);
  assert.equal(text.rotationDegrees,undefined,'text orientation must never become equipment rotation');
  assert.equal(text.meta.spatialPlacementAuthority,'SOURCE_DXF_TEXT_LABEL_POSITION_ONLY');
  assert.equal(text.meta.rotationAuthority,'TEXT_ORIENTATION_ONLY_NOT_EQUIPMENT');
  assert.equal(text.meta.sourceTextRotationDegrees,37);
  assert.equal(text.meta.cadPhysicalAnchor,false);
}

const cadText={
  id:'label-1',layer:'L2',kind:'cad-text',floor:'L1',
  meta:{cadPhysicalAnchor:false,physicalElevationKnown:false,elevationKnown:false,reviewRequired:true}
};
assert.equal(isIdentifiedProjectEquipment(cadText),false,'DXF text label must not count as a physical equipment object');
assert.equal(isActionableReviewEntity(cadText),true,'DXF text label remains actionable review evidence');

const cadBlock={
  id:'block-1',layer:'L2',kind:'cad-block',floor:'L1',
  meta:{cadPhysicalAnchor:true,physicalElevationKnown:false,elevationKnown:false,reviewRequired:true}
};
assert.equal(isIdentifiedProjectEquipment(cadBlock),true,'DXF INSERT/block may represent physical equipment when its label/type is recognized');

const compiler=fs.readFileSync('components/CompilerWorkspace.tsx','utf8');
assert.match(compiler,/dxfEquipmentSpatialAuthority/);
assert.match(compiler,/entityZ=spatial\.allowEntityZAsEquipmentZ\?z:0/,'text source Z must not populate equipment Z');
assert.match(compiler,/sourceTextZCandidateMeters:zInfo\.zMeters/,'text Z is preserved only as source-text provenance');
assert.match(compiler,/zPlacementAuthority:'DXF_TEXT_LABEL_Z_NOT_EQUIPMENT'/);
assert.match(compiler,/\.\.\.\(spatial\.rotationDegrees!==undefined\?\{rotation:spatial\.rotationDegrees\}:\{\}\)/,'only placement-authorized entities may populate rotation');
assert.match(compiler,/e\.meta\?\.cadPhysicalAnchor!==false/,'text labels must not generate derived L4 asset candidates');
assert.match(compiler,/cadBlockName:name/);
assert.match(compiler,/cadTextValue:name/);

const viewer=fs.readFileSync('components/CompiledGraphViewer.tsx','utf8');
assert.match(viewer,/e\.kind==="cad-text"\|\|e\.meta\?\.cadPhysicalAnchor===false/,'text labels must be excluded from model-mapped count');
assert.match(viewer,/e\.kind==='cad-text'&&e\.meta\?\.cadPhysicalAnchor===false/,'text labels must route through review-marker rendering');
assert.match(viewer,/fallbackShape\(e\);return/);

console.log('DXF equipment authority passed: INSERT blocks may authorize native placement/rotation, TEXT/MTEXT remain review-only identity evidence, text Z/rotation cannot become equipment XYZ, and CAD labels cannot create L4/3D equipment twins.');
