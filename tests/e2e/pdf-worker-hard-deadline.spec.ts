import {expect,test} from '@playwright/test';

/**
 * An emitting but never-resolving worker must not indefinitely extend the
 * absolute parse deadline. No real project data or backend is touched.
 */
test('PDF worker hard deadline terminates continuous heartbeats without losing UI',async({page},testInfo)=>{
 if(testInfo.project.name!=='desktop-chromium')return;
 test.setTimeout(65000);
 await page.goto('/compiler');
 await page.clock.install();
 await page.evaluate(()=>{
  const ActualWorker=window.Worker;
  let terminated=0;
  class NeverFinishingWorker {
   onmessage:((event:any)=>void)|null=null;
   onerror:((event:any)=>void)|null=null;
   onmessageerror:((event:any)=>void)|null=null;
   private heartbeat:number|undefined;
   postMessage(data:any){
    const emit=()=>this.onmessage?.({data:{type:'heartbeat',requestId:data.requestId,page:9,total:9,phase:'spatial semantics',processed:1,workTotal:2}});
    emit();
    this.heartbeat=window.setInterval(emit,10000);
   }
   terminate(){terminated++;if(this.heartbeat!==undefined)window.clearInterval(this.heartbeat)}
  }
  (window as any).__workerDeadlineTerminated=()=>terminated;
  (window as any).Worker=NeverFinishingWorker as unknown as typeof Worker;
  (window as any).__workerDeadlineRestore=()=>{window.Worker=ActualWorker};
 });
 const input=page.locator('label.source-drop input[type="file"]');
 await input.setInputFiles({name:'Synthetic-Nine-Page-Stall.pdf',
   mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n%synthetic worker lifecycle fixture\n')});
 await expect(page.getByRole('status').filter({hasText:'PARSING'})).toContainText(/page 9 of 9/);
 await expect(page.getByRole('button',{name:'Cancel current PDF parse'})).toBeVisible();
 // Advancing in slices gives the interval a chance to emit repeatedly so the
 // idle watchdog remains satisfied while the independent hard deadline expires.
 for(let i=0;i<30;i++)await page.clock.fastForward(10000);
 await expect.poll(()=>page.evaluate(()=>(window as any).__workerDeadlineTerminated())).toBe(1);
 await expect(page.getByRole('status').filter({hasText:'IMPORT'}))
   .toContainText(/five-minute total safety budget|hard timeout/i);
 await expect(input).toBeAttached();
 await page.evaluate(()=>(window as any).__workerDeadlineRestore());
});
