import pg from 'pg';

const {Client}=pg;
const databaseUrl=(process.env.DATABASE_URL||'').trim();
if(!databaseUrl)throw new Error('DATABASE_URL is required for relationship graph E2E seed');

const fixtures=[
 {
  organizationId:'10000000-0000-4000-8000-000000000001',
  projectId:'30000000-0000-4000-8000-000000000001',
  siteId:'31000000-0000-4000-8000-000000000011',
  siteName:'E2E Alpha Relationship Site',
  assets:[
   {id:'41000000-0000-4000-8000-000000000011',code:'E2E-ALPHA-MSB',type:'SWITCHGEAR',name:'E2E Alpha Main Switchboard'},
   {id:'41000000-0000-4000-8000-000000000012',code:'E2E-ALPHA-MCC',type:'MCC',name:'E2E Alpha MCC'},
   {id:'41000000-0000-4000-8000-000000000013',code:'E2E-ALPHA-PUMP',type:'PUMP',name:'E2E Alpha Cooling Pump'},
  ],
 },
 {
  organizationId:'10000000-0000-4000-8000-000000000002',
  projectId:'30000000-0000-4000-8000-000000000002',
  siteId:'31000000-0000-4000-8000-000000000021',
  siteName:'E2E Beta Relationship Site',
  assets:[
   {id:'41000000-0000-4000-8000-000000000021',code:'E2E-BETA-MSB',type:'SWITCHGEAR',name:'E2E Beta Main Switchboard'},
   {id:'41000000-0000-4000-8000-000000000022',code:'E2E-BETA-MCC',type:'MCC',name:'E2E Beta MCC'},
  ],
 },
];

const client=new Client({connectionString:databaseUrl,ssl:/sslmode=(require|verify-ca|verify-full)/i.test(databaseUrl)?{rejectUnauthorized:false}:undefined});
try{
 await client.connect();
 await client.query('BEGIN');
 for(const fixture of fixtures){
  await client.query(`
   INSERT INTO sites(id,organization_id,project_id,name,location_label)
   VALUES($1,$2,$3,$4,'Disposable relationship graph fixture')
   ON CONFLICT(id) DO UPDATE SET
    organization_id=EXCLUDED.organization_id,
    project_id=EXCLUDED.project_id,
    name=EXCLUDED.name,
    location_label=EXCLUDED.location_label
  `,[fixture.siteId,fixture.organizationId,fixture.projectId,fixture.siteName]);

  for(const asset of fixture.assets){
   await client.query(`
    INSERT INTO assets(
     id,organization_id,project_id,site_id,asset_code,asset_type,name,status,specifications
    )
    VALUES($1,$2,$3,$4,$5,$6,$7,'REGISTERED',$8::jsonb)
    ON CONFLICT(id) DO UPDATE SET
     organization_id=EXCLUDED.organization_id,
     project_id=EXCLUDED.project_id,
     site_id=EXCLUDED.site_id,
     asset_code=EXCLUDED.asset_code,
     asset_type=EXCLUDED.asset_type,
     name=EXCLUDED.name,
     status='REGISTERED',
     specifications=EXCLUDED.specifications
   `,[asset.id,fixture.organizationId,fixture.projectId,fixture.siteId,asset.code,asset.type,asset.name,JSON.stringify({relationshipGraphFixture:true})]);
  }
 }
 await client.query('COMMIT');
 console.log('✓ seeded isolated registered assets for relationship graph E2E');
 console.log('✓ fixture assets remain REGISTERED; no relationship, evidence, Verified state, DIR, or PoVI record was pre-created');
}catch(error){
 await client.query('ROLLBACK').catch(()=>{});
 throw error;
}finally{
 await client.end().catch(()=>{});
}
