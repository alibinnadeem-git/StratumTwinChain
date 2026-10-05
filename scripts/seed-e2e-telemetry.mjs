import pg from 'pg';

const {Client}=pg;
const databaseUrl=(process.env.DATABASE_URL||'').trim();
if(!databaseUrl)throw new Error('DATABASE_URL is required for telemetry E2E seed');

const fixtures=[
 {
  organizationId:'10000000-0000-4000-8000-000000000001',
  projectId:'30000000-0000-4000-8000-000000000001',
  siteId:'31000000-0000-4000-8000-000000000001',
  assetId:'40000000-0000-4000-8000-000000000001',
  assetCode:'E2E-ALPHA-SWGR',
  name:'E2E Alpha Main Switchgear',
 },
 {
  organizationId:'10000000-0000-4000-8000-000000000002',
  projectId:'30000000-0000-4000-8000-000000000002',
  siteId:'31000000-0000-4000-8000-000000000002',
  assetId:'40000000-0000-4000-8000-000000000002',
  assetCode:'E2E-BETA-SWGR',
  name:'E2E Beta Main Switchgear',
 },
];

const client=new Client({connectionString:databaseUrl,ssl:/sslmode=(require|verify-ca|verify-full)/i.test(databaseUrl)?{rejectUnauthorized:false}:undefined});
try{
 await client.connect();
 await client.query('BEGIN');
 for(const fixture of fixtures){
  await client.query(`
   INSERT INTO sites(id,organization_id,project_id,name,location_label)
   VALUES($1,$2,$3,$4,$5)
   ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,location_label=EXCLUDED.location_label
  `,[fixture.siteId,fixture.organizationId,fixture.projectId,fixture.name+' Site','E2E telemetry lab']);
  await client.query(`
   INSERT INTO assets(id,organization_id,project_id,site_id,asset_code,asset_type,name,status,specifications)
   VALUES($1,$2,$3,$4,$5,'SWITCHGEAR',$6,'REGISTERED',$7::jsonb)
   ON CONFLICT(id) DO UPDATE SET
     organization_id=EXCLUDED.organization_id,
     project_id=EXCLUDED.project_id,
     site_id=EXCLUDED.site_id,
     asset_code=EXCLUDED.asset_code,
     asset_type=EXCLUDED.asset_type,
     name=EXCLUDED.name,
     status='REGISTERED',
     specifications=EXCLUDED.specifications
  `,[fixture.assetId,fixture.organizationId,fixture.projectId,fixture.siteId,fixture.assetCode,fixture.name,JSON.stringify({telemetryFixture:true})]);
 }
 await client.query('COMMIT');
 console.log('✓ seeded isolated registered assets for telemetry E2E');
 console.log('✓ assets remain REGISTERED; telemetry seed does not establish Verified state, field measurement, DIR or PoVI finality');
}catch(error){
 await client.query('ROLLBACK').catch(()=>{});
 throw error;
}finally{
 await client.end().catch(()=>{});
}
