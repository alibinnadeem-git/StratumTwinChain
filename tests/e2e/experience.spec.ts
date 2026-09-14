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
 await page.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true})));
 const search=page.getByRole('textbox',{name:'Search assets, projects, evidence or tools'});
 await expect(search).toBeVisible();
 await search.fill('definitely-no-such-stratum-record');
 await expect(page.getByText('No matching STRATUM records in the current indexed dataset.')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(search).not.toBeVisible();
});

test('asset registry opens the universal asset drawer without losing list context',async({page})=>{
 await page.goto('/assets');
 const trigger=page.getByRole('button',{name:/Open Main Switchgear SG-01 quick view/i});
 await expect(trigger).toBeVisible();
 await trigger.click();
 const drawer=page.getByRole('dialog',{name:/Main Switchgear SG-01 asset details/i});
 await expect(drawer).toBeVisible();
 await expect(drawer.getByText('Infrastructure context')).toBeVisible();
 await expect(drawer.getByText('Lifecycle & trust')).toBeVisible();
 await expect(drawer.getByText(/A DIR proves canonical network finality/i)).toBeVisible();
 await expect(drawer.getByRole('link',{name:'Open full asset'})).toHaveAttribute('href',/\/assets\/STR-AST-0009281/);
 await page.keyboard.press('Escape');
 await expect(drawer).not.toBeVisible();
 await expect(page).toHaveURL(/\/assets$/);
});

test('trust states resolve through the shared semantic token system',async({page})=>{
 await page.goto('/spatial');
 const badges=page.locator('[data-semantic-domain="trust"]');
 await expect(badges.first()).toBeVisible();
 await expect(badges.first()).toHaveClass(/semantic-badge/);
 const states=await badges.evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-semantic-state')));
 expect(states.length).toBeGreaterThanOrEqual(2);
 expect(states.some(state=>state==='LIVE'||state==='STALE')).toBeTruthy();
});

test('field workflow uses shared work and approval components',async({page})=>{
 await page.goto('/workflows');
 const progress=page.getByLabel('Work progress');
 await expect(progress).toBeVisible();
 await expect(progress.locator('.shared-work-step')).toHaveCount(10);
 await expect(page.locator('.shared-approval-card')).toBeVisible();
 await expect(page.locator('[data-semantic-domain="approval"][data-semantic-state="PENDING"]')).toBeVisible();
});

test('evidence vault uses shared evidence cards and privacy semantics',async({page})=>{
 await page.goto('/evidence');
 const cards=page.locator('.shared-evidence-card');
 expect(await cards.count()).toBeGreaterThan(0);
 await expect(cards.first()).toBeVisible();
 await expect(cards.first().locator('[data-semantic-domain="privacy"]')).toBeVisible();
 await expect(cards.first().locator('[data-semantic-domain="trust"]')).toBeVisible();
});
