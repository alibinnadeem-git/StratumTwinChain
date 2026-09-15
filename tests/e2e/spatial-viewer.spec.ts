import {expect,test} from '@playwright/test';

const sourceUpload=(page:import('@playwright/test').Page)=>page.locator('input[type=file][accept*=".dxf"]');

test('DXF plan scale becomes metric while equipment Z remains separately reviewable',async({page})=>{
 await page.goto('/compiler');
 const dxf=`0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n2\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n0\nINSERT\n8\nE-EQUIP\n2\nDRY TYPE TRANSFORMER T1\n10\n100\n20\n100\n30\n0\n0\nINSERT\n8\nE-EQUIP\n2\nPANELBOARD LP-2\n10\n200\n20\n110\n30\n0\n0\nENDSEC\n0\nEOF\n`;
 await sourceUpload(page).setInputFiles({name:'E2-Level-2-Power.dxf',mimeType:'application/dxf',buffer:Buffer.from(dxf)});
 await expect(page.getByText(/Source compilation updated/i)).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>{
  const graph=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}');
  const panel=(graph.entities||[]).find((entity:any)=>entity.name==='PANELBOARD LP-2'&&entity.layer==='L2');
  const transformer=(graph.entities||[]).find((entity:any)=>entity.name==='DRY TYPE TRANSFORMER T1'&&entity.layer==='L2');
  return panel&&transformer?{
   panel:{metric:panel.meta?.cadMetricXY,units:panel.meta?.coordinateUnits,planUnits:panel.meta?.planCoordinateUnits,z:Number(Number(panel.z).toFixed(6)),floor:panel.floor,authority:panel.meta?.zPlacementAuthority,review:panel.meta?.zReviewRequired},
   transformer:{z:Number(Number(transformer.z).toFixed(6)),authority:transformer.meta?.zPlacementAuthority,review:transformer.meta?.zReviewRequired}
  }:null;
 })).toEqual({
  panel:{metric:true,units:'m_xy',planUnits:'m',z:4.695,floor:'L2',authority:'HISTORICAL_RECOMMENDATION',review:true},
  transformer:{z:4,authority:'FLOOR_STANDING_PROFILE',review:true}
 });
 await page.goto('/spatial');
 const modes=page.getByRole('group',{name:'Spatial view mode'});
 await expect(modes).toBeVisible();
 await expect(modes.getByRole('button',{name:/^Model\b/i})).toBeVisible();
 await expect(modes.getByRole('button',{name:/^Electrical\b/i})).toBeVisible();
 await expect(modes.getByRole('button',{name:/^Review\b/i})).toBeVisible();
 const imported=page.getByLabel('Imported object');
 const panelOption=imported.locator('option').filter({hasText:'PANELBOARD LP-2'}).first();
 const panelValue=await panelOption.getAttribute('value');
 expect(panelValue).toBeTruthy();
 await imported.selectOption(panelValue!);
 await expect(page.getByText('Z placement',{exact:true})).toBeVisible();
 await expect(page.getByText('Unverified elevation',{exact:true})).toBeVisible();
 await expect(page.getByText(/Z NEEDS REVIEW/)).toBeVisible();
});

test('SLD becomes review-only spatial electrical hierarchy',async({page})=>{
 await page.goto('/spatial');
 await page.evaluate(()=>{
  localStorage.setItem('stratum_compiled_graph',JSON.stringify({
   version:'fixture',createdAt:new Date().toISOString(),sources:[{name:'E-001 Single Line Diagram.pdf',ext:'pdf',sha256:'sld-fixture',discipline:'Electrical',floor:'L1',elevation:0}],
   entities:[
    {id:'source',source:'E-001 Single Line Diagram.pdf',layer:'L2',kind:'text-asset-candidate',name:'UTILITY SERVICE',x:-6,y:0,z:0,floor:'L1',confidence:.9,meta:{page:1,sourceSha256:'sld-fixture'}},
    {id:'xfmr',source:'E-001 Single Line Diagram.pdf',layer:'L2',kind:'text-asset-candidate',name:'TRANSFORMER T1',x:-2,y:0,z:0,floor:'L1',confidence:.9,meta:{page:1,sourceSha256:'sld-fixture'}},
    {id:'msb',source:'E-001 Single Line Diagram.pdf',layer:'L2',kind:'text-asset-candidate',name:'MAIN SWITCHBOARD MSB',x:2,y:0,z:0,floor:'L1',confidence:.9,meta:{page:1,sourceSha256:'sld-fixture'}},
    {id:'panel',source:'E-001 Single Line Diagram.pdf',layer:'L2',kind:'text-asset-candidate',name:'PANELBOARD LP-1',x:6,y:0,z:0,floor:'L1',confidence:.9,meta:{page:1,sourceSha256:'sld-fixture'}}
   ],links:[],stats:{L0:1,L1:0,L2:4,L3:0,L4:0}
  }));
  window.dispatchEvent(new Event('stratum:graph-updated'));
 });
 await expect(page.getByText(/4 SLD object\(s\)/i)).toBeVisible();
 await page.getByRole('button',{name:/Electrical/i}).click();
 await page.getByLabel('Imported object').selectOption('panel');
 await expect(page.getByText('SLD → SPATIAL PROJECTION')).toBeVisible();
 await expect(page.getByText(/logical power hierarchy/i)).toBeVisible();
 const projected=await page.evaluate(()=>{
  const graph=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}');
  return{depths:(graph.entities||[]).map((entity:any)=>entity.meta?.sldLogicalDepth),feeders:(graph.links||[]).filter((link:any)=>link.type==='SLD_FEEDS').length};
 });
 expect(projected.depths).toEqual([0,1,2,4]);
 expect(projected.feeders).toBeGreaterThanOrEqual(3);
});
