import {expect,test} from '@playwright/test';

test('component library exposes source verification workbench without model activation control',async({page})=>{
 await page.goto('/component-library');
 const workbench=page.getByRole('region',{name:'OEM CAD file verification workbench'});
 await expect(workbench.getByRole('heading',{name:'OEM CAD file verification workbench'})).toBeVisible();
 await expect(workbench).toContainText('This advances evidence to FILE VERIFIED only.');
 await expect(workbench).toContainText(/does not mean the file has been converted to a controlled GLB/i);
 await expect(workbench.getByRole('button',{name:'Verify and store source file'})).toBeDisabled();
 await expect(workbench.getByText(/GLB APPROVED/i)).toHaveCount(0);
});

test('component library exposes governed exact OEM CAD activation readiness',async({page})=>{
 await page.goto('/component-library');
 const queue=page.getByRole('region',{name:'Exact OEM CAD acquisition queue'});
 await expect(queue.getByRole('heading',{name:'Exact OEM CAD acquisition queue'})).toBeVisible();

 await queue.getByLabel('Search exact OEM CAD queue').fill('C10N32D100');
 const schneider=queue.locator('article').filter({hasText:'C10N32D100'});
 await expect(schneider).toContainText('CAD FOUND');
 await expect(schneider).toContainText('BLOCKED');
 await expect(schneider).toContainText('Downloaded source CAD file has not been hash-verified.');
 await expect(schneider).toContainText('Reuse/redistribution terms have not been recorded.');

 await queue.getByLabel('Search exact OEM CAD queue').fill('2652');
 const adafruit=queue.locator('article').filter({hasText:'2652'});
 await expect(adafruit).toContainText('OEM ACTIVE');
 await expect(adafruit).toContainText('ELIGIBLE');
 await expect(adafruit).toContainText('Required provenance gates are complete.');
 await expect(adafruit).toContainText('MIT license');
});

test('component library exposes searchable official OEM sources without treating CAD links as installed models',async({page})=>{
 await page.goto('/component-library');
 const directory=page.getByRole('region',{name:'OEM source directory'});
 await expect(directory.getByText('OEM data and model sources')).toBeVisible();
 await directory.getByLabel('Search OEM sources').fill('receptacles');
 await expect(directory.getByRole('heading',{name:'Legrand'})).toHaveCount(1);
 await expect(directory.locator('article').filter({has:page.getByRole('heading',{name:'Legrand',exact:true})}).getByRole('link',{name:'Open official source ↗'})).toHaveAttribute('href',/legrand\.us/);
 await directory.getByLabel('Search OEM sources').fill('chillers');
 await expect(directory.getByRole('heading',{name:'Trane'})).toBeVisible();
 await expect(directory.getByText(/Select an exact unit before using its electrical demand or geometry/)).toBeVisible();
 await directory.getByLabel('Search OEM sources').fill('Hitachi Energy');
 await directory.getByRole('button',{name:'Inspect 3D registry mapping'}).click();
 const registry=page.getByRole('region',{name:'3D Asset Registry'});
 await expect(registry.getByRole('heading',{name:'Utility Transformer'})).toBeVisible();
 await expect(registry.getByText('Hitachi Energy · distribution transformers, power transformers, dry-type transformers')).toBeVisible();
 await expect(registry.getByText(/STRATUM representative visualization/)).toBeVisible();
 await directory.getByLabel('Search OEM sources').fill('2652');
 await expect(directory.getByText(/Manufacturer CAD converted; exact SKU model active/)).toBeVisible();
 await directory.getByRole('button',{name:'Inspect 3D registry mapping'}).click();
 await expect(registry.getByRole('heading',{name:'Adafruit BME280 Sensor Breakout (2652)'})).toBeVisible();
 await expect(registry.getByText(/OEM supplied geometry/)).toBeVisible();
 await expect(registry.getByText(/adafruit-bme280-2652\.glb/).first()).toBeVisible();
});
test('download inspections expose identity caveats without activating OEM geometry',async({page})=>{
 await page.goto('/component-library');
 const queue=page.getByRole('region',{name:'Exact OEM CAD acquisition queue'});
 await queue.getByLabel('Search exact OEM CAD queue').fill('BSPD48RJ45');
 const card=queue.locator('article');
 await expect(card).toContainText('BLOCKED');
 await card.getByText('Acquisition notes',{exact:true}).click();
 await expect(card).toContainText('DEHN');
 await expect(card).toContainText('8242f595a6d5d21e814a05487a0790f12e20bdb91e563af2018735bd7c204398');
 await expect(card).toContainText('has not been imported into the tenant vault');
 const directory=page.getByRole('region',{name:'OEM source directory'});
 await directory.getByLabel('Search OEM sources').fill('ChargePoint');
 await expect(directory.getByRole('link',{name:'CP6000 configured STEP package'})).toHaveAttribute('href','https://www.chargepoint.com/download-file/step-cp6000-commerical');
});

import {strToU8,zipSync} from 'fflate';
import {readFileSync} from 'node:fs';

const sourceUpload=(page:import('@playwright/test').Page)=>page.locator('input[type=file][accept*=".dxf"]');

test('stale pre-basemap drawing graph warns that the original source must be reprocessed',async({page})=>{
 await page.goto('/spatial');
 await page.evaluate(()=>{
  const drawing='G101 Tesla Supercharger Site Plan.pdf',drawingSha='legacy-g101';
  localStorage.setItem('stratum_compiled_graph',JSON.stringify({
   version:'1.1',createdAt:new Date().toISOString(),reviewState:'REVIEW_REQUIRED',
   sources:[
    {name:drawing,ext:'pdf',sha256:drawingSha,discipline:'Electrical',floor:'L1',elevation:0,state:'parsed',entities:5,vectors:587,textItems:84,sldPages:0},
    {name:'Tesla Supercharger V3 reference.glb',ext:'glb',sha256:'tesla-reference',discipline:'Unclassified',floor:'L1',elevation:0,state:'parsed',entities:1}
   ],
   entities:[
    {id:'legacy-callout',source:drawing,layer:'L2',kind:'text-asset-candidate',name:'NEW TESLA PSU & SUPERCHARGER',x:1,y:1,z:0,confidence:.86,floor:'L1',meta:{sourceSha256:drawingSha,elevationKnown:false,physicalTruth:false,reviewRequired:true}},
    {id:'tesla-model',source:'Tesla Supercharger V3 reference.glb',layer:'L2',kind:'imported-3d-model',name:'Tesla Supercharger V3 reference',x:5,y:0,z:0,confidence:1,floor:'L1',meta:{sourceSha256:'tesla-reference',sourceType:'GLB',placementAuthority:'UNRESOLVED',physicalTruth:false,referenceOnly:true}}
   ],links:[],stats:{L0:2,L1:0,L2:2,L3:0,L4:0}
  }));
  window.dispatchEvent(new Event('stratum:graph-updated'));
 });
 await expect(page.getByRole('heading',{name:'Spatial model'})).toBeVisible();
 const warning=page.getByRole('alert').filter({hasText:'DRAWING REPROCESS REQUIRED'});
 await expect(warning).toBeVisible();
 await expect(warning).toContainText('G101 Tesla Supercharger Site Plan.pdf');
 await expect(warning).toContainText(/original source file must be re-imported/i);
 await expect(warning.getByRole('link',{name:'Reprocess drawing source'})).toHaveAttribute('href','/compiler');
});

test('raster site plan appears as a review-only drawing underlay instead of disappearing',async({page})=>{
 await page.goto('/spatial');
 await page.evaluate(()=>{
  const source='G101 Site Plan.jpg';
  const preview='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=';
  localStorage.setItem('stratum_compiled_graph',JSON.stringify({
   version:'raster-site-plan-fixture',createdAt:new Date().toISOString(),reviewState:'REVIEW_REQUIRED',
   sources:[{name:source,ext:'jpg',sha256:'raster-fixture',discipline:'Electrical',floor:'UNRESOLVED',elevation:0}],
   entities:[{id:'raster-underlay',source,layer:'L1',kind:'source-raster-underlay',name:'G101 Site Plan.jpg · raster source plane',x:-10,y:-6.5,z:0,x2:10,y2:6.5,z2:0,confidence:1,floor:'UNRESOLVED',meta:{page:1,sourceSha256:'raster-fixture',drawingBasemap:true,nonSldPlan:true,planType:'ELECTRICAL_POWER_PLAN',planDiscipline:'Electrical',embeddedRasterDataUrl:preview,coordinateUnits:'image_preview',geometryAuthority:'RASTER_PREVIEW_ONLY',spatialPlacementAuthority:'SOURCE_IMAGE_PLANE_ONLY',physicalElevationKnown:false,physicalTruth:false}}],
   links:[],stats:{L0:1,L1:1,L2:0,L3:0,L4:0}
  }));
  window.dispatchEvent(new Event('stratum:graph-updated'));
 });
 await expect(page.getByRole('heading',{name:'Spatial model'})).toBeVisible();
 await expect(page.getByText(/1 drawing frame · 1 non-SLD plan/i)).toBeVisible();
 await expect(page.getByText(/1 drawing underlay/i)).toBeVisible();
 await expect(page.getByText(/Source drawing basemap is shown on the drawing plane/i)).toBeVisible();
 await expect(page.getByLabel('Imported object').locator('option')).toHaveText(['No selectable objects in this view']);
 await page.getByRole('button',{name:/Infrastructure HUD/i}).click();
 await expect(page.getByText('DRAWING UNDERLAYS',{exact:true})).toBeVisible();
});

test('non-SLD site plan renders retained source vectors with Tesla equipment candidate',async({page})=>{
 await page.goto('/spatial');
 await page.evaluate(()=>{
  const source='G101 Tesla Supercharger Site Plan.pdf';
  localStorage.setItem('stratum_compiled_graph',JSON.stringify({
   version:'site-plan-fixture',createdAt:new Date().toISOString(),reviewState:'REVIEW_REQUIRED',
   sources:[{name:source,ext:'pdf',sha256:'g101-fixture',discipline:'Electrical',floor:'UNRESOLVED',elevation:0}],
   entities:[
    {id:'l1',source,layer:'L1',kind:'line',name:'Source plan line · page 1',x:-8,y:-5,x2:8,y2:-5,z:0,z2:0,confidence:1,floor:'UNRESOLVED',meta:{page:1,sourceSha256:'g101-fixture',drawingBasemap:true,nonSldPlan:true,planType:'SITE_PLAN',planDiscipline:'Civil / Site',coordinateUnits:'sheet',physicalElevationKnown:false,physicalTruth:false}},
    {id:'l2',source,layer:'L1',kind:'line',name:'Source plan line · page 1',x:8,y:-5,x2:8,y2:5,z:0,z2:0,confidence:1,floor:'UNRESOLVED',meta:{page:1,sourceSha256:'g101-fixture',drawingBasemap:true,nonSldPlan:true,planType:'SITE_PLAN',planDiscipline:'Civil / Site',coordinateUnits:'sheet',physicalElevationKnown:false,physicalTruth:false}},
    {id:'l3',source,layer:'L1',kind:'line',name:'Source plan line · page 1',x:8,y:5,x2:-8,y2:5,z:0,z2:0,confidence:1,floor:'UNRESOLVED',meta:{page:1,sourceSha256:'g101-fixture',drawingBasemap:true,nonSldPlan:true,planType:'SITE_PLAN',planDiscipline:'Civil / Site',coordinateUnits:'sheet',physicalElevationKnown:false,physicalTruth:false}},
    {id:'l4',source,layer:'L1',kind:'line',name:'Source plan line · page 1',x:-8,y:5,x2:-8,y2:-5,z:0,z2:0,confidence:1,floor:'UNRESOLVED',meta:{page:1,sourceSha256:'g101-fixture',drawingBasemap:true,nonSldPlan:true,planType:'SITE_PLAN',planDiscipline:'Civil / Site',coordinateUnits:'sheet',physicalElevationKnown:false,physicalTruth:false}},
    {id:'tesla-callout',source,layer:'L2',kind:'text-asset-candidate',name:'NEW TESLA PSU & SUPERCHARGER',x:1,y:1,z:0,confidence:.86,floor:'UNRESOLVED',meta:{page:1,sourceSha256:'g101-fixture',nonSldPlan:true,planType:'SITE_PLAN',planDiscipline:'Civil / Site',coordinateUnits:'sheet',elevationKnown:false,physicalElevationKnown:false,spatialPlacementAuthority:'SOURCE_SHEET_POSITION_ONLY',physicalTruth:false,reviewRequired:true}}
   ],links:[],stats:{L0:1,L1:4,L2:1,L3:0,L4:0}
  }));
  window.dispatchEvent(new Event('stratum:graph-updated'));
 });
 await expect(page.getByRole('heading',{name:'Spatial model'})).toBeVisible();
 await expect(page.getByText(/1 source · 1 drawing frame · 1 non-SLD plan · .*4 drawing lines/i)).toBeVisible();
 await expect(page.getByText(/Source drawing basemap is shown on the drawing plane/i)).toBeVisible();
 await expect(page.getByLabel('Imported object').locator('option').filter({hasText:'NEW TESLA PSU & SUPERCHARGER'})).toHaveCount(1);
 const canvas=page.locator('canvas[aria-label="Interactive Spatial model"]');
 await expect(canvas).toBeVisible();
 await expect.poll(()=>canvas.getAttribute('data-clickable-assets')).toBe('1');
 await page.getByRole('button',{name:/Infrastructure HUD/i}).click();
 await expect(page.getByText('DRAWING LINES',{exact:true})).toBeVisible();
 await expect(page.getByText('3D MODELS',{exact:true})).toBeVisible();
});

