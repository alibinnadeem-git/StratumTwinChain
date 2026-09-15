import {expect,test} from '@playwright/test';

const routes=['/','/spatial','/twin','/compiler','/component-library','/reality','/projects','/sites','/assets','/workflows','/maintenance','/predictive','/simulation','/evidence','/handover','/provenance','/verify','/dir','/admin','/inspection','/passports','/asset-passports','/passport/STR-AST-0009281','/build','/install','/operate','/predictive-maintenance','/reality-reconciliation','/digital-handover','/client-trust','/chain-explorer','/trust','/twin-compiler','/dirs'];
const sourceUpload=(page:import('@playwright/test').Page)=>page.locator('input[type=file][accept*=".dxf"]');

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

test('command center is task-first while Redbook detail remains available on demand',async({page})=>{
 await page.goto('/');
 await expect(page.getByText('STRATUM Spatial Verified',{exact:false}).first()).toBeVisible();
 await expect(page.getByRole('heading',{name:'Choose a task and keep moving.'})).toBeVisible();
 const launcher=page.getByRole('region',{name:'What do you need to do?'});
 await expect(launcher).toBeVisible();
 await expect(launcher.getByRole('link',{name:/Start from a drawing/i})).toBeVisible();
 await expect(launcher.getByRole('link',{name:/Review the model/i})).toBeVisible();
 await expect(launcher.getByRole('link',{name:/Scan & inspect an asset/i})).toBeVisible();
 await expect(launcher.getByRole('link',{name:/Find an asset/i})).toBeVisible();
 await expect(page.getByText(/Redbook implementation order/i)).toBeHidden();
 await page.getByText('Trust & architecture details',{exact:true}).click();
 await expect(page.getByText(/Redbook implementation order/i)).toBeVisible();
 await expect(page.getByText('P0 · PARTIAL',{exact:true})).toBeVisible();
 await expect(page.getByText('P1 · IN PROGRESS',{exact:true})).toBeVisible();
});

test('primary navigation exposes tasks first and advanced workspaces through More tools',async({page})=>{
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Primary navigation'});
 await expect(nav).toBeVisible();
 await expect(nav.getByRole('link',{name:'Component Library'})).toBeHidden();
 await nav.getByRole('link',{name:'Start from drawing'}).click();
 await expect(page).toHaveURL(/\/compiler$/);
 await expect(page.getByRole('heading',{name:/Engineering sources in\. Traceable Spatial model out\./i})).toBeVisible();
 await nav.getByRole('link',{name:'Review model'}).click();
 await expect(page).toHaveURL(/\/spatial$/);
 await nav.getByText('More tools',{exact:true}).click();
 await expect(nav.getByRole('link',{name:'Component Library'})).toBeVisible();
 await expect(nav.getByRole('link',{name:'DIR Explorer'})).toHaveAttribute('href','/dir');
 await nav.getByRole('link',{name:'Component Library'}).click();
 await expect(page).toHaveURL(/\/component-library$/);
});

test('legacy /twin remains a compatibility route and lands on Spatial',async({page})=>{
 await page.goto('/twin');
 await expect(page).toHaveURL(/\/spatial$/);
});

test('Spatial viewer exposes the simple Model Electrical Review journey when a graph is loaded',async({page})=>{
 await page.goto('/spatial');
 await page.evaluate(()=>{
  localStorage.setItem('stratum_compiled_graph',JSON.stringify({
   version:'fixture',createdAt:new Date().toISOString(),
   sources:[{name:'E1.dxf',ext:'dxf',sha256:'mode-fixture',discipline:'Electrical',floor:'L1',elevation:0}],
   entities:[{id:'panel',source:'E1.dxf',layer:'L2',kind:'cad-block',name:'PANELBOARD LP-1',x:0,y:0,z:0,floor:'L1',confidence:.9,meta:{sourceSha256:'mode-fixture'}}],
   links:[],stats:{L0:1,L1:0,L2:1,L3:0,L4:0}
  }));
 });
 await page.reload();
 const modes=page.getByRole('group',{name:'Spatial view mode'});
 await expect(modes).toBeVisible();
 await expect(modes.getByRole('button',{name:/Model/i})).toBeVisible();
 await expect(modes.getByRole('button',{name:/Electrical/i})).toBeVisible();
 await expect(modes.getByRole('button',{name:/Review/i})).toBeVisible();
});

