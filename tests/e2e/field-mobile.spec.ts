import {expect,test} from '@playwright/test';

test('responsive shell exposes field navigation on compact viewports without replacing desktop workspace navigation',async({page})=>{
 await page.goto('/');
 const compact=(page.viewportSize()?.width||0)<=900;
 const fieldNav=page.getByRole('navigation',{name:'Field navigation'});
 const primaryNav=page.getByRole('navigation',{name:'Primary navigation'});
 if(compact){
  await expect(fieldNav).toBeVisible();
  await expect(primaryNav).not.toBeVisible();
  await expect(fieldNav.getByRole('link',{name:'My Work',exact:true})).toHaveAttribute('href','/workflows');
  await expect(fieldNav.getByRole('link',{name:'Scan',exact:true})).toHaveAttribute('href','/scan');
  await expect(fieldNav.getByRole('link',{name:'Capture',exact:true})).toHaveAttribute('href','/capture');
 }else{
  await expect(primaryNav).toBeVisible();
  await expect(fieldNav).not.toBeVisible();
 }
});

test('standalone scan route identifies an asset through the manual resilience path and enters inspection',async({page})=>{
 await page.goto('/scan');
 await expect(page.getByRole('heading',{name:'Scan equipment'})).toBeVisible();
 const input=page.getByRole('textbox',{name:'Asset code or serial'});
 await input.fill('STR-AST-0009281');
 await page.getByRole('button',{name:'Continue inspection'}).click();
 await expect(page).toHaveURL(/\/inspection\?q=STR-AST-0009281/);
 await expect(page.getByRole('heading',{name:'Inspection & commissioning session'})).toBeVisible();
 await expect(page.getByText(/Main Switchgear SG-01|Asset identified/i).first()).toBeVisible();
});

test('standalone capture route preserves capture intent while entering the controlled field session',async({page})=>{
 await page.goto('/capture');
 await expect(page.getByRole('heading',{name:'Capture evidence'})).toBeVisible();
 await page.getByRole('textbox',{name:'Asset code or serial'}).fill('STR-AST-0009281');
 await page.getByRole('button',{name:'Continue to field capture'}).click();
 await expect(page).toHaveURL(/\/inspection\?q=STR-AST-0009281&intent=capture/);
 await expect(page.getByRole('heading',{name:'Inspection & commissioning session'})).toBeVisible();
 await expect(page.getByText(/Installation \/ inspection evidence/i)).toBeVisible();
});

test('inspection fallback returns to the dedicated scanner instead of the desktop work hub',async({page})=>{
 await page.goto('/inspection');
 await expect(page.getByRole('heading',{name:'No asset selected'})).toBeVisible();
 await page.getByRole('button',{name:'Open field scanner'}).click();
 await expect(page).toHaveURL(/\/scan$/);
});
