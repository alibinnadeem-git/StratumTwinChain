import {expect,test} from '@playwright/test';

test('desktop Spatial workspace creates a live WebGL canvas and preserves it across runtime mode changes',async({page},testInfo)=>{
 test.skip(testInfo.project.name!=='desktop-chromium','One GPU/WebGL release proof is sufficient; responsive behavior is covered separately.');
 const consoleErrors:string[]=[];
 page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text())});
 await page.addInitScript(()=>{
  localStorage.setItem('stratum_compiled_graph',JSON.stringify({
   version:'1.1',createdAt:new Date().toISOString(),
   sources:[{name:'webgl-uat.dxf',ext:'dxf',sha256:'webgl-uat-source',discipline:'Architectural',floor:'L1',elevation:0}],
   entities:[{
    id:'webgl-room',source:'webgl-uat.dxf',layer:'L1',kind:'room-boundary',name:'WebGL UAT Room',
    x:0,y:0,z:0,floor:'L1',confidence:1,
    vertices:[{x:-4,y:-3},{x:4,y:-3},{x:4,y:3},{x:-4,y:3},{x:-4,y:-3}],
    meta:{sourceSha256:'webgl-uat-source',geometryValidated:true,reviewRequired:false,coordinateUnits:'m',elevationKnown:true}
   },{
    id:'webgl-panel',source:'webgl-uat.dxf',layer:'L2',kind:'insert',name:'PANELBOARD LP-1',
    x:1,y:1,z:0,floor:'L1',zone:'WebGL UAT Room',confidence:1,
    meta:{sourceSha256:'webgl-uat-source',coordinateUnits:'m',elevationKnown:true}
   }],
   links:[],stats:{L0:1,L1:1,L2:1,L3:0,L4:0}
  }));
 });
 await page.goto('/spatial');
 await expect(page.getByRole('heading',{name:/spatial operating and trust model for physical infrastructure/i})).toBeVisible();
 await expect(page.getByLabel('Environment mode')).toBeVisible({timeout:20_000});
 const canvas=page.locator('canvas').first();
 await expect(canvas).toBeVisible({timeout:20_000});
 const runtime=await canvas.evaluate(node=>{
  const element=node as HTMLCanvasElement;
  const context=element.getContext('webgl2')||element.getContext('webgl');
  if(!context)return{hasContext:false,width:element.width,height:element.height,renderer:''};
  return{
   hasContext:true,
   width:element.width,
   height:element.height,
   renderer:String(context.getParameter(context.RENDERER)||'')
  };
 });
 expect(runtime.hasContext).toBeTruthy();
 expect(runtime.width).toBeGreaterThan(100);
 expect(runtime.height).toBeGreaterThan(100);
 await page.getByLabel('Environment mode').selectOption('NIGHT');
 await expect(page.getByLabel('Environment mode')).toHaveValue('NIGHT');
 await expect(canvas).toBeVisible();
 await expect(page.getByRole('status')).toHaveCount(0);
 const fatal=consoleErrors.filter(message=>/webgl context lost|failed to create webgl|three\.webglrenderer.*error/i.test(message));
 expect(fatal).toEqual([]);
});
