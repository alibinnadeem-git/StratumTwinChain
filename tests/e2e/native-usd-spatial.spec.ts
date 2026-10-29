import {test,expect} from '@playwright/test';
import path from 'node:path';

test('native USDA import survives source archive and displays review-only geometry in Spatial',async({page})=>{
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
  return records.find(record=>record.name==='native-usd-cube.usda')||null;
 });
 expect(source?.sha256).toMatch(/^[0-9a-f]{64}$/);
 expect(source?.ext).toBe('usda');
 expect(source?.bytes?.byteLength).toBeGreaterThan(100);
 await page.goto('/spatial');
 const canvas=page.locator('canvas[aria-label="Interactive Spatial model"]');
 await expect(canvas).toBeVisible({timeout:25_000});
 await expect.poll(async()=>Number(await canvas.getAttribute('data-clickable-assets')||0),{timeout:25_000}).toBeGreaterThan(0);
 await expect(page.getByLabel('Imported object')).toContainText('native usd cube');
});
