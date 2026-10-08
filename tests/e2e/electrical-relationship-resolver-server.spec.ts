import {expect,test,type Page} from '@playwright/test';

const alpha={
 email:'alpha.pm@stratum-e2e.test',
 password:'StratumE2E!Alpha2026',
 projectId:'30000000-0000-4000-8000-000000000001',
 switchboard:'41000000-0000-4000-8000-000000000014',
 panel:'41000000-0000-4000-8000-000000000015',
};
const beta={
 email:'beta.pm@stratum-e2e.test',
 password:'StratumE2E!Beta2026',
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
   method,
   credentials:'same-origin',
   headers:body===undefined?undefined:{'content-type':'application/json'},
   body:body===undefined?undefined:JSON.stringify(body),
  });
  return{status:response.status,body:await response.json().catch(()=>({}))};
 },{url,method,body});
}

test.describe('authenticated electrical relationship resolver',()=>{
 test.describe.configure({mode:'serial'});

 test('SLD_FEEDS becomes an evidence-backed review candidate only for bound registered assets',async({page})=>{
  await login(page,alpha.email,alpha.password);
  const sourceName='E2E Resolver SLD E-601.pdf';
  const sourceSha='c'.repeat(64);
  const graph={
   version:'e2e-electrical-relationship-resolver-v1',
   createdAt:'2026-10-07T15:30:00.000Z',
   sources:[{
    name:sourceName,ext:'pdf',sha256:sourceSha,discipline:'Electrical',floor:'UNRESOLVED',elevation:0
   }],
   entities:[
    {
     id:'resolver-swbd',source:sourceName,layer:'L2',kind:'text-asset-candidate',name:'E2E-ALPHA-RESOLVER-SWBD',
     x:0,y:0,z:0,confidence:.96,floor:'UNRESOLVED',
     meta:{page:1,sheet:'E-601',sourceSha256:sourceSha,registeredAssetId:alpha.switchboard,sldSpatialProjection:true,sldLogicalDepth:2,physicalTruth:false,reviewRequired:true}
    },
    {
     id:'resolver-panel',source:sourceName,layer:'L2',kind:'text-asset-candidate',name:'E2E-ALPHA-RESOLVER-PNL',
     x:0,y:4,z:0,confidence:.94,floor:'UNRESOLVED',
     meta:{page:1,sheet:'E-601',sourceSha256:sourceSha,registeredAssetId:alpha.panel,sldSpatialProjection:true,sldLogicalDepth:4,physicalTruth:false,reviewRequired:true}
    },
    {
     id:'resolver-unbound',source:sourceName,layer:'L2',kind:'text-asset-candidate',name:'UNBOUND LOAD',
     x:0,y:8,z:0,confidence:.72,floor:'UNRESOLVED',
     meta:{page:1,sheet:'E-601',sourceSha256:sourceSha,sldSpatialProjection:true,sldLogicalDepth:5,physicalTruth:false,reviewRequired:true}
    }
   ],
   links:[
    {
     id:'sld-feeds:resolver-swbd:resolver-panel',from:'resolver-swbd',to:'resolver-panel',type:'SLD_FEEDS',confidence:.9,
     meta:{inference:'PDF_VECTOR_CONNECTED_COMPONENT',reviewRequired:true,physicalTruth:false,sourceVectorComponent:1}
    },
    {
     id:'sld-feeds:resolver-panel:resolver-unbound',from:'resolver-panel',to:'resolver-unbound',type:'SLD_FEEDS',confidence:.72,
     meta:{inference:'DETERMINISTIC_HIERARCHY_NEAREST_UPSTREAM',reviewRequired:true,physicalTruth:false}
    }
   ],
   stats:{L0:1,L1:0,L2:3,L3:0,L4:0}
  };

  const compilation=await api(page,'/api/spatial/compilations','POST',{projectId:alpha.projectId,graph});
  expect(compilation.status).toBe(201);
  expect(compilation.body.id).toMatch(/^[0-9a-f-]{36}$/i);

  const discovered=await api(page,'/api/relationships/discover/electrical','POST',{
   projectId:alpha.projectId,
   compilationId:compilation.body.id,
  });
  expect(discovered.status).toBe(200);
  expect(discovered.body.inspectedSldLinks).toBe(2);
  expect(discovered.body.candidates).toHaveLength(1);
  expect(discovered.body.unresolved).toEqual(expect.arrayContaining([
   expect.objectContaining({linkId:'sld-feeds:resolver-panel:resolver-unbound',reason:'TARGET_ASSET_UNRESOLVED'})
  ]));
  expect(discovered.body.truthBoundary).toMatch(/REVIEW_REQUIRED_RELATIONSHIP_CANDIDATES_ONLY/);
  const candidate=discovered.body.candidates[0];
  expect(candidate).toMatchObject({
   sourceAssetId:alpha.switchboard,
   targetAssetId:alpha.panel,
   currentState:'REVIEW_REQUIRED',
   confidence:.9,
   extractionMethod:'SLD_VECTOR_CONNECTIVITY',
   candidateIdempotent:false,
   evidenceIdempotent:false,
  });
  expect(candidate.evidenceId).toMatch(/^[0-9a-f-]{36}$/i);

  const listing=await api(page,'/api/relationships?assetId='+alpha.panel);
  expect(listing.status).toBe(200);
  expect(listing.body.trustedCount).toBe(0);
  expect(listing.body.items).toEqual(expect.arrayContaining([
   expect.objectContaining({id:candidate.relationshipId,current_state:'REVIEW_REQUIRED',trusted:false,evidence_count:1})
  ]));

  const beforeReview=await api(page,'/api/relationships/traverse?assetId='+alpha.switchboard);
  expect(beforeReview.status).toBe(200);
  expect(beforeReview.body.affected).toEqual([]);

  const retry=await api(page,'/api/relationships/discover/electrical','POST',{
   projectId:alpha.projectId,
   compilationId:compilation.body.id,
  });
  expect(retry.status).toBe(200);
  expect(retry.body.candidates[0]).toMatchObject({
   relationshipId:candidate.relationshipId,
   candidateIdempotent:true,
   evidenceIdempotent:true,
   currentState:'REVIEW_REQUIRED',
  });

  const review=await api(page,'/api/relationships/'+candidate.relationshipId+'/review','POST',{
   action:'VERIFY',
   reason:'E2E reviewer confirms the vector-connected SLD feeder path between these two registered assets.'
  });
  expect(review.status).toBe(200);
  expect(review.body.currentState).toBe('VERIFIED');

  const afterReview=await api(page,'/api/relationships/traverse?assetId='+alpha.switchboard);
  expect(afterReview.status).toBe(200);
  expect(afterReview.body.affected).toEqual(expect.arrayContaining([
   expect.objectContaining({asset_id:alpha.panel,depth:1})
  ]));
 });

 test('electrical discovery cannot read another tenant project or compilation',async({page})=>{
  await login(page,beta.email,beta.password);
  const result=await api(page,'/api/relationships/discover/electrical','POST',{projectId:alpha.projectId});
  expect(result.status).toBe(404);
 });
});
