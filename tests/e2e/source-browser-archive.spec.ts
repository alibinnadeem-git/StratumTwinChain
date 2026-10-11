import {createHash} from 'node:crypto';
import {expect,test} from '@playwright/test';

const sourceInput=(page:any)=>page.locator('label.source-drop input[type="file"]');

test('compiler preserves accepted source bytes in browser-local IndexedDB by SHA-256',async({page})=>{
 const csv=[
  'TAG,DESCRIPTION,VOLTAGE,PHASE,FLA,LOCATION',
  'AHU-ARCHIVE-1,Air Handling Unit,480,3,12,Mechanical Room'
 ].join('\n');
 const sha=createHash('sha256').update(csv).digest('hex');

 await page.goto('/compiler');
 await sourceInput(page).setInputFiles({name:'M-Archive-Equipment-Schedule.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
 await expect(page.getByText(/powered equipment candidate/i)).toBeVisible();

 await expect.poll(()=>page.evaluate(async digest=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{
   const request=indexedDB.open('stratum-source-archive-v1',1);
   request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
  return new Promise<any>(resolve=>{
   const request=db.transaction('sources','readonly').objectStore('sources').get(digest);
   request.onsuccess=()=>{
    const record=request.result;
    resolve(record?{name:record.name,size:record.size,text:new TextDecoder().decode(record.bytes)}:null);
   };
   request.onerror=()=>resolve(null);
  });
 },sha),{timeout:15000}).toEqual({name:'M-Archive-Equipment-Schedule.csv',size:Buffer.byteLength(csv),text:csv});

 const archived=page.locator('.import-summary div').filter({hasText:'Sources archived locally'});
 await expect(archived.locator('strong')).toHaveText('1');
});

test('stale drawing can use archived source and failed reprocess preserves previous graph',async({page})=>{
 const invalidPdf='not a valid pdf source';
 const sha=createHash('sha256').update(invalidPdf).digest('hex');
 const drawing='G101 Archived Legacy Site Plan.pdf';

 await page.goto('/compiler');
 await page.evaluate(async({sha,drawing,bytes})=>{
  const graph={
   version:'1.1',createdAt:new Date().toISOString(),reviewState:'REVIEW_REQUIRED',
   sources:[{name:drawing,ext:'pdf',sha256:sha,discipline:'Electrical',floor:'L1',elevation:0,state:'parsed',entities:1,vectors:587,textItems:84,sldPages:0,size:bytes.length,summary:'Legacy parsed drawing'}],
   entities:[{id:'legacy-callout',source:drawing,layer:'L2',kind:'text-asset-candidate',name:'NEW TESLA PSU & SUPERCHARGER',x:1,y:1,z:0,confidence:.86,floor:'L1',meta:{sourceSha256:sha,elevationKnown:false,physicalTruth:false,reviewRequired:true}}],
   links:[],stats:{L0:1,L1:0,L2:1,L3:0,L4:0}
  };

  localStorage.setItem('stratum_compiled_graph',JSON.stringify(graph));

  const graphDb=await new Promise<IDBDatabase>((resolve,reject)=>{
   const request=indexedDB.open('stratum-spatial-recovery-v1',1);
   request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('graphs'))request.result.createObjectStore('graphs')};
   request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
  await new Promise<void>((resolve,reject)=>{
   const tx=graphDb.transaction('graphs','readwrite');const store=tx.objectStore('graphs');
   store.put(graph,'current');store.put(graph,'latest');
   tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
  });

  const archiveDb=await new Promise<IDBDatabase>((resolve,reject)=>{
   const request=indexedDB.open('stratum-source-archive-v1',1);
   request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('sources'))request.result.createObjectStore('sources',{keyPath:'sha256'})};
   request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
  await new Promise<void>((resolve,reject)=>{
   const tx=archiveDb.transaction('sources','readwrite');
   tx.objectStore('sources').put({sha256:sha,name:drawing,mimeType:'application/pdf',size:bytes.length,ext:'pdf',archivedAt:new Date().toISOString(),bytes:new Uint8Array(bytes).buffer});
   tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
  });
 },{sha,drawing,bytes:Array.from(Buffer.from(invalidPdf))});

 await page.reload();

 const warning=page.getByRole('alert').filter({hasText:'REPROCESS SAVED DRAWING'});
 await expect(warning).toBeVisible();
 await expect(warning).toContainText(/available in this browser's protected local archive/i);
 const button=warning.getByRole('button',{name:'Reprocess archived drawing'});
 await expect(button).toBeEnabled();
 const row=page.getByRole('button',{name:`Reprocess ${drawing}`});
 await expect(row).toBeEnabled();
 await row.click();
 await expect(page.getByRole('status').filter({hasText:'LOCAL SOURCE ARCHIVE'})).toContainText(/REPROCESS QUEUED|Reprocessing/i);

 await expect(row).toBeEnabled({timeout:20000});
 await button.click();
 await expect(button).toBeEnabled({timeout:20000});

 await expect.poll(()=>page.evaluate(()=>{
  const graph=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}');
  return{
   source:Boolean((graph.sources||[]).some((item:any)=>item.name==='G101 Archived Legacy Site Plan.pdf')),
   entity:Boolean((graph.entities||[]).some((item:any)=>item.id==='legacy-callout')),
   basemap:Boolean((graph.entities||[]).some((item:any)=>item.meta?.drawingBasemap===true))
  };
 }),{timeout:20000}).toEqual({source:true,entity:true,basemap:false});

 await expect(page.locator('.import-summary div').filter({hasText:'Reprocess required'}).locator('strong')).toHaveText('1');
});