test('multi-discipline non-SLD plan set isolates sheet frames instead of stacking unrelated pages',async({page})=>{
 await page.goto('/spatial');
 await page.evaluate(()=>{
  const source='Full Rev 3 Set.pdf',sha='full-rev-3-fixture';
  const meta=(page:number,planType:string,planDiscipline:string)=>({page,sourceSha256:sha,nonSldPlan:true,planType,planDiscipline,planRecognition:'CONTENT_PLAN_V1',coordinateUnits:'sheet',drawingBasemap:true,elevationKnown:false,physicalElevationKnown:false,physicalTruth:false});
  localStorage.setItem('stratum_compiled_graph',JSON.stringify({
   version:'multi-plan-fixture',createdAt:new Date().toISOString(),reviewState:'REVIEW_REQUIRED',
   sources:[{name:source,ext:'pdf',sha256:sha,discipline:'Multi-discipline',floor:'UNRESOLVED',elevation:0}],
   entities:[
    {id:'roof-line',source,layer:'L1',kind:'line',name:'Roof framing source line',x:-9,y:-5,x2:9,y2:-5,z:0,z2:0,confidence:1,floor:'UNRESOLVED',meta:meta(14,'STRUCTURAL_FRAMING_PLAN','Structural')},
    {id:'utility-line',source,layer:'L1',kind:'line',name:'Utility source line',x:-8,y:3,x2:8,y2:3,z:0,z2:0,confidence:1,floor:'UNRESOLVED',meta:meta(147,'UTILITY_PLAN','Multi-discipline / Utilities')},
    {id:'wheel-balancer',source,layer:'L4',kind:'powered-equipment-candidate',name:'WHEEL BALANCER',x:2,y:2,z:0,confidence:.72,floor:'UNRESOLVED',meta:{...meta(147,'UTILITY_PLAN','Multi-discipline / Utilities'),reviewRequired:true}},
    {id:'fire-line',source,layer:'L1',kind:'line',name:'Fire suppression source line',x:-7,y:1,x2:7,y2:1,z:0,z2:0,confidence:1,floor:'UNRESOLVED',meta:meta(148,'FIRE_PROTECTION_PLAN','Fire Protection')},
    {id:'haz-line',source,layer:'L1',kind:'line',name:'Hazardous area source line',x:-6,y:-1,x2:6,y2:-1,z:0,z2:0,confidence:1,floor:'UNRESOLVED',meta:meta(149,'HAZARDOUS_AREA_PLAN','Electrical / Life Safety')}
   ],links:[],stats:{L0:1,L1:4,L2:0,L3:0,L4:1}
  }));
  window.dispatchEvent(new Event('stratum:graph-updated'));
 });
 await expect(page.getByText(/4 drawing frames · 4 non-SLD plans/i)).toBeVisible();
 await expect(page.getByText(/Multiple drawing frames were recognized/i)).toBeVisible();
 const frame=page.getByLabel('Sheet page isolation');
 await expect(frame).toHaveValue('AUTO');
 await expect(page.getByLabel('Imported object').locator('option').filter({hasText:'WHEEL BALANCER'})).toHaveCount(0);
 await frame.selectOption('full-rev-3-fixture:147');
 await expect(page.getByLabel('Imported object').locator('option').filter({hasText:'WHEEL BALANCER'})).toHaveCount(1);
 await page.getByLabel('Discipline isolation').selectOption('Fire Protection');
 await expect(page.getByLabel('Imported object').locator('option').filter({hasText:'WHEEL BALANCER'})).toHaveCount(0);
 await page.getByLabel('Discipline isolation').selectOption('ALL');
 await frame.selectOption('ALL');
 await expect(page.getByText(/Review overlay is showing multiple source sheets together/i)).toBeVisible();
 await page.getByRole('button',{name:/Infrastructure HUD/i}).click();
 await expect(page.getByText('PLAN FRAMES',{exact:true})).toBeVisible();
 await expect(page.getByText('NON-SLD PLANS',{exact:true})).toBeVisible();
});

test('Audi E4.0 snapshot restores five source-linked selectable callouts without inventing asset history',async({page})=>{
 await page.goto('/spatial');
 await page.evaluate(()=>{
  const name='Audi E4.0.pdf';
  localStorage.setItem('stratum_compiled_graph',JSON.stringify({version:'1.1',createdAt:new Date().toISOString(),reviewState:'SOURCE_SHEET_ONLY',
   sources:[{name,ext:'pdf',sha256:'c6b4c02f0b97d6eef947ff57f6863eddd16a6f769c13777af42e113905ded35c',discipline:'Electrical',floor:'L1'}],
   entities:[{id:'sheet-line',source:name,layer:'L1',kind:'line',name:'Source vector',x:-3,y:3,x2:-2,y2:3,confidence:1,floor:'L1'}],
   links:[],stats:{L0:1,L1:1,L2:0,L3:0,L4:0}}));
  window.dispatchEvent(new Event('stratum:graph-updated'));
 });
 await expect(page.getByLabel('Imported object').locator('option').filter({hasText:'(E) L5A'})).toHaveCount(1);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}'));
 expect(saved.stats.L2).toBe(5);
 await page.getByLabel('Imported object').selectOption(saved.entities.find((item:any)=>item.name==='(E) L5A').id);
 await expect(page.getByText('DRAWING CALLOUT · REVIEW REQUIRED')).toBeVisible();
 await expect(page.getByText(/Maintenance can be recorded later for both existing and new registered assets/)).toBeVisible();
 const canvas=page.locator('canvas[aria-label="Interactive Spatial model"]');
 await expect(canvas).toBeVisible();
 await expect.poll(()=>canvas.getAttribute('data-clickable-assets')).toBe('5');
});

test('source-sheet compilation identifies zero selectable components and exposes model recovery',async({page})=>{
 await page.goto('/spatial');
 await page.evaluate(()=>{
  localStorage.setItem('stratum_compiled_graph',JSON.stringify({
   version:'1.1',createdAt:new Date().toISOString(),reviewState:'SOURCE_SHEET_ONLY',
   sources:[{name:'Audi E4.0.pdf',ext:'pdf',sha256:'a'.repeat(64),discipline:'Electrical'}],
   entities:[{id:'sheet-line',source:'Audi E4.0.pdf',layer:'L1',kind:'line',name:'Drawing line',x:0,y:0,x2:5,y2:0,confidence:1}],
   links:[],stats:{L0:1,L1:1,L2:0,L3:0,L4:0}
  }));
  window.dispatchEvent(new Event('stratum:graph-updated'));
 });
 await expect(page.getByText('SOURCE SHEET ONLY · 0 COMPONENTS')).toBeVisible();
 await expect(page.getByRole('button',{name:'Recover earlier STRATUM model'})).toBeVisible();
 await expect(page.getByLabel('Imported object').locator('option')).toHaveText(['No selectable objects in this view']);
 await expect(page.getByText(/1 source · 0 objects · 1 drawing line/)).toBeVisible();
});

test('Tesla GLB import persists real geometry and makes it selectable in Spatial',async({page})=>{
 await page.goto('/compiler');
 await page.evaluate(()=>{
  localStorage.setItem('stratum_compiled_graph',JSON.stringify({version:'1.1',createdAt:new Date().toISOString(),reviewState:'SOURCE_SHEET_ONLY',
   sources:[{name:'Audi E4.0.pdf',ext:'pdf',sha256:'a'.repeat(64),discipline:'Electrical',floor:'L1',elevation:0}],
   entities:[{id:'audi-line',source:'Audi E4.0.pdf',layer:'L1',kind:'line',name:'Plan vector',x:0,y:0,x2:5,y2:0,z:0,confidence:1,floor:'L1'}],
   links:[],stats:{L0:1,L1:1,L2:0,L3:0,L4:0}}));
  window.dispatchEvent(new Event('stratum:graph-updated'));
 });
 await expect(page.getByText('Audi E4.0.pdf')).toBeVisible();
 await page.locator('input[type=file][accept*=".glb"]').setInputFiles({
  name:'Tesla-Supercharger-V3.glb',mimeType:'model/gltf-binary',
  buffer:readFileSync('public/models/oem/tesla-supercharger-v3-community.glb')
 });
 await expect(page.getByText(/Renderable 3D geometry imported/)).toBeVisible();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}'));
 expect(saved.entities).toEqual(expect.arrayContaining([expect.objectContaining({id:'audi-line'}),expect.objectContaining({kind:'imported-3d-model',layer:'L2',name:'Tesla Supercharger V3'})]));
 expect(saved.entities.find((entity:any)=>entity.kind==='imported-3d-model').meta.embeddedGlb.length).toBeGreaterThan(100_000);
 expect(saved.reviewState).toBe('REVIEW_REQUIRED');
 await page.getByRole('link',{name:'Render Spatial Environment'}).click();
 await expect(page.getByRole('heading',{name:'Spatial model'})).toBeVisible();
 const canvas=page.locator('canvas[aria-label="Interactive Spatial model"]');
 await expect(canvas).toBeVisible();
 await expect.poll(()=>canvas.getAttribute('data-clickable-assets')).toBe('1');
 await expect.poll(()=>canvas.getAttribute('data-primary-asset')).toContain('imported-glb-');
 const point=await canvas.evaluate(element=>({x:Number((element as HTMLElement).dataset.primaryHitX),y:Number((element as HTMLElement).dataset.primaryHitY)}));
 await canvas.click({position:point});
 await expect.poll(()=>canvas.getAttribute('data-selected-asset')).toBe(await canvas.getAttribute('data-primary-asset'));
 await expect(page.getByText('IMPORTED 3D GEOMETRY · REVIEW-SCALE')).toBeVisible();
 await expect(page.getByText('Tesla Supercharger V3',{exact:true}).first()).toBeVisible();
 await expect(page.getByText('Review plane · physical Z unresolved',{exact:true})).toBeVisible();
 await page.getByText('Placement & source confidence').click();
 await expect(page.locator('.placement-details').getByText('Review plane · unresolved',{exact:true})).toBeVisible();
 await page.reload();
 await expect(page.getByLabel('Imported object').locator('option').filter({hasText:'Tesla Supercharger V3'})).toHaveCount(1);
});

