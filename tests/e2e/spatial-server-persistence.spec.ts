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

async function saveGraph(page:Page,projectId:string,value:ReturnType<typeof graph>){
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
 });
});
