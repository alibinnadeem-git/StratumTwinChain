import {expect,test} from '@playwright/test';
import fs from 'node:fs';

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

function largePdfBeyondLegacyLimit(){
 const base=syntheticVectorPdf(1,25);
 const target=65*1024*1024+1024;
 const padding=Buffer.alloc(Math.max(0,target-base.length),0x20);
 return Buffer.concat([base,Buffer.from('\n% LARGE SOURCE TEST PADDING\n'),padding]);
}

test('valid PDF beyond the legacy 64 MB ceiling enters LARGE_SOURCE parsing instead of failing on size',async({page},testInfo)=>{
 test.setTimeout(120000);
 if(testInfo.project.name!=='desktop-chromium')return;
 await page.goto('/import');
 const pdf=largePdfBeyondLegacyLimit();
 expect(pdf.byteLength).toBeGreaterThan(64*1024*1024);
 expect(pdf.byteLength).toBeLessThan(250*1024*1024);
 const input=page.locator('section.import-primary input[type=file][accept*=".pdf"]');
 const filePath=testInfo.outputPath('large-source-over-64mb.pdf');
 fs.writeFileSync(filePath,pdf);
 await input.setInputFiles(filePath);
 await expect(page.getByText('large-source-over-64mb.pdf',{exact:true})).toBeVisible({timeout:15000});
 await expect(page.getByText(/large-source bounded parse off the UI thread/i)).toBeVisible({timeout:90000});
 await expect(page.getByText('PARSED',{exact:true})).toBeVisible();
 await expect(page.getByRole('status')).not.toContainText(/browser parser limit is 64|split the set/i);
});

test('native PDF worker stays responsive, can cancel, and retries the same file without reload',async({page},testInfo)=>{
 test.setTimeout(75000);
 if(testInfo.project.name!=='desktop-chromium')return;
 await page.goto('/import');
 await page.evaluate(()=>{
  (window as any).__stratumHeartbeat=0;
  (window as any).__stratumHeartbeatTimer=window.setInterval(()=>{(window as any).__stratumHeartbeat++},25);
 });
 const pdf=syntheticVectorPdf();
 const input=page.locator('section.import-primary input[type=file][accept*=".pdf"]');
 await input.setInputFiles({name:'worker-stress-electrical.pdf',mimeType:'application/pdf',buffer:pdf});
 const cancel=page.getByRole('button',{name:'Cancel current PDF parse'});
 await expect(cancel).toBeVisible({timeout:10000});
 const before=await page.evaluate(()=>(window as any).__stratumHeartbeat);
 await page.waitForTimeout(250);
 const after=await page.evaluate(()=>(window as any).__stratumHeartbeat);
 expect(after).toBeGreaterThan(before);
 await cancel.click();
 await expect(page.getByRole('status').filter({hasText:/canceled|review exception/i})).toBeVisible({timeout:10000});
 await expect(input).toBeEnabled();

 await input.setInputFiles({name:'worker-stress-electrical.pdf',mimeType:'application/pdf',buffer:pdf});
 await expect(page.getByText('worker-stress-electrical.pdf',{exact:true})).toBeVisible();
 await expect(page.getByText(/standard parse off the UI thread/i)).toBeVisible({timeout:60000});
 await expect(page.getByText('PARSED',{exact:true})).toBeVisible();
 await expect(page.locator('section.import-primary input[type=file][accept*=".pdf"]')).toBeEnabled();
 await page.evaluate(()=>window.clearInterval((window as any).__stratumHeartbeatTimer));
});

// Graph finalization (enrich/compile/project) runs in its own worker after the PDF parse. A real
// worker is used for the PDF; only graph-task messages are swallowed, so that worker never replies.
async function stallGraphWorker(page:import('@playwright/test').Page){
 await page.evaluate(()=>{
  const ActualWorker=window.Worker;
  const graphTasks=new Set(['enrich','compile','assemble','project']);
  let stalled=0,terminated=0;
  class StallingGraphWorker extends ActualWorker{
   private swallowed=false;
   postMessage(message:any,options?:any){
    if(graphTasks.has(message?.type)){this.swallowed=true;stalled++;return}
    super.postMessage(message,options);
   }
   terminate(){if(this.swallowed)terminated++;super.terminate()}
  }
  window.Worker=StallingGraphWorker as unknown as typeof Worker;
  (window as any).__graphStalled=()=>stalled;
  (window as any).__graphTerminated=()=>terminated;
  (window as any).__restoreWorker=()=>{window.Worker=ActualWorker};
 });
}

test('silent graph worker is stopped by its deadline and the same PDF retries without reload',async({page},testInfo)=>{
 test.setTimeout(120000);
 if(testInfo.project.name!=='desktop-chromium')return;
 await page.goto('/import');
 await page.clock.install();
 await stallGraphWorker(page);
 const pdf=syntheticVectorPdf(1,1200);
 const input=page.locator('section.import-primary input[type=file][accept*=".pdf"]');
 await input.setInputFiles({name:'graph-stall.pdf',mimeType:'application/pdf',buffer:pdf});
 await expect.poll(()=>page.evaluate(()=>(window as any).__graphStalled()),{timeout:60000}).toBeGreaterThan(0);
 await expect(page.getByRole('button',{name:'Cancel current PDF parse'})).toBeEnabled();
 // Ten simulated minutes: the three-minute graph deadline must release the import.
 for(let i=0;i<20;i++)await page.clock.fastForward(30000);
 await expect(page.getByRole('status').filter({hasText:/did not finish within 3 minutes/})).toBeVisible();
 await expect(page.getByRole('status').filter({hasText:/Existing saved work is unchanged; retry is available/})).toBeVisible();
 await expect(input).toBeEnabled();
 expect(await page.evaluate(()=>(window as any).__graphTerminated())).toBeGreaterThan(0);

 await page.evaluate(()=>(window as any).__restoreWorker());
 await input.setInputFiles({name:'graph-stall.pdf',mimeType:'application/pdf',buffer:pdf});
 await expect(page.getByRole('status').filter({hasText:/Source compilation updated/})).toBeVisible({timeout:60000});
 await expect(page.getByText('PARSED',{exact:true})).toBeVisible();
 await expect(input).toBeEnabled();
});

test('graph finalization can be canceled and leaves upload available',async({page},testInfo)=>{
 test.setTimeout(90000);
 if(testInfo.project.name!=='desktop-chromium')return;
 await page.goto('/import');
 await stallGraphWorker(page);
 const input=page.locator('section.import-primary input[type=file][accept*=".pdf"]');
 await input.setInputFiles({name:'graph-cancel.pdf',mimeType:'application/pdf',buffer:syntheticVectorPdf(1,1200)});
 await expect.poll(()=>page.evaluate(()=>(window as any).__graphStalled()),{timeout:60000}).toBeGreaterThan(0);
 await page.getByRole('button',{name:'Cancel current PDF parse'}).click();
 await expect(page.getByRole('status').filter({hasText:/Graph finalization was canceled/})).toBeVisible({timeout:10000});
 await expect(input).toBeEnabled();
 expect(await page.evaluate(()=>(window as any).__graphTerminated())).toBeGreaterThan(0);
 await page.evaluate(()=>(window as any).__restoreWorker());
});
