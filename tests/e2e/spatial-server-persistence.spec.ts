import {expect,test,type Page} from '@playwright/test';

const alpha={
 email:'alpha.pm@stratum-e2e.test',
 password:'StratumE2E!Alpha2026',
 projectId:'30000000-0000-4000-8000-000000000001',
 entity:'E2E ALPHA PANEL',
};
const beta={
 email:'beta.pm@stratum-e2e.test',
 password:'StratumE2E!Beta2026',
 projectId:'30000000-0000-4000-8000-000000000002',
 entity:'E2E BETA PANEL',
};
const gamma={
 email:'gamma.pm@stratum-e2e.test',
 password:'StratumE2E!Gamma2026',
 projectId:'30000000-0000-4000-8000-000000000003',
 entity:'E2E GAMMA TRANSFORMER',
};

function graph(name:string,seed:string){
 return{
  version:'server-golden-1',
  createdAt:seed==='a'?'2026-10-04T00:00:01.000Z':'2026-10-04T00:00:02.000Z',
  sources:[{name:`E2E-${seed}.dxf`,ext:'dxf',sha256:seed.repeat(64),discipline:'Electrical',floor:'L1',elevation:0}],
  entities:[{id:`panel-${seed}`,source:`E2E-${seed}.dxf`,layer:'L2',kind:'text-asset-candidate',name,x:1,y:2,z:0,floor:'L1',confidence:.99,meta:{elevationKnown:false,physicalTruth:false,reviewRequired:true}}],
  links:[],
  stats:{L0:1,L1:0,L2:1,L3:0,L4:0},
 };
}

function zConflictGraph(){
 const source='E2E-gamma-z-conflict.pdf';
 return{
  version:'server-z-review-1',
  createdAt:'2026-10-04T00:00:03.000Z',
  sources:[{name:source,ext:'pdf',sha256:'e'.repeat(64),discipline:'Electrical / Civil',floor:'UNRESOLVED',elevation:0}],
  entities:[{
   id:'gamma-xfmr-z',source,layer:'L2',kind:'text-asset-candidate',name:gamma.entity,x:0,y:0,z:0,floor:'UNRESOLVED',confidence:.93,
   meta:{
    assetDimensionAuthority:'SOURCE_SPEC',assetDimensionsMeters:[1.7,1.6,1.25],
    localReviewSurfaceZ:30.48,localReviewSurfaceKind:'GRADE',localReviewSurfaceAuthority:'SOURCE_ELEVATION_TRIANGLE',localReviewSurfaceConfidence:.84,
    supportBaseOffsetMeters:.1524,supportOffsetKind:'PAD',supportOffsetAuthority:'TAG_LINKED_SOURCE_SUPPORT_NOTE',supportOffsetConfidence:.94,
    supportOffsetEvidenceLabel:'XFMR 6" CONC PAD',
    zResolutionStatus:'RESOLVED_DESIGN_CANDIDATE',zCandidateMeters:31.1,zCandidateReferencePoint:'BASE',zResolutionConfidence:.9,zResolutionAuthority:'SOURCE_BASE_ELEVATION',
    physicalElevationKnown:false,elevationKnown:false,physicalTruth:false,reviewRequired:true
   }
  }],
  links:[],
  stats:{L0:1,L1:0,L2:1,L3:0,L4:0},
 };
}

async function login(page:Page,email:string,password:string){
 await page.goto('/login');
 await page.getByPlaceholder('Email').fill(email);
 await page.getByPlaceholder('Password').fill(password);
 await page.getByRole('button',{name:'Sign in'}).click();
 await expect(page).toHaveURL(/\/$/);
 const session=(await page.context().cookies()).find(cookie=>cookie.name==='stratum_session');
 expect(session?.httpOnly).toBe(true);
 expect(session?.sameSite).toBe('Lax');
}

async function writeBrowserGraph(page:Page,projectId:string,value:ReturnType<typeof graph>){
 await page.goto('/compiler');
 await page.evaluate(async({projectId,value})=>{
  localStorage.setItem('stratum_spatial_project_id',projectId);
  localStorage.setItem('stratum_compiled_graph',JSON.stringify(value));
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{
   const request=indexedDB.open('stratum-spatial-recovery-v1',1);
   request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('graphs'))request.result.createObjectStore('graphs')};
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>reject(request.error);
  });
  await new Promise<void>((resolve,reject)=>{
   const tx=db.transaction('graphs','readwrite');
   tx.objectStore('graphs').put(value,'current');
   tx.oncomplete=()=>resolve();
   tx.onerror=()=>reject(tx.error);
  });
  db.close();
  window.dispatchEvent(new Event('stratum:graph-updated'));
 },{projectId,value});
}

