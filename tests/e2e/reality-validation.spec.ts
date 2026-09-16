import {expect,test} from '@playwright/test';

test('Reality Validation keeps Designed Observed and Verified states visibly separate',async({page})=>{
 await page.goto('/reality');
 await expect(page.getByRole('heading',{name:'Designed. Observed. Verified—kept deliberately separate.'})).toBeVisible();
 await expect(page.getByText('REFERENCE DATA · HITL · READ-ONLY')).toBeVisible();
 await expect(page.getByText('Observed never overwrites Verified.')).toBeVisible();
 await expect(page.getByText('Engineering variances requiring disposition')).toBeVisible();
 await expect(page.getByText('3000 A',{exact:true})).toBeVisible();
 await expect(page.getByText('3200 A',{exact:true}).first()).toBeVisible();
 await expect(page.getByText(/tenant-backed capture and persistence remain pending/i)).toBeVisible();
});

test('controlled agent detects reference rating variance without overwriting Verified state',async({request})=>{
 const response=await request.post('/api/twin-agent',{data:{action:'compareObservedToDesigned',assetId:'STR-AST-0009281'}});
 expect(response.ok()).toBeTruthy();
 const body=await response.json();
 expect(body.truthBoundary).toBe('OBSERVED_NEVER_OVERWRITES_VERIFIED');
 expect(body.authority).toBe('REFERENCE_ONLY');
 expect(body.source).toBe('reality-reference-rules-v1');
 expect(body.result).toContainEqual(expect.objectContaining({field:'Current',designed:'3200 A',observed:'3000 A',verified:'3200 A',reviewState:'REVIEW_REQUIRED'}));
});

test('OEM-neutral normalization maps reference manufacturer aliases deterministically',async({request})=>{
 const response=await request.post('/api/twin-agent',{data:{action:'normalizeOEMAsset',manufacturer:'Square D'}});
 expect(response.ok()).toBeTruthy();
 expect(await response.json()).toMatchObject({authority:'REFERENCE_ONLY',source:'oem-normalization-v1',result:{canonical:'Schneider Electric',matched:true}});
});

test('Reality impact trace remains read-only and exposes downstream dependency context',async({request})=>{
 const response=await request.post('/api/twin-agent',{data:{action:'traceRealityImpact',assetId:'STR-AST-0009282'}});
 expect(response.ok()).toBeTruthy();
 const body=await response.json();
 expect(body.truthBoundary).toBe('OBSERVED_NEVER_OVERWRITES_VERIFIED');
 expect(body.authority).toBe('REFERENCE_ONLY');
 expect(body.result.affectedAssets.map((item:{id:string})=>item.id)).toContain('STR-AST-0009281');
});
