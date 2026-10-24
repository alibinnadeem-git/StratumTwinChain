/** STRATUM Delta Wallbox 50 kW review: GLB envelope and scene manifest gate.
 * Run: node scripts/check-delta-wallbox-review.cjs
 * Verifies cabinet dimensions using actual vertex buffers, not only accessory bounds.
 */
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const names=['cabinet','dualgun','optional-estop'];
const expected=[0.650,1.020,0.250];
for(const name of names){
 const file=path.join(root,'public/models/oem/delta-dc-wallbox-50kw-202504-'+name+'-review.glb');
 const b=fs.readFileSync(file);
 assert.equal(b.subarray(0,4).toString(),'glTF');
 assert.equal(b.readUInt32LE(4),2);
 assert.equal(b.readUInt32LE(8),b.length);
 const jl=b.readUInt32LE(12),doc=JSON.parse(b.subarray(20,20+jl).toString());
 const binStart=20+jl+8;
 assert.equal(doc.asset.version,'2.0');
 assert.equal(doc.nodes[0].extras.status,'REVIEW_REQUIRED');
 assert.deepEqual(doc.nodes[0].extras.cabinetDimensionsMeters,expected);
 let lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity],count=0;
 for(const mesh of doc.meshes)for(const prim of mesh.primitives){
  const accessor=doc.accessors[prim.attributes.POSITION],view=doc.bufferViews[accessor.bufferView];
  assert.equal(accessor.componentType,5126);
  const stride=view.byteStride||12;
  for(let i=0;i<accessor.count;i++){
   const offset=binStart+(view.byteOffset||0)+(accessor.byteOffset||0)+i*stride;
   for(let j=0;j<3;j++){
    const v=b.readFloatLE(offset+j*4);
    assert(Number.isFinite(v));
    lo[j]=Math.min(lo[j],v);hi[j]=Math.max(hi[j],v);
   }count++;
  }
 }
 let size=hi.map((v,i)=>v-lo[i]);
 if(name==='cabinet'){
  for(let i=0;i<3;i++)assert(Math.abs(size[i]-expected[i])<0.001, 'cabinet envelope mismatch axis '+i+': '+size[i]);
  assert(Math.abs(lo[1])<0.001,'cabinet bottom must be local Y=0');
 }else{
  assert(size[0]>expected[0]&&size[1]>expected[1],'cable assembly must remain separate from cabinet envelope');
 }
 console.log('PASS',name, 'positions',count,'bbox_m',size.map(x=>x.toFixed(6)).join(' × '));
}
const registryText=fs.readFileSync(path.join(root,'lib/electrical-model-registry.ts'),'utf8');
assert.match(registryText,/evse-delta-dc-wallbox-50[^\n]*202504-dualgun-review\.glb/);
assert.match(registryText,/meterScaleBasis:'CABINET_WITH_ACCESSORIES'/);
const viewerText=fs.readFileSync(path.join(root,'components/CompiledGraphViewer.tsx'),'utf8');
assert.match(viewerText,/preserveCabinetAccessoryAssemblyMeters\(model,cfg\.dimensionsMeters,target/);
const normalizerText=fs.readFileSync(path.join(root,'lib/three-model-normalization.ts'),'utf8');
assert.match(normalizerText,/dimensionFitMode='CABINET_ENVELOPE_PRESERVE_ACCESSORIES_METERS'/);
console.log('PASS: dual gun default and meter-space preservation policy');
console.log('Review gate passed: visual identity and 2025-11-26 SKU remain unverified.');
