import {expect,test,type Page} from '@playwright/test';

const alpha={
 email:'alpha.pm@stratum-e2e.test',
 password:'StratumE2E!Alpha2026',
 assetId:'40000000-0000-4000-8000-000000000001',
};
const beta={
 email:'beta.pm@stratum-e2e.test',
 password:'StratumE2E!Beta2026',
 assetId:'40000000-0000-4000-8000-000000000002',
};

async function login(page:Page,email:string,password:string){
 await page.goto('/login');
 await page.getByPlaceholder('Email').fill(email);
 await page.getByPlaceholder('Password').fill(password);
 await page.getByRole('button',{name:'Sign in'}).click();
 await expect(page).toHaveURL(/\/$/);
}

async function api(page:Page,url:string,method='GET',body?:unknown){
 return page.evaluate(async({url,method,body})=>{
  const response=await fetch(url,{
   method,credentials:'same-origin',
   headers:body===undefined?undefined:{'content-type':'application/json'},
   body:body===undefined?undefined:JSON.stringify(body),
  });
  return{status:response.status,body:await response.json().catch(()=>({}))};
 },{url,method,body});
}

test.describe('authenticated telemetry production path',()=>{
 test.describe.configure({mode:'serial'});

 test('simulator uses shared ingestion, latest values persist, SSE snapshots live data and Verified state is untouched',async({page})=>{
  await login(page,alpha.email,alpha.password);

  const simulated=await api(page,'/api/telemetry/simulate','POST',{assetId:alpha.assetId,tick:7});
  expect(simulated.status).toBe(201);
  expect(simulated.body.readings).toHaveLength(4);
  expect(simulated.body.simulatorBoundary).toBe('SIMULATED_OBSERVED_DATA_NOT_FIELD_MEASUREMENT');
  expect(simulated.body.truthBoundary).toBe('OBSERVED_OPERATIONAL_DATA_NOT_VERIFIED_PHYSICAL_TRUTH');
  expect(simulated.body.readings.every((item:any)=>item.source_protocol==='SIMULATOR')).toBe(true);

  const direct=await api(page,'/api/telemetry/ingest','POST',{
   assetId:alpha.assetId,
   sensorKey:'rest.breaker.position',
   measurement:'Breaker Position',
   unit:'state',
   value:'CLOSED',
   observedAt:new Date().toISOString(),
   quality:'GOOD',
   source:{protocol:'REST_WEBHOOK',ref:'E2E webhook adapter',samplingIntervalMs:5000,metadata:{fixture:true}},
  });
  expect(direct.status).toBe(201);
  expect(direct.body.reading).toMatchObject({sensor_key:'rest.breaker.position',measurement:'Breaker Position',unit:'state',value_json:'CLOSED',source_protocol:'REST_WEBHOOK'});

  const latest=await api(page,'/api/telemetry/latest?assetId='+alpha.assetId);
  expect(latest.status).toBe(200);
  expect(latest.body.readings.map((item:any)=>item.sensor_key)).toEqual(expect.arrayContaining([
   'sim.voltage.l1','sim.current.l1','sim.power.kw','sim.temperature','rest.breaker.position'
  ]));

  const snapshot=await page.evaluate(async assetId=>await new Promise<any>((resolve,reject)=>{
   const source=new EventSource('/api/telemetry/stream?assetId='+assetId);
   const timer=setTimeout(()=>{source.close();reject(new Error('SSE snapshot timeout'))},8000);
   source.addEventListener('snapshot',event=>{
    clearTimeout(timer);source.close();
    try{resolve(JSON.parse((event as MessageEvent).data))}catch(error){reject(error)}
   });
   source.addEventListener('error',()=>{/* EventSource reconnect semantics are expected after bounded streams. */});
  }),alpha.assetId);
  expect(snapshot.assetId).toBe(alpha.assetId);
  expect(snapshot.readings.length).toBeGreaterThanOrEqual(5);
  expect(snapshot.truthBoundary).toBe('OBSERVED_OPERATIONAL_DATA_NOT_VERIFIED_PHYSICAL_TRUTH');

  const asset=await api(page,'/api/assets/'+alpha.assetId);
  expect(asset.status).toBe(200);
  expect(asset.body.status).toBe('REGISTERED');
 });

 test('telemetry remains tenant-isolated',async({page})=>{
  await login(page,beta.email,beta.password);
  const foreignRead=await api(page,'/api/telemetry/latest?assetId='+alpha.assetId);
  expect(foreignRead.status).toBe(404);

  const foreignWrite=await api(page,'/api/telemetry/ingest','POST',{
   assetId:alpha.assetId,
   sensorKey:'attempt.cross-tenant',
   measurement:'Cross Tenant Attempt',
   unit:'count',
   value:1,
   observedAt:new Date().toISOString(),
   quality:'GOOD',
   source:{protocol:'REST_WEBHOOK',ref:'negative fixture',metadata:{}},
  });
  expect(foreignWrite.status).toBe(404);

  const ownSim=await api(page,'/api/telemetry/simulate','POST',{assetId:beta.assetId,tick:2});
  expect(ownSim.status).toBe(201);
 });
});