test('DXF native units are retained while explicit design Z remains review-only',async({page})=>{
 await page.goto('/compiler');
 const dxf=`0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n2\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n0\nINSERT\n8\nE-EQUIP\n2\nDRY TYPE TRANSFORMER T1\n10\n100\n20\n100\n30\n0\n0\nINSERT\n8\nE-EQUIP\n2\nPANELBOARD LP-2\n10\n200\n20\n110\n30\n0\n0\nENDSEC\n0\nEOF\n`;
 await sourceUpload(page).setInputFiles({name:'E2-Level-2-Power.dxf',mimeType:'application/dxf',buffer:Buffer.from(dxf)});
 await expect(page.getByText(/Source compilation updated/i)).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>{
  const graph=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}');
  const panel=(graph.entities||[]).find((entity:any)=>entity.name==='PANELBOARD LP-2'&&entity.layer==='L2');
  const transformer=(graph.entities||[]).find((entity:any)=>entity.name==='DRY TYPE TRANSFORMER T1'&&entity.layer==='L2');
  return panel&&transformer?{
   panel:{unit:panel.meta?.unitName,toMeters:panel.meta?.unitToMeters,z:Number(Number(panel.z).toFixed(6)),floor:panel.floor,authority:panel.meta?.zPlacementAuthority,status:panel.meta?.zResolutionStatus,candidate:panel.meta?.zCandidateMeters,physical:panel.meta?.physicalElevationKnown},
   transformer:{z:Number(Number(transformer.z).toFixed(6)),authority:transformer.meta?.zPlacementAuthority,status:transformer.meta?.zResolutionStatus,candidate:transformer.meta?.zCandidateMeters,physical:transformer.meta?.physicalElevationKnown}
  }:null;
 })).toEqual({
  panel:{unit:'ft',toMeters:.3048,z:0,floor:'L2',authority:'SOURCE_DXF_DESIGN_Z',status:'RESOLVED_DESIGN_CANDIDATE',candidate:0,physical:false},
  transformer:{z:0,authority:'SOURCE_DXF_DESIGN_Z',status:'RESOLVED_DESIGN_CANDIDATE',candidate:0,physical:false}
 });
 await page.goto('/spatial');
 const imported=page.getByLabel('Imported object');
 const panelOption=imported.locator('option').filter({hasText:'PANELBOARD LP-2'}).first();
 const panelValue=await panelOption.getAttribute('value');
 expect(panelValue).toBeTruthy();
 await imported.selectOption(panelValue!);
 await expect(page.getByText('SOURCE ORIGIN design Z reference · review required',{exact:true})).toBeVisible();
 await expect(page.getByText(/Z REFERENCE CANDIDATE · REVIEW REQUIRED/)).toBeVisible();
 await page.getByText('Z solution evidence').click();
 await expect(page.locator('.z-solution-details').getByText(/SOURCE DXF DESIGN Z/i).first()).toBeVisible();
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
 await expect(page.getByText(/4 SLD objects/i)).toBeVisible();
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


test('Render Spatial Environment surfaces missing HVAC power from a mechanical source',async({page})=>{
 await page.goto('/compiler');
 const dxf=`0
SECTION
2
HEADER
9
$INSUNITS
70
2
0
ENDSEC
0
SECTION
2
ENTITIES
0
INSERT
8
M-HVAC-EQUIP
2
AHU-1 480V 3PH FLA 12
10
100
20
100
30
0
0
ENDSEC
0
EOF
`;
 await sourceUpload(page).setInputFiles({name:'M-201-HVAC-Equipment.dxf',mimeType:'application/dxf',buffer:Buffer.from(dxf)});
 const render=page.getByRole('link',{name:'Render Spatial Environment'});
 await expect(render).toBeVisible();
 await render.click();
 await expect(page).toHaveURL(/\/spatial/);
 await expect(page.getByRole('heading',{name:'Expected power review'})).toBeVisible();
 await expect(page.getByText(/AHU-1 has no reconciled electrical feed/i)).toBeVisible();
 const discipline=page.getByLabel('Discipline isolation');
 await expect(discipline).toBeVisible();
 await expect(discipline.locator('option').filter({hasText:'Mechanical'})).toHaveCount(1);
});


test('CSV equipment schedule feeds Expected Power without inventing Spatial XYZ',async({page})=>{
 await page.goto('/compiler');
 const csv=[
  'TAG,DESCRIPTION,MANUFACTURER,MODEL,VOLTAGE,PHASE,FLA,MCA,MOCP,LOCATION',
  'AHU-7,Air Handling Unit,Trane,XA700,480,3,14,18,25,Mechanical Room'
 ].join('\n');
 await sourceUpload(page).setInputFiles({name:'M-601-HVAC-Equipment-Schedule.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
 await expect(page.getByText(/powered equipment candidate/i)).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>{
  const graph=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}');
  const entity=(graph.entities||[]).find((item:any)=>item.meta?.assetTag==='AHU-7');
  return entity?{kind:entity.kind,nonSpatial:entity.meta?.nonSpatial,authority:entity.meta?.spatialPlacementAuthority,voltage:entity.meta?.voltage,phase:entity.meta?.phase}:null;
 }),{timeout:20000}).toEqual({kind:'schedule-powered-equipment-candidate',nonSpatial:true,authority:'NON_SPATIAL_SCHEDULE',voltage:480,phase:3});
 const render=page.getByRole('link',{name:'Render Spatial Environment'});
 await expect(render).toBeVisible();await render.click();
 await expect(page.getByRole('heading',{name:'Expected power review'})).toBeVisible();
 await expect(page.getByText(/AHU-7 has no reconciled electrical feed/i)).toBeVisible();
 await expect(page.getByLabel('Imported object').locator('option').filter({hasText:'AHU-7'})).toHaveCount(0);
});


test('cross-document coordination surfaces schedule versus drawing rating conflict without claiming geometric clash',async({page})=>{
 await page.goto('/compiler');
 const csv=[
  'TAG,DESCRIPTION,MANUFACTURER,MODEL,VOLTAGE,PHASE,FLA,LOCATION',
  'AHU-7,Air Handling Unit,Trane,XA700,480,3,14,Mechanical Room'
 ].join('\n');
 const dxf=`0
SECTION
2
HEADER
9
$INSUNITS
70
2
0
ENDSEC
0
SECTION
2
ENTITIES
0
INSERT
8
M-HVAC-EQUIP
2
AHU-7 208V 3PH
10
100
20
100
30
0
0
ENDSEC
0
EOF
`;
 await sourceUpload(page).setInputFiles([
  {name:'M-601-HVAC-Equipment-Schedule.csv',mimeType:'text/csv',buffer:Buffer.from(csv)},
  {name:'M-201-HVAC-Plan.dxf',mimeType:'application/dxf',buffer:Buffer.from(dxf)}
 ]);
 await expect(page.getByText(/powered equipment candidate/i)).toBeVisible();
 await expect.poll(()=>page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('stratum-spatial-recovery-v1',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
  return new Promise<boolean>(resolve=>{const request=db.transaction('graphs','readonly').objectStore('graphs').get('current');request.onsuccess=()=>resolve(Boolean(request.result?.coordinationIntelligence?.findings?.some((item:any)=>/AHU-7 has conflicting equipment ratings across sources/i.test(item.title||''))));request.onerror=()=>resolve(false)});
 }),{timeout:30000,intervals:[250,500,1000,2000]}).toBe(true);
 await page.getByRole('link',{name:'Render Spatial Environment'}).click();
 await expect(page.getByRole('heading',{name:'Coordination findings'})).toBeVisible();
 await expect(page.getByText(/AHU-7 has conflicting equipment ratings across sources/i)).toBeVisible();
 await expect(page.getByText(/geometric clash proof/i)).toBeVisible();
});


test('XLSX equipment matrix becomes non-spatial Expected Power evidence',async({page})=>{
 await page.goto('/compiler');
 const workbook='<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Mechanical Equipment" sheetId="1" r:id="rId1"/></sheets></workbook>';
 const rels='<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>';
 const shared=['TAG','DESCRIPTION','MANUFACTURER','MODEL','VOLTAGE','PHASE','FLA','LOCATION','AHU-12','Air Handling Unit','Trane','TX12','480','3','15','Mechanical Room'];
 const sharedXml='<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+shared.map(v=>'<si><t>'+v+'</t></si>').join('')+'</sst>';
 const cell=(ref:string,index:number)=>'<c r="'+ref+'" t="s"><v>'+index+'</v></c>';
 const cols=['A','B','C','D','E','F','G','H'];
 const row1='<row r="1">'+cols.map((col,i)=>cell(col+'1',i)).join('')+'</row>';
 const row2='<row r="2">'+cols.map((col,i)=>cell(col+'2',8+i)).join('')+'</row>';
 const sheet='<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+row1+row2+'</sheetData></worksheet>';
 const xlsx=zipSync({'xl/workbook.xml':strToU8(workbook),'xl/_rels/workbook.xml.rels':strToU8(rels),'xl/sharedStrings.xml':strToU8(sharedXml),'xl/worksheets/sheet1.xml':strToU8(sheet)});
 await sourceUpload(page).setInputFiles({name:'M-601-Equipment-Matrix.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(xlsx)});
 await expect(page.getByText(/worksheet\(s\).*powered equipment candidate/i)).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>{
  const graph=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}');
  const entity=(graph.entities||[]).find((item:any)=>item.meta?.assetTag==='AHU-12');
  return entity?{nonSpatial:entity.meta?.nonSpatial,officeFormat:entity.meta?.officeFormat,sheet:entity.meta?.workbookSheet,voltage:entity.meta?.voltage}:null;
 })).toEqual({nonSpatial:true,officeFormat:'XLSX',sheet:'Mechanical Equipment',voltage:480});
 await page.getByRole('link',{name:'Render Spatial Environment'}).click();
 await expect(page.getByRole('heading',{name:'Expected power review'})).toBeVisible();
 await expect(page.getByText(/AHU-12 has no reconciled electrical feed/i)).toBeVisible();
 await expect(page.getByLabel('Imported object').locator('option').filter({hasText:'AHU-12'})).toHaveCount(0);
});

test('DOCX specification text becomes non-spatial powered-equipment evidence',async({page})=>{
 await page.goto('/compiler');
 const documentXml='<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>HVAC equipment electrical requirements</w:t></w:r></w:p><w:p><w:r><w:t>RTU-4 Rooftop Unit 208V 3PH FLA 22</w:t></w:r></w:p></w:body></w:document>';
 const docx=zipSync({'word/document.xml':strToU8(documentXml)});
 await sourceUpload(page).setInputFiles({name:'23-73-00-HVAC-Specification.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:Buffer.from(docx)});
 await expect(page.getByText(/paragraph\(s\).*powered equipment\/spec candidate/i)).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>{
  const graph=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}');
  const entity=(graph.entities||[]).find((item:any)=>item.name.includes('RTU-4'));
  return entity?{nonSpatial:entity.meta?.nonSpatial,officeFormat:entity.meta?.officeFormat,section:entity.meta?.documentSection}:null;
 })).toEqual({nonSpatial:true,officeFormat:'DOCX',section:'PARAGRAPH_TEXT'});
 await page.getByRole('link',{name:'Render Spatial Environment'}).click();
 await expect(page.getByRole('heading',{name:'Expected power review'})).toBeVisible();
 await expect(page.getByText(/RTU-4 has no reconciled electrical feed/i)).toBeVisible();
 await expect(page.getByLabel('Imported object').locator('option').filter({hasText:'RTU-4'})).toHaveCount(0);
});


