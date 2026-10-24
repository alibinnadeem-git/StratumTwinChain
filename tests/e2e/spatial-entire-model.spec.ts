import {expect,test} from '@playwright/test';

test('entire-project view includes every sheet and unresolved candidate without changing source coordinates',async({page})=>{
 const sha='c'.repeat(64),source='E-All-Plans.pdf';
 const meta=(page:number)=>({page,sourceSha256:sha,nonSldPlan:true,planType:'ELECTRICAL_POWER_PLAN',coordinateUnits:'sheet',physicalTruth:false,elevationKnown:false});
 const entities=[
  {id:'panel',source,layer:'L2',kind:'text-asset-candidate',name:'PANEL LP-1',x:1,y:1,z:0,confidence:.9,floor:'UNRESOLVED',meta:{...meta(1),candidateRole:'INSTANCE'}},
  {id:'transformer',source,layer:'L2',kind:'text-asset-candidate',name:'TRANSFORMER T1',x:1,y:1,z:0,confidence:.9,floor:'UNRESOLVED',meta:{...meta(2),candidateRole:'INSTANCE'}},
  {id:'unresolved-co',source,layer:'L2',kind:'text-asset-candidate',name:'CO',x:2,y:1,z:0,confidence:.7,floor:'UNRESOLVED',meta:{...meta(2),electricalComponentHint:'CO_DETECTOR',candidateRole:'LABEL'}},
  {id:'registration-copy',source,layer:'L4',kind:'asset-candidate',name:'TRANSFORMER T1',x:1,y:1,z:0,confidence:.9,floor:'UNRESOLVED',meta:{...meta(2),derivedFrom:'transformer',candidateRole:'REGISTRATION_SHADOW'}},
  ...[1,2].map(p=>({id:'line-'+p,source,layer:'L1',kind:'line',name:'Drawing line',x:0,y:0,x2:4,y2:3,z:0,confidence:1,floor:'UNRESOLVED',meta:{...meta(p),drawingBasemap:true}})),
 ];
 await page.goto('/compiler');
 await page.evaluate(async graph=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('stratum-spatial-recovery-v1',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('graphs'))r.result.createObjectStore('graphs')};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction('graphs','readwrite');tx.objectStore('graphs').put(graph,'current');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)});db.close();localStorage.setItem('stratum_compiled_graph',JSON.stringify(graph));
 },{version:'1.2',createdAt:'2026-10-24T00:00:00Z',sources:[{name:source,sha256:sha,state:'parsed',ext:'pdf',discipline:'Electrical'}],entities,links:[],stats:{L0:1,L1:2,L2:3,L3:0,L4:1}});
 await page.goto('/spatial');
 const canvas=page.locator('canvas[aria-label="Interactive Spatial model"]');
 await expect(page.getByLabel('Sheet page isolation')).toHaveValue('PROJECT');
 await expect(canvas).toBeVisible();
 await expect(canvas).toHaveAttribute('data-source-sheets','2');
 await expect(canvas).toHaveAttribute('data-review-candidates','1');
 await expect(canvas).toHaveAttribute('data-clickable-assets','2');
 await page.getByLabel('Imported object').selectOption('unresolved-co');
 await expect(page.getByRole('heading',{name:'CO',exact:true})).toBeVisible();
 await page.getByLabel('Sheet page isolation').selectOption(sha+':1');
 await expect(canvas).toHaveAttribute('data-source-sheets','1');
 await page.getByRole('button',{name:'Show entire model',exact:true}).click();
 await expect(canvas).toHaveAttribute('data-source-sheets','2');
 await expect(canvas).toHaveAttribute('data-review-candidates','1');
 const coordinates=await page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('stratum-spatial-recovery-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  const graph=await new Promise<any>((resolve,reject)=>{const r=db.transaction('graphs','readonly').objectStore('graphs').get('current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});db.close();
  return graph.entities.filter((e:any)=>['panel','transformer','unresolved-co','line-1','line-2'].includes(e.id)).map((e:any)=>({id:e.id,x:e.x,y:e.y}));
 });
 expect(coordinates).toEqual(entities.filter(e=>['panel','transformer','unresolved-co','line-1','line-2'].includes(e.id)).map(e=>({id:e.id,x:e.x,y:e.y})));
});