async function clearBrowserGraphs(page:Page){
 await page.evaluate(async()=>{
  for(const key of [
   'stratum_compiled_graph',
   'stratum_compiled_graph_last_good_v2',
   'stratum_compiled_graph_previous_v2',
   'stratum_legacy_spatial_graph'
  ])localStorage.removeItem(key);
  sessionStorage.removeItem('stratum_spatial_server_hydration_v1');
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{
   const request=indexedDB.open('stratum-spatial-recovery-v1',1);
   request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('graphs'))request.result.createObjectStore('graphs')};
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>reject(request.error);
  });
  await new Promise<void>((resolve,reject)=>{
   const tx=db.transaction('graphs','readwrite');
   tx.objectStore('graphs').clear();
   tx.oncomplete=()=>resolve();
   tx.onerror=()=>reject(tx.error);
  });
  db.close();
 });
}

async function browserFetch(page:Page,url:string,method='GET',body?:unknown){
 return page.evaluate(async({url,method,body})=>{
  const response=await fetch(url,{
   method,
   credentials:'same-origin',
   headers:body===undefined?undefined:{'content-type':'application/json'},
   body:body===undefined?undefined:JSON.stringify(body),
  });
  return{status:response.status,ok:response.ok,body:await response.json().catch(()=>({}))};
 },{url,method,body});
}

async function saveGraph(page:Page,projectId:string,value:any){
 const response=await browserFetch(page,'/api/spatial/compilations','POST',{projectId,graph:value});
 expect(response.status).toBe(201);
 return response.body;
}