test('IFC BIM source preserves source-design placement and feeds Expected Power',async({page})=>{
 await page.goto('/compiler');
 const ifc=[
  'ISO-10303-21;','HEADER;',"FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');",'ENDSEC;','DATA;',
  '#1=IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.);',
  '#10=IFCCARTESIANPOINT((1000.,2000.,0.));','#11=IFCAXIS2PLACEMENT3D(#10,$,$);','#12=IFCLOCALPLACEMENT($,#11);',
  "#20=IFCBUILDINGSTOREY('STOREY',$,'Level 1',$,$,#12,$,'L1',.ELEMENT.,0.);",
  '#21=IFCCARTESIANPOINT((3000.,4000.,1000.));','#22=IFCAXIS2PLACEMENT3D(#21,$,$);','#23=IFCLOCALPLACEMENT(#12,#22);',
  "#30=IFCPUMP('PUMP-GID',$,'CHW Pump',$,$,#23,$,'P-1',.CIRCULATOR.);",
  "#40=IFCRELCONTAINEDINSPATIALSTRUCTURE('REL',$,$,$,(#30),#20);",
  "#50=IFCPROPERTYSINGLEVALUE('Voltage',$,IFCELECTRICVOLTAGEMEASURE(480.),$);",
  "#51=IFCPROPERTYSINGLEVALUE('NumberOfPhases',$,IFCINTEGER(3),$);",
  "#52=IFCPROPERTYSINGLEVALUE('FLA',$,IFCELECTRICCURRENTMEASURE(12.),$);",
  "#55=IFCPROPERTYSET('PSET',$,'Pset_EquipmentElectrical',$,(#50,#51,#52));",
  "#56=IFCRELDEFINESBYPROPERTIES('PSETREL',$,$,$,(#30),#55);",
  'ENDSEC;','END-ISO-10303-21;'
 ].join('\n');
 await sourceUpload(page).setInputFiles({name:'M-201-Mechanical.ifc',mimeType:'application/x-step',buffer:Buffer.from(ifc)});
 await expect(page.getByText(/IFC STEP records.*placement\(s\) resolved/i)).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>{
  const graph=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}');
  const entity=(graph.entities||[]).find((item:any)=>item.meta?.assetTag==='P-1'&&item.meta?.ifcType==='IFCPUMP');
  return entity?{x:entity.x,y:entity.y,z:entity.z,floor:entity.floor,physicalTruth:entity.meta?.physicalTruth,authority:entity.meta?.zPlacementAuthority,geometry:entity.meta?.geometryAuthority,unit:entity.meta?.ifcUnitToMeters}:null;
 })).toEqual({x:4,y:6,z:1,floor:'Level 1',physicalTruth:false,authority:'SOURCE_IFC_DESIGN_PLACEMENT',geometry:'IFC_PLACEMENT_ONLY_NO_SHAPE_MESH',unit:.001});
 await page.getByRole('link',{name:'Render Spatial Environment'}).click();
 await expect(page.getByRole('heading',{name:'Expected power review'})).toBeVisible();
 await expect(page.getByText(/P-1 has no reconciled electrical feed/i)).toBeVisible();
 await expect(page.getByLabel('Imported object').locator('option').filter({hasText:'P-1'})).toHaveCount(1);
});

test('uploaded drawing renders a clickable WebGL asset and opens its inspector from the model',async({page})=>{
 await page.goto('/compiler');
 const dxf=['0','SECTION','2','HEADER','9','$INSUNITS','70','2','0','ENDSEC','0','SECTION','2','ENTITIES','0','INSERT','8','E-EQUIP','2','DRY TYPE TRANSFORMER T1','10','100','20','100','30','0','0','ENDSEC','0','EOF',''].join('\n');
 await sourceUpload(page).setInputFiles({name:'E2-Level-1-Transformer.dxf',mimeType:'application/dxf',buffer:Buffer.from(dxf)});
 await expect(page.getByText(/Source compilation updated/i)).toBeVisible();
 await page.getByRole('link',{name:'Render Spatial Environment'}).click();
 await expect(page).toHaveURL(/\/spatial/);
 await expect(page.getByRole('heading',{name:'Spatial model'})).toBeVisible();

 const canvas=page.locator('canvas[aria-label="Interactive Spatial model"]');
 await expect(canvas).toBeVisible();
 await page.getByRole('button',{name:/Infrastructure HUD/}).click();
 await expect(page.getByText(/3D WEBGL/)).toBeVisible();
 await expect.poll(async()=>Number(await canvas.getAttribute('data-clickable-assets')||0),{timeout:15000}).toBeGreaterThan(0);

 const box=await canvas.boundingBox();
 expect(box).not.toBeNull();
 await expect.poll(async()=>({
  x:Number(await canvas.getAttribute('data-primary-hit-x')),
  y:Number(await canvas.getAttribute('data-primary-hit-y')),
  id:await canvas.getAttribute('data-primary-asset')
 }),{timeout:15000}).toMatchObject({id:expect.any(String)});
 const hitX=Number(await canvas.getAttribute('data-primary-hit-x'));
 const hitY=Number(await canvas.getAttribute('data-primary-hit-y'));
 expect(Number.isFinite(hitX)&&Number.isFinite(hitY)).toBeTruthy();
 await canvas.click({position:{x:hitX,y:hitY}});
 await expect.poll(async()=>await canvas.getAttribute('data-selected-asset')).toBe(await canvas.getAttribute('data-primary-asset'));
 await expect(page.getByRole('heading',{name:'DRY TYPE TRANSFORMER T1'})).toBeVisible();
 await expect(page.getByText('Z placement',{exact:true})).toBeVisible();
});


test('Spatial auto-recovers the last good uploaded model when the current browser key is missing',async({page})=>{
 await page.goto('/compiler');
 const dxf=['0','SECTION','2','HEADER','9','$INSUNITS','70','2','0','ENDSEC','0','SECTION','2','ENTITIES','0','INSERT','8','E-EQUIP','2','MAIN SWITCHBOARD MSB-1','10','100','20','100','30','0','0','ENDSEC','0','EOF',''].join('\n');
 await sourceUpload(page).setInputFiles({name:'E-201-Level-1-Switchboard.dxf',mimeType:'application/dxf',buffer:Buffer.from(dxf)});
 await expect(page.getByText(/Source compilation updated/i)).toBeVisible();
 await expect.poll(()=>page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('stratum-spatial-recovery-v1',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
  return new Promise<boolean>(resolve=>{const request=db.transaction('graphs','readonly').objectStore('graphs').get('latest');request.onsuccess=()=>resolve(Boolean(request.result?.entities?.length));request.onerror=()=>resolve(false)});
 })).toBeTruthy();

 await page.evaluate(()=>localStorage.removeItem('stratum_compiled_graph'));
 await page.goto('/spatial');

 await expect(page.getByRole('heading',{name:'Spatial model'})).toBeVisible();
 const canvas=page.locator('canvas[aria-label="Interactive Spatial model"]');
 await expect(canvas).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>Boolean(localStorage.getItem('stratum_compiled_graph')))).toBeTruthy();
 expect(await page.getByLabel('Imported object').locator('option').filter({hasText:'MAIN SWITCHBOARD MSB-1'}).count()).toBeGreaterThan(0);
});


test('Spatial restores the saved project among multiple tenant projects when browser state is empty',async({page})=>{
 const projectId='30000000-0000-4000-8000-000000000001';
 const source='E-201-Server-Switchboard.dxf';
 const graph={
  version:'1.1',
  createdAt:'2026-09-22T21:10:00.000Z',
  sources:[{name:source,ext:'dxf',sha256:'a'.repeat(64),discipline:'Electrical',floor:'L1',elevation:0,unitName:'m',unitToMeters:1}],
  entities:[{id:'server-msb-1',source,layer:'L4',kind:'asset-candidate',name:'SERVER MAIN SWITCHBOARD MSB-1',x:0,y:0,z:0,floor:'L1',confidence:.96,meta:{registrationState:'CANDIDATE',sourceDesignCoordinate:true,physicalTruth:false,reviewRequired:true}}],
  links:[],
  stats:{L0:1,L1:0,L2:0,L3:0,L4:1}
 };
 await page.route('**/api/spatial/compilations**',async route=>{
  const url=new URL(route.request().url());
  if(url.searchParams.get('projectId')){
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({schemaReady:true,projects:[{id:projectId,project_code:'SV-UAT-001',name:'STRATUM Verified Production Pilot'}],latest:{revision:7,graph_json:graph}})});
  }else{
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({schemaReady:true,projects:[{id:'30000000-0000-4000-8000-000000000002',project_code:'EMPTY',name:'Empty project'},{id:projectId,project_code:'SV-UAT-001',name:'STRATUM Verified Production Pilot'}],restorableProjectId:projectId,latest:null})});
  }
 });
 await page.goto('/spatial');
 await expect(page.getByRole('heading',{name:'Spatial model'})).toBeVisible();
 await expect(page.locator('canvas[aria-label="Interactive Spatial model"]')).toBeVisible();
 await expect(page.getByLabel('Imported object').locator('option').filter({hasText:'SERVER MAIN SWITCHBOARD MSB-1'})).toHaveCount(1);
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}'));
 expect(stored.entities?.some((entity:any)=>entity.name==='SERVER MAIN SWITCHBOARD MSB-1')).toBeTruthy();
 expect(await page.evaluate(()=>localStorage.getItem('stratum_spatial_project_id'))).toBe(projectId);
 await page.getByText('Backup & recovery').click();
 await expect(page.getByRole('button',{name:'Recover earlier STRATUM model'})).toBeVisible();
 await page.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{origin:'https://stratum-twin-chain.vercel.app',data:{type:'STRATUM_SPATIAL_RECOVERY',version:1,graph:{version:'1.1',createdAt:new Date().toISOString(),sources:[],entities:[{id:'legacy-one',source:'legacy',layer:'L2',kind:'asset-candidate',name:'LEGACY ASSET',x:0,y:0,z:0,confidence:.7}],links:[],stats:{L2:1}}}})));
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem('stratum_spatial_project_id'))).toBeNull();
 await expect(page.getByText(/Choose the correct project before server sync/)).toBeVisible();
});


test('Spatial keeps a restoring state while the latest server model is still loading',async({page})=>{
 const projectId='30000000-0000-4000-8000-000000000001';
 const source='M-201-Server-Pump.ifc';
 const graph={
  version:'1.1',
  createdAt:'2026-09-22T22:20:00.000Z',
  sources:[{name:source,ext:'ifc',sha256:'b'.repeat(64),discipline:'Mechanical',floor:'L2',elevation:4,unitName:'m',unitToMeters:1}],
  entities:[{id:'server-pump-1',source,layer:'L4',kind:'ifc-product-placement',name:'SERVER CHW PUMP P-1',x:2,y:3,z:4,floor:'L2',confidence:.94,meta:{registrationState:'CANDIDATE',sourceDesignCoordinate:true,physicalTruth:false,reviewRequired:true}}],
  links:[],
  stats:{L0:1,L1:0,L2:0,L3:0,L4:1}
 };
 await page.route('**/api/spatial/compilations**',async route=>{
  const url=new URL(route.request().url());
  if(url.searchParams.get('projectId')){
   await new Promise(resolve=>setTimeout(resolve,900));
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({schemaReady:true,projects:[{id:projectId,project_code:'SV-UAT-001',name:'STRATUM Verified Production Pilot'}],latest:{revision:8,graph_json:graph}})});
  }else{
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({schemaReady:true,projects:[{id:projectId,project_code:'SV-UAT-001',name:'STRATUM Verified Production Pilot'}],latest:null})});
  }
 });
 await page.goto('/spatial');
 await expect(page.getByRole('heading',{name:'Restoring latest project model…'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Import before viewing Spatial'})).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Spatial model'})).toBeVisible();
 await expect(page.locator('canvas[aria-label="Interactive Spatial model"]')).toBeVisible();
 await expect(page.getByLabel('Imported object').locator('option').filter({hasText:'SERVER CHW PUMP P-1'})).toHaveCount(1);
});

test('each uploaded drawing can be toggled independently as a Spatial source layer',async({page})=>{
 const graph={
  version:'1.1',createdAt:'2026-09-22T22:30:00.000Z',
  sources:[
   {name:'A-101 Architectural Plan.dxf',ext:'dxf',sha256:'1'.repeat(64),discipline:'Architectural',floor:'L1',elevation:0,unitName:'m',unitToMeters:1},
   {name:'E-201 Electrical Plan.dxf',ext:'dxf',sha256:'2'.repeat(64),discipline:'Electrical',floor:'L1',elevation:0,unitName:'m',unitToMeters:1}
  ],
  entities:[
   {id:'room-a',source:'A-101 Architectural Plan.dxf',layer:'L1',kind:'room-boundary',name:'ELECTRICAL ROOM',x:0,y:0,z:0,floor:'L1',confidence:.9,vertices:[{x:-3,y:-3},{x:3,y:-3},{x:3,y:3},{x:-3,y:3}],meta:{sourceDesignCoordinate:true,physicalTruth:false}},
   {id:'panel-e',source:'E-201 Electrical Plan.dxf',layer:'L2',kind:'cad-block',name:'PANELBOARD LP-1',x:0,y:0,z:0,floor:'L1',confidence:.95,meta:{sourceDesignCoordinate:true,physicalTruth:false}}
  ],
  links:[],stats:{L0:2,L1:1,L2:1,L3:0,L4:0}
 };
 await page.addInitScript(value=>localStorage.setItem('stratum_compiled_graph',JSON.stringify(value)),graph);
 await page.goto('/spatial');
 await expect(page.getByRole('heading',{name:'Spatial model'})).toBeVisible();
 const layers=page.getByText(/Source layers · 2\/2 visible/);
 await expect(layers).toBeVisible();
 await layers.click();

 const architectural=page.getByLabel('Toggle source A-101 Architectural Plan.dxf');
 const electrical=page.getByLabel('Toggle source E-201 Electrical Plan.dxf');
 await expect(architectural).toBeChecked();await expect(electrical).toBeChecked();
 await expect(page.getByLabel('Imported object').locator('option').filter({hasText:'PANELBOARD LP-1'})).toHaveCount(1);

 await electrical.uncheck();
 await expect(page.getByText(/Source layers · 1\/2 visible/)).toBeVisible();
 await expect(page.getByLabel('Imported object').locator('option').filter({hasText:'PANELBOARD LP-1'})).toHaveCount(0);
 await expect(architectural).toBeChecked();

 await page.getByRole('button',{name:'Show all sources'}).click();
 await expect(electrical).toBeChecked();
 await expect(page.getByText(/Source layers · 2\/2 visible/)).toBeVisible();
});


