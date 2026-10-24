/* STRATUM: independent GLB envelope and safety gate for T1 authored visual components.
 * Run: node scripts/qa-visual-library-wave1.cjs
 * A passing gate checks binary validity and authored geometry envelope ONLY.
 * It never certifies OEM exactness or installation measurements.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/component-visual-quality-wave1.json'),'utf8'));
const registry=fs.readFileSync(path.join(root,'lib/electrical-model-registry.ts'),'utf8');
function inspect(file){
 const b=fs.readFileSync(file);
 assert(b.length>512&&b.subarray(0,4).toString('ascii')==='glTF','invalid glTF magic');
 assert.equal(b.readUInt32LE(4),2,'glTF 2.0 required');
 assert.equal(b.readUInt32LE(8),b.length,'GLB declared length mismatch');
 const jlen=b.readUInt32LE(12);
 assert.equal(b.readUInt32LE(16),0x4e4f534a,'JSON chunk must be first');
 const doc=JSON.parse(b.subarray(20,20+jlen).toString('utf8'));
 assert.equal(doc.asset.version,'2.0');
 assert.equal(doc.buffers.length,1,'external resources forbidden in T1 pack');
 const binaryPos=20+jlen;
 const binLen=b.readUInt32LE(binaryPos);
 assert.equal(b.readUInt32LE(binaryPos+4),0x004e4942,'BIN chunk required');
 const binStart=binaryPos+8;
 assert(binStart+binLen<=b.length,'BIN length invalid');
 assert(doc.nodes.length&&doc.meshes.length&&doc.meshes[0].primitives.length,'geometry required');
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 let triangleCount=0,vertices=0;
 for(const mesh of doc.meshes)for(const prim of mesh.primitives){
  assert.equal(prim.mode,4,'TRIANGLES only');
  const a=doc.accessors[prim.attributes.POSITION];
  assert.equal(a.componentType,5126,'float32 positions required');
  const v=doc.bufferViews[a.bufferView],stride=v.byteStride||12,offset=binStart+(v.byteOffset||0)+(a.byteOffset||0);
  assert(offset>=binStart&&offset+(a.count-1)*stride+12<=binStart+binLen,'invalid vertex range');
  for(let i=0;i<a.count;i++)for(let k=0;k<3;k++){
    const value=b.readFloatLE(offset+i*stride+k*4);
    assert(Number.isFinite(value),'non-finite vertices');
    min[k]=Math.min(min[k],value);max[k]=Math.max(max[k],value);
  }
  const ia=doc.accessors[prim.indices];
  assert(ia.count%3===0,'triangle index count required');
  assert([5123,5125].includes(ia.componentType),'index type invalid');
  triangleCount+=ia.count/3;vertices+=a.count;
 }
 return {doc,min,max,bounds:max.map((v,i)=>v-min[i]),triangleCount,vertices};
}
let mapped=0,held=0;
for(const item of manifest.models){
 const file=path.join(root,'public',item.url.replace(/^\/+/,''));assert(fs.existsSync(file),file);
 const stats=inspect(file),d=item.visualAssemblyBoundsMeters||item.referenceDimensionsMeters,goal=[d.width,d.height,d.depth];
 const relative=stats.bounds.map((v,i)=>Math.abs(v-goal[i])/goal[i]);
 assert(stats.triangleCount>100&&stats.triangleCount<=50000,'triangle budget outside limits: '+item.componentKey);
 assert(stats.doc.nodes[0]?.extras?.reviewStatus==='REVIEW_REQUIRED','provenance review gate missing');
 assert(stats.doc.nodes[0]?.extras?.componentKey===item.componentKey,'asset component key mismatch');
 assert(stats.doc.nodes[0]?.extras?.status==='VISUALIZATION_ONLY','do not release authoritative geometry');
 assert(stats.doc.materials?.length<=20,'material budget exceeded');
 // Small offsets from cabinet facings/trim are allowed; this is NOT OEM-dimensional certification.
 const maxTolerance=item.reviewStatus.startsWith('HELD_')?0.18:0.06;
 assert(Math.max(...relative)<=maxTolerance,'geometry envelope exceeds tolerance '+item.componentKey+' '+JSON.stringify(relative));
 const refLine=registry.split('\n').find(s=>s.includes("'"+item.componentKey+"':{modelUrl:"));
 if(item.reviewStatus==='MAPPED_ON_REVIEW_BRANCH'){
   assert(refLine?.includes(item.url),'expected registry default not mapped: '+item.componentKey);
   assert(refLine?.includes('dimensionsConfidence:.2'),'T1 assumption confidence must remain low');
   mapped++;
 }else{assert(!refLine?.includes(item.url),'held model must not be activated');held++;}
 console.log('PASS',item.componentKey,JSON.stringify(stats.bounds.map(v=>+v.toFixed(5))),stats.triangleCount,'triangles',item.reviewStatus);
}
console.log('T1 visual-review intake:',mapped,'mapped',held,'held; physical product matching STILL requires OEM submittal.');

