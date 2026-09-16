import {expect,test} from '@playwright/test';

test('one-time account setup screen is usable without implying authentication',async({page})=>{
 await page.goto('/set-password?token=example-one-time-token-value-1234567890');
 await expect(page.getByRole('heading',{name:'Configure your account password'})).toBeVisible();
 await expect(page.getByLabel('One-time setup token')).toHaveValue('example-one-time-token-value-1234567890');
 await expect(page.getByPlaceholder('New password',{exact:true})).toHaveAttribute('minlength','12');
 await expect(page.getByPlaceholder('Confirm new password',{exact:true})).toHaveAttribute('minlength','12');
 await expect(page.getByRole('button',{name:'Configure password'})).toBeEnabled();
});

test('password setup rejects malformed credentials before persistence',async({request})=>{
 const complete=await request.post('/api/auth/password-setup/complete',{data:{token:'short',password:'short'}});
 expect(complete.status()).toBe(400);
 const issue=await request.post('/api/auth/password-setup/request',{data:{email:''}});
 expect(issue.status()).toBe(400);
});

test('signed-out administration fails closed without demo administrator identity',async({page})=>{
 await page.goto('/admin');
 await expect(page.getByRole('heading',{name:'Sign in required'})).toBeVisible();
 await expect(page.getByRole('link',{name:'Sign in'})).toBeVisible();
 await expect(page.getByText('No reference or demo administrator identity is substituted.')).toBeVisible();
 await expect(page.getByText('SUPER ADMIN',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Provision member'})).toHaveCount(0);
});

test('tenant member provisioning requires authenticated SUPER_ADMIN before database work',async({request})=>{
 const response=await request.post('/api/admin/members',{data:{email:'new.member@example.com',displayName:'New Member',role:'VIEWER'}});
 expect(response.status()).toBe(401);
 const body=await response.json();
 expect(body.error).toBe('Unauthorized');
});
