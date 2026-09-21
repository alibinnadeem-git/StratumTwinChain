import {expect,test} from '@playwright/test';

const asset={
 id:'11111111-1111-4111-8111-111111111111',asset_code:'STR-AST-0009281',asset_type:'Switchgear',name:'Main Switchgear',serial_number:'SN-9281',location_label:'Electrical Room 101',status:'ACTIVE',project_id:'22222222-2222-4222-8222-222222222222',project_code:'APOLLO',project_name:'Apollo',site_name:'Rosecrans',system_name:'Main Distribution',administratively_archived:false
};
const tiny=Buffer.from('field evidence');

test('offline inspection stays UNSYNCED and retries lifecycle/evidence with the same requestId',async({page,context})=>{
 const lifecycleRequestIds:string[]=[];
 let evidenceAttempts=0;
 await page.route('**/api/assets/resolve?q=*',async route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({source:'live',tenantScoped:true,asset})}));
 await page.route('**/api/lifecycle',async route=>{
  const body=route.request().postDataJSON();
  lifecycleRequestIds.push(String(body.requestId));
  await route.fulfill({status:lifecycleRequestIds.length===1?201:200,contentType:'application/json',body:JSON.stringify({id:'33333333-3333-4333-8333-333333333333',canonicalHash:'c'.repeat(64),replayed:lifecycleRequestIds.length>1})});
 });
 await page.route('**/api/evidence/upload',async route=>{
  evidenceAttempts++;
  if(evidenceAttempts===1){await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'temporary evidence outage'})});return;}
  await route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({id:'44444444-4444-4444-8444-444444444444',fileStored:true,idempotent:false})});
 });

 await page.goto(`/inspection?q=${asset.id}`);
 await expect(page.getByText('Main Switchgear')).toBeVisible();
 await context.setOffline(true);
 await expect(page.getByText('OFFLINE',{exact:true})).toBeVisible();
 const checks=page.locator('input[type="checkbox"]');
 await checks.nth(0).check();
 await checks.nth(1).check();
 await page.getByPlaceholder(/Voltage, current, torque/i).fill('480 V phase-to-phase; enclosure visually acceptable');
 await page.locator('input[type="file"]').setInputFiles({name:'inspection.txt',mimeType:'text/plain',buffer:tiny});
 await expect(page.locator('small').filter({hasText:/1 evidence file\(s\) protected for sync/i})).toBeVisible();
 await page.getByRole('button',{name:'Queue for sync'}).click();
 await expect(page.getByText(/UNSYNCED: inspection is safely queued on this device/i)).toBeVisible();
 expect(lifecycleRequestIds).toHaveLength(0);

 await context.setOffline(false);
 await expect.poll(()=>lifecycleRequestIds.length).toBe(1);
 await expect(page.getByText(/remain UNSYNCED/i)).toBeVisible();
 expect(evidenceAttempts).toBe(1);

 await page.getByText('Progress & sync details',{exact:true}).click();
 await page.getByRole('button',{name:/Sync queued inspections \(1\)/}).click();
 await expect.poll(()=>lifecycleRequestIds.length).toBe(2);
 await expect.poll(()=>evidenceAttempts).toBe(2);
 expect(lifecycleRequestIds[0]).toBeTruthy();
 expect(lifecycleRequestIds[1]).toBe(lifecycleRequestIds[0]);
 await expect(page.getByText(/queued inspection\(s\) synchronized/i)).toBeVisible();
 await expect(page.getByRole('button',{name:'Synchronized'})).toBeDisabled();
 await expect(page.getByRole('status')).toContainText('SYNCHRONIZED');
});
