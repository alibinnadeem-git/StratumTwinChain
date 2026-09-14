import {expect,test} from '@playwright/test';

test('global command palette finds a canonical asset and preserves entity navigation',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Search STRATUM'}).click();
 const search=page.getByRole('textbox',{name:'Search assets, projects, evidence or tools'});
 await expect(search).toBeFocused();
 await search.fill('Main Switchgear');
 const result=page.getByRole('button',{name:/Main Switchgear SG-01/i});
 await expect(result).toBeVisible();
 await result.click();
 await expect(page).toHaveURL(/\/passport\/STR-AST-0009281$/);
});

test('command palette supports keyboard opening and clear no-match feedback',async({page})=>{
 await page.goto('/');
 await page.keyboard.press('Control+K');
 const search=page.getByRole('textbox',{name:'Search assets, projects, evidence or tools'});
 await expect(search).toBeVisible();
 await search.fill('definitely-no-such-stratum-record');
 await expect(page.getByText('No matching STRATUM records in the current indexed dataset.')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(search).not.toBeVisible();
});
