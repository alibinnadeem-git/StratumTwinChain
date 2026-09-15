import {expect,test} from '@playwright/test';

const asset={
 id:'11111111-1111-4111-8111-111111111111',asset_code:'STR-AST-0009281',asset_type:'Switchgear',name:'Main Switchgear',serial_number:'SN-9281',location_label:'Electrical Room 101',status:'ACTIVE',project_id:'22222222-2222-4222-8222-222222222222',project_code:'APOLLO',project_name:'Apollo',site_name:'Rosecrans',system_name:'Main Distribution'
};

test('field scan normalizes a Passport URL, resolves tenant asset and hands off to inspection',async({page})=>{
 await page.route('**/api/assets/resolve?q=*',async route=>{
  const q=new URL(route.request().url()).searchParams.get('q');
  expect(q==='STR-AST-0009281'||q===asset.id).toBeTruthy();
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({source:'live',tenantScoped:true,truthBoundary:'FIELD_IDENTITY_RESOLUTION_DOES_NOT_ESTABLISH_VERIFIED_STATE',asset:{...asset,administratively_archived:false,administrative_state:'ACTIVE'}})});
 });
 await page.goto('/scan');
 await page.getByLabel('Asset code or serial').fill('https://field.example/passport/STR-AST-0009281');
 await page.getByRole('button',{name:'Identify asset'}).click();
 await expect(page.getByText('STR-AST-0009281 · Main Switchgear')).toBeVisible();
 await expect(page.getByText('LIVE TENANT ASSET')).toBeVisible();
 await expect(page.getByRole('link',{name:'Open Passport'})).toHaveAttribute('href',`/assets/${asset.id}`);
 await page.getByRole('button',{name:'Continue inspection'}).click();
 await expect(page).toHaveURL(new RegExp(`/inspection\\?q=${asset.id}$`));
});

test('field scan blocks inspection for an administratively archived asset',async({page})=>{
 await page.route('**/api/assets/resolve?q=*',async route=>{
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({source:'live',tenantScoped:true,asset:{...asset,administratively_archived:true,administrative_state:'ARCHIVE',archive_reason:'Retired equipment'}})});
 });
 await page.goto('/scan');
 await page.getByLabel('Asset code or serial').fill('STR-AST-0009281');
 await page.getByRole('button',{name:'Identify asset'}).click();
 await expect(page.getByText('ADMINISTRATIVELY ARCHIVED',{exact:true})).toBeVisible();
 await expect(page.getByText('Retired equipment',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Continue inspection'})).toBeDisabled();
});