test('Review mode exposes clickable coordination findings on affected 3D assets',async({page})=>{
 const source='E-201 Electrical Plan.dxf';
 const schedule='M-601 Equipment Matrix.xlsx';
 const graph={
  version:'1.1',createdAt:'2026-09-22T22:40:00.000Z',
  sources:[
   {name:source,ext:'dxf',sha256:'c'.repeat(64),discipline:'Electrical',floor:'L1',elevation:0,unitName:'m',unitToMeters:1},
   {name:schedule,ext:'xlsx',sha256:'d'.repeat(64),discipline:'Mechanical',floor:'L1',elevation:0}
  ],
  entities:[
   {id:'panel-review-1',source,layer:'L4',kind:'asset-candidate',name:'PANELBOARD LP-1',x:0,y:0,z:0,floor:'L1',confidence:.96,meta:{assetTag:'LP-1',voltage:480,phase:3,registrationState:'CANDIDATE',sourceSha256:'c'.repeat(64),sourceDesignCoordinate:true,physicalTruth:false,reviewRequired:true}},
   {id:'schedule-review-1',source:schedule,layer:'L4',kind:'equipment-schedule',name:'LP-1 PANELBOARD',x:0,y:0,z:0,floor:'L1',confidence:.91,meta:{assetTag:'LP-1',voltage:208,phase:3,sourceSha256:'d'.repeat(64),nonSpatial:true,physicalTruth:false,reviewRequired:true}}
  ],
  links:[],stats:{L0:2,L1:0,L2:0,L3:0,L4:2}
 };
 await page.addInitScript(value=>localStorage.setItem('stratum_compiled_graph',JSON.stringify(value)),graph);
 await page.goto('/spatial');
 await expect(page.getByRole('heading',{name:'Spatial model'})).toBeVisible();
 await page.getByRole('button',{name:/Review/}).click();
 const canvas=page.locator('canvas[aria-label="Interactive Spatial model"]');
 await expect(canvas).toBeVisible();
 await expect.poll(async()=>Number(await canvas.getAttribute('data-coordination-assets')||0),{timeout:15000}).toBeGreaterThan(0);
 let box=await canvas.boundingBox();expect(box).not.toBeNull();
 const x=Number(await canvas.getAttribute('data-coordination-hit-x'));
 const y=Number(await canvas.getAttribute('data-coordination-hit-y'));
 expect(Number.isFinite(x)&&Number.isFinite(y)).toBeTruthy();
 const viewport=page.viewportSize();
 if(viewport&&box!.y+y>viewport.height-48){
  await page.evaluate(({top,hitY,height})=>window.scrollBy(0,Math.max(0,top+hitY-height*.62)),{top:box!.y,hitY:y,height:viewport.height});
  box=await canvas.boundingBox();expect(box).not.toBeNull();
 }
 await page.mouse.click(box!.x+x,box!.y+y);
 await expect.poll(async()=>await canvas.getAttribute('data-selected-asset')).toBe('panel-review-1');
 await expect(page.getByRole('heading',{name:'PANELBOARD LP-1'})).toBeVisible();
 const reviewCard=page.getByLabel('Selected asset coordination review');
 await expect(reviewCard).toBeVisible();
 await expect(reviewCard.getByText(/RATING CONFLICT/)).toBeVisible();
 await expect(reviewCard.getByText(/do not establish a geometric clash, code compliance, AHJ approval, or engineering approval/i)).toBeVisible();
});


test('raster OCR positional equipment is clickable while physical XYZ remains unverified',async({page})=>{
 const source='Synthetic Flattened E-201.pdf',sha='raster-ocr-positional-fixture';
 const preview='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=';
 await page.addInitScript(({source,sha,preview})=>localStorage.setItem('stratum_compiled_graph',JSON.stringify({
  version:'raster-ocr-positional-1',createdAt:'2026-09-27T00:00:00.000Z',reviewState:'REVIEW_REQUIRED',
  sources:[
   {name:source,ext:'pdf',sha256:sha,discipline:'Electrical',floor:'UNRESOLVED',elevation:0},
   {name:'Tesla Supercharger V3 reference.glb',ext:'glb',sha256:'tesla-reference',discipline:'Unclassified',floor:'UNRESOLVED',elevation:0}
  ],
  entities:[
   {id:'raster-underlay',source,layer:'L1',kind:'source-raster-underlay',name:'Electrical power plan · page 1',x:-10,y:-7,z:0,x2:10,y2:7,z2:0,confidence:1,floor:'UNRESOLVED',meta:{page:1,sourceSha256:sha,drawingBasemap:true,embeddedRasterDataUrl:preview,coordinateUnits:'image_preview',geometryAuthority:'RASTER_PREVIEW_ONLY',spatialPlacementAuthority:'SOURCE_IMAGE_PLANE_ONLY',zPlacementAuthority:'UNVERIFIED_DRAWING_PLANE',physicalElevationKnown:false,physicalTruth:false,rasterCandidateCount:1,nonSldPlan:true,planType:'ELECTRICAL_POWER_PLAN',planDiscipline:'Electrical'}},
   {id:'ocr-panel',source,layer:'L2',kind:'text-asset-candidate',name:'PANEL LP-1',x:2.4,y:-1.6,z:0,confidence:.71,floor:'UNRESOLVED',meta:{page:1,sourceSha256:sha,sourceType:'PDF_RASTER_OCR_POSITIONAL_CANDIDATE',ocrAuthority:'REVIEW_ONLY',geometryAuthority:'SOURCE_IMAGE_BBOX_ONLY',coordinateUnits:'image_sheet',spatialPlacementAuthority:'OCR_SOURCE_IMAGE_POSITION_ONLY',zPlacementAuthority:'UNVERIFIED_DRAWING_PLANE',elevationKnown:false,physicalElevationKnown:false,physicalTruth:false,reviewRequired:true,registrationState:'CANDIDATE',electricalComponentHint:'PANEL',ocrBoundingBoxPixels:[100,200,300,260],nonSldPlan:true,planType:'ELECTRICAL_POWER_PLAN',planDiscipline:'Electrical'}},
   {id:'tesla-reference',source:'Tesla Supercharger V3 reference.glb',layer:'L2',kind:'imported-3d-model',name:'Tesla Supercharger V3 reference',x:8,y:0,z:0,confidence:1,floor:'UNRESOLVED',meta:{sourceSha256:'tesla-reference',sourceType:'GLB',referenceOnly:true,physicalTruth:false,placementAuthority:'UNRESOLVED'}}
  ],
  links:[],stats:{L0:2,L1:1,L2:2,L3:0,L4:0}
 })),{source,sha,preview});
 await page.goto('/spatial');
 await expect(page.getByText('PROJECT MODEL',{exact:true})).toBeVisible();
 const select=page.getByLabel('Imported object');
 await expect(select.locator('option').filter({hasText:'PANEL LP-1'})).toHaveCount(1);
 const canvas=page.locator('canvas[aria-label="Interactive Spatial model"]');
 await expect(canvas).toBeVisible();
 await expect.poll(async()=>Number(await canvas.getAttribute('data-clickable-assets')||0),{timeout:15000}).toBeGreaterThanOrEqual(1);
 await select.selectOption('ocr-panel');
 await expect(page.getByRole('heading',{name:'PANEL LP-1'})).toBeVisible();
 await expect(page.getByText('Review plane · physical Z unresolved',{exact:true})).toBeVisible();
 await page.getByText('Placement & source confidence').click();
 await expect(page.locator('.placement-details').getByText('Review plane · unresolved',{exact:true})).toBeVisible();
});

test('reference-only Tesla geometry cannot disguise a source-sheet-only project',async({page})=>{
 const source='Synthetic Raster Sheet.pdf',sha='source-sheet-reference-fixture';
 await page.addInitScript(({source,sha})=>localStorage.setItem('stratum_compiled_graph',JSON.stringify({
  version:'source-sheet-reference-1',createdAt:'2026-09-27T00:00:00.000Z',reviewState:'REVIEW_REQUIRED',
  sources:[
   {name:source,ext:'pdf',sha256:sha,discipline:'Electrical',floor:'UNRESOLVED',elevation:0},
   {name:'Tesla Supercharger V3 reference.glb',ext:'glb',sha256:'tesla-reference',discipline:'Unclassified',floor:'UNRESOLVED',elevation:0}
  ],
  entities:[
   {id:'sheet-line',source,layer:'L1',kind:'line',name:'Source plan line',x:-5,y:0,x2:5,y2:0,confidence:1,floor:'UNRESOLVED',meta:{page:1,sourceSha256:sha,drawingBasemap:true,physicalTruth:false}},
   {id:'tesla-reference',source:'Tesla Supercharger V3 reference.glb',layer:'L2',kind:'imported-3d-model',name:'Tesla Supercharger V3 reference',x:8,y:0,z:0,confidence:1,floor:'UNRESOLVED',meta:{sourceSha256:'tesla-reference',sourceType:'GLB',referenceOnly:true,physicalTruth:false,placementAuthority:'UNRESOLVED'}}
  ],
  links:[],stats:{L0:2,L1:1,L2:1,L3:0,L4:0}
 })),{source,sha});
 await page.goto('/spatial');
 await expect(page.getByText(/SOURCE SHEET ONLY · 0 COMPONENTS/i)).toBeVisible();
 await expect(page.getByText(/Reference-only models do not count as project equipment/i)).toBeVisible();
});


test('civil grading plan renders as a recognized source frame without inventing equipment',async({page})=>{
 const source='Synthetic City Grading Plan.pdf',sha='civil-grading-fixture';
 const preview='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=';
 await page.addInitScript(({source,sha,preview})=>localStorage.setItem('stratum_compiled_graph',JSON.stringify({
  version:'civil-grading-1',createdAt:'2026-09-27T00:00:00.000Z',reviewState:'REVIEW_REQUIRED',
  sources:[{name:source,ext:'pdf',sha256:sha,discipline:'Civil / Grading',floor:'UNRESOLVED',elevation:0}],
  entities:[
   {id:'grading-underlay',source,layer:'L1',kind:'source-raster-underlay',name:'CIVIL_GRADING_PLAN · page 1',x:-10,y:-7,z:0,x2:10,y2:7,z2:0,confidence:1,floor:'UNRESOLVED',
    meta:{page:1,sourceSha256:sha,drawingBasemap:true,embeddedRasterDataUrl:preview,coordinateUnits:'image_preview',geometryAuthority:'RASTER_PREVIEW_ONLY',
      spatialPlacementAuthority:'SOURCE_IMAGE_PLANE_ONLY',zPlacementAuthority:'UNVERIFIED_DRAWING_PLANE',elevationKnown:false,physicalElevationKnown:false,physicalTruth:false,
      nonSldPlan:true,planType:'CIVIL_GRADING_PLAN',planRecognition:'CONTENT_PLAN_V1',planRecognitionScore:10,planDiscipline:'Civil / Grading'}},
   {id:'grading-line',source,layer:'L1',kind:'line',name:'Source grading line',x:-6,y:2,x2:6,y2:2,z:0,z2:0,confidence:.99,floor:'UNRESOLVED',
    meta:{page:1,sourceSha256:sha,drawingBasemap:true,coordinateUnits:'sheet',spatialPlacementAuthority:'SOURCE_SHEET_POSITION_ONLY',zPlacementAuthority:'UNVERIFIED_DRAWING_PLANE',
      elevationKnown:false,physicalElevationKnown:false,physicalTruth:false,nonSldPlan:true,planType:'CIVIL_GRADING_PLAN',planRecognition:'CONTENT_PLAN_V1',planDiscipline:'Civil / Grading'}}
  ],
  links:[],stats:{L0:1,L1:2,L2:0,L3:0,L4:0}
 })),{source,sha,preview});
 await page.goto('/spatial');
 await expect(page.getByRole('heading',{name:'Spatial model'})).toBeVisible();
 await expect(page.getByText(/1 drawing frame · 1 non-SLD plan/i)).toBeVisible();
 await expect(page.getByLabel('Imported object').locator('option')).toHaveText(['No selectable objects in this view']);
 await page.getByRole('button',{name:/Infrastructure HUD/i}).click();
 await expect(page.getByText('NON-SLD PLANS',{exact:true})).toBeVisible();
 await expect(page.getByText('DRAWING UNDERLAYS',{exact:true})).toBeVisible();
 await expect(page.getByText(/Z unverified|drawing plane/i)).toBeVisible();
});


