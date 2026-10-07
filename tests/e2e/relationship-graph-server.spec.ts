import {expect,test,type Page} from '@playwright/test';

const alpha={
 email:'alpha.pm@stratum-e2e.test',
 password:'StratumE2E!Alpha2026',
 projectId:'30000000-0000-4000-8000-000000000001',
 msb:'41000000-0000-4000-8000-000000000011',
 mcc:'41000000-0000-4000-8000-000000000012',
 pump:'41000000-0000-4000-8000-000000000013',
};
const beta={
 email:'beta.pm@stratum-e2e.test',
 password:'StratumE2E!Beta2026',
 projectId:'30000000-0000-4000-8000-000000000002',
 msb:'41000000-0000-4000-8000-000000000021',
 mcc:'41000000-0000-4000-8000-000000000022',
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

test.describe('authenticated trusted relationship graph',()=>{
 test.describe.configure({mode:'serial'});

 test('unreviewed edge cannot propagate; evidence-backed human review unlocks trusted traversal idempotently',async({page})=>{
  await login(page,alpha.email,alpha.password);

  const candidatePayload={
   projectId:alpha.projectId,
   sourceAssetId:alpha.msb,
   targetAssetId:alpha.mcc,
   relationshipType:'FEEDS',
   confidence:.97,
   discoveryAuthority:'SOURCE_DOCUMENT',
  };
  const created=await api(page,'/api/relationships','POST',candidatePayload);
  expect(created.status).toBe(201);
  expect(created.body.relationship.current_state).toBe('REVIEW_REQUIRED');
  expect(created.body.truthBoundary).toBe('RELATIONSHIP_CANDIDATE_NOT_OPERATIONAL_TRUTH_UNTIL_EVIDENCE_BACKED_HUMAN_VERIFIED');
  const firstRelationshipId=created.body.relationship.id as string;

  const retry=await api(page,'/api/relationships','POST',candidatePayload);
  expect(retry.status).toBe(200);
  expect(retry.body.idempotent).toBe(true);
  expect(retry.body.relationship.id).toBe(firstRelationshipId);

  const beforeTrust=await api(page,'/api/relationships/traverse?assetId='+alpha.msb+'&depth=6');
  expect(beforeTrust.status).toBe(200);
  expect(beforeTrust.body.affected).toEqual([]);
  expect(beforeTrust.body.trustedOnly).toBe(true);

  const prematureReview=await api(page,'/api/relationships/'+firstRelationshipId+'/review','POST',{
   action:'VERIFY',
   reason:'SLD feeder path reviewed before evidence is attached.'
  });
  expect(prematureReview.status).toBe(409);

  const evidencePayload={
   sourceSha256:'a'.repeat(64),
   sourceFileName:'E2E Alpha SLD.pdf',
   sheetReference:'E-601',
   pageNumber:1,
   regionGeometry:{x:120,y:80,width:360,height:160,coordinateSpace:'source-page'},
   extractionMethod:'SLD_CONNECTIVITY',
   confidence:.99,
  };
  const evidence=await api(page,'/api/relationships/'+firstRelationshipId+'/evidence','POST',evidencePayload);
  expect(evidence.status).toBe(201);
  expect(evidence.body.evidence.evidence_sha256).toMatch(/^[a-f0-9]{64}$/);

  const evidenceRetry=await api(page,'/api/relationships/'+firstRelationshipId+'/evidence','POST',evidencePayload);
  expect(evidenceRetry.status).toBe(200);
  expect(evidenceRetry.body.evidence.idempotent).toBe(true);

  const verified=await api(page,'/api/relationships/'+firstRelationshipId+'/review','POST',{
   action:'VERIFY',
   reason:'Electrical one-line E-601 explicitly shows the main switchboard feeding this MCC.'
  });
  expect(verified.status).toBe(200);
  expect(verified.body.currentState).toBe('VERIFIED');

  const second=await api(page,'/api/relationships','POST',{
   projectId:alpha.projectId,
   sourceAssetId:alpha.mcc,
   targetAssetId:alpha.pump,
   relationshipType:'SUPPLIES',
   confidence:.95,
   discoveryAuthority:'SCHEDULE',
   evidence:{
    sourceSha256:'b'.repeat(64),
    sourceFileName:'E2E Alpha Equipment Schedule.pdf',
    sheetReference:'E-701',
    pageNumber:2,
    extractionMethod:'EQUIPMENT_SCHEDULE',
    confidence:.96,
   },
  });
  expect(second.status).toBe(201);
  const secondId=second.body.relationship.id as string;
  const secondVerified=await api(page,'/api/relationships/'+secondId+'/review','POST',{
   action:'VERIFY',
   reason:'Reviewed equipment schedule explicitly identifies MCC supply to the cooling pump.'
  });
  expect(secondVerified.status).toBe(200);
  expect(secondVerified.body.currentState).toBe('VERIFIED');

  const traversal=await api(page,'/api/relationships/traverse?assetId='+alpha.msb+'&depth=6');
  expect(traversal.status).toBe(200);
  expect(traversal.body.affected.map((row:any)=>row.asset_id)).toEqual(expect.arrayContaining([alpha.mcc,alpha.pump]));
  expect(traversal.body.affected.find((row:any)=>row.asset_id===alpha.mcc)?.depth).toBe(1);
  expect(traversal.body.affected.find((row:any)=>row.asset_id===alpha.pump)?.depth).toBe(2);
  expect(traversal.body.truthBoundary).toBe('TRUSTED_RELATIONSHIP_TRAVERSAL_IS_DEPENDENCY_EVIDENCE_NOT_A_FAILURE_PREDICTION_OR_POVI_FINALITY');

  const listing=await api(page,'/api/relationships?assetId='+alpha.mcc);
  expect(listing.status).toBe(200);
  expect(listing.body.trustedCount).toBe(2);
  expect(listing.body.items.every((item:any)=>item.trusted===true)).toBe(true);

  const asset=await api(page,'/api/assets/'+alpha.msb);
  expect(asset.status).toBe(200);
  expect(asset.body.status).toBe('REGISTERED');
 });

 test('relationship graph remains tenant-isolated for reads writes evidence review and traversal',async({page})=>{
  await login(page,beta.email,beta.password);

  const foreignListing=await api(page,'/api/relationships?assetId='+alpha.msb);
  expect(foreignListing.status).toBe(404);
  const foreignTraversal=await api(page,'/api/relationships/traverse?assetId='+alpha.msb);
  expect(foreignTraversal.status).toBe(404);

  const crossTenant=await api(page,'/api/relationships','POST',{
   projectId:beta.projectId,
   sourceAssetId:beta.msb,
   targetAssetId:alpha.mcc,
   relationshipType:'FEEDS',
   confidence:.9,
   discoveryAuthority:'HUMAN_REVIEW',
  });
  expect(crossTenant.status).toBe(404);

  const own=await api(page,'/api/relationships','POST',{
   projectId:beta.projectId,
   sourceAssetId:beta.msb,
   targetAssetId:beta.mcc,
   relationshipType:'FEEDS',
   confidence:.8,
   discoveryAuthority:'HUMAN_REVIEW',
  });
  expect(own.status).toBe(201);
  expect(own.body.relationship.current_state).toBe('REVIEW_REQUIRED');

  const ownTraversal=await api(page,'/api/relationships/traverse?assetId='+beta.msb);
  expect(ownTraversal.status).toBe(200);
  expect(ownTraversal.body.affected).toEqual([]);
 });
});
