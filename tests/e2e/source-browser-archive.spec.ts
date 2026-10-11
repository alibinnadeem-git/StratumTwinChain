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

function syntheticVectorPdf(pageCount=9,linesPerPage=1000){
 const escape=(value:string)=>value.replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
 const pageIds=Array.from({length:pageCount},(_,i)=>3+i*2);
 const contentIds=pageIds.map(id=>id+1);
 const fontId=3+pageCount*2;
 const bodies:string[]=[];
 bodies[0]='<< /Type /Catalog /Pages 2 0 R >>';
 bodies[1]=`<< /Type /Pages /Kids [${pageIds.map(id=>id+' 0 R').join(' ')}] /Count ${pageCount} >>`;
 for(let page=0;page<pageCount;page++){
  const labels=['FIRST FLOOR PLAN','E - 4','ELEC.','PANEL LP-1','HP1-12,14','SCALE: 1/8" = 1\'-0"'];
  const text=labels.map((label,index)=>`BT /F1 10 Tf 42 ${760-index*18} Td (${escape(label)}) Tj ET`).join('\n');
  let vectors='';
  for(let i=0;i<linesPerPage;i++){
   const x=30+(i%500),y=80+((i*7)%600),x2=x+12+(i%9),y2=y+((i%5)-2);
   vectors+=`${x} ${y} m ${x2} ${y2} l S\n`;
  }
  const stream=text+'\n'+vectors;
  bodies[pageIds[page]-1]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentIds[page]} 0 R >>`;
  bodies[contentIds[page]-1]=`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`;
 }
 bodies[fontId-1]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
 let pdf='%PDF-1.4\n',offset=Buffer.byteLength(pdf),offsets=[0];
 bodies.forEach((body,index)=>{offsets[index+1]=offset;const object=`${index+1} 0 obj\n${body}\nendobj\n`;pdf+=object;offset+=Buffer.byteLength(object)});
 const xref=offset;pdf+=`xref\n0 ${bodies.length+1}\n0000000000 65535 f \n`;
 for(let i=1;i<=bodies.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
 pdf+=`trailer\n<< /Size ${bodies.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 return Buffer.from(pdf);
}

test('saved drawing REPROCESS queues visibly behind an active worker parse',async({page},testInfo)=>{
 test.setTimeout(75000);
 if(testInfo.project.name!=='desktop-chromium')return;
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
 const row=page.getByRole('button',{name:`Reprocess ${drawing}`});
 await expect(row).toBeEnabled();
 const activeFile=syntheticVectorPdf(12,1200);
 await sourceInput(page).setInputFiles({name:'parallel-electrical.pdf',mimeType:'application/pdf',buffer:activeFile});
 const cancel=page.getByRole('button',{name:'Cancel current PDF parse'});
 await expect(cancel).toBeVisible({timeout:10000});
 await expect(row).toBeEnabled();
 await row.click();
 await expect(row).toHaveText('QUEUED');
 await expect(page.getByRole('status').filter({hasText:'LOCAL SOURCE ARCHIVE'})).toContainText(/REPROCESS QUEUED:.*after the current parse/i);
 await cancel.click();
 await expect(page.getByRole('status').filter({hasText:'LOCAL SOURCE ARCHIVE'})).toContainText(/Reprocessing 1 protected browser-local drawing/,{timeout:30000});
 await expect.poll(()=>page.evaluate(()=>{
  const graph=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}');
  return Boolean((graph.sources||[]).some((source:any)=>source.name==='G101 Archived Legacy Site Plan.pdf'))&&
   Boolean((graph.entities||[]).some((entity:any)=>entity.id==='legacy-callout'));
 }),{timeout:30000}).toBe(true);
});

