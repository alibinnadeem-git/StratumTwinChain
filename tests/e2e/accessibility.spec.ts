import {expect,test} from '@playwright/test';

test('shared shell exposes skip navigation, main focus target and responsive current-page semantics',async({page})=>{
 await page.goto('/');
 const skip=page.getByRole('link',{name:'Skip to main content'});
 await page.keyboard.press('Tab');
 await expect(skip).toBeFocused();
 await page.keyboard.press('Enter');
 await expect(page.locator('#main-content')).toBeFocused();
 const compact=(page.viewportSize()?.width||0)<=900;
 if(compact){
  const fieldNav=page.getByRole('navigation',{name:'Field navigation'});
  await expect(fieldNav).toBeVisible();
  await fieldNav.getByRole('link',{name:'My Work',exact:true}).click();
  await expect(page.getByRole('navigation',{name:'Field navigation'}).getByRole('link',{name:'My Work',exact:true})).toHaveAttribute('aria-current','page');
 }else{
  const nav=page.getByRole('navigation',{name:'Primary navigation'});
  await expect(nav.getByRole('link',{name:'Home',exact:true})).toHaveAttribute('aria-current','page');
  await nav.getByRole('link',{name:'Sites',exact:true}).click();
  await expect(page.getByRole('navigation',{name:'Primary navigation'}).getByRole('link',{name:'Sites',exact:true})).toHaveAttribute('aria-current','page');
 }
});

test('command palette traps keyboard focus and returns it to the opener',async({page})=>{
 await page.goto('/');
 const trigger=page.getByRole('button',{name:'Search STRATUM'});
 await trigger.focus();
 await trigger.click();
 const input=page.getByRole('textbox',{name:'Search assets, projects, evidence or tools'});
 await expect(input).toBeFocused();
 const options=page.getByRole('option');
 expect(await options.count()).toBeGreaterThan(0);
 await page.keyboard.press('Shift+Tab');
 await expect(options.last()).toBeFocused();
 await page.keyboard.press('Escape');
 await expect(trigger).toBeFocused();
});

test('asset drawer traps focus and returns it to the originating asset control',async({page})=>{
 await page.goto('/assets');
 const trigger=page.getByRole('button',{name:/Open Main Switchgear SG-01 quick view/i});
 await trigger.focus();
 await trigger.click();
 const drawer=page.getByRole('dialog',{name:/Main Switchgear SG-01 asset details/i});
 await expect(drawer).toBeVisible();
 const close=drawer.getByRole('button',{name:'Close asset details'});
 await expect(close).toBeFocused();
 await page.keyboard.press('Shift+Tab');
 await expect(drawer.getByRole('link',{name:'Work'})).toBeFocused();
 await page.keyboard.press('Escape');
 await expect(trigger).toBeFocused();
});

test('coarse-pointer controls meet the minimum release touch target',async({page})=>{
 await page.goto('/');
 const coarse=await page.evaluate(()=>matchMedia('(pointer: coarse)').matches);
 if(!coarse)return;
 const box=await page.getByRole('button',{name:'Search STRATUM'}).boundingBox();
 expect(box).not.toBeNull();
 expect(box!.height).toBeGreaterThanOrEqual(44);
});

test('reduced-motion preference suppresses nonessential motion durations',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/');
 const durations=await page.getByRole('button',{name:'Search STRATUM'}).evaluate(element=>getComputedStyle(element).transitionDuration.split(',').map(value=>value.trim()));
 const seconds=durations.map(value=>value.endsWith('ms')?Number.parseFloat(value)/1000:Number.parseFloat(value));
 expect(seconds.every(value=>Number.isFinite(value)&&value<=0.001)).toBeTruthy();
});
