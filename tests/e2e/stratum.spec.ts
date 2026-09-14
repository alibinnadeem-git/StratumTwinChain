import {expect,test} from '@playwright/test';

const routes=['/','/library','/spatial','/twin','/compiler','/component-library','/reality','/projects','/sites','/assets','/workflows','/maintenance','/predictive','/simulation','/evidence','/handover','/provenance','/verify','/dir','/admin','/inspection','/passports','/asset-passports','/passport/STR-AST-0009281','/build','/install','/operate','/predictive-maintenance','/reality-reconciliation','/digital-handover','/client-trust','/chain-explorer','/trust','/twin-compiler','/dirs'];

test.describe('STRATUM Spatial Verified route and responsive UAT',()=>{
 for(const route of routes){
  test(`${route} renders without browser/server failure`,async({page})=>{
   const consoleErrors:string[]=[];
   page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text())});
   const response=await page.goto(route,{waitUntil:'domcontentloaded'});
   expect(response).not.toBeNull();
   expect(response!.status(),`${route} returned HTTP ${response!.status()}`).toBeLessThan(500);
   await expect(page.locator('body')).toBeVisible();
   await expect(page.locator('body')).not.toContainText(/Application error|Internal Server Error/i);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
   expect(overflow,`${route} has horizontal overflow`).toBeLessThanOrEqual(2);
   const fatal=consoleErrors.filter(x=>/uncaught|application error|hydration failed|failed to fetch dynamically imported module/i.test(x));
   expect(fatal).toEqual([]);
  });
 }
});

test('Home is role-aware while preserving explicit implementation status',async({page})=>{
 await page.goto('/');
 await expect(page.getByText('STRATUM Spatial Verified',{exact:false}).first()).toBeVisible();
 await expect(page.getByText(/Program command/i)).toBeVisible();
 await expect(page.getByRole('heading',{name:/See what needs attention across STRATUM/i})).toBeVisible();
 await expect(page.getByText(/Your most relevant actions/i)).toBeVisible();
 await expect(page.getByText(/Implementation status/i)).toBeVisible();
 await expect(page.getByText('P0 · PARTIAL',{exact:true})).toBeVisible();
 await expect(page.getByText('P1 · IN PROGRESS',{exact:true})).toBeVisible();
});

test('primary navigation stays focused on the five canonical destinations',async({page})=>{
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Primary navigation'});
 await expect(nav).toBeVisible();
 const links=nav.getByRole('link');
 await expect(links).toHaveCount(5);
 await expect(nav.getByRole('link',{name:'Home',exact:true})).toBeVisible();
 await expect(nav.getByRole('link',{name:'Sites',exact:true})).toBeVisible();
 await expect(nav.getByRole('link',{name:'Work',exact:true})).toBeVisible();
 await expect(nav.getByRole('link',{name:'Verify',exact:true})).toBeVisible();
 await expect(nav.getByRole('link',{name:'Library',exact:true})).toBeVisible();
 await nav.getByRole('link',{name:'Sites',exact:true}).click();
 await expect(page).toHaveURL(/\/sites$/);
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('link',{name:'Work',exact:true}).click();
 await expect(page).toHaveURL(/\/workflows$/);
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('link',{name:'Verify',exact:true}).click();
 await expect(page).toHaveURL(/\/verify$/);
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('link',{name:'Library',exact:true}).click();
 await expect(page).toHaveURL(/\/library$/);
 await expect(page.getByRole('heading',{name:/Specialist tools, one understandable place/i})).toBeVisible();
 await page.getByRole('link',{name:/Spatial Compiler/i}).click();
 await expect(page).toHaveURL(/\/compiler$/);
});

test('legacy /twin remains a compatibility route and lands on Spatial',async({page})=>{
 await page.goto('/twin');
 await expect(page).toHaveURL(/\/spatial$/);
});

test('Spatial layer controls are interactive',async({page})=>{
 await page.goto('/spatial');
 const l8=page.getByRole('button',{name:/L8.*Trust|L8/i}).first();
 await expect(l8).toBeVisible();
 const before=await l8.getAttribute('class');
 await l8.click();
 expect(await l8.getAttribute('class')).not.toBe(before);
 await l8.click();
});

test('Spatial Compiler accepts a real DXF through the file workflow',async({page})=>{
 await page.goto('/compiler');
 const dxf=`0\nSECTION\n2\nENTITIES\n0\nINSERT\n8\nE-EQUIP\n2\nPANEL-LP1\n10\n100\n20\n200\n0\nLINE\n8\nE-FEEDER\n10\n100\n20\n200\n11\n300\n21\n200\n0\nENDSEC\n0\nEOF\n`;
 await page.locator('input[type=file][accept*=".dxf"]').setInputFiles({name:'E1-test.dxf',mimeType:'application/dxf',buffer:Buffer.from(dxf)});
 await expect(page.getByText('E1-test.dxf')).toBeVisible();
 await expect(page.getByText(/CAD entities|Architectural compilation updated/i).first()).toBeVisible();
 await expect(page.getByText(/PARSED/).first()).toBeVisible();
});

