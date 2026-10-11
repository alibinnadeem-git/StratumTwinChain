import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {Box3,Vector3} from 'three';
import {SPATIAL_ELECTRICAL_CLASS_MODEL_BINDINGS,electricalClassModelBinding} from '../lib/spatial-electrical-class-model-bindings.ts';
import {selectTier1ModelVariant} from '../lib/spatial-tier1-model-variant.ts';
import {DEFAULT_ELECTRICAL_MODEL_REGISTRY} from '../lib/electrical-model-registry.ts';
import manifest from '../docs/electrical-3d-queue-manifest-2026-10-10.json' with {type:'json'};
assert.equal(manifest.length,12);
assert.equal(new Set(SPATIAL_ELECTRICAL_CLASS_MODEL_BINDINGS.map(x=>x.typeId)).size,SPATIAL_ELECTRICAL_CLASS_MODEL_BINDINGS.length,'exactly one registry binding per class');
assert.equal(electricalClassModelBinding('E-05').modelUrl,electricalClassModelBinding('E-06').modelUrl);
assert.equal(electricalClassModelBinding('E-34').modelUrl,electricalClassModelBinding('E-48').modelUrl);
assert.equal(electricalClassModelBinding('E-40').modelUrl,electricalClassModelBinding('E-60').modelUrl);
assert.equal(electricalClassModelBinding('E-10').variantId,'E-10');
assert.equal(electricalClassModelBinding('E-22').variantId,'E-22-ELBOW');
assert.equal(electricalClassModelBinding('PV-MODULE'),undefined,'do not silently invent PV class');
for(const item of manifest){
 const binary=fs.readFileSync('public'+item.uri);
 assert.equal(binary.length,item.sizeBytes,item.name+' exact binary length');
 assert.equal(binary.toString('ascii',0,4),'glTF');
 assert.equal(binary.readUInt32LE(4),2);
 assert.equal(binary.readUInt32LE(8),binary.length);
 assert.equal(binary.readUInt32LE(16),0x4e4f534a);
 const jsonLength=binary.readUInt32LE(12);
 const json=JSON.parse(binary.toString('utf8',20,20+jsonLength));
 assert.equal(json.materials.length,item.materials);
 assert.ok(json.materials.length<=4);
 assert.equal(json.meshes.length>0,true);
 assert.equal(json.asset.version,'2.0');
 assert.ok(!JSON.stringify(json).match(/Tesla|Siemens|Schneider|ABB|Eaton|Leviton|Lutron|Kempower|Alpitronic/i),
    'No OEM identifying information should be embedded in generic geometry');
 const scene=(await new GLTFLoader().parseAsync(binary.buffer.slice(binary.byteOffset,binary.byteOffset+binary.byteLength),'')).scene;
 for(const variant of item.variants){
  assert.equal(selectTier1ModelVariant(scene,variant),true,item.name+' '+variant);
  const nodes=[];scene.traverse(object=>{if(object.userData?.variantId===variant)nodes.push(object);});
  assert.equal(nodes.length,1);
  const v=nodes[0],bounds=new Box3().setFromObject(v),size=bounds.getSize(new Vector3());
  assert.ok(size.toArray().every(x=>Number.isFinite(x)&&x>0));
  const anchors=[];v.traverse(object=>{if(['mount_face','power_in','ground_lug','conduit_entry'].includes(object.name))anchors.push(object.name);});
  assert.ok(anchors.includes('mount_face'));
  if(!['luminaire-family','wall-device-plate','ceiling-device-puck'].includes(item.name))
   for(const a of ['power_in','ground_lug','conduit_entry'])assert.ok(anchors.includes(a),item.name+' missing '+a);
  const approx=.05;
  if(item.mount==='wall_back_face')assert.ok(bounds.min.z>=-approx,item.name+' wall mount must not protrude behind back plane');
  if(item.mount==='ceiling_plane')assert.ok(bounds.max.y<=approx,item.name+' cannot float above ceiling');
  if(item.mount==='floor_center')assert.ok(bounds.min.y>=-approx,item.name+' cannot be below floor');
  for(const binding of SPATIAL_ELECTRICAL_CLASS_MODEL_BINDINGS.filter(x=>x.variantId===variant))
   assert.equal(binding.modelUrl,item.uri,binding.typeId+' must share correct model path');
 }
 assert.ok(item.triangles <= (item.name==='wall-device-plate'||item.name==='ceiling-device-puck'?300:3000));
 const max=item.name==='wall-device-plate'||item.name==='ceiling-device-puck'?5000:90000;
 assert.ok(binary.length<=max,item.name+' under size budget');
 assert.ok(json.nodes.some(n=>typeof n.extras?.variantId==='string'),'variant groups must be named');
 console.log('TIER1-QA '+JSON.stringify({file:item.name,bytes:binary.length,tris:item.triangles,materials:item.materials,variants:item.variants,mount:item.mount}));
}
assert.equal(DEFAULT_ELECTRICAL_MODEL_REGISTRY.find(x=>x.componentKey==='distribution-panel').modelUrl.endsWith('panelboard-representative.gltf'),true,
 'candidates must not auto-activate live registry');
console.log('A10 reference-spec queue: 12 family GLBs parsed, shared variants and anchors verified; no lifecycle/placement authority.');
