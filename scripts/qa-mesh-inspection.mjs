import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import ts from 'typescript';
import * as THREE from 'three';
const path = new URL(`../lib/.qa-mesh-${randomUUID()}.mjs`, import.meta.url);
try {
  const source = await readFile(new URL('../lib/mesh-inspection.ts', import.meta.url), 'utf8');
  await writeFile(path, ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText);
  const { createMeshInspection } = await import(path.href);
  const root = new THREE.Group(); root.position.set(13,-4,9); root.rotation.set(.2,.8,-.3); root.scale.set(2,3,.5);
  const group = new THREE.Group(); group.rotation.set(.4,.1,.9); group.scale.set(.3,2,1); root.add(group);
  const meshes = Array.from({length:12}, (_,i) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(.5 + i/7,1,.8), new THREE.MeshStandardMaterial());
    mesh.name = `Component ${i}`; mesh.position.set(i%3,Math.floor(i/3),i*.2); mesh.rotation.y = i*.2; group.add(mesh); return mesh;
  });
  const before = meshes.map(m=>({p:m.position.clone(),r:m.rotation.clone(),s:m.scale.clone(),parent:m.parent,geometry:Array.from(m.geometry.attributes.position.array),mask:m.layers.mask}));
  const model = createMeshInspection(root);
  assert.equal(model.details.length,12); assert.equal(model.canExplode,true);
  model.apply(1);
  const boxes=meshes.map(m=>new THREE.Box3().setFromObject(m));
  for(let i=0;i<boxes.length;i++) for(let j=i+1;j<boxes.length;j++) assert.equal(boxes[i].intersectsBox(boxes[j]),false,`overlap ${i}/${j}`);
  const displaced=meshes.map(m=>m.position.clone()); model.apply(1); meshes.forEach((m,i)=>assert.ok(m.position.equals(displaced[i])));
  model.apply(.5,'mesh-3'); meshes.forEach((m,i)=>assert.equal(m.layers.mask,i===2?before[i].mask:0));
  assert.equal(model.mesh('mesh-3'),meshes[2]); assert.equal(model.details[2].triangles,12);
  model.apply(0);
  meshes.forEach((m,i)=>{const b=before[i];assert.ok(m.position.equals(b.p));assert.ok(m.rotation.equals(b.r));assert.ok(m.scale.equals(b.s));assert.equal(m.parent,b.parent);assert.deepEqual(Array.from(m.geometry.attributes.position.array),b.geometry);assert.equal(m.layers.mask,b.mask);});
  model.apply(1,'mesh-2');model.restore();meshes.forEach((m,i)=>{assert.ok(m.position.equals(before[i].p));assert.equal(m.layers.mask,before[i].mask);});
  const nestedRoot = new THREE.Group(); const parent=meshes[0].clone(); const child=meshes[1].clone();parent.add(child);nestedRoot.add(parent);
  assert.equal(createMeshInspection(nestedRoot).canExplode,false);
  const skinnedRoot=new THREE.Group();skinnedRoot.add(new THREE.SkinnedMesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial()));
  assert.equal(createMeshInspection(skinnedRoot).canExplode,false);
  assert.equal(createMeshInspection(new THREE.Group()).details.length,0);
  console.log('PASS: transformed hierarchy, 12 nonoverlapping slots, isolation, repeat stability, exact restoration, source geometry preservation, unsupported hierarchy guards.');
} finally { await unlink(path).catch(()=>{}); }
