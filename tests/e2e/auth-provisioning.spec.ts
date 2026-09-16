import {expect,test} from '@playwright/test';

test('one-time account setup screen is usable without implying authentication',async({page})=>{
 await page.goto('/set-password?token=example-one-time-token-value-1234567890');
 await expect(page.getByRole('heading',{name:'Configure your account password'})).toBeVisible();
 await expect(page.getByLabel('One-time setup token')).toHaveValue('example-one-time-token-value-1234567890');
 await expect(page.getByPlaceholder('New password')).toHaveAttribute('minlength','12');
 await expect(page.getByPlaceholder('Confirm new password')).toHaveAttribute('minlength','12');
 await expect(page.getByRole('button',{name:'Configure password'})).toBeEnabled();
});

test('password setup rejects malformed credentials before persistence',async({request})=>{
 const complete=await request.post('/api/auth/password-setup/complete',{data:{token:'short',password:'short'}});
 expect(complete.status()).toBe(400);
 const issue=await request.post('/api/auth/password-setup/request',{data:{email:''}});
 expect(issue.status()).toBe(400);
});
