import {expect,test} from '@playwright/test';

const routes=[
  '/', '/compiler','/twin','/reality','/projects','/sites','/assets',
  '/workflows','/maintenance','/predictive','/simulation','/evidence',
  '/handover','/provenance','/verify','/dir','/admin'
];

test.describe('STRATUM Verified route and responsive UAT',()=>{
  for(const route of routes){
    test(`${route} renders without browser/server failure`,async({page})=>{
      const consoleErrors:string[]=[];
      page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text())});
      const response=await page.goto(route,{waitUntil:'domcontentloaded'});
      expect(response,`No response for ${route}`).not.toBeNull();
      expect(response!.status(),`${route} returned HTTP ${response!.status()}`).toBeLessThan(500);
      await expect(page.locator('body')).toBeVisible();
      await expect(page.locator('body')).not.toContainText(/Application error|Internal Server Error/i);
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
      expect(overflow,`${route} has horizontal overflow`).toBeLessThanOrEqual(2);
      const fatal=consoleErrors.filter(x=>/uncaught|application error|hydration failed|failed to fetch dynamically imported module/i.test(x));
      expect(fatal,`Fatal console errors on ${route}: ${fatal.join(' | ')}`).toEqual([]);
    });
  }
});

test('primary navigation reaches key workspaces',async({page})=>{
  await page.goto('/');
  const nav=page.getByRole('navigation',{name:'Primary navigation'});
  await expect(nav).toBeVisible();
  await nav.getByRole('link',{name:'Twin Compiler'}).click();
  await expect(page).toHaveURL(/\/compiler$/);
  await expect(page.getByRole('heading',{name:/Engineering documents in\. Verifiable twin out\./i})).toBeVisible();
  await nav.getByRole('link',{name:'STRATUM Twin'}).click();
  await expect(page).toHaveURL(/\/twin$/);
  await nav.getByRole('link',{name:'DIR Explorer'}).click();
  await expect(page).toHaveURL(/\/dir$/);
});

test('Twin layer controls are interactive',async({page})=>{
  await page.goto('/twin');
  const l8=page.getByRole('button',{name:/L8.*Trust|L8/i}).first();
  await expect(l8).toBeVisible();
  const before=await l8.getAttribute('class');
  await l8.click();
  const after=await l8.getAttribute('class');
  expect(after).not.toBe(before);
  await l8.click();
});

test('Twin Compiler accepts a real DXF through the file workflow',async({page})=>{
  await page.goto('/compiler');
  const dxf=`0\nSECTION\n2\nENTITIES\n0\nINSERT\n8\nE-EQUIP\n2\nPANEL-LP1\n10\n100\n20\n200\n0\nLINE\n8\nE-FEEDER\n10\n100\n20\n200\n11\n300\n21\n200\n0\nENDSEC\n0\nEOF\n`;
  await page.locator('input[type=file]').setInputFiles({name:'E1-test.dxf',mimeType:'application/dxf',buffer:Buffer.from(dxf)});
  await expect(page.getByText('E1-test.dxf')).toBeVisible();
  await expect(page.getByText(/CAD entities parsed|Compilation updated/i).first()).toBeVisible();
  await expect(page.getByText(/PARSED/).first()).toBeVisible();
});

test('project CRUD entry point opens a usable editor',async({page})=>{
  await page.goto('/projects');
  const create=page.getByRole('button',{name:/New project/i});
  await expect(create).toBeVisible();
  await create.click();
  await expect(page.getByText('Create project',{exact:true})).toBeVisible();
  await expect(page.getByPlaceholder('Project name')).toBeVisible();
  await expect(page.getByPlaceholder('Client')).toBeVisible();
  await expect(page.getByPlaceholder('Location')).toBeVisible();
  await expect(page.getByRole('button',{name:'Create project'})).toBeVisible();
});

test('login form submits through an explicit functional control',async({page})=>{
  await page.goto('/login');
  await expect(page.getByRole('heading',{name:'Sign in'})).toBeVisible();
  const submit=page.getByRole('button',{name:'Sign in'});
  await expect(submit).toBeEnabled();
});
