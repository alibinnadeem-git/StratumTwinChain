import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {expect,test} from '@playwright/test';

test('large compiler graph chunk storage yields between writes and retains atomic recovery pointers',async({page},testInfo)=>{
 if(testInfo.project.name!=='desktop-chromium')return;
 test.setTimeout(90000);
 await page.goto('/recovery.html');
 const module=ts.transpileModule(readFileSync('lib/spatial-chunked-graph.ts','utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).outputText;
 await page.addScriptTag({content:`const module={exports:{}};const exports=module.exports;${module};window.__spatialChunkTest=module.exports;`});
 const result=await page.evaluate(async()=>{
  const store=(window as any).__spatialChunkTest;
  let ticks=0;const clock=setInterval(()=>ticks++,1);
  const original={version:'1.2',createdAt:'2026-10-11T00:00:00Z',
   sources:[{name:'synthetic-large.pdf',sha256:'a'.repeat(64)}],
   entities:Array.from({length:12_288},(_,i)=>({id:'e'+i,source:'synthetic-large.pdf',layer:'L1',
     kind:'line',name:'source segment',x:i/100,y:i/110,z:0,
     meta:{sourceSha256:'a'.repeat(64),physicalTruth:false,reviewRequired:true}})),
   links:[],stats:{L0:1,L1:12288,L2:0,L3:0,L4:0}};
  const seen:number[]=[];
  await store.putChunkedGraph('current',original,(saved:number)=>seen.push(saved));
  const first=await store.getChunkedGraph('current');
  const copied=await store.copyChunkedGraphHead('current','latest');
  const lastGood=await store.getChunkedGraph('latest');
  const before=await store.getChunkedGraphHead('current');
  // A malformed incoming graph must not replace a complete revision.
  let rejected=false;
  try{await store.putChunkedGraph('current',{sources:[],entities:null})}catch{rejected=true}
  const after=await store.getChunkedGraphHead('current');
  clearInterval(clock);
  return{ticks,firstCount:first?.entities.length,lastCount:lastGood?.entities.length,
   source:first?.sources[0]?.name,copied,rejected,
   sameRevision:before?.revision===after?.revision,steps:seen.length,
   last:seen.at(-1),threshold:store.CHUNKED_GRAPH_THRESHOLD,batch:store.CHUNKED_GRAPH_BATCH};
 });
 expect(result).toMatchObject({firstCount:12288,lastCount:12288,source:'synthetic-large.pdf',
  copied:true,rejected:true,sameRevision:true,last:12288,threshold:10000,batch:256});
 expect(result.steps).toBeGreaterThanOrEqual(48);
 expect(result.ticks).toBeGreaterThan(0);
});
