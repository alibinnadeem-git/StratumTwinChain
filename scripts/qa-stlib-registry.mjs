import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {SPATIAL_GENERIC_3D_MODELS,GENERIC_3D_MODEL_BY_CLASS,GENERIC_3D_MODEL_BY_ID,
 genericModelIdForPath,generic3dModelById,generic3dModelForClass,assertAppendOnlyGenericRegistry,validateLicensedOemModel} from '../lib/spatial-3d-model-registry.ts';
import {DEFAULT_ELECTRICAL_MODEL_REGISTRY,normalizeElectricalModelRegistry} from '../lib/electrical-model-registry.ts';
import {SPATIAL_ELECTRICAL_CLASS_MODEL_BINDINGS} from '../lib/spatial-electrical-class-model-bindings.ts';
const models=SPATIAL_GENERIC_3D_MODELS;
assert.equal(models.length,29,'17 existing + 12 queue models');
const hasId=new Set(),classes=new Map();
let legacy=0,built=0;
for(const m of models){
 assert.match(m.model_id,/^stlib-ele-[a-z0-9]+(?:-[a-z0-9]+)*-v[1-9][0-9]*$/);
 assert.equal(m.model_id.split('-v').at(-1),String(m.version));
 assert.ok(!hasId.has(m.model_id),'duplicate immutable id '+m.model_id);hasId.add(m.model_id);
 assert.ok(['hero','instanced'].includes(m.tier));assert.ok(['in-house','procedural','cc0'].includes(m.source.type));
 assert.ok(m.source.type!=='cc0'||/^https:\/\//.test(m.source.url||''),'CC0 must cite a URL');
 assert.ok(Boolean(m.license)&&m.supersedes===null&&m.version===1);
 assert.ok(Object.values(m.dims_w_h_d).every(v=>Number.isFinite(v)&&v>0));
 assert.match(m.file.sha256,/^[0-9a-f]{64}$/);
 assert.match(m.file.path,new RegExp('/'+m.model_id+'\\.(glb|gltf)$'));
 assert.ok(m.file.path.startsWith('/models/equipment/'),'generic models must never claim /models/oem');
 const dest=fs.readFileSync('public'+m.file.path),previous=fs.readFileSync('public'+m.legacy_file);
 assert.equal(createHash('sha256').update(dest).digest('hex'),m.file.sha256,m.model_id+' SHA256 mismatch');
 assert.equal(createHash('sha256').update(previous).digest('hex'),m.file.sha256,'legacy path differs: '+m.model_id);
 assert.equal(dest.length,previous.length);
 assert.equal(genericModelIdForPath(m.file.path),m.model_id);
 assert.equal(genericModelIdForPath(m.legacy_file),m.model_id);
 assert.equal(generic3dModelById(m.model_id)?.model_id,m.model_id);
 for(const id of m.serves_classes){
  assert.match(id,/^E-(?:0[1-9]|[1-5][0-9]|6[0-2])$/,'out of taxonomy '+id);
  assert.ok(!classes.has(id),'duplicate class assignment '+id);classes.set(id,m.model_id);
  assert.equal(generic3dModelForClass(id)?.model_id,m.model_id);
 }
 if(m.status==='LEGACY_GENERIC_VISUALIZATION')legacy++;else built++;
}
assert.equal(legacy,17);assert.equal(built,12);assert.equal(classes.size,42);
assert.equal(GENERIC_3D_MODEL_BY_ID.size,29);assert.equal(GENERIC_3D_MODEL_BY_CLASS.size,42);
assert.equal(genericModelIdForPath('/models/oem/abb-terra-360.glb'),null);
assert.equal(genericModelIdForPath(''),null);
assert.equal(generic3dModelForClass('E-32'),null,'missing bar must remain unresolved');
assert.equal(generic3dModelForClass('E-20'),null,'EV OEM candidate cannot claim Tier-1 class');
assert.equal(generic3dModelForClass('PV-MODULE'),null,'PV taxonomy gap remains open');
assert.equal(classes.get('E-05'),classes.get('E-06'));
assert.equal(classes.get('E-11'),classes.get('E-12'));
assert.equal(classes.get('E-21'),classes.get('E-24'));
assert.notEqual(classes.get('E-10'),genericModelIdForPath('/models/equipment/power-meter-representative.gltf'));
for(const binding of SPATIAL_ELECTRICAL_CLASS_MODEL_BINDINGS){
 const m=generic3dModelForClass(binding.typeId);
 assert.ok(m,binding.typeId);
 assert.equal(binding.modelId,m.model_id);
 assert.equal(binding.modelUrl,m.file.path);
 assert.equal(binding.variantId,m.variant_by_class[binding.typeId]);
}
const defaultPanel=DEFAULT_ELECTRICAL_MODEL_REGISTRY.find(x=>x.componentKey==='distribution-panel');
assert.equal(defaultPanel.modelUrl,'/models/equipment/panelboard-representative.gltf','activation unchanged');
assert.equal(defaultPanel.modelId,'stlib-ele-panelboard-representative-v1');
assert.equal(DEFAULT_ELECTRICAL_MODEL_REGISTRY.find(x=>x.componentKey==='evse-abb-terra-360')?.modelId,null,'OEM URL must not acquire stlib prefix');
const current=normalizeElectricalModelRegistry(DEFAULT_ELECTRICAL_MODEL_REGISTRY);
assert.equal(current.find(x=>x.componentKey==='main-switchboard')?.modelId,'stlib-ele-main-switchboard-v1');
const switched=DEFAULT_ELECTRICAL_MODEL_REGISTRY.map(x=>x.componentKey==='main-switchboard'?{...x,modelUrl:'/models/oem/example.glb'}:x);
assert.equal(normalizeElectricalModelRegistry(switched).find(x=>x.componentKey==='main-switchboard')?.modelId,null,'overridden URL may not retain stale ID');
assert.doesNotThrow(()=>assertAppendOnlyGenericRegistry(models,models));
assert.throws(()=>assertAppendOnlyGenericRegistry(models,models.slice(1)),/removed/);
assert.throws(()=>assertAppendOnlyGenericRegistry(models,models.map((m,i)=>i?m:{...m,license:'tampered'})),/mutated/);
assert.equal(validateLicensedOemModel({model_id:'oem-acme-abc123-v1',license_ref:'signed-contract',license_expiry:'2030-06-30',source:{type:'oem',url:'https://example.com/license'},file:{path:'/models/oem/oem-acme-abc123-v1.glb',sha256:'a'.repeat(64)},version:1,supersedes:null,serves_classes:['E-20']}),true);
assert.equal(validateLicensedOemModel({model_id:'oem-acme-abc123-v1',license_ref:'',license_expiry:'2030-06-30',source:{type:'oem',url:'https://example.com/license'},file:{path:'/models/oem/oem-acme-abc123-v1.glb',sha256:'a'.repeat(64)},version:1,supersedes:null,serves_classes:['E-20']}),false);
console.log('STLIB REGISTRY QA PASSED: '+models.length+' immutable generic IDs (17 existing + 12 new), 42 unique E-class bindings, 20 explicit unresolved class gaps; SHA256 real-byte verification on all canonical/alias files; OEM namespace gated; no activation.');