test('site asset uses local grade review surface without claiming physical Z',async({page})=>{
 const source='Synthetic Grading Plan.pdf';
 const graph={
  version:'local-grade-surface-1',createdAt:'2026-09-28T00:00:00.000Z',reviewState:'REVIEW_REQUIRED',
  sources:[{name:source,ext:'pdf',sha256:'g'.repeat(64),discipline:'Civil / Grading',floor:'UNRESOLVED',elevation:0}],
  entities:[
   {id:'terrain-triangle',source,layer:'L1',kind:'elevation-review-surface-triangle',name:'GRADE review surface',x:0,y:0,z:30.8,floor:'UNRESOLVED',confidence:.74,
    vertices:[{x:-6,y:-4},{x:6,y:-4},{x:0,y:6}],
    meta:{page:1,nonSldPlan:true,planType:'CIVIL_GRADING_PLAN',planDiscipline:'Civil / Grading',elevationTriangle:{id:'tri-1',kind:'GRADE',pointIds:['p1','p2','p3'],zMeters:[30.48,30.7848,31.0896]},physicalElevationKnown:false,physicalTruth:false,reviewRequired:true}},
   {id:'site-evse',source,layer:'L2',kind:'text-asset-candidate',name:'EVSE-1',x:0,y:0,z:0,floor:'UNRESOLVED',confidence:.82,
    meta:{page:1,nonSldPlan:true,planType:'CIVIL_GRADING_PLAN',planDiscipline:'Civil / Grading',localReviewSurfaceZ:30.7848,localReviewSurfaceKind:'GRADE',localReviewSurfaceAuthority:'SOURCE_ELEVATION_TRIANGLE',localReviewSurfaceConfidence:.74,localReviewSurfaceTriangleId:'tri-1',localReviewSurfaceControlPointIds:['p1','p2','p3'],physicalElevationKnown:false,elevationKnown:false,physicalTruth:false,reviewRequired:true}}
  ],
  links:[],stats:{L0:0,L1:1,L2:1,L3:0,L4:0}
 };
 await page.addInitScript(value=>localStorage.setItem('stratum_compiled_graph',JSON.stringify(value)),graph);
 await page.goto('/spatial');
 const select=page.getByLabel('Imported object');
 await expect(select.locator('option').filter({hasText:'EVSE-1'})).toHaveCount(1);
 await select.selectOption('site-evse');
 await expect(page.getByRole('heading',{name:'EVSE-1'})).toBeVisible();
 await expect(page.getByText(/GRADE local review surface · object Z unresolved/i)).toBeVisible();
 await page.getByText('Placement & source confidence').click();
 await expect(page.locator('.placement-details').getByText(/30\.78 m grade local surface/i)).toBeVisible();
 await expect(page.locator('.placement-details').getByText(/SOURCE ELEVATION TRIANGLE/i).first()).toBeVisible();
 await expect(page.getByText(/74%/).first()).toBeVisible();
});


test('pedestal EVSE composes local grade surface into a placement candidate',async({page})=>{
 const source='Synthetic Grading Plan.pdf';
 const graph={
  version:'local-grade-placement-1',createdAt:'2026-09-29T00:00:00.000Z',reviewState:'REVIEW_REQUIRED',
  sources:[{name:source,ext:'pdf',sha256:'p'.repeat(64),discipline:'Civil / Grading',floor:'UNRESOLVED',elevation:0}],
  entities:[
   {id:'terrain-triangle-2',source,layer:'L1',kind:'elevation-review-surface-triangle',name:'GRADE review surface',x:0,y:0,z:30.7848,floor:'UNRESOLVED',confidence:.74,
    vertices:[{x:-6,y:-4},{x:6,y:-4},{x:0,y:6}],
    meta:{page:1,elevationTriangle:{id:'tri-2',kind:'GRADE',pointIds:['p1','p2','p3'],zMeters:[30.48,30.7848,31.0896]},physicalElevationKnown:false,physicalTruth:false,reviewRequired:true}},
   {id:'pedestal-evse',source,layer:'L2',kind:'text-asset-candidate',name:'EVSE-1',x:0,y:0,z:0,floor:'UNRESOLVED',confidence:.82,
    meta:{page:1,mountingType:'pedestal',localReviewSurfaceZ:30.7848,localReviewSurfaceKind:'GRADE',localReviewSurfaceAuthority:'SOURCE_ELEVATION_TRIANGLE',localReviewSurfaceConfidence:.74,physicalElevationKnown:false,elevationKnown:false,physicalTruth:false,reviewRequired:true}}
  ],
  links:[],stats:{L0:0,L1:1,L2:1,L3:0,L4:0}
 };
 await page.addInitScript(value=>localStorage.setItem('stratum_compiled_graph',JSON.stringify(value)),graph);
 await page.goto('/spatial');
 const select=page.getByLabel('Imported object');
 await select.selectOption('pedestal-evse');
 await expect(page.getByRole('heading',{name:'EVSE-1'})).toBeVisible();
 await expect(page.getByText(/30\.78 m placement candidate · review required/i)).toBeVisible();
 await page.getByText('Placement & source confidence').click();
 const details=page.locator('.placement-details');
 await expect(details.getByText(/30\.785 m/)).toBeVisible();
 await expect(details.getByText(/SOURCE SUPPORT SURFACE CANDIDATE/i)).toBeVisible();
 await expect(details.getByText(/EVSE PEDESTAL BASE ON SUPPORT SURFACE/i)).toBeVisible();
 await expect(page.getByText(/physical Z/i).first()).toBeVisible();
});

test('reviewed civil-to-electrical alignment transfers grade Z across sheets without claiming physical elevation',async({page})=>{
 const electricalSha='a'.repeat(64),civilSha='b'.repeat(64);
 const sourceElectrical='E-101 Electrical Site Plan.pdf',sourceCivil='C-2 Grading Plan.pdf';
 const meta=(sha:string,pageNumber:number,discipline:string)=>({sourceSha256:sha,page:pageNumber,nonSldPlan:true,planType:discipline==='Electrical'?'ELECTRICAL_POWER_PLAN':'CIVIL_GRADING_PLAN',planDiscipline:discipline,physicalElevationKnown:false,elevationKnown:false,physicalTruth:false,reviewRequired:true});
 const graph={
  version:'cross-sheet-z-browser-1',createdAt:'2026-09-29T00:00:00.000Z',reviewState:'REVIEW_REQUIRED',
  sources:[
   {name:sourceElectrical,ext:'pdf',sha256:electricalSha,discipline:'Electrical',floor:'L1',elevation:0,state:'parsed',entities:4},
   {name:sourceCivil,ext:'pdf',sha256:civilSha,discipline:'Civil',floor:'L1',elevation:0,state:'parsed',entities:4}
  ],
  titleBlocks:[
   {sourceSha256:electricalSha,page:1,sheetNumber:{value:'E-101'},discipline:{value:'Electrical'},floor:{value:'L1'},drawingScale:{value:'1:100'},pageGeometry:{widthPoints:1000,heightPoints:700,maxDimensionPoints:1000},geometryScaleAuthority:false,reviewState:'CONFIRMED'},
   {sourceSha256:civilSha,page:2,sheetNumber:{value:'C-2'},discipline:{value:'Civil'},floor:{value:'L1'},drawingScale:{value:'1:100'},pageGeometry:{widthPoints:1000,heightPoints:700,maxDimensionPoints:1000},geometryScaleAuthority:false,reviewState:'CONFIRMED'}
  ],
  entities:[
   {id:'e-a1',source:sourceElectrical,layer:'L2',kind:'logical-tag',name:'PANEL LP1',x:0,y:0,z:0,floor:'L1',confidence:.95,meta:meta(electricalSha,1,'Electrical')},
   {id:'e-a2',source:sourceElectrical,layer:'L2',kind:'logical-tag',name:'TRANSFORMER T1',x:2,y:0,z:0,floor:'L1',confidence:.95,meta:meta(electricalSha,1,'Electrical')},
   {id:'e-a3',source:sourceElectrical,layer:'L2',kind:'logical-tag',name:'ATS 1',x:0,y:2,z:0,floor:'L1',confidence:.95,meta:meta(electricalSha,1,'Electrical')},
   {id:'evse-cross-sheet',source:sourceElectrical,layer:'L2',kind:'text-asset-candidate',name:'EVSE-1',x:.5,y:.25,z:0,floor:'UNRESOLVED',confidence:.9,meta:meta(electricalSha,1,'Electrical')},
   {id:'c-a1',source:sourceCivil,layer:'L2',kind:'logical-tag',name:'PANEL LP1',x:0,y:0,z:0,floor:'L1',confidence:.95,meta:meta(civilSha,2,'Civil')},
   {id:'c-a2',source:sourceCivil,layer:'L2',kind:'logical-tag',name:'TRANSFORMER T1',x:2,y:0,z:0,floor:'L1',confidence:.95,meta:meta(civilSha,2,'Civil')},
   {id:'c-a3',source:sourceCivil,layer:'L2',kind:'logical-tag',name:'ATS 1',x:0,y:2,z:0,floor:'L1',confidence:.95,meta:meta(civilSha,2,'Civil')},
   {id:'civil-grade-triangle',source:sourceCivil,layer:'L1',kind:'elevation-review-surface-triangle',name:'GRADE review surface',x:.5,y:.2,z:30.6,floor:'UNRESOLVED',confidence:.82,
    vertices:[{x:-1,y:-1},{x:2,y:-1},{x:.5,y:2}],
    meta:{...meta(civilSha,2,'Civil'),elevationTriangle:{id:'tri-browser-1',kind:'GRADE',pointIds:['p1','p2','p3'],zMeters:[30,31,32]}}}
  ],
  links:[],stats:{L0:2,L1:1,L2:7,L3:0,L4:0}
 };
 await page.addInitScript(value=>localStorage.setItem('stratum_compiled_graph',JSON.stringify(value)),graph);
 await page.goto('/compiler');
 const exceptions=page.getByText('Review exceptions',{exact:true});
 await expect(exceptions).toBeVisible();
 await exceptions.click();
 const review=page.getByRole('region',{name:'Automatic sheet alignment review'});
 await expect(review).toBeVisible();
 await expect(review.getByText(/C-2 → E-101|E-101 → C-2/)).toBeVisible();
 await expect(review.getByText(/COORDINATION REVIEW/)).toBeVisible();
 await expect(review.getByText(/disciplines differ/i)).toBeVisible();
 await review.getByRole('button',{name:'Apply reviewed proposal'}).click();
 await expect(review.getByRole('status')).toContainText(/cross-sheet elevation surfaces were sampled for review/i);

 await expect.poll(()=>page.evaluate(()=>{
  const g=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}');
  const evse=(g.entities||[]).find((entity:any)=>entity.id==='evse-cross-sheet');
  const z=evse?.meta?.crossSheetReviewSurfaceZ;
  return evse?{
   z,
   finite:Number.isFinite(Number(z)),
   kind:evse.meta?.crossSheetReviewSurfaceKind,
   authority:evse.meta?.crossSheetReviewSurfaceAuthority,
   physical:evse.meta?.physicalElevationKnown
  }:null;
 })).toMatchObject({finite:true,kind:'GRADE',authority:'HUMAN_CONFIRMED_ALIGNMENT_PLUS_SOURCE_ELEVATION_TRIANGLE',physical:false});

 await page.goto('/spatial');
 const sheetSelect=page.getByLabel('Sheet page isolation');
 const electricalOption=sheetSelect.locator('option').filter({hasText:sourceElectrical}).first();
 await expect(electricalOption).toHaveCount(1);
 const electricalValue=await electricalOption.getAttribute('value');
 expect(electricalValue).toBeTruthy();
 await sheetSelect.selectOption(electricalValue!);
 const select=page.getByLabel('Imported object');
 await expect(select.locator('option').filter({hasText:'EVSE-1'})).toHaveCount(1);
 await select.selectOption('evse-cross-sheet');
 await expect(page.getByText(/CROSS-SHEET Z REVIEW SURFACE/)).toBeVisible();
 await expect(page.getByText(/coordination-derived design evidence, not field-verified physical elevation/i)).toBeVisible();
 await expect(page.getByText(/GRADE cross-sheet review surface · object Z unresolved/i)).toBeVisible();
 await page.getByText('Placement & source confidence').click();
 const placementDetails=page.locator('.placement-details');
 await expect(placementDetails.getByText(/Cross-sheet Z authority/)).toBeVisible();
 await expect(placementDetails.getByText(/HUMAN CONFIRMED ALIGNMENT PLUS SOURCE ELEVATION TRIANGLE/)).toBeVisible();
});


