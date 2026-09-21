import {expect,test} from '@playwright/test';

const tinyPng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlP7wAAAABJRU5ErkJggg==','base64');

function syntheticElectricalPdf(lines:string[]){
 const escape=(value:string)=>value.replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
 const stream=lines.map((line,index)=>`BT /F1 12 Tf 72 ${740-index*46} Td (${escape(line)}) Tj ET`).join('\n')+'\n70 755 m 70 500 l S\n';
 const bodies=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
  `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
 ];
 let pdf='%PDF-1.4\n',offset=Buffer.byteLength(pdf),offsets=[0];
 bodies.forEach((body,index)=>{offsets.push(offset);const object=`${index+1} 0 obj\n${body}\nendobj\n`;pdf+=object;offset+=Buffer.byteLength(object)});
 const xref=offset;pdf+='xref\n0 6\n0000000000 65535 f \n';
 for(let i=1;i<=5;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
 pdf+=`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 return Buffer.from(pdf);
}

test('content-only electrical SLD upload populates the Spatial model',async({page})=>{
 await page.goto('/compiler');
 const pdf=syntheticElectricalPdf(['UTILITY SERVICE 12KV','XFMR-1','SWBD-1','MDP-1','CB-12','480V FEEDER']);
 await page.locator('section.import-primary input[type=file][accept*=".pdf"]').setInputFiles({name:'project-power-sheet.pdf',mimeType:'application/pdf',buffer:pdf});
 await expect(page.getByText('project-power-sheet.pdf',{exact:true})).toBeVisible();
 await expect.poll(async()=>page.evaluate(()=>{
  const graph=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}');
  const sld=(graph.entities||[]).filter((entity:any)=>entity.layer==='L2'&&entity.meta?.sldCandidate===true),feeders=(graph.entities||[]).filter((entity:any)=>entity.kind==='sld-feeder-candidate'),vectorTagged=sld.filter((entity:any)=>entity.meta?.sldVectorComponent!==undefined);
  return {sources:graph.sources?.length||0,names:sld.map((entity:any)=>entity.name),classes:sld.map((entity:any)=>entity.meta?.electricalComponentHint),vectorReady:feeders.length>0&&vectorTagged.length>=3};
 }),{timeout:15000}).toMatchObject({
  sources:expect.any(Number),
  names:expect.arrayContaining(['UTILITY SERVICE 12KV','XFMR-1','SWBD-1','MDP-1','CB-12']),
  classes:expect.arrayContaining(['UTILITY_SOURCE','TRANSFORMER','SWITCHBOARD','BREAKER']),
  vectorReady:true
 });
 await page.getByRole('link',{name:'Open Spatial'}).last().click();
 await expect(page).toHaveURL(/\/spatial$/);
 await expect(page.getByRole('heading',{name:'Spatial model'})).toBeVisible();
 await expect(page.getByText(/SLD object\(s\)/)).toContainText(/[1-9]\d* SLD object\(s\)/);
});

test('portable Spatial recovery exports protected history and restores the working graph',async({page})=>{
 await page.goto('/compiler');
 const seeded=await page.evaluate(()=>{
  const graph={
   version:'recovery-test-1',createdAt:'2026-09-21T07:10:00.000Z',
   sources:[{name:'legacy-sld.pdf',ext:'pdf',sha256:'a'.repeat(64),discipline:'Electrical',floor:'UNRESOLVED',elevation:0}],
   entities:[{id:'legacy-xfmr',source:'legacy-sld.pdf',layer:'L2',kind:'text-asset-candidate',name:'XFMR-1',x:1,y:2,z:0,confidence:.9,meta:{sldCandidate:true}}],
   links:[{id:'legacy-link',from:'legacy-xfmr',to:'legacy-xfmr',type:'SOURCE_RELATION',confidence:.7}],
   stats:{L0:1,L1:0,L2:1,L3:0,L4:0}
  };
  localStorage.setItem('stratum_compiled_graph',JSON.stringify(graph));
  localStorage.setItem('stratum_compiled_graph_last_good_v2',JSON.stringify(graph));
  localStorage.setItem('stratum_compiled_graph_previous_v2',JSON.stringify({...graph,version:'recovery-test-previous'}));
  window.dispatchEvent(new Event('stratum:graph-updated'));
  return graph;
 });
 await page.getByText('Advanced compiler details',{exact:true}).click();
 await expect(page.getByRole('heading',{name:'Move the full browser Spatial workspace safely'})).toBeVisible();
 const downloadPromise=page.waitForEvent('download');
 await page.getByRole('button',{name:'Export recovery bundle'}).click();
 const download=await downloadPromise;
 expect(download.suggestedFilename()).toMatch(/^stratum-spatial-recovery-.*\.json$/);
 const downloadPath=await download.path();
 expect(downloadPath).toBeTruthy();
 const preImport=await page.evaluate(()=>{
  const graph={
   version:'pre-import-newer',createdAt:'2026-09-21T07:20:00.000Z',
   sources:[{name:'newer-plan.pdf',ext:'pdf',sha256:'b'.repeat(64),discipline:'Electrical',floor:'L1',elevation:0}],
   entities:[{id:'newer-panel',source:'newer-plan.pdf',layer:'L2',kind:'text-asset-candidate',name:'PANEL-LP1',x:4,y:5,z:0,confidence:.91}],
   links:[],stats:{L0:1,L1:0,L2:1,L3:0,L4:0}
  };
  localStorage.setItem('stratum_compiled_graph',JSON.stringify(graph));
  localStorage.setItem('stratum_compiled_graph_last_good_v2',JSON.stringify(graph));
  window.dispatchEvent(new Event('stratum:graph-updated'));
  return graph;
 });
 await page.locator('section[aria-label="Portable Spatial recovery"] input[type=file]').setInputFiles(downloadPath!);
 await expect(page.getByRole('status').filter({hasText:'Recovery bundle restored'})).toBeVisible();
 const recovered=await page.evaluate(()=>{
  const restored=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}');
  const preImportKeys=Object.keys(localStorage).filter(key=>key.startsWith('stratum_spatial_preimport_'));
  const preImportGraphs=preImportKeys.map(key=>JSON.parse(localStorage.getItem(key)||'{}'));
  return{restored,preImportGraphs};
 });
 expect(recovered.restored).toEqual(seeded);
 expect(recovered.preImportGraphs).toContainEqual(preImport);
});

