import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {Box3,Vector3} from 'three';
import {DEFAULT_ELECTRICAL_MODEL_REGISTRY} from '../lib/electrical-model-registry.ts';
import {SPATIAL_ELECTRICAL_CLASS_MODEL_BINDINGS,SPATIAL_ELECTRICAL_CLASS_MODEL_VARIANTS,electricalClassModelBinding} from '../lib/spatial-electrical-class-model-bindings.ts';
import manifest from '../docs/electrical-3d-queue-manifest-2026-10-10.json' with {type:'json'};
const bindings=SPATIAL_ELECTRICAL_CLASS_MODEL_BINDINGS;
assert.equal(new Set(bindings.map(x=>x.typeId)).size,bindings.length,'one binding per distinct A10 taxonomy class');
assert.equal(bindings.filter(x=>x.typeId==='E-05').length,1);
assert.equal(electricalClassModelBinding('E-05').modelUrl,electricalClassModelBinding('E-06').modelUrl);
assert.equal(electricalClassModelBinding('E-34').modelUrl,electricalClassModelBinding('E-48').modelUrl);
assert.equal(electricalClassModelBinding('E-40').modelUrl,electricalClassModelBinding('E-60').modelUrl);
assert.ok(!bindings.some(x=>x.typeId==='PV-ARRAY'),'PV class is not silently added to locked 62');
assert.equal(manifest.length,18);
let seen=0;
for(const entry of manifest){
 const file=path.resolve('public'+entry.uri),bytes=fs.readFileSync(file);
 assert.equal(bytes.length,entry.size_bytes,entry.name+' size');
 assert.ok(bytes.length>=3000&&bytes.length<=90000,entry.name+' <=90KB');
 assert.equal(bytes.toString('ascii',0,4),'glTF',entry.name+' GLB header');
 assert.equal(bytes.readUInt32LE(4),2,entry.name+' glTF version 2');
 assert.equal(bytes.readUInt32LE(8),bytes.length,'exact total length');
 const jsonLength=bytes.readUInt32LE(12);
 assert.equal(bytes.toString('ascii',16,20),'JSON');
 const json=JSON.parse(bytes.toString('utf8',20,20+jsonLength));
 const binOffset=20+jsonLength;
 assert.equal(bytes.readUInt32LE(binOffset+4),0x004e4942,'GLB binary chunk type');
 const byteLength=bytes.readUInt32LE(binOffset);
 assert.ok(json.bufferViews.every(view=>view.byteOffset+view.byteLength<=byteLength));
 assert.ok(json.nodes.some(node=>node.name===entry.modelAnchor),'named mounting origin expected');
 assert.ok(json.nodes.some(node=>node.extras?.licenceTier==='T1'&&node.extras?.authority==='VISUALIZATION_ONLY'));
 assert.ok(json.meshes.some(mesh=>mesh.primitives?.length>0));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const bounds=new Box3().setFromObject(gltf.scene).getSize(new Vector3()).toArray();
 assert.ok(bounds.every(v=>Number.isFinite(v)&&v>0),entry.name+' must have visible valid physical-size geometry');
 for(const id of entry.type_ids)assert.equal(electricalClassModelBinding(id)?.modelUrl,entry.uri,id+' class points to shared GLB');
 seen++;
}
for(const uri of SPATIAL_ELECTRICAL_CLASS_MODEL_VARIANTS['E-22'])assert.ok(fs.existsSync(path.resolve('public'+uri)));
assert.ok(electricalClassModelBinding('E-10')?.modelUrl.endsWith('meter-ct-cabinet.glb'));
for(const [key,suffix] of [['metering-cabinet','meter-ct-cabinet.glb'],['distribution-panel','panelboard-full.glb'],['vfd','vfd-starter.glb'],['fire-alarm','fire-alarm-control-panel.glb']]){
 const cfg=DEFAULT_ELECTRICAL_MODEL_REGISTRY.find(x=>x.componentKey===key);
 assert.ok(cfg?.modelUrl.endsWith(suffix),'legacy runtime registry family '+key);
 assert.match(cfg.license,/STRATUM-authored/);
}
assert.ok(DEFAULT_ELECTRICAL_MODEL_REGISTRY.find(x=>x.componentKey==='power-meter')?.modelUrl.endsWith('power-meter-representative.gltf'),'standalone meter remains separate from E-10 cabinet');
console.log('A10 queue: '+seen+' Tier-1 compact GLBs parsed in Three.js; exact-class distinct bindings, shared paths, GLB v2 structures, no authority assertions.');