test('explicit transformer pad height composes with local grade into base Z candidate',async({page})=>{
 const source='Synthetic Equipment Site Plan.pdf';
 const graph={
  version:'support-offset-browser-1',createdAt:'2026-09-29T00:00:00.000Z',reviewState:'REVIEW_REQUIRED',
  sources:[{name:source,ext:'pdf',sha256:'s'.repeat(64),discipline:'Electrical',floor:'UNRESOLVED',elevation:0}],
  entities:[
   {id:'xfmr-pad',source,layer:'L2',kind:'text-asset-candidate',name:'PAD MOUNT TRANSFORMER T1',x:0,y:0,z:0,floor:'UNRESOLVED',confidence:.91,
    meta:{page:1,localReviewSurfaceZ:30.48,localReviewSurfaceKind:'GRADE',localReviewSurfaceAuthority:'SOURCE_ELEVATION_TRIANGLE',localReviewSurfaceConfidence:.82,
      supportBaseOffsetMeters:.1524,supportOffsetKind:'PAD',supportOffsetAuthority:'TAG_LINKED_SOURCE_SUPPORT_NOTE',supportOffsetConfidence:.94,
      supportOffsetEvidenceLabel:'XFMR T1 6" CONC PAD',supportOffsetSource:source,physicalElevationKnown:false,elevationKnown:false,physicalTruth:false,reviewRequired:true}}
  ],
  links:[],stats:{L0:0,L1:0,L2:1,L3:0,L4:0}
 };
 await page.addInitScript(value=>localStorage.setItem('stratum_compiled_graph',JSON.stringify(value)),graph);
 await page.goto('/spatial');
 const select=page.getByLabel('Imported object');
 await expect(select.locator('option').filter({hasText:'PAD MOUNT TRANSFORMER T1'})).toHaveCount(1);
 await select.selectOption('xfmr-pad');
 await expect(page.getByRole('heading',{name:'PAD MOUNT TRANSFORMER T1'})).toBeVisible();
 await expect(page.getByText(/30\.63 m placement candidate · review required/i)).toBeVisible();
 await page.getByText('Placement & source confidence').click();
 const details=page.locator('.placement-details');
 await expect(details.getByText(/30\.632 m/)).toBeVisible();
 await expect(details.getByText(/SUPPORT SURFACE PLUS SOURCE BASE OFFSET/i)).toBeVisible();
 await expect(details.getByText(/0\.152 m · PAD/i)).toBeVisible();
 await expect(details.getByText(/TAG LINKED SOURCE SUPPORT NOTE/i)).toBeVisible();
 await expect(details.getByText(/SOURCE SUPPORT BASE OFFSET ON REVIEW SURFACE/i)).toBeVisible();
 await expect(details.getByText(/Physical Z/)).toBeVisible();
 await expect(details.getByText(/Unverified/)).toBeVisible();
});


test('vertical Z reference semantics convert centerline to equipment base and keep unspecified AFF review-only',async({page})=>{
 const source='E-201 Power Plan.pdf';
 const graph={
  version:'z-reference-browser-1',createdAt:'2026-09-29T12:50:00.000Z',reviewState:'REVIEW_REQUIRED',
  sources:[{name:source,ext:'pdf',sha256:'r'.repeat(64),discipline:'Electrical',floor:'L2',elevation:0}],
  entities:[
   {id:'panel-centerline',source,layer:'L2',kind:'text-asset-candidate',name:'PANEL LP-2',x:1,y:1,z:0,floor:'L2',confidence:.9,
    meta:{assetDimensionAuthority:'SOURCE_SPEC',assetDimensionsMeters:[.8,1.2,.25],zCandidateMeters:5.4864,zCandidateReferencePoint:'CENTERLINE',zResolutionStatus:'RESOLVED_DESIGN_CANDIDATE',zResolutionConfidence:.88,zResolutionAuthority:'FLOOR_DATUM_PLUS_AFF_REFERENCE',physicalElevationKnown:false,elevationKnown:false,physicalTruth:false,reviewRequired:true}},
   {id:'panel-ambiguous',source,layer:'L2',kind:'text-asset-candidate',name:'PANEL LP-3',x:3,y:1,z:0,floor:'L2',confidence:.88,
    meta:{reviewSurfaceZ:4.2672,reviewSurfaceKind:'FINISHED_FLOOR',reviewSurfaceAuthority:'SOURCE_PROJECT_DATUM',reviewSurfaceConfidence:.9,zCandidateReferencePoint:'UNSPECIFIED',zResolutionStatus:'RELATIVE_ONLY',zResolutionConfidence:.7,zResolutionAuthority:'AFF_REFERENCE_UNSPECIFIED',physicalElevationKnown:false,elevationKnown:false,physicalTruth:false,reviewRequired:true}}
  ],
  links:[],stats:{L0:0,L1:0,L2:2,L3:0,L4:0}
 };
 await page.addInitScript(value=>localStorage.setItem('stratum_compiled_graph',JSON.stringify(value)),graph);
 await page.goto('/spatial');
 const select=page.getByLabel('Imported object');

 await select.selectOption('panel-centerline');
 await expect(page.getByRole('heading',{name:'PANEL LP-2'})).toBeVisible();
 await expect(page.getByText('CENTERLINE design Z reference · review required',{exact:true})).toBeVisible();
 await expect(page.getByText(/Z REFERENCE CANDIDATE · REVIEW REQUIRED/)).toBeVisible();
 await page.getByText('Placement & source confidence').click();
 const centerDetails=page.locator('.placement-details');
 await expect(centerDetails.getByText('4.886 m',{exact:false})).toBeVisible();
 await expect(centerDetails.getByText(/CENTERLINE · 5\.486 m/)).toBeVisible();

 await select.selectOption('panel-ambiguous');
 await expect(page.getByRole('heading',{name:'PANEL LP-3'})).toBeVisible();
 await expect(page.getByText(/AFF HEIGHT FOUND · REFERENCE POINT REQUIRED/)).toBeVisible();
 await expect(page.getByText(/does not state whether that height is to the base, bottom, centerline, top, or mounting point/i)).toBeVisible();
});


test('conflicting absolute Z chains block auto-placement and expose both evidence paths',async({page})=>{
 const source='Synthetic Z Conflict Plan.pdf';
 const graph={
  version:'z-conflict-browser-1',createdAt:'2026-09-29T10:40:00.000Z',reviewState:'REVIEW_REQUIRED',
  sources:[{name:source,ext:'pdf',sha256:'z'.repeat(64),discipline:'Electrical / Civil',floor:'UNRESOLVED',elevation:0}],
  entities:[
   {id:'xfmr-z-conflict',source,layer:'L2',kind:'text-asset-candidate',name:'PAD MOUNT TRANSFORMER T1',x:0,y:0,z:0,floor:'UNRESOLVED',confidence:.93,
    meta:{
      page:1,
      assetDimensionAuthority:'SOURCE_SPEC',assetDimensionsMeters:[1.7,1.6,1.25],
      localReviewSurfaceZ:30.48,localReviewSurfaceKind:'GRADE',localReviewSurfaceAuthority:'SOURCE_ELEVATION_TRIANGLE',localReviewSurfaceConfidence:.84,
      supportBaseOffsetMeters:.1524,supportOffsetKind:'PAD',supportOffsetAuthority:'TAG_LINKED_SOURCE_SUPPORT_NOTE',supportOffsetConfidence:.94,
      supportOffsetEvidenceLabel:'XFMR T1 6" CONC PAD',
      zResolutionStatus:'RESOLVED_DESIGN_CANDIDATE',zCandidateMeters:31.1,zCandidateReferencePoint:'BASE',zResolutionConfidence:.9,zResolutionAuthority:'SOURCE_BASE_ELEVATION',
      physicalElevationKnown:false,elevationKnown:false,physicalTruth:false,reviewRequired:true
    }}
  ],
  links:[],stats:{L0:0,L1:0,L2:1,L3:0,L4:0}
 };
 await page.addInitScript(value=>localStorage.setItem('stratum_compiled_graph',JSON.stringify(value)),graph);
 await page.goto('/spatial');
 const select=page.getByLabel('Imported object');
 await expect(select.locator('option').filter({hasText:'PAD MOUNT TRANSFORMER T1'})).toHaveCount(1);
 await select.selectOption('xfmr-z-conflict');
 await expect(page.getByRole('heading',{name:'PAD MOUNT TRANSFORMER T1'})).toBeVisible();
 await expect(page.getByText('Z CONFLICT · review required',{exact:true})).toBeVisible();
 await expect(page.getByText(/Z CONFLICT · AUTO-PLACEMENT BLOCKED/)).toBeVisible();
 await expect(page.getByText(/Independent absolute-Z chains disagree/i)).toBeVisible();
 await page.getByText('Placement & source confidence').click();
 const details=page.locator('.placement-details');
 await expect(details.getByText('30.480 m',{exact:false})).toBeVisible();
 const facts=details.locator('.passport-facts > div');
 await expect(facts.filter({hasText:'Placement authority'}).getByText('UNRESOLVED',{exact:true})).toBeVisible();
 await expect(facts.filter({hasText:'Z solution'}).getByText('CONFLICT',{exact:true})).toBeVisible();
 await expect(facts.filter({hasText:'Z chains compared'}).locator('strong')).toHaveText(/^[2-9]\d*$/);
 await page.getByText('Z solution evidence').click();
 await expect(page.getByText(/source reference/i).first()).toBeVisible();
 await expect(page.getByText(/support surface plus offset/i).first()).toBeVisible();
});

