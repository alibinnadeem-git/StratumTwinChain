import {expect,test} from '@playwright/test';

const source={name:'E-1.pdf',sha256:'a'.repeat(64),state:'parsed',ext:'pdf',size:100,summary:'Saved source',entities:1,discipline:'Electrical',floor:'L2',elevation:0};
const graph={version:'1.2',createdAt:'2026-10-24T00:00:00.000Z',sources:[source],
 entities:[{id:'panel-1',source:source.name,layer:'L2',kind:'text-asset-candidate',name:'PANEL LP-1',x:1,y:2,z:0,floor:'L2',confidence:.9,
  meta:{sourceSha256:source.sha256,relativeReviewSurfaceZ:3.2,zConstraintGraphStatus:'UNRESOLVED',zConstraintGraph:{status:'UNRESOLVED',nodes:[{id:'panel-base',kind:'ASSET_BASE'}]},humanReview:{reviewer:'engineer',decision:'retained'}}}],
 links:[{id:'reviewed-link',from:'panel-1',to:'panel-1',type:'REVIEWED_CONNECTION',confidence:1}],stats:{L0:1,L1:0,L2:1,L3:0,L4:0},
 reviewState:'REVIEW_REQUIRED',titleBlockReview:{confirmedSheet:'E-1'},projectFrameReview:{reviewer:'engineer',transform:[1,0,0,1,0,0]}};

async function saved(page:import('@playwright/test').Page){
 return page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('stratum-spatial-recovery-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  try{return await new Promise<any>((resolve,reject)=>{const r=db.transaction('graphs','readonly').objectStore('graphs').get('current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}finally{db.close()}
 });
}

test('a PDF worker crash records failure without rewriting the saved model or reviews',async({page})=>{
 await page.goto('/compiler');
 await page.evaluate(async value=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('stratum-spatial-recovery-v1',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('graphs'))r.result.createObjectStore('graphs')};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction('graphs','readwrite');tx.objectStore('graphs').put(value,'current');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)});db.close();
  localStorage.setItem('stratum_compiled_graph',JSON.stringify(value));window.dispatchEvent(new Event('stratum:graph-updated'));
 },graph);
 await page.reload();
 await expect(page.getByText(source.name,{exact:true}).first()).toBeVisible();
 const before=await saved(page);
 await page.evaluate(()=>{
  const Actual=window.Worker;
  window.Worker=class extends Actual{
   postMessage(message:any,options?:any){
    if(message?.type==='parse'){setTimeout(()=>this.dispatchEvent(new ErrorEvent('error',{message:'Synthetic worker failure'})),0);return}
    super.postMessage(message,options);
   }
  } as typeof Worker;
 });
 await page.locator('section.import-primary input[type=file]').first().setInputFiles({name:'failed-electrical.pdf',mimeType:'application/pdf',buffer:Buffer.from('synthetic failure input')});
 await expect(page.getByRole('status').filter({hasText:'Import finished'})).toContainText('Synthetic worker failure',{timeout:30000});
 const after=await saved(page);
 expect(after.entities).toEqual(before.entities);expect(after.links).toEqual(before.links);
 expect(after.createdAt).toBe(before.createdAt);expect(after.reviewState).toBe(before.reviewState);
 expect(after.titleBlockReview).toEqual(before.titleBlockReview);expect(after.projectFrameReview).toEqual(before.projectFrameReview);
 expect(after.sources.find((item:any)=>item.sha256===source.sha256)).toEqual(before.sources[0]);
 expect(after.sources.find((item:any)=>item.name==='failed-electrical.pdf')?.state).toBe('failed');
 await page.reload();
 await expect(page.getByText('FAILED',{exact:true})).toBeVisible();
 expect((await saved(page)).entities).toEqual(before.entities);
});
