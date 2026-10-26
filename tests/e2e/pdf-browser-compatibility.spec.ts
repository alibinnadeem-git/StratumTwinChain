import {expect,test} from '@playwright/test';

function textPdf(){
 const stream='BT /F1 14 Tf 40 750 Td (FIRST FLOOR PLAN) Tj ET\nBT /F1 12 Tf 40 725 Td (PANEL LP-1) Tj ET\nBT /F1 12 Tf 40 700 Td (120 V 1PH) Tj ET\n40 40 m 200 40 l 200 160 l 40 160 l h S\n';
 const objects=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,
 ];
 let pdf='%PDF-1.4\n';const offsets=[0];
 for(const [i,body] of objects.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${body}\nendobj\n`;}
 const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
 for(const offset of offsets.slice(1))pdf+=String(offset).padStart(10,'0')+' 00000 n \n';
 pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 return Buffer.from(pdf);
}

test('PDF text extraction works when workers have no ReadableStream async iterator',async({page})=>{
 const probes:string[]=[];
 page.on('console',message=>{if(message.text().includes('PDF_STREAM_ITERATOR_DISABLED'))probes.push(message.text())});
 // Exercise the shipping-Safari capability gap even when this suite runs on newer Chromium/WebKit.
 await page.route('**/turbopack-worker-*.js',async route=>{
  const response=await route.fetch();
  const prefix='delete ReadableStream.prototype[Symbol.asyncIterator];console.info("PDF_STREAM_ITERATOR_DISABLED",typeof ReadableStream.prototype[Symbol.asyncIterator]);\n';
  await route.fulfill({response,body:prefix+await response.text()});
 });
 await page.goto('/compiler');
 await page.locator('input[type=file][accept*=".dxf"]').first().setInputFiles({name:'browser-compatibility-electrical.pdf',mimeType:'application/pdf',buffer:textPdf()});
 await expect(page.getByText('PARSED',{exact:true})).toBeVisible({timeout:30000});
 expect(probes.some(value=>value.includes('undefined')),'the parser worker must actually lack the async iterator').toBe(true);
 await expect.poll(()=>page.evaluate(()=>{
  const graph=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}');
  return(graph.entities||[]).some((entity:any)=>String(entity.name).includes('LP-1'));
 })).toBe(true);
 await expect(page.getByRole('button',{name:'Render Spatial Environment'})).toBeEnabled();
});
