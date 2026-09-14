import {expect,test} from '@playwright/test';
import {requiredPoviQuorum} from '../../lib/redbook/povi/quorum';

test('PoVI strict-supermajority finality cannot regress to 2-of-3',async({page})=>{
 expect(requiredPoviQuorum(3)).toBe(3);
 await page.goto('/dir');
 await expect(page.getByRole('heading',{name:'PoVI finality threshold'})).toBeVisible();
 await expect(page.locator('body')).not.toContainText(/2 of 3/i);
 await expect(page.getByText(/Network connectivity, a record height, or a signature count alone does not prove physical truth/i)).toBeVisible();
});

test('Verify explains record integrity before progressively disclosing protocol detail',async({page})=>{
 await page.route('**/api/verify*',async route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({verified:true,records:[{record_id:'MDIR-TEST-001',event_type:'INSPECTION_COMPLETED',occurred_at:'2026-09-14T01:00:00.000Z',payload_sha256:'a'.repeat(64),evidence_package_sha256:'b'.repeat(64),ledger_network:'stratum-devnet-1',ledger_tx_hash:'c'.repeat(64),ledger_block_height:8194251,asset_code:'STR-AST-0009281',asset_name:'Main Switchgear SG-01',serial_number:'SG24-001928',project_code:'STR-DC-01',project_name:'Northstar Data Center'}]})}));
 await page.goto('/verify');
 await page.getByLabel('Verification identifier').fill('STR-AST-0009281');
 await page.getByRole('button',{name:'Verify'}).click();
 await expect(page.getByRole('heading',{name:'Recorded fingerprint matched'})).toBeVisible();
 await expect(page.getByText(/does not independently prove physical truth, work quality, installation correctness, or engineering approval/i)).toBeVisible();
 await expect(page.getByText('Recorded DIR')).toBeVisible();
 await expect(page.getByText('#8194251')).toBeVisible();
 await expect(page.locator('body')).not.toContainText('Authentic and unchanged');
 await expect(page.getByText('Technical proof details')).toBeVisible();
 await expect(page.getByText('DIR network')).not.toBeVisible();
 await page.getByText('Technical proof details').click();
 await expect(page.getByText('DIR network')).toBeVisible();
 await expect(page.getByText('Transaction reference')).toBeVisible();
});

test('asset passport never infers PoVI verification from a DIR reference or lifecycle metadata',async({page})=>{
 await page.goto('/assets/STR-AST-0009281');
 await expect(page.getByRole('heading',{name:'Main Switchgear SG-01'})).toBeVisible();
 await expect(page.locator('[data-semantic-state="POVI_VERIFIED"]')).toHaveCount(0);
 await expect(page.locator('body')).not.toContainText('Verified in DIR');
 const recorded=page.locator('[data-semantic-domain="trust"][data-semantic-state="DIR_RECORDED"]');
 if(await recorded.count()){
  await expect(recorded).toBeVisible();
  await expect(page.getByRole('heading',{name:'Immutable record reference present'})).toBeVisible();
  await expect(page.getByText(/PoVI Verified is reserved for a DIR whose finality proof has been independently verified/i)).toBeVisible();
  await expect(page.getByText('Technical record details')).toBeVisible();
  await expect(page.getByText('DIR network')).not.toBeVisible();
  await page.getByText('Technical record details').click();
  await expect(page.getByText('DIR network')).toBeVisible();
 }else{
  await expect(page.getByRole('heading',{name:'Awaiting immutable lifecycle record'})).toBeVisible();
 }
});
