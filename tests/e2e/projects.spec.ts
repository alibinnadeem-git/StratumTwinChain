import {expect,test} from '@playwright/test';

test('signed-out Projects refuses browser-only project substitution',async({page})=>{
 await page.goto('/projects');
 await expect(page.getByRole('heading',{name:'Sign in required'})).toBeVisible();
 await expect(page.getByText(/organization-scoped server records/i)).toBeVisible();
 await expect(page.getByRole('button',{name:'New project'})).toHaveCount(0);
 await expect(page.getByText(/Restore reference projects/i)).toHaveCount(0);
});

test('project API fails closed when signed out',async({request})=>{
 const list=await request.get('/api/projects');
 expect(list.status()).toBe(401);
 expect((await list.json()).error).toBe('Unauthorized');

 const create=await request.post('/api/projects',{data:{projectCode:'NOPE',name:'Unauthorized project'}});
 expect(create.status()).toBe(401);
 expect((await create.json()).error).toBe('Unauthorized');

 const update=await request.patch('/api/projects',{data:{projectId:'30000000-0000-4000-8000-000000000001',status:'ARCHIVED'}});
 expect(update.status()).toBe(401);
 expect((await update.json()).error).toBe('Unauthorized');
});
