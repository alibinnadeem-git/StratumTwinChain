import {expect,test} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';

// Deliberately synthetic source and designations. No customer drawing enters UAT artifacts.
const source='Synthetic E-101.pdf';
const graph={
 version:'1.1',createdAt:'2026-01-01T00:00:00.000Z',reviewState:'REVIEW_REQUIRED',
 sources:[{name:source,ext:'pdf',sha256:'f'.repeat(64),discipline:'Electrical',floor:'LEVEL A'}],
 entities:[
  ...Array.from({length:15},(_,i)=>({id:`line-${i}`,source,layer:'L1',kind:'line',name:'Drawing line',x:i*.5,y:-2,x2:i*.5,y2:2,confidence:.8,floor:'LEVEL A'})),
  ...Array.from({length:5},(_,i)=>({id:`candidate-${i}`,source,layer:'L2',kind:'sheet-callout-candidate',name:`(E) C${i+1}`,x:i*.09,y:0,floor:'LEVEL A',confidence:.8,meta:{sheet:'E-101',page:1,sheetX:100+i*9,sheetY:200,coordinateUnits:'sheet',elevationKnown:false,physicalElevationKnown:false,referenceOnly:true}})),
 ],links:[],stats:{L0:1,L1:15,L2:5,L3:0,L4:0}
};

test('Spatial review truth and layout at device width',async({page},testInfo)=>{
  const viewports:Record<string,{label:string;width:number;height:number}>={
   'desktop-chromium':{label:'desktop',width:1280,height:900},
   'tablet-chromium':{label:'tablet',width:768,height:1024},
   'mobile-chromium':{label:'mobile',width:390,height:844},
  };
  const {label,width,height}=viewports[testInfo.project.name];
  await page.setViewportSize({width,height});
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
  await page.addInitScript(value=>localStorage.setItem('stratum_compiled_graph',JSON.stringify(value)),graph);
  await page.goto('/spatial');
  await expect(page.getByRole('heading',{name:'Spatial model'})).toBeVisible();
  await expect(page.getByText('5 objects · 15 drawing lines')).toBeVisible();
  const canvas=page.locator('canvas[aria-label="Interactive Spatial model"]');
  await expect(canvas).toBeVisible();
  await expect.poll(()=>canvas.getAttribute('data-clickable-assets')).toBe('5');
  await page.getByLabel('Imported object').selectOption('candidate-0');
  await expect(page.getByText('Unverified elevation',{exact:true})).toBeVisible();
  await page.getByText('Placement & source confidence').click();
  await expect(page.getByText('Z unverified',{exact:true})).toBeVisible();
  await expect(page.getByText('Tier 2 · Drawing callout, review required')).toBeVisible();
  await expect(page.getByText('No history recorded by this drawing.',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:/^Review Source candidates$/}).click();
  await expect.poll(()=>canvas.getAttribute('data-clickable-assets')).toBe('5');
  await expect(page.getByText('5 objects · 15 drawing lines')).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
  expect(overflow).toBe(false);
  expect(errors).toEqual([]);
  if(process.env.STRATUM_CAPTURE_DIR){
   await mkdir(process.env.STRATUM_CAPTURE_DIR,{recursive:true});
   await page.screenshot({path:join(process.env.STRATUM_CAPTURE_DIR,`spatial-${label}.png`),fullPage:true});
  }
  await page.getByRole('button',{name:/^Electrical SLD topology$/}).click();
  await expect(page.getByText('No SLD topology in this project yet')).toBeVisible();
  await expect(page.getByRole('heading',{name:'(E) C1'})).toBeVisible();
  expect(errors).toEqual([]);
});
