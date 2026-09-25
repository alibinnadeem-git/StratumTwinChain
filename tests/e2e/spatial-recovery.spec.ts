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
 await expect(workspace).toContainText('1 source · 1 object · 0 drawing lines');
 const recovered=await page.evaluate(()=>JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}').entities?.[0]?.name);
 expect(recovered).toBe('Recovered panel');
 await expect.poll(()=>page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('stratum-spatial-recovery-v1',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
  return new Promise<string|null>(resolve=>{const request=db.transaction('graphs','readonly').objectStore('graphs').get('current');request.onsuccess=()=>resolve(request.result?.entities?.[0]?.name||null);request.onerror=()=>resolve(null)});
 })).toBe('Recovered panel');
 await page.goto('/spatial');
 await expect(page.getByRole('region',{name:'Imported project spatial model'})).toBeVisible();
 await expect(page.getByText('PROJECT MODEL',{exact:true})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}').entities?.[0]?.name)).toBe('Recovered panel');
});

test('graph updates create a protected last-good browser copy',async({page})=>{
 await page.goto('/compiler');
 await page.evaluate(value=>{
  localStorage.setItem('stratum_compiled_graph',JSON.stringify(value));
  window.dispatchEvent(new Event('stratum:graph-updated'));
 },graph('Protected panel'));
 await expect.poll(()=>page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('stratum-spatial-recovery-v1',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
  return new Promise<string|null>((resolve)=>{const request=db.transaction('graphs','readonly').objectStore('graphs').get('latest');request.onsuccess=()=>resolve(request.result?.entities?.[0]?.name||null);request.onerror=()=>resolve(null)});
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
 await expect(page.getByRole('region',{name:'Imported project spatial model'})).toBeVisible();
 await expect(page.getByText('PROJECT MODEL',{exact:true})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}').entities?.[0]?.name)).toBe('Imported backup panel');
});


test('legacy STRATUM origin can hand off a validated Spatial graph to the current app',async({page})=>{
 await page.goto('/');
 const workspace=page.getByRole('region',{name:'Project workspace status'});
 await expect(workspace).toHaveAttribute('data-recovery-ready','true');
 await page.evaluate(value=>{
  localStorage.removeItem('stratum_compiled_graph');
  window.dispatchEvent(new MessageEvent('message',{
   origin:'https://stratum-twin-chain.vercel.app',
   data:{type:'STRATUM_SPATIAL_RECOVERY',version:1,graph:value,sourceOrigin:'https://stratum-twin-chain.vercel.app'}
  }));
 },graph('Legacy origin panel'));
 await expect(workspace).toContainText('MODEL FOUND');
 const name=await page.evaluate(()=>JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}').entities?.[0]?.name);
 expect(name).toBe('Legacy origin panel');
});

test('untrusted origin cannot inject a Spatial graph',async({page})=>{
 await page.goto('/');
 await page.evaluate(()=>{
  localStorage.removeItem('stratum_compiled_graph');
  localStorage.removeItem('stratum_compiled_graph_last_good_v2');
  localStorage.removeItem('stratum_compiled_graph_previous_v2');
 });
 await page.reload();
 await page.evaluate(value=>{
  window.dispatchEvent(new MessageEvent('message',{
   origin:'https://example.com',
   data:{type:'STRATUM_SPATIAL_RECOVERY',version:1,graph:value}
  }));
 },graph('Injected panel'));
 const stored=await page.evaluate(()=>localStorage.getItem('stratum_compiled_graph'));
 expect(stored).toBeNull();
});


test('IndexedDB current graph is authoritative over a stale localStorage compatibility shadow',async({page})=>{
 await page.goto('/compiler');
 await page.evaluate(async({primary,stale})=>{
  localStorage.setItem('stratum_compiled_graph',JSON.stringify(stale));
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{
   const request=indexedDB.open('stratum-spatial-recovery-v1',1);
   request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('graphs'))request.result.createObjectStore('graphs')};
   request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
  await new Promise<void>((resolve,reject)=>{
   const tx=db.transaction('graphs','readwrite');
   tx.objectStore('graphs').put(primary,'current');
   tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
  });
  db.close();
 },{primary:graph('IndexedDB primary panel'),stale:graph('Stale localStorage panel')});
 await page.goto('/spatial');
 await expect(page.getByRole('heading',{name:'Spatial model'})).toBeVisible();
 const imported=page.getByLabel('Imported object');
 await expect(imported).toContainText('IndexedDB primary panel',{timeout:15000});
 await imported.selectOption('panel-1');
 await expect.poll(()=>page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('stratum-spatial-recovery-v1',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
  return new Promise<string|null>(resolve=>{const request=db.transaction('graphs','readonly').objectStore('graphs').get('current');request.onsuccess=()=>resolve(request.result?.entities?.[0]?.name||null);request.onerror=()=>resolve(null)});
 })).toBe('IndexedDB primary panel');
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}').entities?.[0]?.name)).toBe('IndexedDB primary panel');
});
