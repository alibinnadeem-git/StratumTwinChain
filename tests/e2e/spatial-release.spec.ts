import {expect,test} from '@playwright/test';

const tinyPng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlP7wAAAABJRU5ErkJggg==','base64');

test('manual plan annotations persist deletion and restore without resurrecting removed marks',async({page})=>{
 await page.goto('/compiler');
 await page.getByLabel('Plan image').setInputFiles({name:'annotation-plan.png',mimeType:'image/png',buffer:tinyPng});
 await page.getByLabel('Annotation text').fill('PANEL-LP1');
 await page.getByLabel('Drawing reference').fill('E-201');
 await page.getByAltText('annotation-plan.png').click({position:{x:1,y:1}});
 await expect(page.getByText('PANEL-LP1 · E-201')).toBeVisible();
 await page.getByRole('button',{name:'Save annotations to Spatial'}).click();
 await expect(page.getByRole('status')).toContainText(/Annotations saved in this browser/i);

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
 await expect(page.getByRole('status')).toContainText(/Annotations saved in this browser/i);

 const afterDelete=await page.evaluate(()=>{
  const graph=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}');
  const annotated=(graph.entities||[]).filter((entity:any)=>entity.meta?.sourceType==='MANUAL_IMAGE_ANNOTATION');
  const records=Object.values(graph.annotationSources||{}) as any[];
  return {entities:annotated.length,marks:records.reduce((sum,record)=>sum+(record.marks?.length||0),0)};
 });
 expect(afterDelete).toEqual({entities:0,marks:0});

 await page.reload();
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

 const review=page.getByRole('region',{name:'Drawing review'});
 await expect(review).toBeVisible();
 await review.getByLabel('Drawing sheet').selectOption({label:'review-sheet.pdf · page 1'});
 await review.getByLabel('Boundary').selectOption({label:/PDF closed path · page 1/});
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
