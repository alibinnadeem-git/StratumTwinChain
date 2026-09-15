import assert from 'node:assert/strict';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import ts from 'typescript';
const url=new URL(`../lib/.qa-alignment-${randomUUID()}.mjs`,import.meta.url);
try{
 await writeFile(url,ts.transpileModule(await readFile(new URL('../lib/sheet-alignment.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
 const {solveSheetTransform,applySheetTransform,restoreSheetCoordinates}=await import(url.href);
 const source=[{x:2,y:3},{x:6,y:3}],target=[{x:100,y:200},{x:100,y:208}];
 const t=solveSheetTransform(source,target,'L2',4.25);
 const e={id:'a',source:'plan',kind:'line',name:'wall',x:2,y:3,z:0,x2:6,y2:3,z2:0,vertices:source,meta:{sourceSha256:'abc',page:2}};
 const snapshot=JSON.stringify(e),aligned=applySheetTransform(e,t);
 assert.equal(JSON.stringify(e),snapshot,'source entity is immutable');
 assert.deepEqual([aligned.x,aligned.y,aligned.x2,aligned.y2],[100,200,100,208]);
 assert.equal(aligned.z,4.25);assert.equal(aligned.floor,'L2');assert.equal(aligned.meta.sourceSha256,'abc');assert.equal(aligned.meta.alignmentVerified,false);
 assert.deepEqual(applySheetTransform(aligned,t),aligned,'reapply does not compound transforms');
 const reset=solveSheetTransform(source,source,'L1',0),restored=applySheetTransform(aligned,reset);
 assert.equal(restoreSheetCoordinates(aligned).meta.sheetTransform,undefined);assert.deepEqual(restoreSheetCoordinates(aligned).vertices,e.vertices);assert.deepEqual(restored.vertices,e.vertices);assert.equal(restored.x,e.x);assert.equal(restored.y,e.y);
 assert.throws(()=>solveSheetTransform([source[0],source[0]],target,'L1',0));
 assert.throws(()=>solveSheetTransform(source,target,'UNRESOLVED',0));
 assert.throws(()=>solveSheetTransform(source,target,'L1',NaN));
 console.log('PASS: control point alignment, rotated scale, elevation, source immutability, idempotent reapply, restoration and invalid input guards');
}finally{await unlink(url)}
