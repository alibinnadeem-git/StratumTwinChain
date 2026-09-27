import {expect,test} from '@playwright/test';

const projectId='11111111-1111-4111-8111-111111111111';

test('signed-out compiler keeps local source protection without exposing tenant source-vault controls',async({page})=>{
 await page.goto('/compiler');
 await expect(page.locator('.import-summary div').filter({hasText:'Sources archived locally'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Keep original project files recoverable'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Back up local project sources'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Restore server sources to this browser'})).toHaveCount(0);
});

test('project source vault API fails closed before project or byte access when signed out',async({request})=>{
 const list=await request.get('/api/spatial/sources?projectId='+projectId);
 expect(list.status()).toBe(401);
 expect((await list.json()).error).toBe('Unauthorized');

 const create=await request.post('/api/spatial/sources',{data:{
  projectId,sha256:'a'.repeat(64),fileName:'G101 Site Plan.pdf',extension:'pdf',mimeType:'application/pdf',byteSize:1024
 }});
 expect(create.status()).toBe(401);
 expect((await create.json()).error).toBe('Unauthorized');

 const finalize=await request.patch('/api/spatial/sources',{data:{sourceId:'22222222-2222-4222-8222-222222222222'}});
 expect(finalize.status()).toBe(401);
 expect((await finalize.json()).error).toBe('Unauthorized');

 const chunk=await request.get('/api/spatial/sources/22222222-2222-4222-8222-222222222222/chunks/0');
 expect(chunk.status()).toBe(401);
 expect((await chunk.json()).error).toBe('Unauthorized');
});
