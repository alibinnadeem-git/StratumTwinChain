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

type PersistedEntity={id:string;name:string;x:number;y:number;z?:number;kind:string;meta?:Record<string,unknown>};
// The persisted (post-projection) graph the viewer renders, read from the chunked IndexedDB store.
async function readPersistedEntities(page:import('@playwright/test').Page):Promise<PersistedEntity[]>{
  return page.evaluate(async()=>{
    const request=<T,>(r:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
    const db=await request(indexedDB.open('stratum-spatial-chunked-v1',1));
    const get=(store:string,key:string)=>request(db.transaction(store,'readonly').objectStore(store).get(key));
    const head=await get('heads','current') as {revision:string;entityParts:number}|undefined;
    const entities:PersistedEntity[]=[];
    for(let i=0;head&&i<head.entityParts;i++)entities.push(...(await get('parts',`${head.revision}:entities:${i}`) as PersistedEntity[]));
    db.close();return entities;
  });
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
// BRYNHURST_GOLDEN_PDF convention: registered only when STRATUM_BRYNHURST_E2E=1,
// so CI without the 5.3 MB customer drawing stays green. Run with:
//   STRATUM_BRYNHURST_E2E=1 npx playwright test spatial-diagnostics --project=desktop-chromium
const BRYNHURST=join(process.cwd(),'tests/fixtures/spatial/5749 Brynhurst - Electrical - Bid Set 2025.04.17.pdf');
if(process.env.STRATUM_BRYNHURST_E2E==='1'){
test('Brynhurst import drives the full pipeline with no silent failure',async({page},testInfo)=>{
  expect(existsSync(BRYNHURST),'provide the original Brynhurst PDF fixture when opting into its full-pipeline baseline').toBe(true);
  // The import also reads the 17 images embedded in the set (Phase 20a OCR), about a minute more.
  test.setTimeout(540_000);

  await page.goto('/compiler');
  // The source-import input is the only file input that accepts CAD/drawing formats.
  await page.locator('input[type=file][accept*=".dxf"]').setInputFiles(BRYNHURST);

  const renderButton=page.getByRole('button',{name:'Render Spatial Environment'});
  await expect(renderButton).toBeEnabled({timeout:420_000});
  await renderButton.click();

  await page.waitForURL('**/spatial',{timeout:60_000});
  await expect(page.getByRole('heading',{name:'Spatial model'})).toBeVisible({timeout:60_000});
  // The viewer opens on the entire project; auto-safe isolation opens on the plan drawing the most equipment
  // (lib/sheet-frame-choice.ts), E-4, never the E-2 one-line, and the drawing-scale notice is per sheet.
  // (Before the viewer rendered on demand, drawing all nine sheets every frame kept headless Chromium's
  // software renderer ~98% busy and projection never settled; now the entire-project view costs ~25 s of
  // long tasks in 90 s and projection applies in under 2 s.)
  const frameSelect=page.getByLabel('Sheet page isolation');
  await expect(frameSelect).toHaveValue('PROJECT');
  await frameSelect.selectOption('AUTO');
  await expect.poll(async()=>(await readTrace(page)).some(e=>e.code==='RENDER_BUILT'),{timeout:60_000,message:'render stage never reported RENDER_BUILT'}).toBe(true);
  // The real ~31k-record graph can need multiple chunked reads around room/projection writes; each pass
  // re-reads, signs and re-writes the whole ~39 MB graph. A measured baseline settled about 67 s after parse
  // before the contention fix (scripts/qa-projection-contention.mjs: one pass at a time across the Import and
  // Spatial page mounts, no redundant guard rewrite) and about 21 s after it; keep this bounded at 90 s.
  // Small synthetic tests retain their tight limits.
  await expect.poll(async()=>(await readTrace(page)).some(e=>['PROJECT_APPLIED','PROJECT_NO_OP','PROJECT_SKIPPED_SELF_ECHO'].includes(e.code)),{timeout:90_000,message:'large-graph projection did not settle within 90 seconds'}).toBe(true);
  await page.waitForTimeout(1_500);

  const trace=await readTrace(page);
  await attachTrace(testInfo,trace);

  assertNoSilentFailure(trace);
  expect(trace.some(e=>e.stage==='parse'&&e.code==='PARSE_SUMMARY'),'parse stage recorded no summary').toBe(true);
  expect(trace.some(e=>e.code==='RENDER_BUILT'),'render stage never built a scene').toBe(true);

  // Phase 20a (docs/SPATIAL_SOURCE_FIDELITY_PLAN.md): the self-hosted engine starts, every embedded image is
  // read with no failed tile, and E-2's pasted panel schedules come back as review-only OCR text.
  expect(trace.some(e=>e.code==='OCR_ENGINE_READY'),'the self-hosted OCR engine never started').toBe(true);
  const ocrRead=trace.find(e=>e.code==='OCR_EMBEDDED_IMAGES_READ');
  expect(ocrRead?.counts,'embedded drawing images read').toMatchObject({regions:17,failedTiles:0,overBudget:0});
  // eslint-disable-next-line no-console
  console.log('[brynhurst ocr]',JSON.stringify(ocrRead?.counts),'in',Math.round(Number(ocrRead?.durationMs)/1000),'s');

  // Metric placement phases 11–15 (docs/SPATIAL_METRIC_PLACEMENT_PLAN.md).
  const entities=await readPersistedEntities(page);
  const ocrLines=entities.filter(e=>e.kind==='ocr-text-line');
  for(const panel of ['HL','HP1','HP2','HP3','HWH'])expect(ocrLines.some(e=>new RegExp(`PANEL ${panel}\\b`).test(e.name)&&Number(e.meta?.page)===2),`PANEL ${panel} schedule header read on E-2`).toBe(true);
  expect(ocrLines.every(e=>e.meta?.nonSpatial===true&&e.meta?.referenceOnly===true&&e.meta?.ocrAuthority==='REVIEW_ONLY'),'OCR text stays non-spatial, reference-only review evidence').toBe(true);
  const instances=entities.filter(e=>e.meta?.candidateRole==='INSTANCE');
  expect(entities.find(e=>e.name==='MS1 #1')?.meta?.candidateRole,'the "MS1 #1" circuit callout must stay a label').toBe('LABEL');
  // Phase 20 (docs/SPATIAL_SOURCE_FIDELITY_PLAN.md): the equipment roster read from E-2's schedules and one-line,
  // checked against its own totals, and found on the plans where its names label drawn symbols.
  const roster=entities.filter(e=>e.kind==='equipment-roster-entry').map(e=>e.meta?.rosterEntry as {tag:string;checks:Array<{passed:boolean}>});
  expect(roster.map(entry=>entry.tag).sort(),'equipment roster from the schedules and one-line').toEqual(['HL','HP1','HP2','HP3','HWH','MS1','MS2']);
  expect(roster.flatMap(entry=>entry.checks).filter(check=>!check.passed),'every roster self-check passes').toEqual([]);
  const rosterSymbols=instances.filter(e=>e.meta?.rosterBacked===true&&e.meta?.drawnFootprint).map(e=>`${e.name}@${e.meta?.page}`).sort();
  expect(rosterSymbols,'roster names on their drawn symbols').toEqual(['HL@4','HP1@4','HP2@5','HP3@4','MS1@4','MS2@4']);
  const loadCentres=instances.filter(e=>e.meta?.footprintClassPhrase===true);
  expect(loadCentres.length,'unit "ELEC. PANEL" load centres on E-4 and E-5').toBe(25);
  expect(entities.filter(e=>e.meta?.lineupSectionOf==='MS1'&&!e.meta?.derivedFrom).map(e=>`${e.name}:${e.meta?.candidateRole}`).sort(),'DIST and P/S are sections of the MS1 lineup').toEqual(['DIST:LABEL','P/S:LABEL']);
  // After merging main (2026-10-29): roster-backed MS1/MS2 on E-2 and E-4, HL, HP1, HP3 (E-4), HP2 (E-5) = 8;
  // 25 unit load centres; and 3 "Solar" labels on the E-6 roof from main's nearest-shape anchor (the Phase 17
  // answer key judges these). Main's matcher also finds 7 receptacles, 7 "SD" and 1 "PANEL" on the typical-unit
  // plans E-7 to E-9; those are details of every unit of a type, so they stay labels (TYPICAL_UNIT_DETAIL).
  expect(instances.filter(e=>Number(e.meta?.page)>=7).length,'no instances on the typical-unit detail plans E-7 to E-9').toBe(0);
  expect(entities.filter(e=>e.meta?.candidateRoleReason==='TYPICAL_UNIT_DETAIL'&&!e.meta?.derivedFrom&&e.kind==='legend-symbol-match-candidate').length,'the 7 legend receptacle matches on E-7 to E-9 are kept as labels').toBe(7);
  expect(instances.filter(e=>!e.meta?.rosterBacked&&!e.meta?.footprintClassPhrase).length,'instances from the legend matcher and nearest-shape anchor').toBe(3);
  expect(instances.length,'8 roster-backed + 25 unit load centres + 3 anchored roof labels').toBe(36);
  const e4=(name:string)=>instances.find(e=>e.name===name&&Number(e.meta?.page)===4);
  expect(e4('MS1')?.meta?.supportBaseOffsetMeters,'the "6\' x 8\' T-Pad" footprint must not lift MS1').toBeUndefined();
  expect(Math.abs(Number(e4('MS1')?.z||0)),'MS1 sits on the E-4 floor datum').toBeLessThan(.01);
  const e3Scale=entities.find(e=>e.kind==='scale-validation-candidate'&&Number(e.meta?.page)===3)?.meta?.scaleValidationEvidence as {status:string;declaredMetersPerNormalizedSheetUnit:number;corroboratedMetersPerNormalizedSheetUnit:number}|undefined;
  expect(Math.abs(Number(e3Scale?.corroboratedMetersPerNormalizedSheetUnit)/Number(e3Scale?.declaredMetersPerNormalizedSheetUnit)-1),'E-3 dimensions agree with its printed 1/8" scale').toBeLessThan(.02);
  await expect(frameSelect,'auto-safe isolation opens on the E-4 first floor plan, not the E-2 one-line').toHaveAttribute('data-active-frame',/:4:frame-l1$/);
  // eslint-disable-next-line no-console
  console.log('[brynhurst metric] E-3 scale',e3Scale?.status,Number(e3Scale?.corroboratedMetersPerNormalizedSheetUnit).toFixed(3),'| instances',instances.length);

  // Confirming the drawing scale on E-4 puts MS1↔MS2 at their real ~3.6 m (0.708 sheet units × 5.121 m).
  // E-4 has no dimensions of its own; E-3's dimensions corroborate the same printed scale (same-set basis).
  expect(e3Scale?.status,'E-3 corroborates its printed scale by witness consensus').toBe('CORROBORATED');
  const applyScale=page.getByRole('button',{name:'Apply drawing scale'});
  await expect(applyScale,'E-4 offers its printed scale for confirmation').toBeVisible({timeout:30_000});
  await applyScale.click();
  // Apply and undo wait their turn in the graph write queue behind projection (see the settle note above):
  // 33 s before the contention fix under load average ~12, 17.6 s after it.
  const undoScale=page.getByRole('button',{name:'Undo drawing scale'});
  await expect(undoScale).toBeVisible({timeout:60_000});
  const scaled=(await readPersistedEntities(page)).filter(e=>e.meta?.candidateRole==='INSTANCE'&&Number(e.meta?.page)===4);
  const [ms1,ms2]=['MS1','MS2'].map(name=>scaled.find(e=>e.name===name)!);
  const scaledDistance=Math.hypot(ms1.x-ms2.x,ms1.y-ms2.y);
  expect(Math.abs(scaledDistance-3.63),'E-4 MS1↔MS2 distance after confirming the scale').toBeLessThan(.18);
  // eslint-disable-next-line no-console
  console.log('[brynhurst metric] E-4 MS1↔MS2 after Apply drawing scale:',scaledDistance.toFixed(2),'m');
  // Phase 21: at the reviewed scale MS1 takes its plan size from the drawn lineup DIST | MS1 | P/S,
  // 102" × 20" as on E-2's elevation (lib/drawn-footprint-placement.ts); projection stamps it on the graph.
  await expect.poll(async()=>(await readPersistedEntities(page)).find(e=>e.meta?.candidateRole==='INSTANCE'&&Number(e.meta?.page)===4&&e.name==='MS1')?.meta?.assetDimensionAuthority,{timeout:60_000,message:'projection never stamped the drawn size on MS1'}).toBe('DRAWN_SYMBOL');
  const sized=(await readPersistedEntities(page)).find(e=>e.meta?.candidateRole==='INSTANCE'&&Number(e.meta?.page)===4&&e.name==='MS1')!;
  const [lineupWidth,,lineupDepth]=sized.meta!.assetDimensionsMeters as number[];
  expect(Math.abs(lineupWidth/.0254-102),'MS1 lineup width from the drawing (36" + 30" + 36")').toBeLessThan(1.5);
  expect(Math.abs(lineupDepth/.0254-20),'MS1 lineup depth from the drawing').toBeLessThan(1);
  await expect(page.getByText('SIZED FROM DRAWN SYMBOLS · DRAWING SCALE APPLIED')).toBeVisible();
  // eslint-disable-next-line no-console
  console.log('[brynhurst phase21] MS1 drawn size',(lineupWidth/.0254).toFixed(1)+'" ×',(lineupDepth/.0254).toFixed(1)+'"');
  await undoScale.click();
  await expect(applyScale,'undo restores the sheet coordinates').toBeVisible({timeout:60_000});
  const restored=(await readPersistedEntities(page)).find(e=>e.meta?.candidateRole==='INSTANCE'&&Number(e.meta?.page)===4&&e.name==='MS1');
  expect(restored?.meta?.pdfMetricFrameOriginal,'undo removes the metric frame').toBeUndefined();

  // Phase 4: show every sheet frame so the identified INSTANCEs (on the one-line sheet) are in view,
  // then confirm the role gate actually draws them — and no silent failure appears when it rebuilds.
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
}