test('Spatial Compiler accepts a real DXF through the file workflow',async({page})=>{
 await page.goto('/compiler');
 const dxf=`0\nSECTION\n2\nENTITIES\n0\nINSERT\n8\nE-EQUIP\n2\nPANEL-LP1\n10\n100\n20\n200\n0\nLINE\n8\nE-FEEDER\n10\n100\n20\n200\n11\n300\n21\n200\n0\nENDSEC\n0\nEOF\n`;
 await sourceUpload(page).setInputFiles({name:'E1-test.dxf',mimeType:'application/dxf',buffer:Buffer.from(dxf)});
 await expect(page.getByText('E1-test.dxf')).toBeVisible();
 await expect(page.getByText(/Source compilation updated: 1\/1 sources/i)).toBeVisible();
 const compiled=await page.evaluate(()=>{
  const graph=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}');
  return{source:graph.sources?.[0]?.name,names:(graph.entities||[]).map((entity:any)=>entity.name),stats:graph.stats};
 });
 expect(compiled.source).toBe('E1-test.dxf');
 expect(compiled.names).toContain('PANEL-LP1');
 expect(compiled.stats.L2).toBeGreaterThanOrEqual(1);
 expect(compiled.stats.L3).toBeGreaterThanOrEqual(1);
});

test('compiled Spatial model preserves source placement while recommended equipment Z stays reviewable',async({page})=>{
 await page.goto('/compiler');
 const dxf=`0\nSECTION\n2\nENTITIES\n0\nINSERT\n8\nE-EQUIP\n2\nPANELBOARD LP-2\n10\n100\n20\n200\n30\n0\n41\n1.25\n42\n1.25\n50\n90\n0\nTEXT\n8\nA-ROOM\n1\nELECTRICAL ROOM 201\n10\n102\n20\n202\n0\nENDSEC\n0\nEOF\n`;
 await sourceUpload(page).setInputFiles({name:'E2-Level-2-Power.dxf',mimeType:'application/dxf',buffer:Buffer.from(dxf)});
 await expect(page.getByText(/L2 @ 4m/).first()).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>{
  const graph=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}');
  const entity=(graph.entities||[]).find((item:any)=>item.name==='PANELBOARD LP-2'&&item.layer==='L2');
  return entity?{floor:entity.floor,z:Number(Number(entity.z).toFixed(6)),rotation:entity.rotation,scale:entity.scale,source:entity.source,authority:entity.meta?.zPlacementAuthority,review:entity.meta?.zReviewRequired}:null;
 })).toEqual({floor:'L2',z:4.695,rotation:90,scale:1.25,source:'E2-Level-2-Power.dxf',authority:'HISTORICAL_RECOMMENDATION',review:true});
 await page.goto('/spatial');
 await expect(page.getByLabel('Floor isolation')).toContainText('L2');
 await expect(page.getByLabel('Imported object')).toContainText('PANELBOARD LP-2');
 await page.getByText('Advanced view controls').click();
 await expect(page.getByLabel('Environment mode')).toBeVisible();
});

test('DXF closed architectural polyline becomes reconstructed Spatial room geometry',async({page})=>{
 await page.goto('/compiler');
 const dxf=`0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n2\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n0\nLWPOLYLINE\n8\nA-ROOM\n70\n1\n10\n0\n20\n0\n10\n20\n20\n0\n10\n20\n20\n15\n10\n0\n20\n15\n0\nTEXT\n8\nA-ROOM\n1\nELECTRICAL ROOM 101\n10\n10\n20\n7\n0\nINSERT\n8\nE-EQUIP\n2\nPANELBOARD LP-1\n10\n12\n20\n8\n0\nENDSEC\n0\nEOF\n`;
 await sourceUpload(page).setInputFiles({name:'A-E-Level-1-Room.dxf',mimeType:'application/dxf',buffer:Buffer.from(dxf)});
 await expect(page.getByText(/1 reconstructed rooms/i)).toBeVisible();
 await expect(page.getByText(/units ft/i).first()).toBeVisible();
 await page.goto('/spatial');
 await expect(page.getByText(/1 room\(s\)/i)).toBeVisible();
 await page.getByText('Advanced view controls').click();
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
 await page.getByLabel('Width dimension meters').fill('1.6');
 await page.getByLabel('Height dimension meters').fill('1.8');
 await page.getByLabel('Depth dimension meters').fill('1.2');
 await page.getByLabel('Dimension source').fill('OEM submittal');
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