test('compiled Spatial model preserves level elevation rotation and source placement',async({page})=>{
 await page.goto('/compiler');
 const dxf=`0\nSECTION\n2\nENTITIES\n0\nINSERT\n8\nE-EQUIP\n2\nPANELBOARD LP-2\n10\n100\n20\n200\n30\n0\n41\n1.25\n42\n1.25\n50\n90\n0\nTEXT\n8\nA-ROOM\n1\nELECTRICAL ROOM 201\n10\n102\n20\n202\n0\nENDSEC\n0\nEOF\n`;
 await page.locator('input[type=file][accept*=".dxf"]').setInputFiles({name:'E2-Level-2-Power.dxf',mimeType:'application/dxf',buffer:Buffer.from(dxf)});
 await expect(page.getByText(/L2 @ 4m/).first()).toBeVisible();
 await page.goto('/spatial');
 await expect(page.getByText(/INFRASTRUCTURE OPERATING VIEW/i)).toBeVisible();
 await expect(page.getByText(/1 level\(s\)/i)).toBeVisible();
 await expect(page.getByLabel('Environment mode')).toBeVisible();
});

test('DXF closed architectural polyline becomes reconstructed Spatial room geometry',async({page})=>{
 await page.goto('/compiler');
 const dxf=`0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n2\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n0\nLWPOLYLINE\n8\nA-ROOM\n70\n1\n10\n0\n20\n0\n10\n20\n20\n0\n10\n20\n20\n15\n10\n0\n20\n15\n0\nTEXT\n8\nA-ROOM\n1\nELECTRICAL ROOM 101\n10\n10\n20\n7\n0\nINSERT\n8\nE-EQUIP\n2\nPANELBOARD LP-1\n10\n12\n20\n8\n0\nENDSEC\n0\nEOF\n`;
 await page.locator('input[type=file][accept*=".dxf"]').setInputFiles({name:'A-E-Level-1-Room.dxf',mimeType:'application/dxf',buffer:Buffer.from(dxf)});
 await expect(page.getByText(/1 reconstructed rooms/i)).toBeVisible();
 await expect(page.getByText(/units ft/i).first()).toBeVisible();
 await page.goto('/spatial');
 await expect(page.getByText(/1 room\(s\)/i)).toBeVisible();
 const explode=page.getByRole('button',{name:'Explode building'});
 await expect(explode).toBeVisible();
 await explode.click();
 await expect(page.getByRole('button',{name:'Collapse building'})).toBeVisible();
 const xray=page.getByRole('button',{name:'X-Ray architecture'});
 await xray.click();
 await expect(page.getByRole('button',{name:'Disable X-Ray'})).toBeVisible();
 await page.getByLabel('Environment mode').selectOption('NIGHT');
 await expect(page.getByLabel('Environment mode')).toHaveValue('NIGHT');
 await page.getByLabel('System isolation').selectOption('POWER');
 await expect(page.getByLabel('System isolation')).toHaveValue('POWER');
 await expect(page.getByText('INFRASTRUCTURE HUD')).toBeVisible();
});

test('electrical component library exposes canonical equipment classes and Spatial registry',async({page})=>{
 await page.goto('/component-library');
 await expect(page.getByRole('heading',{name:'Main Switchboard',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Dry-Type Transformer',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'EV Charging Station',exact:true})).toBeVisible();
 await expect(page.getByText('Spatial Asset Object Attributes',{exact:true})).toBeVisible();
 await expect(page.getByRole('region',{name:'3D Asset Registry'})).toBeVisible();
 const search=page.getByRole('textbox',{name:'Search component models'});
 await search.fill('transformer');
 await page.getByRole('button',{name:/Dry-Type Transformer/i}).click();
 const modelUrl=page.getByLabel('Model URL');
 await modelUrl.fill('/models/electrical/dry-transformer.glb');
 await expect(page.getByText('DETAILED MODEL ACTIVE',{exact:true})).toBeVisible();
});

test('project CRUD entry point opens a usable editor',async({page})=>{
 await page.goto('/projects');
 const create=page.getByRole('button',{name:/New project/i});
 await create.click();
 await expect(page.getByPlaceholder('Project name')).toBeVisible();
 await expect(page.getByPlaceholder('Client')).toBeVisible();
 await expect(page.getByPlaceholder('Location')).toBeVisible();
 await expect(page.getByRole('button',{name:'Create project'})).toBeVisible();
});

test('login form submits through an explicit functional control',async({page})=>{
 await page.goto('/login');
 await expect(page.getByRole('heading',{name:'Sign in'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Sign in'})).toBeEnabled();
});

test('continuous handover uses explainable asset readiness',async({page})=>{
 await page.goto('/handover');
 await expect(page.getByRole('heading',{name:'Turnover readiness you can explain.'})).toBeVisible();
 await expect(page.getByText('Asset turnover matrix')).toBeVisible();
 await expect(page.getByText('Main Switchgear SG-01')).toBeVisible();
 await expect(page.getByText('DETERMINISTIC')).toBeVisible();
});

test('controlled infrastructure agent returns deterministic commissioning blockers',async({request})=>{
 const response=await request.post('/api/twin-agent',{data:{action:'evaluateCommissioningReadiness',assetId:'STR-AST-0009283'}});
 expect(response.ok()).toBeTruthy();
 const body=await response.json();
 expect(body.source).toBe('deterministic-rules-v1');
 expect(body.result[0].blockers).toContain('Inspection passed');
});

test('electrical graph traces affected assets through controlled API',async({request})=>{
 const response=await request.post('/api/twin-agent',{data:{action:'traceAffectedSystems',assetId:'STR-AST-0009282'}});
 expect(response.ok()).toBeTruthy();
 const body=await response.json();
 expect(body.source).toBe('electrical-graph-v1');
 expect(body.result.map((item:{id:string})=>item.id)).toContain('STR-AST-0009281');
});
