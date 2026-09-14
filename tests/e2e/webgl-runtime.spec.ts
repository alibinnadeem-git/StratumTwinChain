import {expect,test} from '@playwright/test';

test('desktop Spatial workspace creates a live WebGL canvas and preserves it across runtime mode changes',async({page},testInfo)=>{
 test.skip(testInfo.project.name!=='desktop-chromium','One GPU/WebGL release proof is sufficient; responsive behavior is covered separately.');
 const consoleErrors:string[]=[];
 page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text())});
 await page.goto('/spatial');
 await expect(page.getByRole('heading',{name:/spatial operating and trust model for physical infrastructure/i})).toBeVisible();
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
