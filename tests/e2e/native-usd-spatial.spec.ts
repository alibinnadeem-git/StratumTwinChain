import {test,expect} from '@playwright/test';
import path from 'node:path';

test('native USDA import survives source archive and displays review-only geometry in Spatial',async({page})=>{
 const browserErrors:string[]=[];
 page.on('console',m=>{if(['error','warning'].includes(m.type()))browserErrors.push(m.type()+': '+m.text().slice(0,600));});
 page.on('pageerror',e=>browserErrors.push('pageerror: '+e.message.slice(0,600)));
 await page.goto('/compiler');
 const picker=page.locator('input[type="file"][accept*=".usda"]').first();
 await expect(picker).toHaveCount(1);
 await picker.setInputFiles(path.resolve('tests/fixtures/spatial/native-usd-cube.usda'));
 await expect(page.locator('body')).toContainText('Source compilation updated:',{timeout:40_000});
 const source=await page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{
   const request=indexedDB.open('stratum-source-archive-v1',1);
   request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
  const records=await new Promise<any[]>((resolve,reject)=>{
   const tx=db.transaction('sources','readonly'),req=tx.objectStore('sources').getAll();
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });db.close();
  const record=records.find(record=>record.name==='native-usd-cube.usda');
  return record?{sha256:record.sha256,ext:record.ext,byteLength:record.bytes?.byteLength??0}:null;
 });
 expect(source?.sha256).toMatch(/^[0-9a-f]{64}$/);
 expect(source?.ext).toBe('usda');
 expect(source?.byteLength).toBeGreaterThan(100);
 await page.goto('/spatial');
 const canvas=page.locator('canvas[aria-label="Interactive Spatial model"]');
 await expect(canvas).toBeVisible({timeout:25_000});
 try{
  await expect.poll(async()=>Number(await canvas.getAttribute('data-clickable-assets')||0),{timeout:16_000}).toBeGreaterThan(0);
 }catch(error){
  const diagnostic=await page.evaluate(()=>{
   let graph:any={};try{graph=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}');}catch{}
   return{
    sources:(graph.sources||[]).map((s:any)=>({name:s.name,ext:s.ext,state:s.state})),
    imported:(graph.entities||[]).filter((e:any)=>e.kind==='imported-3d-model').map((e:any)=>({id:e.id,kind:e.kind,meta:e.meta})),
    canvas:Array.from(document.querySelectorAll('canvas[aria-label="Interactive Spatial model"]')).map((el:any)=>({...el.dataset})),
    notice:document.body.innerText.match(/3D IMPORT NEEDS ATTENTION[\\s\\S]{0,250}/)?.[0]||null,
    objectSelect:document.querySelector('select[aria-label="Imported object"]')?.textContent?.slice(0,350)
   };
  });
  console.log('NATIVE_USD_BROWSER_DIAGNOSTIC',JSON.stringify({diagnostic,browserErrors}).slice(0,12000));
  throw error;
 }
 await expect(page.getByLabel('Imported object')).toContainText('native usd cube');
});
