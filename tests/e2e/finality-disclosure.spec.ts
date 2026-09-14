import {expect,test} from '@playwright/test';
import {requiredPoviQuorum} from '../../lib/redbook/povi/quorum';

test('PoVI strict-supermajority finality cannot regress to 2-of-3',async({page})=>{
 expect(requiredPoviQuorum(3)).toBe(3);
 await page.goto('/dir');
 await expect(page.getByRole('heading',{name:'PoVI finality threshold'})).toBeVisible();
 await expect(page.locator('body')).not.toContainText(/2 of 3/i);
 await expect(page.getByText(/Network connectivity, a record height, or a signature count alone does not prove physical truth/i)).toBeVisible();
});
