import {expect,test} from '@playwright/test';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

// Phase 0 regression guard for the Spatial pipeline diagnostics backbone. The pipeline reports
// structured events to window.__STRATUM_SPATIAL_DIAG; these tests assert that a render completes
// with NO silent failure (no error-level event, no "fell back to UI thread" worker event) and
// that every background stage that should run actually recorded activity. warn-level events are
// allowed: they are the honest signal (e.g. evidence-free Z), not a failure.

type DiagEvent={stage:string;level:string;code:string;message?:string;counts?:Record<string,number>;durationMs?:number};

const FELL_BACK_CODES=['WORKER_CRASHED_FELL_BACK','WORKER_UNAVAILABLE_FELL_BACK','WEBGL_UNAVAILABLE_FALLBACK'];

// Deliberately synthetic. Mix of drawing lines, evidence-free equipment (Z unresolved) and one
// reviewed-Z transformer so the Z-solution distribution has both resolved and unresolved buckets.
const source='Synthetic E-DIAG.pdf';
const graph={
  version:'1.2',createdAt:'2026-02-02T00:00:00.000Z',reviewState:'REVIEW_REQUIRED',
  sources:[{name:source,ext:'pdf',sha256:'d'.repeat(64),discipline:'Electrical',floor:'LEVEL A'}],
  entities:[
    ...Array.from({length:12},(_,i)=>({id:`line-${i}`,source,layer:'L1',kind:'line',name:'Drawing line',x:i*.5,y:-2,x2:i*.5,y2:2,confidence:.8,floor:'LEVEL A'})),
    {id:'xfmr-1',source,layer:'L2',kind:'equipment',name:'Utility Transformer T1',x:1,y:1,z:2.5,floor:'LEVEL A',confidence:.9,meta:{sourceSha256:'d'.repeat(64),page:1,elevationKnown:true,physicalElevationKnown:true}},
    {id:'panel-1',source,layer:'L2',kind:'equipment',name:'Panelboard LP1',x:3,y:1,floor:'LEVEL A',confidence:.85,meta:{sourceSha256:'d'.repeat(64),page:1}},
    {id:'gen-1',source,layer:'L2',kind:'equipment',name:'Emergency Generator G1',x:5,y:1,floor:'LEVEL A',confidence:.85,meta:{sourceSha256:'d'.repeat(64),page:1}},
  ],
  links:[],stats:{L0:1,L1:12,L2:3,L3:0,L4:0},
};

async function readTrace(page:import('@playwright/test').Page):Promise<DiagEvent[]>{
  return page.evaluate(()=>((window as unknown as {__STRATUM_SPATIAL_DIAG?:{events:DiagEvent[]}}).__STRATUM_SPATIAL_DIAG?.events)||[]) as Promise<DiagEvent[]>;
}

function assertNoSilentFailure(trace:DiagEvent[]){
  const errors=trace.filter(e=>e.level==='error');
  expect(errors,`error-level pipeline events: ${JSON.stringify(errors)}`).toEqual([]);
  const fellBack=trace.filter(e=>FELL_BACK_CODES.includes(e.code));
  expect(fellBack,`silent-fallback pipeline events: ${JSON.stringify(fellBack)}`).toEqual([]);
}

async function attachTrace(testInfo:import('@playwright/test').TestInfo,trace:DiagEvent[]){
  const body=JSON.stringify(trace,null,2);
  await testInfo.attach('spatial-pipeline-trace.json',{body,contentType:'application/json'});
  // Also persist to a stable path so a passing-run baseline survives output-dir cleanup.
  const dir=join(process.cwd(),'test-results');
  try{mkdirSync(dir,{recursive:true});writeFileSync(join(dir,`baseline-${testInfo.title.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.json`),body)}catch{}
}

test('seeded Spatial render reports a clean pipeline trace with no silent failure',async({page},testInfo)=>{
  test.setTimeout(120_000);
  await page.goto('/spatial');
  // Seed the authoritative IndexedDB 'current' key (not just the localStorage shadow) so the graph
  // is promoted immediately and the server-hydration path cannot leave it in "Preparing…". This
  // keeps the baseline capturable against either a dev or a prod server.
  await page.evaluate(async value=>{
    localStorage.setItem('stratum_compiled_graph',JSON.stringify(value));
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{
      const request=indexedDB.open('stratum-spatial-recovery-v1',1);
      request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('graphs'))request.result.createObjectStore('graphs')};
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    await new Promise<void>((resolve,reject)=>{const tx=db.transaction('graphs','readwrite');tx.objectStore('graphs').put(value,'current');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)});
    db.close();
  },graph);
  await page.goto('/spatial');
  // Dev-server first compile of the three.js route can be slow; prod builds are fast.
  await expect(page.getByRole('heading',{name:'Spatial model'})).toBeVisible({timeout:90_000});
  await expect(page.locator('canvas[aria-label="Interactive Spatial model"]')).toBeVisible({timeout:30_000});

  await expect.poll(async()=>(await readTrace(page)).some(e=>e.code==='RENDER_BUILT'),{timeout:15_000,message:'render stage never reported RENDER_BUILT'}).toBe(true);

  const trace=await readTrace(page);
  await attachTrace(testInfo,trace);

  assertNoSilentFailure(trace);

  const built=trace.find(e=>e.code==='RENDER_BUILT');
  expect(built?.counts?.visible,'nothing was visible in the built scene').toBeGreaterThan(0);
  expect(trace.some(e=>e.stage==='project'&&(e.code==='PROJECT_APPLIED'||e.code==='PROJECT_NO_OP')),'projection stage recorded no outcome').toBe(true);

  const zSummary=trace.find(e=>e.code==='RENDER_Z_SUMMARY');
  expect(zSummary,'no Z-solution summary was reported').toBeTruthy();
  // Baseline visibility: surface the Z distribution and stage count so the HTML report carries it.
  // eslint-disable-next-line no-console
  console.log('[spatial-diag baseline] stages:',[...new Set(trace.map(e=>e.stage))].join(','),'| Z:',JSON.stringify(zSummary?.counts||{}),'| events:',trace.length);
});

