import {expect,test} from '@playwright/test';

const graph=(name='Recovered panel')=>({
  version:'recovery-test',
  createdAt:'2026-09-20T20:00:00.000Z',
  sources:[{name:'E1.dxf',ext:'dxf',sha256:'a'.repeat(64),discipline:'Electrical',floor:'L1',elevation:0}],
  entities:[{id:'panel-1',source:'E1.dxf',layer:'L2',kind:'cad-block',name,x:1,y:2,z:0,confidence:.9,meta:{elevationKnown:false}}],
  links:[],
  stats:{L0:1,L1:0,L2:1,L3:0,L4:0}
});

test('same-origin legacy Spatial graph is automatically recovered instead of showing an empty viewer',async({page})=>{
 await page.addInitScript((value)=>{
  localStorage.removeItem('stratum_compiled_graph');
  localStorage.removeItem('stratum_compiled_graph_last_good_v2');
  localStorage.setItem('stratum_legacy_spatial_graph',JSON.stringify(value));
 },graph());
 await page.goto('/');
 const workspace=page.getByRole('region',{name:'Project workspace status'});
 await expect(workspace).toContainText('MODEL FOUND');
 await expect(workspace).toContainText('1 source · 1 Spatial object');
 const recovered=await page.evaluate(()=>JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}').entities?.[0]?.name);
 expect(recovered).toBe('Recovered panel');
 await page.goto('/spatial');
 await expect(page.getByText('Recovered panel',{exact:true})).toBeVisible();
});

test('graph updates create a protected last-good browser copy',async({page})=>{
 await page.goto('/compiler');
 await page.evaluate(value=>{
  localStorage.setItem('stratum_compiled_graph',JSON.stringify(value));
  window.dispatchEvent(new Event('stratum:graph-updated'));
 },graph('Protected panel'));
 await expect.poll(()=>page.evaluate(()=>{
  const saved=JSON.parse(localStorage.getItem('stratum_compiled_graph_last_good_v2')||'{}');
  return saved.entities?.[0]?.name||null;
 })).toBe('Protected panel');
});

test('a JSON backup can restore a missing model without rebuilding sources',async({page})=>{
 await page.addInitScript(()=>{
  localStorage.removeItem('stratum_compiled_graph');
  localStorage.removeItem('stratum_compiled_graph_last_good_v2');
  localStorage.removeItem('stratum_compiled_graph_previous_v2');
  localStorage.removeItem('stratum_legacy_spatial_graph');
 });
 await page.goto('/');
 const workspace=page.getByRole('region',{name:'Project workspace status'});
 await expect(workspace).toContainText('MODEL MISSING');
 await workspace.getByText('Backup & recovery',{exact:true}).click();
 await workspace.getByLabel('Import Spatial backup').setInputFiles({
  name:'spatial-backup.json',
  mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(graph('Imported backup panel')))
 });
 await expect(workspace).toContainText('MODEL FOUND');
 await expect(workspace.getByRole('status')).toContainText(/Imported 1 Spatial objects/i);
 await page.goto('/spatial');
 await expect(page.getByText('Imported backup panel',{exact:true})).toBeVisible();
});
