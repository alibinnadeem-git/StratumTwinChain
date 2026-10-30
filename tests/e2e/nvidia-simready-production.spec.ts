import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/** Browser-local integration against actual deployed STRATUM. No tenant session, no
 * production project mutations, no backend writes, no approved-geometry claims. */
test('real NVIDIA SimReady layer archive imports, selects and survives reload in production',async({page},testInfo)=>{
 const root=path.resolve('.simready-qa-fixtures/nvidia-simready');
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
 const source=path.resolve(manifest.test_archive);
 expect(manifest.source).toBe('https://huggingface.co/datasets/nvidia/simready-assets');
 expect(manifest.license).toBe('CC BY 4.0');
 expect(manifest.revision).toMatch(/^[a-f0-9]{40}$/);
 expect(manifest.payload_files).toBeGreaterThan(0);
 expect(manifest.texture_files).toBeGreaterThan(0);
 expect(manifest.test_archive_bytes).toBeGreaterThan(10000);
 const errors:string[]=[];
 page.on('pageerror',e=>errors.push(e.message.slice(0,500)));
 page.on('console',msg=>{if(msg.type()==='error'&&/USD|Spatial|3D|model/i.test(msg.text()))errors.push(msg.text().slice(0,500));});
 await page.goto('/compiler');
 await expect(page.locator('input[type="file"][accept*=".usdz"]')).toHaveCount(1);
 await page.locator('input[type="file"][accept*=".usdz"]').setInputFiles(source);
 await expect(page.locator('body')).toContainText('Source compilation updated:',{timeout:65_000});
 const before=await page.evaluate(()=>{
  const graph=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}');
  const item=(graph.entities||[]).find((e:any)=>e.kind==='imported-3d-model');
  return {sources:graph.sources?.map((s:any)=>({name:s.name,ext:s.ext,state:s.state})),item:item?{id:item.id,name:item.name,meta:item.meta}:null};
 });
 expect(before.item).not.toBeNull();
 expect(before.item?.meta.sourceType).toBe('USDZ');
 expect(before.item?.meta.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
 expect(before.item?.meta.physicalTruth).toBe(false);
 expect(before.item?.meta.reviewRequired).toBe(true);
 expect(before.item?.meta.modelBoundsUnitAuthority).toBe('UNVERIFIED_USD_SCENE_UNITS');
 await page.goto('/spatial');
 const canvas=page.locator('canvas[aria-label="Interactive Spatial model"]');
 await expect(canvas).toBeVisible({timeout:30_000});
 await expect.poll(async()=>Number(await canvas.getAttribute('data-clickable-assets')||0),{timeout:45_000}).toBeGreaterThan(0);
 await expect(page.getByLabel('Imported object')).toContainText('nvidia tool hammer');
 await expect(page.getByText('3D IMPORT NEEDS ATTENTION')).toHaveCount(0);
 const beforeReload=await canvas.evaluate((el:HTMLCanvasElement)=>({...el.dataset}));
 const x=Number(beforeReload.primaryHitX),y=Number(beforeReload.primaryHitY);
 expect(Number.isFinite(x)&&Number.isFinite(y)).toBe(true);
 await canvas.click({position:{x,y},force:true});
 await expect(canvas).toHaveAttribute('data-selected-asset',before.item!.id,{timeout:10_000});
 const screenshot=path.join(testInfo.outputDir,'real-nvidia-simready-production.png');
 await page.screenshot({path:screenshot,fullPage:false});
 await page.reload();
 await expect(canvas).toBeVisible({timeout:25_000});
 await expect.poll(async()=>Number(await canvas.getAttribute('data-clickable-assets')||0),{timeout:40_000}).toBeGreaterThan(0);
 const after=await page.evaluate(()=>{
  const graph=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}');
  return (graph.entities||[]).find((e:any)=>e.kind==='imported-3d-model')?.meta?.sourceSha256||null;
 });
 expect(after).toBe(before.item!.meta.sourceSha256);
 const result={origin:process.env.STRATUM_UAT_BASE_URL,license:manifest.license,source:manifest.source,revision:manifest.revision,asset:manifest.asset,sourceFiles:manifest.files,payloadFiles:manifest.payload_files,textureFiles:manifest.texture_files,uncontainedReferences:manifest.uncontained_references,sourceSha256:after,canvasBeforeReload:beforeReload,canvasAfterReload:await canvas.evaluate((el:HTMLCanvasElement)=>({...el.dataset})),browserErrors:errors};
 console.log('NVIDIA_SIMREADY_PRODUCTION_RESULT',JSON.stringify(result));
 expect(errors.filter(s=>/usd|3d|spatial/i.test(s))).toEqual([]);
});