// Opt-in full-pipeline baseline through the real Brynhurst electrical bid set. Mirrors the repo's
// BRYNHURST_GOLDEN_PDF convention: skipped unless the fixture is present and STRATUM_BRYNHURST_E2E=1,
// so CI without the 5.3 MB customer drawing stays green. Run with:
//   STRATUM_BRYNHURST_E2E=1 npx playwright test spatial-diagnostics --project=desktop-chromium
const BRYNHURST=join(process.cwd(),'tests/fixtures/spatial/5749 Brynhurst - Electrical - Bid Set 2025.04.17.pdf');
test('Brynhurst import drives the full pipeline with no silent failure',async({page},testInfo)=>{
  test.skip(process.env.STRATUM_BRYNHURST_E2E!=='1'||!existsSync(BRYNHURST),'set STRATUM_BRYNHURST_E2E=1 with the Brynhurst fixture present to run the full-pipeline baseline');
  test.setTimeout(300_000);

  await page.goto('/compiler');
  // The source-import input is the only file input that accepts CAD/drawing formats.
  await page.locator('input[type=file][accept*=".dxf"]').setInputFiles(BRYNHURST);

  const renderButton=page.getByRole('button',{name:'Render Spatial Environment'});
  await expect(renderButton).toBeEnabled({timeout:240_000});
  await renderButton.click();

  await page.waitForURL('**/spatial',{timeout:60_000});
  await expect(page.getByRole('heading',{name:'Spatial model'})).toBeVisible({timeout:60_000});
  await expect.poll(async()=>(await readTrace(page)).some(e=>e.code==='RENDER_BUILT'),{timeout:60_000,message:'render stage never reported RENDER_BUILT'}).toBe(true);
  // Projection must SETTLE to a terminal outcome (applied / no-op / self-echo skip) rather than starving
  // on write contention. Backoff should let the retry re-read a settled graph.
  await expect.poll(async()=>(await readTrace(page)).some(e=>['PROJECT_APPLIED','PROJECT_NO_OP','PROJECT_SKIPPED_SELF_ECHO'].includes(e.code)),{timeout:30_000,message:'projection never settled (kept contending)'}).toBe(true);
  await page.waitForTimeout(1_500);

  const trace=await readTrace(page);
  await attachTrace(testInfo,trace);

  assertNoSilentFailure(trace);
  expect(trace.some(e=>e.stage==='parse'&&e.code==='PARSE_SUMMARY'),'parse stage recorded no summary').toBe(true);
  expect(trace.some(e=>e.code==='RENDER_BUILT'),'render stage never built a scene').toBe(true);

  // Phase 4: show every sheet frame so the identified INSTANCEs (on the one-line sheet) are in view,
  // then confirm the role gate actually draws them — and no silent failure appears when it rebuilds.
  const frameSelect=page.getByLabel('Sheet page isolation');
  if(await frameSelect.count()){
    await frameSelect.selectOption('ALL');
    // GLB-backed instances tag asynchronously; the canvas data-clickable-assets attribute updates as
    // each model loads, so poll it (not the synchronous RENDER_BUILT snapshot) for the live count.
    const canvas=page.locator('canvas[aria-label="Interactive Spatial model"]');
    await expect.poll(async()=>Number(await canvas.getAttribute('data-clickable-assets'))||0,{timeout:30_000,message:'no equipment ever tagged after async model load'}).toBeGreaterThan(0);
    await page.waitForTimeout(2_000);
    const after=await readTrace(page);
    assertNoSilentFailure(after);
    const liveClickable=Number(await canvas.getAttribute('data-clickable-assets'))||0;
    const gap=after.filter(e=>e.code==='RENDER_INSTANCE_GAP').pop();
    expect(Number(gap?.counts?.realGap||0),'a visible instance with no async model failed to draw').toBe(0);
    // eslint-disable-next-line no-console
    console.log('[brynhurst phase4] live clickable assets:',liveClickable,'· last gap:',JSON.stringify(gap?.counts));
  }

  const zSummary=trace.find(e=>e.code==='RENDER_Z_SUMMARY');
  // eslint-disable-next-line no-console
  console.log('[brynhurst baseline] stages:',[...new Set(trace.map(e=>e.stage))].join(','),'| Z:',JSON.stringify(zSummary?.counts||{}),'| events:',trace.length);
});
