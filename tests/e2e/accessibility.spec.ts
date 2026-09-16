import {expect,test} from '@playwright/test';

test('keyboard users can skip directly to the main workspace with visible focus',async({page})=>{
 await page.goto('/');
 await page.keyboard.press('Tab');
 const skip=page.getByRole('link',{name:'Skip to main content'});
 await expect(skip).toBeFocused();
 const style=await skip.evaluate(el=>getComputedStyle(el));
 expect(style.outlineStyle).not.toBe('none');
 expect(parseFloat(style.outlineWidth)).toBeGreaterThanOrEqual(2);
 await page.keyboard.press('Enter');
 await expect(page.locator('#main-content')).toBeFocused();
});

test('primary shell exposes navigation and main landmarks with usable touch targets',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('navigation',{name:'Primary navigation'})).toBeVisible();
 await expect(page.getByRole('main')).toBeVisible();
 const targets=page.getByRole('navigation',{name:'Primary navigation'}).locator('a:visible');
 const count=await targets.count();
 expect(count).toBeGreaterThanOrEqual(5);
 for(let i=0;i<Math.min(count,5);i++){
  const box=await targets.nth(i).boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(44);
 }
});

test('reduced-motion preference suppresses nonessential transition duration',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/');
 const reduced=await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 expect(reduced).toBeTruthy();
 const duration=await page.getByRole('link',{name:'Skip to main content'}).evaluate(el=>getComputedStyle(el).transitionDuration);
 expect(parseFloat(duration)).toBeLessThanOrEqual(.001);
});

test('consequential state chips communicate status with text rather than color alone',async({page})=>{
 await page.goto('/reality');
 await expect(page.getByText('REVIEW REQUIRED',{exact:false}).first()).toBeVisible();
 await expect(page.getByText('REFERENCE DATA · HITL · READ-ONLY')).toBeVisible();
});
