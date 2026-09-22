import {expect,test} from '@playwright/test';
import {strToU8,zipSync} from 'fflate';

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
  panel:{metric:true,units:'m_xy',planUnits:'m',z:4.62,floor:'L2',authority:'HISTORICAL_RECOMMENDATION',review:true},
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
 const graphState=await page.evaluate(()=>{
  const graph=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}');
  const entity=(graph.entities||[]).find((item:any)=>item.meta?.assetTag==='AHU-7');
  return entity?{kind:entity.kind,nonSpatial:entity.meta?.nonSpatial,authority:entity.meta?.spatialPlacementAuthority,voltage:entity.meta?.voltage,phase:entity.meta?.phase}:null;
 });
 expect(graphState).toEqual({kind:'schedule-powered-equipment-candidate',nonSpatial:true,authority:'NON_SPATIAL_SCHEDULE',voltage:480,phase:3});
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
 const evidence=await page.evaluate(()=>{
  const graph=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}');
  const entity=(graph.entities||[]).find((item:any)=>item.meta?.assetTag==='AHU-12');
  return entity?{nonSpatial:entity.meta?.nonSpatial,officeFormat:entity.meta?.officeFormat,sheet:entity.meta?.workbookSheet,voltage:entity.meta?.voltage}:null;
 });
 expect(evidence).toEqual({nonSpatial:true,officeFormat:'XLSX',sheet:'Mechanical Equipment',voltage:480});
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
 const evidence=await page.evaluate(()=>{
  const graph=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}');
  const entity=(graph.entities||[]).find((item:any)=>item.name.includes('RTU-4'));
  return entity?{nonSpatial:entity.meta?.nonSpatial,officeFormat:entity.meta?.officeFormat,section:entity.meta?.documentSection}:null;
 });
 expect(evidence).toEqual({nonSpatial:true,officeFormat:'DOCX',section:'PARAGRAPH_TEXT'});
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
 const evidence=await page.evaluate(()=>{
  const graph=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}');
  const entity=(graph.entities||[]).find((item:any)=>item.meta?.assetTag==='P-1'&&item.meta?.ifcType==='IFCPUMP');
  return entity?{x:entity.x,y:entity.y,z:entity.z,floor:entity.floor,physicalTruth:entity.meta?.physicalTruth,authority:entity.meta?.zPlacementAuthority,geometry:entity.meta?.geometryAuthority,unit:entity.meta?.ifcUnitToMeters}:null;
 });
 expect(evidence).toEqual({x:4,y:6,z:1,floor:'Level 1',physicalTruth:false,authority:'SOURCE_IFC_DESIGN_PLACEMENT',geometry:'IFC_PLACEMENT_ONLY_NO_SHAPE_MESH',unit:.001});
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
 await expect.poll(()=>page.evaluate(()=>Boolean(localStorage.getItem('stratum_compiled_graph_last_good_v2')))).toBeTruthy();

 await page.evaluate(()=>localStorage.removeItem('stratum_compiled_graph'));
 await page.goto('/spatial');

 await expect(page.getByRole('heading',{name:'Spatial model'})).toBeVisible();
 const canvas=page.locator('canvas[aria-label="Interactive Spatial model"]');
 await expect(canvas).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>Boolean(localStorage.getItem('stratum_compiled_graph')))).toBeTruthy();
 expect(await page.getByLabel('Imported object').locator('option').filter({hasText:'MAIN SWITCHBOARD MSB-1'}).count()).toBeGreaterThan(0);
});


test('Spatial restores the latest tenant project snapshot from the server when browser state is empty',async({page})=>{
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
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({schemaReady:true,projects:[{id:projectId,project_code:'SV-UAT-001',name:'STRATUM Verified Production Pilot'}],latest:null})});
  }
 });
 await page.goto('/spatial');
 await expect(page.getByRole('heading',{name:'Spatial model'})).toBeVisible();
 await expect(page.locator('canvas[aria-label="Interactive Spatial model"]')).toBeVisible();
 await expect(page.getByLabel('Imported object').locator('option').filter({hasText:'SERVER MAIN SWITCHBOARD MSB-1'})).toHaveCount(1);
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}'));
 expect(stored.entities?.some((entity:any)=>entity.name==='SERVER MAIN SWITCHBOARD MSB-1')).toBeTruthy();
 expect(await page.evaluate(()=>localStorage.getItem('stratum_spatial_project_id'))).toBe(projectId);
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
