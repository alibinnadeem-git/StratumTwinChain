import assert from 'node:assert/strict';
import fs from 'node:fs';
import {associateDxfEquipmentLabels,dxfEquipmentTagFromLabel} from '../lib/dxf-block-label-association.ts';

const baseMeta={sourceType:'DXF',coordinateUnits:'m_dxf_design',xyCoordinateFrame:'CAD_LOCAL_ENGINEERING:plan.dxf',physicalTruth:false,reviewRequired:true};

const block={
  id:'block-1',source:'plan.dxf',layer:'L2',kind:'cad-block',name:'ANON_BLOCK_42',
  x:10,y:10,z:3.2,rotation:90,confidence:.96,floor:'L1',
  meta:{...baseMeta,cadPhysicalAnchor:true,spatialPlacementAuthority:'SOURCE_DXF_INSERT',rotationAuthority:'SOURCE_DXF_INSERT_ROTATION'}
};
const label={
  id:'text-1',source:'plan.dxf',layer:'L2',kind:'cad-text',name:'MSB-1 MAIN SWITCHBOARD',
  x:10.8,y:10.2,z:0,confidence:.92,floor:'L1',
  meta:{...baseMeta,cadPhysicalAnchor:false,spatialPlacementAuthority:'SOURCE_DXF_TEXT_LABEL_POSITION_ONLY',sourceTextRotationDegrees:15}
};

const associated=associateDxfEquipmentLabels([block,label]);
const outBlock=associated.find(item=>item.id==='block-1');
const outLabel=associated.find(item=>item.id==='text-1');
assert.equal(outBlock.x,10);assert.equal(outBlock.y,10);assert.equal(outBlock.z,3.2);assert.equal(outBlock.rotation,90,'identity association must not donate text geometry');
assert.equal(outBlock.name,'MSB-1 MAIN SWITCHBOARD');
assert.equal(outBlock.meta.assetTag,'MSB-1');
assert.equal(outBlock.meta.equipmentTag,'MSB-1');
assert.equal(outBlock.meta.dxfIdentityLabelId,'text-1');
assert.equal(outBlock.meta.dxfIdentityAssociationStatus,'SOURCE_RECONCILED_CANDIDATE');
assert.equal(outBlock.meta.dxfIdentityAssociationAuthority,'UNIQUE_NEAREST_DXF_INSERT');
assert.equal(outBlock.meta.physicalTruth,false);
assert.equal(outBlock.meta.physicalPositionVerified,false);
assert.equal(outBlock.meta.asBuiltAuthority,false);
assert.equal(outLabel.meta.dxfLabelAssociationStatus,'ASSOCIATED');
assert.equal(outLabel.meta.dxfAssociatedBlockId,'block-1');
assert.equal(outLabel.meta.cadPhysicalAnchor,false);
assert.equal(outLabel.rotation,undefined,'text orientation must remain non-spatial');

assert.equal(dxfEquipmentTagFromLabel('EVSE-12 TESLA WALL CONNECTOR'),'EVSE-12');
assert.equal(dxfEquipmentTagFromLabel('PANEL LP-1'),'LP-1');
assert.equal(dxfEquipmentTagFromLabel('MCC-A1'),'MCC-A1');
assert.equal(dxfEquipmentTagFromLabel('GENERATOR'),null);

const left={...block,id:'left',x:9.5,y:10,name:'ANON_A'};
const right={...block,id:'right',x:10.5,y:10,name:'ANON_B'};
const ambiguousLabel={...label,id:'amb-label',x:10,y:10,name:'EVSE-1 EV CHARGER'};
const ambiguous=associateDxfEquipmentLabels([left,right,ambiguousLabel]);
assert.equal(ambiguous.find(item=>item.id==='amb-label').meta.dxfLabelAssociationStatus,'AMBIGUOUS');
assert.equal(ambiguous.find(item=>item.id==='left').meta.dxfIdentityAssociationStatus,undefined);
assert.equal(ambiguous.find(item=>item.id==='right').meta.dxfIdentityAssociationStatus,undefined);

const transformerBlock={...block,id:'xfmr',name:'PAD MOUNT TRANSFORMER'};
const panelLabel={...label,id:'panel-label',name:'MSB-2 MAIN SWITCHBOARD',x:10.2,y:10.1};
const conflict=associateDxfEquipmentLabels([transformerBlock,panelLabel]);
assert.equal(conflict.find(item=>item.id==='panel-label').meta.dxfLabelAssociationStatus,'CONFLICT');
assert.equal(conflict.find(item=>item.id==='xfmr').name,'PAD MOUNT TRANSFORMER','conflicting family label must not overwrite block identity');

const exactEvseBlock={...block,id:'evse-block',name:'Tesla Universal Wall Connector',x:5,y:5,rotation:22};
const genericEvseLabel={...label,id:'evse-label',name:'EVSE-7 EV CHARGER',x:5.4,y:5.1};
const evse=associateDxfEquipmentLabels([exactEvseBlock,genericEvseLabel]);
const evseOut=evse.find(item=>item.id==='evse-block');
assert.match(evseOut.name,/EVSE-7 EV CHARGER/);
assert.match(evseOut.name,/Tesla Universal Wall Connector/,'compatible generic label should preserve exact block product text');
assert.equal(evseOut.rotation,22);
assert.equal(evseOut.meta.assetTag,'EVSE-7');

const otherFrameLabel={...label,id:'other-frame',meta:{...label.meta,xyCoordinateFrame:'CAD_LOCAL_ENGINEERING:other.dxf'}};
const frameSafe=associateDxfEquipmentLabels([block,otherFrameLabel]);
assert.equal(frameSafe.find(item=>item.id==='other-frame').meta.dxfLabelAssociationStatus,'UNRESOLVED');
assert.equal(frameSafe.find(item=>item.id==='block').meta?.dxfIdentityAssociationStatus,undefined);

const farLabel={...label,id:'far',x:20,y:20};
const far=associateDxfEquipmentLabels([block,farLabel]);
assert.equal(far.find(item=>item.id==='far').meta.dxfLabelAssociationStatus,'UNRESOLVED');

const duplicateLabel={...label,id:'text-2',x:10.9,y:10.25};
const duplicate=associateDxfEquipmentLabels([block,label,duplicateLabel]);
assert.equal(duplicate.find(item=>item.id==='block-1').meta.dxfIdentityLabelId,'text-1','identical duplicate label text may collapse to the closest native text item');
assert.equal(duplicate.find(item=>item.id==='text-2').meta.dxfLabelAssociationStatus,'ASSOCIATED');

const compiler=fs.readFileSync('components/CompilerWorkspace.tsx','utf8');
assert.match(compiler,/associateDxfEquipmentLabels\(entities\)/);
assert.ok(
  compiler.indexOf('associateDxfEquipmentLabels(entities)')<
  compiler.indexOf('function withAssetCandidates'),
  'DXF identity association must run before derived L4 asset candidates are created'
);
assert.match(compiler,/dxfIdentityAssociationStatus==='SOURCE_RECONCILED_CANDIDATE'/);
assert.match(compiler,/block\/label identity association/);

console.log('DXF block/label association passed: native INSERT geometry keeps XYZ/rotation, unique nearby text may contribute equipment identity/tag only, family conflicts and ambiguous blocks fail closed, frame isolation is enforced, and L4 candidates are created only after safe identity enrichment.');