test('archived plan REPROCESS retains a source basemap and explicitly reports unresolved downstream stages',async({page},testInfo)=>{
 test.setTimeout(60000);
 if(testInfo.project.name!=='desktop-chromium')return;
 const drawing='E-4 Synthetic First Floor Plan.pdf';
 const buffer=syntheticVectorPdf(1,1500);
 const sha=createHash('sha256').update(buffer).digest('hex');
 await page.goto('/compiler');
 await page.evaluate(async({drawing,sha,bytes})=>{
   const graph={
     version:'1.1',createdAt:new Date().toISOString(),reviewState:'REVIEW_REQUIRED',
     sources:[{name:drawing,ext:'pdf',sha256:sha,discipline:'Electrical',floor:'L1',
       elevation:0,state:'parsed',entities:1,vectors:1300,textItems:6,
       nonSldPlanPages:1,planTypes:['ELECTRICAL_POWER_PLAN'],sldPages:0,
       size:bytes.length,summary:'Recognized historical plan metadata; source basemap absent'}],
     entities:[{id:'legacy-sheet-label',source:drawing,layer:'L2',kind:'text-asset-candidate',
       name:'PANEL LP-1',x:1,y:1,z:0,floor:'L1',confidence:.7,
       meta:{sourceSha256:sha,physicalTruth:false,reviewRequired:true}}],
     links:[],stats:{L0:1,L1:0,L2:1,L3:0,L4:0}
   };
   localStorage.setItem('stratum_compiled_graph',JSON.stringify(graph));
   const db=await new Promise<IDBDatabase>((resolve,reject)=>{
     const r=indexedDB.open('stratum-spatial-recovery-v1',1);
     r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('graphs'))r.result.createObjectStore('graphs')};
     r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
   });
   await new Promise<void>((resolve,reject)=>{
     const tx=db.transaction('graphs','readwrite'),store=tx.objectStore('graphs');
     store.put(graph,'current');store.put(graph,'latest');
     tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
   });
   db.close();
   const archive=await new Promise<IDBDatabase>((resolve,reject)=>{
     const r=indexedDB.open('stratum-source-archive-v1',1);
     r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('sources'))r.result.createObjectStore('sources',{keyPath:'sha256'})};
     r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
   });
   await new Promise<void>((resolve,reject)=>{
     const tx=archive.transaction('sources','readwrite');
     tx.objectStore('sources').put({sha256:sha,name:drawing,mimeType:'application/pdf',
       size:bytes.length,ext:'pdf',archivedAt:new Date().toISOString(),bytes:new Uint8Array(bytes).buffer});
     tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
   });
   archive.close();
 },{drawing,sha,bytes:Array.from(buffer)});
 await page.reload();
 const row=page.getByRole('button',{name:`Reprocess ${drawing}`});
 await expect(row).toBeEnabled();
 await row.click();
 await expect(page.getByRole('status').filter({hasText:'LOCAL SOURCE ARCHIVE'}))
   .toContainText(/REPROCESS QUEUED|Reprocessing|REPROCESS ATTEMPT FINISHED/);
 await expect.poll(()=>page.evaluate(({sha})=>{
   const graph=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}');
   const source=(graph.sources||[]).find((s:any)=>s.sha256===sha);
   const entities=(graph.entities||[]).filter((e:any)=>e.meta?.sourceSha256===sha);
   return{
     plans:Number(source?.nonSldPlanPages||0),
     basemap:entities.some((e:any)=>e.meta?.drawingBasemap===true),
     sourceStillThere:Boolean(source),
     sourceState:source?.state||'unknown',
     summary:String(source?.summary||'')
   };
 },{sha}),{timeout:45000}).toMatchObject({sourceStillThere:true,sourceState:'parsed',basemap:true,plans:1});
 const status=await page.evaluate(({sha})=>{
   const graph=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}');
   return String((graph.sources||[]).find((s:any)=>s.sha256===sha)?.summary||'');
 },{sha});
 expect(status).toContain('REPROCESS AUDIT');
 expect(status).toContain('PARSER CAPABILITY GAP');
});