test('human Z review selects one preserved design chain without establishing physical truth',async({page})=>{
 const source='Synthetic Z Conflict Review.pdf';
 const graph={
  version:'z-conflict-review-browser-1',createdAt:'2026-09-30T08:00:00.000Z',reviewState:'REVIEW_REQUIRED',
  sources:[{name:source,ext:'pdf',sha256:'y'.repeat(64),discipline:'Electrical / Civil',floor:'UNRESOLVED',elevation:0}],
  entities:[
   {id:'xfmr-z-review',source,layer:'L2',kind:'text-asset-candidate',name:'PAD MOUNT TRANSFORMER T2',x:0,y:0,z:0,floor:'UNRESOLVED',confidence:.93,
    meta:{page:1,assetDimensionAuthority:'SOURCE_SPEC',assetDimensionsMeters:[1.7,1.6,1.25],
      localReviewSurfaceZ:30.48,localReviewSurfaceKind:'GRADE',localReviewSurfaceAuthority:'SOURCE_ELEVATION_TRIANGLE',localReviewSurfaceConfidence:.84,
      supportBaseOffsetMeters:.1524,supportOffsetKind:'PAD',supportOffsetAuthority:'TAG_LINKED_SOURCE_SUPPORT_NOTE',supportOffsetConfidence:.94,
      supportOffsetEvidenceLabel:'XFMR T2 6" CONC PAD',
      zResolutionStatus:'RESOLVED_DESIGN_CANDIDATE',zCandidateMeters:31.1,zCandidateReferencePoint:'BASE',zResolutionConfidence:.9,zResolutionAuthority:'SOURCE_BASE_ELEVATION',
      physicalElevationKnown:false,elevationKnown:false,physicalTruth:false,reviewRequired:true}}
  ],
  links:[],stats:{L0:0,L1:0,L2:1,L3:0,L4:0}
 };
 await page.addInitScript(value=>localStorage.setItem('stratum_compiled_graph',JSON.stringify(value)),graph);
 await page.goto('/spatial');
 await page.getByLabel('Imported object').selectOption('xfmr-z-review');
 await expect(page.getByText(/Z CONFLICT · AUTO-PLACEMENT BLOCKED/)).toBeVisible();
 await page.getByText('Z solution evidence').click();
 const supportCard=page.locator('.binding-panel').filter({hasText:'support-chain'}).first();
 await supportCard.getByRole('button',{name:'Use this design chain for review placement'}).click();
 await expect(page.getByText(/HUMAN REVIEW PLACEMENT · PHYSICAL Z UNVERIFIED/)).toBeVisible();
 await page.getByText('Placement & source confidence').click();
 const details=page.locator('.placement-details');
 await expect(details.getByText(/30\.632 m/)).toBeVisible();
 await expect(details.getByText(/HUMAN REVIEWED DESIGN CANDIDATE/)).toBeVisible();
 await expect(details.getByText(/Unverified/)).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>{
  const g=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}');
  const entity=(g.entities||[]).find((item:any)=>item.id==='xfmr-z-review');
  return entity?.meta?{
   decision:entity.meta.zReviewDecisionStatus,
   candidate:entity.meta.zReviewDecisionCandidateId,
   physical:entity.meta.physicalElevationKnown,
   truth:entity.meta.physicalTruth,
   review:entity.meta.reviewRequired
  }:null;
 })).toEqual({decision:'ACCEPTED_DESIGN_CHAIN',candidate:'support-chain',physical:false,truth:false,review:true});
});

test('Spatial restores an authenticated Z review receipt with the exact server compilation',async({page})=>{
 const projectId='30000000-0000-4000-8000-000000000010';
 const compilationId='30000000-0000-4000-8000-000000000011';
 const decisionId='30000000-0000-4000-8000-000000000012';
 const source='E-301-Z-Conflict.pdf';
 const graph={
  version:'z-review-hydration-1',createdAt:'2026-09-30T14:40:00.000Z',reviewState:'REVIEW_REQUIRED',
  sources:[{name:source,ext:'pdf',sha256:'e'.repeat(64),discipline:'Electrical / Civil',floor:'UNRESOLVED',elevation:0}],
  entities:[{id:'server-xfmr-z',source,layer:'L2',kind:'text-asset-candidate',name:'SERVER PAD MOUNT TRANSFORMER',x:0,y:0,z:0,floor:'UNRESOLVED',confidence:.93,
   meta:{assetDimensionAuthority:'SOURCE_SPEC',assetDimensionsMeters:[1.7,1.6,1.25],
    localReviewSurfaceZ:30.48,localReviewSurfaceKind:'GRADE',localReviewSurfaceAuthority:'SOURCE_ELEVATION_TRIANGLE',localReviewSurfaceConfidence:.84,
    supportBaseOffsetMeters:.1524,supportOffsetKind:'PAD',supportOffsetAuthority:'TAG_LINKED_SOURCE_SUPPORT_NOTE',supportOffsetConfidence:.94,
    supportOffsetEvidenceLabel:'XFMR 6" CONC PAD',
    zResolutionStatus:'RESOLVED_DESIGN_CANDIDATE',zCandidateMeters:31.1,zCandidateReferencePoint:'BASE',zResolutionConfidence:.9,zResolutionAuthority:'SOURCE_BASE_ELEVATION',
    physicalElevationKnown:false,elevationKnown:false,physicalTruth:false,reviewRequired:true}}],
  links:[],stats:{L0:0,L1:0,L2:1,L3:0,L4:0}
 };
 await page.route('**/api/spatial/compilations**',async route=>{
  const url=new URL(route.request().url());
  if(url.searchParams.get('projectId')){
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    schemaReady:true,projects:[{id:projectId,project_code:'SV-Z-001',name:'Z Review Project'}],
    latest:{id:compilationId,revision:12,graph_sha256:'f'.repeat(64),graph_json:graph}
   })});
  }else{
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    schemaReady:true,projects:[{id:projectId,project_code:'SV-Z-001',name:'Z Review Project'}],restorableProjectId:projectId,latest:null
   })});
  }
 });
 await page.route('**/api/spatial/z-reviews**',async route=>{
  const url=new URL(route.request().url());
  expect(url.searchParams.get('projectId')).toBe(projectId);
  expect(url.searchParams.get('compilationId')).toBe(compilationId);
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   schemaReady:true,
   decisions:[{
    id:decisionId,project_id:projectId,compilation_id:compilationId,entity_id:'server-xfmr-z',
    action:'ACCEPT_DESIGN_CHAIN',candidate_id:'support-chain',reason:'Use grade plus explicit pad for the coordination model.',
    graph_sha256:'f'.repeat(64),decision_sha256:'a'.repeat(64),occurred_at:'2026-09-30T14:41:00.000Z'
   }]
  })});
 });
 await page.goto('/spatial');
 await expect(page.getByRole('heading',{name:'Spatial model'})).toBeVisible();
 await page.getByLabel('Imported object').selectOption('server-xfmr-z');
 await expect(page.getByText(/HUMAN REVIEW PLACEMENT · PHYSICAL Z UNVERIFIED/)).toBeVisible();
 await page.getByText('Placement & source confidence').click();
 const details=page.locator('.placement-details');
 await expect(details.getByText(/30\.632 m/)).toBeVisible();
 await expect(details.getByText(/HUMAN REVIEWED DESIGN CANDIDATE/)).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>{
  const g=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}');
  const entity=(g.entities||[]).find((item:any)=>item.id==='server-xfmr-z');
  return entity?.meta?{
   authority:entity.meta.zReviewDecisionAuthority,
   receipt:entity.meta.zReviewDecisionId,
   candidate:entity.meta.zReviewDecisionCandidateId,
   physical:entity.meta.physicalElevationKnown,
   truth:entity.meta.physicalTruth
  }:null;
 })).toEqual({
  authority:'SERVER_AUTHENTICATED_HUMAN_REVIEW',receipt:decisionId,candidate:'support-chain',physical:false,truth:false
 });
});


test('human Z review selects one preserved design chain without establishing physical truth',async({page})=>{
 const source='Synthetic Z Conflict Review.pdf';
 const projectId='22222222-2222-4222-8222-222222222222';
 const compilationId='33333333-3333-4333-8333-333333333333';
 const decisionId='44444444-4444-4444-8444-444444444444';
 const graphSha='c'.repeat(64);
 const decisionSha='d'.repeat(64);
 const reason='Use the grade plus explicit transformer pad evidence for review placement.';
 const graph={
  version:'z-conflict-review-browser-1',createdAt:'2026-09-30T08:00:00.000Z',reviewState:'REVIEW_REQUIRED',
  sources:[{name:source,ext:'pdf',sha256:'y'.repeat(64),discipline:'Electrical / Civil',floor:'UNRESOLVED',elevation:0}],
  entities:[
   {id:'xfmr-z-review',source,layer:'L2',kind:'text-asset-candidate',name:'PAD MOUNT TRANSFORMER T2',x:0,y:0,z:0,floor:'UNRESOLVED',confidence:.93,
    meta:{page:1,assetDimensionAuthority:'SOURCE_SPEC',assetDimensionsMeters:[1.7,1.6,1.25],
      localReviewSurfaceZ:30.48,localReviewSurfaceKind:'GRADE',localReviewSurfaceAuthority:'SOURCE_ELEVATION_TRIANGLE',localReviewSurfaceConfidence:.84,
      supportBaseOffsetMeters:.1524,supportOffsetKind:'PAD',supportOffsetAuthority:'TAG_LINKED_SOURCE_SUPPORT_NOTE',supportOffsetConfidence:.94,
      supportOffsetEvidenceLabel:'XFMR T2 6" CONC PAD',
      zResolutionStatus:'RESOLVED_DESIGN_CANDIDATE',zCandidateMeters:31.1,zCandidateReferencePoint:'BASE',zResolutionConfidence:.9,zResolutionAuthority:'SOURCE_BASE_ELEVATION',
      physicalElevationKnown:false,elevationKnown:false,physicalTruth:false,reviewRequired:true}}
  ],
  links:[],stats:{L0:0,L1:0,L2:1,L3:0,L4:0}
 };
 let reviewRequest:any=null;
 await page.route('**/api/spatial/compilations?projectId=*',async route=>{
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({schemaReady:true,latest:{id:compilationId,graph_sha256:graphSha}})});
 });
 await page.route('**/api/spatial/z-reviews',async route=>{
  reviewRequest=route.request().postDataJSON();
  await route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({
   id:decisionId,action:'ACCEPT_DESIGN_CHAIN',candidate_id:'support-chain',reason,
   graph_sha256:graphSha,decision_sha256:decisionSha,occurred_at:'2026-09-30T08:05:00.000Z',
   reviewState:'REVIEW_RESOLVED_CANDIDATE',
   truthBoundary:'AUTHENTICATED_Z_REVIEW_SELECTS_A_DESIGN_PLACEMENT_CHAIN_ONLY_NOT_PHYSICAL_TRUTH_NOT_DIR_NOT_POVI'
  })});
 });
 await page.addInitScript(({graph,projectId})=>{
  localStorage.setItem('stratum_compiled_graph',JSON.stringify(graph));
  localStorage.setItem('stratum_spatial_project_id',projectId);
 },{graph,projectId});
 await page.goto('/spatial');
 await page.getByLabel('Imported object').selectOption('xfmr-z-review');
 await expect(page.getByText(/Z CONFLICT · AUTO-PLACEMENT BLOCKED/)).toBeVisible();
 await page.getByText('Z solution evidence').click();
 await page.getByLabel('Review rationale').fill(reason);
 const supportCard=page.locator('.binding-panel').filter({hasText:'support-chain'}).first();
 const choose=supportCard.getByRole('button',{name:'Use this design chain for review placement'});
 await expect(choose).toBeEnabled();
 await choose.click();
 await expect(page.getByText(/Authenticated design Z review recorded/)).toBeVisible();
 await expect(page.getByText(/HUMAN REVIEW PLACEMENT · PHYSICAL Z UNVERIFIED/)).toBeVisible();
 expect(reviewRequest).toMatchObject({
  projectId,compilationId,entityId:'xfmr-z-review',action:'ACCEPT_DESIGN_CHAIN',candidateId:'support-chain',reason
 });
 await page.getByText('Placement & source confidence').click();
 const details=page.locator('.placement-details');
 await expect(details.getByText(/30\.632 m/)).toBeVisible();
 await expect(details.getByText(/HUMAN REVIEWED DESIGN CANDIDATE/)).toBeVisible();
 await expect(details.getByText(/Unverified/)).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>{
  const g=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}');
  const entity=(g.entities||[]).find((item:any)=>item.id==='xfmr-z-review');
  return entity?.meta?{
   decision:entity.meta.zReviewDecisionStatus,
   candidate:entity.meta.zReviewDecisionCandidateId,
   authority:entity.meta.zReviewDecisionAuthority,
   receipt:entity.meta.zReviewDecisionId,
   decisionSha:entity.meta.zReviewDecisionSha256,
   reason:entity.meta.zReviewDecisionReason,
   physical:entity.meta.physicalElevationKnown,
   truth:entity.meta.physicalTruth,
   review:entity.meta.reviewRequired
  }:null;
 })).toEqual({
  decision:'ACCEPTED_DESIGN_CHAIN',candidate:'support-chain',authority:'SERVER_AUTHENTICATED_HUMAN_REVIEW',
  receipt:decisionId,decisionSha,reason,physical:false,truth:false,review:true
 });
});

