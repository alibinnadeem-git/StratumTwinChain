import {expect,test} from '@playwright/test';

test('tenant OEM source verification advances exact SKU to FILE VERIFIED while GLB activation stays blocked',async({page})=>{
 await page.route('**/api/oem/cad-verifications',async route=>{
  if(route.request().method()!=='GET'){await route.continue();return}
  await route.fulfill({
   status:200,
   contentType:'application/json',
   body:JSON.stringify({records:[{
    id:'verification-1',
    candidate_id:'schneider-c10n32d100',
    manufacturer_name:'Schneider Electric',
    sku:'C10N32D100',
    product_name:'ComPacT NSX100N 100 A three-pole circuit breaker',
    revision:'MCADPP0000031',
    source_file_name:'MCADPP0000031_3D-simplified.stp',
    source_byte_size:123456,
    source_sha256:'f'.repeat(64),
    reuse_terms:'Manufacturer CAD retained for controlled internal verification; redistribution not yet approved.',
    notes:'Exact SKU and source file checked.',
    verification_status:'FILE_VERIFIED',
    verified_at:'2026-09-25T23:00:00.000Z',
    file_stored:true
   }]})
  });
 });
 await page.goto('/component-library');
 const queue=page.getByRole('region',{name:'Exact OEM CAD acquisition queue'});
 await queue.getByLabel('Search exact OEM CAD queue').fill('C10N32D100');
 const schneider=queue.locator('article').filter({hasText:'C10N32D100'});
 await expect(schneider).toContainText('FILE VERIFIED');
 await expect(schneider).toContainText('BLOCKED');
 await expect(schneider).toContainText('Source CAD SHA-256 verified');
 await expect(schneider).toContainText('Reuse terms recorded');
 await expect(schneider).toContainText('Controlled browser GLB has not been approved.');
 await expect(schneider).toContainText('MCADPP0000031_3D-simplified.stp');
 await expect(schneider).toContainText('revision MCADPP0000031');
 await expect(schneider).toContainText(/Convert to meter-space GLB/i);
 await expect(schneider).not.toContainText('OEM ACTIVE');
});