test.describe('authenticated server-backed Spatial golden path',()=>{
 test('tenant graph saves, survives browser wipe, hydrates from server and cannot cross tenant boundary',async({page,browser})=>{
  const alphaGraph=graph(alpha.entity,'a');
  await login(page,alpha.email,alpha.password);
  await writeBrowserGraph(page,alpha.projectId,alphaGraph);

  await expect.poll(async()=>{
   const response=await browserFetch(page,'/api/spatial/compilations?projectId='+alpha.projectId);
   if(!response.ok)return null;
   const body=response.body;
   return body.latest?{revision:body.latest.revision,name:body.latest.graph_json?.entities?.[0]?.name,projects:body.projects?.map((p:any)=>p.id)}:null;
  },{timeout:20_000,intervals:[250,500,1000,2000]}).toEqual({
   revision:1,
   name:alpha.entity,
   projects:[alpha.projectId],
  });

  // Re-emitting the same graph must not create another append-only revision.
  await page.evaluate(()=>window.dispatchEvent(new Event('stratum:graph-updated')));
  await page.waitForTimeout(2500);
  const idempotentRead=await browserFetch(page,'/api/spatial/compilations?projectId='+alpha.projectId);
  expect(idempotentRead.ok).toBe(true);
  expect(idempotentRead.body.latest.revision).toBe(1);

  await clearBrowserGraphs(page);
  await page.goto('/spatial');
  await expect(page.getByText('PROJECT MODEL',{exact:true})).toBeVisible({timeout:20_000});
  await expect(page.getByLabel('Imported object')).toContainText(alpha.entity);
  await expect.poll(()=>page.evaluate(()=>{
   try{return JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}').entities?.[0]?.name||null}catch{return null}
  }),{timeout:20_000}).toBe(alpha.entity);
  const hydration=await page.evaluate(()=>{
   try{return JSON.parse(sessionStorage.getItem('stratum_spatial_server_hydration_v1')||'{}')}catch{return{}}
  });
  expect(hydration).toMatchObject({state:'RESTORED',projectId:alpha.projectId,revision:1});

  const origin=new URL(page.url()).origin;
  const betaContext=await browser.newContext({baseURL:origin});
  const betaPage=await betaContext.newPage();
  try{
   await login(betaPage,beta.email,beta.password);
   const betaSaved=await saveGraph(betaPage,beta.projectId,graph(beta.entity,'b'));
   expect(betaSaved).toMatchObject({revision:1,idempotent:false,reviewState:'REVIEW_REQUIRED'});

   const alphaReadingBeta=await browserFetch(page,'/api/spatial/compilations?projectId='+beta.projectId);
   expect(alphaReadingBeta.status).toBe(200);
   const alphaReadingBetaBody=alphaReadingBeta.body;
   expect(alphaReadingBetaBody.projects.map((project:any)=>project.id)).toEqual([alpha.projectId]);
   expect(alphaReadingBetaBody.latest).toBeNull();

   const alphaWritingBeta=await browserFetch(page,'/api/spatial/compilations','POST',{projectId:beta.projectId,graph:alphaGraph});
   expect(alphaWritingBeta.status).toBe(404);
   expect(alphaWritingBeta.body.error).toBe('Project not found in this organization');

   const betaReadingAlpha=await browserFetch(betaPage,'/api/spatial/compilations?projectId='+alpha.projectId);
   expect(betaReadingAlpha.status).toBe(200);
   const betaReadingAlphaBody=betaReadingAlpha.body;
   expect(betaReadingAlphaBody.projects.map((project:any)=>project.id)).toEqual([beta.projectId]);
   expect(betaReadingAlphaBody.latest).toBeNull();
  }finally{
   await betaContext.close();
  }
 })

 test('authenticated Z adjudication survives server hydration and rejects tampered receipts',async({page})=>{
  await login(page,gamma.email,gamma.password);
  const original=zConflictGraph();
  const saved=await saveGraph(page,gamma.projectId,original);
  expect(saved).toMatchObject({revision:1,idempotent:false,reviewState:'REVIEW_REQUIRED'});
  const compilationId=String(saved.id||'');
  expect(compilationId).toMatch(/^[0-9a-f-]{36}$/i);

  const reason='Use grade plus the explicit transformer pad for the coordination review model.';
  const review=await browserFetch(page,'/api/spatial/z-reviews','POST',{
   projectId:gamma.projectId,
   compilationId,
   entityId:'gamma-xfmr-z',
   action:'ACCEPT_DESIGN_CHAIN',
   candidateId:'support-chain',
   reason,
  });
  expect(review.status).toBe(201);
  expect(review.body).toMatchObject({
   action:'ACCEPT_DESIGN_CHAIN',
   candidate_id:'support-chain',
   reviewState:'REVIEW_RESOLVED_CANDIDATE',
   truthBoundary:'AUTHENTICATED_Z_REVIEW_SELECTS_A_DESIGN_PLACEMENT_CHAIN_ONLY_NOT_PHYSICAL_TRUTH_NOT_DIR_NOT_POVI',
  });
  const decisionId=String(review.body.id||'');
  expect(decisionId).toMatch(/^[0-9a-f-]{36}$/i);

  const listed=await browserFetch(page,`/api/spatial/z-reviews?projectId=${gamma.projectId}&compilationId=${compilationId}&entityId=gamma-xfmr-z`);
  expect(listed.status).toBe(200);
  expect(listed.body.decisions).toHaveLength(1);
  expect(listed.body.decisions[0]).toMatchObject({
   id:decisionId,
   entity_id:'gamma-xfmr-z',
   action:'ACCEPT_DESIGN_CHAIN',
   candidate_id:'support-chain',
   graph_sha256:saved.graph_sha256,
  });

  await clearBrowserGraphs(page);
  await page.goto('/spatial');
  await expect(page.getByText('PROJECT MODEL',{exact:true})).toBeVisible({timeout:20_000});
  await expect(page.getByLabel('Imported object')).toContainText(gamma.entity);
  await page.getByLabel('Imported object').selectOption('gamma-xfmr-z');
  await expect(page.getByText(/HUMAN REVIEW PLACEMENT · PHYSICAL Z UNVERIFIED/)).toBeVisible();

  await expect.poll(async()=>page.evaluate(()=>{
   try{
    const graph=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}');
    const entity=(graph.entities||[]).find((item:any)=>item.id==='gamma-xfmr-z');
    const hydration=JSON.parse(sessionStorage.getItem('stratum_spatial_server_hydration_v1')||'{}');
    return entity?.meta?{
     authority:entity.meta.zReviewDecisionAuthority,
     decisionId:entity.meta.zReviewDecisionId,
     candidate:entity.meta.zReviewDecisionCandidateId,
     reason:entity.meta.zReviewDecisionReason,
     physicalElevationKnown:entity.meta.physicalElevationKnown,
     physicalTruth:entity.meta.physicalTruth,
     reviewRequired:entity.meta.reviewRequired,
     hydrationState:hydration.state,
     hydrationDecisionCount:hydration.zReviewDecisionCount,
    }:null;
   }catch{return null}
  }),{timeout:20_000,intervals:[250,500,1000,2000]}).toMatchObject({
   authority:'SERVER_AUTHENTICATED_HUMAN_REVIEW',
   decisionId,
   candidate:'support-chain',
   reason,
   physicalElevationKnown:false,
   physicalTruth:false,
   reviewRequired:true,
   hydrationState:'RESTORED',
   hydrationDecisionCount:1,
  });

  const hydratedGraph=await page.evaluate(()=>JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}'));
  const resaved=await browserFetch(page,'/api/spatial/compilations','POST',{projectId:gamma.projectId,graph:hydratedGraph});
  expect(resaved.status).toBe(201);
  expect(resaved.body.revision).toBe(2);

  const tampered=structuredClone(hydratedGraph);
  tampered.entities[0].meta.zReviewDecisionId='40000000-0000-4000-8000-000000000099';
  const rejected=await browserFetch(page,'/api/spatial/compilations','POST',{projectId:gamma.projectId,graph:tampered});
  expect(rejected.status).toBe(409);
  expect(rejected.body.error).toMatch(/Z review receipt does not match the persisted server decision/i);
 });;
});