test('manual plan annotations persist deletion and restore without resurrecting removed marks',async({page})=>{
 await page.goto('/compiler');
 await page.getByText('Advanced compiler details',{exact:true}).click();
 await page.getByText('Manual annotation',{exact:true}).click();
 await page.getByLabel('Plan image').setInputFiles({name:'annotation-plan.png',mimeType:'image/png',buffer:tinyPng});
 await page.getByLabel('Annotation text').fill('PANEL-LP1');
 await page.getByLabel('Drawing reference').fill('E-201');
 await page.getByAltText('annotation-plan.png').click({position:{x:1,y:1}});
 await expect(page.getByText('PANEL-LP1 · E-201')).toBeVisible();
 await page.getByRole('button',{name:'Save annotations to Spatial'}).click();
 await expect(page.getByRole('status').filter({hasText:'Annotations saved in this browser'})).toContainText(/Annotations saved in this browser/i);

 const saved=await page.evaluate(()=>{
  const graph=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}');
  const annotated=(graph.entities||[]).filter((entity:any)=>entity.meta?.sourceType==='MANUAL_IMAGE_ANNOTATION');
  const records=Object.values(graph.annotationSources||{}) as any[];
  return {entities:annotated.length,marks:records.reduce((sum,record)=>sum+(record.marks?.length||0),0)};
 });
 expect(saved).toEqual({entities:1,marks:1});

 await page.getByRole('button',{name:'Remove'}).click();
 await expect(page.getByText('PANEL-LP1 · E-201')).toHaveCount(0);
 await page.getByRole('button',{name:'Save annotations to Spatial'}).click();
 await expect(page.getByRole('status').filter({hasText:'Annotations saved in this browser'})).toContainText(/Annotations saved in this browser/i);

 const afterDelete=await page.evaluate(()=>{
  const graph=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}');
  const annotated=(graph.entities||[]).filter((entity:any)=>entity.meta?.sourceType==='MANUAL_IMAGE_ANNOTATION');
  const records=Object.values(graph.annotationSources||{}) as any[];
  return {entities:annotated.length,marks:records.reduce((sum,record)=>sum+(record.marks?.length||0),0)};
 });
 expect(afterDelete).toEqual({entities:0,marks:0});

 await page.reload();
 await page.getByText('Advanced compiler details',{exact:true}).click();
 await page.getByText('Manual annotation',{exact:true}).click();
 await page.getByLabel('Saved plan').selectOption({label:'annotation-plan.png'});
 await expect(page.getByText('PANEL-LP1 · E-201')).toHaveCount(0);
 const restored=await page.evaluate(()=>{
  const graph=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}');
  const records=Object.values(graph.annotationSources||{}) as any[];
  return records.reduce((sum,record)=>sum+(record.marks?.length||0),0);
 });
 expect(restored).toBe(0);
});

