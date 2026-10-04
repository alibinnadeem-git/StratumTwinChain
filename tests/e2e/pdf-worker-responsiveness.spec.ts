import {expect,test} from '@playwright/test';

function syntheticVectorPdf(pageCount=9,linesPerPage=6000){
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

test('native PDF worker stays responsive, can cancel, and retries the same file without reload',async({page},testInfo)=>{
 test.skip(testInfo.project.name!=='desktop-chromium','P0 parser stress test runs once on desktop Chromium.');
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
 await expect(page.getByText(/parsed off the UI thread/i)).toBeVisible({timeout:45000});
 await expect(page.getByText('PARSED',{exact:true})).toBeVisible();
 await expect(input).toBeEnabled();
 await page.evaluate(()=>window.clearInterval((window as any).__stratumHeartbeatTimer));
});