test('sheet review requires explicit room confirmation and alignment remains reversible',async({page})=>{
 await page.goto('/compiler');
 await page.evaluate(()=>{
  localStorage.setItem('stratum_compiled_graph',JSON.stringify({
   version:'1.1',createdAt:new Date().toISOString(),
   sources:[{name:'review-sheet.pdf',ext:'pdf',sha256:'review-sha',discipline:'Architectural',floor:'UNRESOLVED',elevation:0}],
   entities:[{
    id:'pdf-room-1-test',source:'review-sheet.pdf',layer:'L1',kind:'vector-boundary-candidate',name:'PDF closed path · page 1',
    x:5,y:2.5,z:0,floor:'UNRESOLVED',confidence:.74,
    vertices:[{x:0,y:0},{x:10,y:0},{x:10,y:5},{x:0,y:5},{x:0,y:0}],
    meta:{page:1,sourceSha256:'review-sha',reviewRequired:true,geometryValidated:false,coordinateUnits:'sheet',elevationKnown:false}
   }],links:[],stats:{L0:1,L1:1,L2:0,L3:0,L4:0}
  }));
  window.dispatchEvent(new Event('stratum:graph-updated'));
 });

 await page.getByText('Advanced compiler details',{exact:true}).click();
 const review=page.getByRole('region',{name:'Drawing review'});
 await expect(review).toBeVisible();
 await expect(review.getByLabel('Drawing sheet')).toBeHidden();
 await review.getByText('Review drawing geometry',{exact:true}).click();
 await expect(review.getByLabel('Drawing sheet')).toBeVisible();
 await review.getByLabel('Drawing sheet').selectOption({label:'review-sheet.pdf · page 1'});
 await review.locator('select').nth(1).selectOption('pdf-room-1-test');
 await review.getByLabel('Reviewed room name').fill('Electrical Room 101');
 await review.getByRole('button',{name:'Confirm selected boundary as room'}).click();
 await expect(review.getByRole('status')).toContainText(/Drawing review saved/i);

 let state=await page.evaluate(()=>{
  const entity=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}').entities[0];
  return {kind:entity.kind,validated:entity.meta.geometryValidated,reviewRequired:entity.meta.reviewRequired,review:entity.meta.geometryReview};
 });
 expect(state).toEqual({kind:'room-boundary',validated:true,reviewRequired:false,review:'manual-boundary-review'});

 await review.getByRole('button',{name:'Undo room confirmation'}).click();
 state=await page.evaluate(()=>{
  const entity=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}').entities[0];
  return {kind:entity.kind,validated:entity.meta.geometryValidated,reviewRequired:entity.meta.reviewRequired,review:entity.meta.geometryReview};
 });
 expect(state.kind).toBe('vector-boundary-candidate');
 expect(state.validated).toBe(false);
 expect(state.reviewRequired).toBe(true);

 await review.getByText('Alignment & elevation controls',{exact:true}).click();
 const values:Record<string,string>={
  'Sheet A X':'0','Sheet A Y':'0','Sheet B X':'10','Sheet B Y':'0',
  'Project A X (m)':'100','Project A Y (m)':'200','Project B X (m)':'120','Project B Y (m)':'200',
  'Floor identifier':'L2','Measured elevation (m)':'4'
 };
 for(const [label,value] of Object.entries(values))await review.getByLabel(label).fill(value);
 await review.getByRole('button',{name:'Apply sheet alignment'}).click();
 await expect(review.getByRole('status')).toContainText(/Drawing review saved/i);

 const aligned=await page.evaluate(()=>{
  const entity=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}').entities[0];
  return {x:entity.x,y:entity.y,z:entity.z,floor:entity.floor,units:entity.meta.coordinateUnits,method:entity.meta.alignmentMethod,verified:entity.meta.alignmentVerified,original:entity.meta.sheetOriginal};
 });
 expect(aligned.x).toBeCloseTo(110,8);
 expect(aligned.y).toBeCloseTo(205,8);
 expect(aligned.z).toBe(4);
 expect(aligned.floor).toBe('L2');
 expect(aligned.units).toBe('m');
 expect(aligned.method).toBe('reviewed-two-control-points');
 expect(aligned.verified).toBe(false);
 expect(aligned.original.x).toBe(5);
 expect(aligned.original.y).toBe(2.5);

 await review.getByRole('button',{name:'Restore original sheet coordinates'}).click();
 const restored=await page.evaluate(()=>{
  const entity=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}').entities[0];
  return {x:entity.x,y:entity.y,z:entity.z,floor:entity.floor,units:entity.meta.coordinateUnits,elevationKnown:entity.meta.elevationKnown,hasTransform:Boolean(entity.meta.sheetTransform)};
 });
 expect(restored).toEqual({x:5,y:2.5,z:0,floor:'UNRESOLVED',units:'sheet',elevationKnown:false,hasTransform:false});
});