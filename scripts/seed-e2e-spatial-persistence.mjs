import pg from 'pg';

const {Client}=pg;
const databaseUrl=(process.env.DATABASE_URL||'').trim();
if(!databaseUrl)throw new Error('DATABASE_URL is required for authenticated Spatial E2E seed');

const fixtures={
 alpha:{
  organizationId:'10000000-0000-4000-8000-000000000001',
  organizationName:'STRATUM E2E Alpha',
  userId:'20000000-0000-4000-8000-000000000001',
  email:'alpha.pm@stratum-e2e.test',
  password:'StratumE2E!Alpha2026',
  projectId:'30000000-0000-4000-8000-000000000001',
  projectCode:'E2E-ALPHA',
  projectName:'Authenticated Spatial Alpha',
 },
 beta:{
  organizationId:'10000000-0000-4000-8000-000000000002',
  organizationName:'STRATUM E2E Beta',
  userId:'20000000-0000-4000-8000-000000000002',
  email:'beta.pm@stratum-e2e.test',
  password:'StratumE2E!Beta2026',
  projectId:'30000000-0000-4000-8000-000000000002',
  projectCode:'E2E-BETA',
  projectName:'Authenticated Spatial Beta',
 },
};

const client=new Client({connectionString:databaseUrl,ssl:/sslmode=(require|verify-ca|verify-full)/i.test(databaseUrl)?{rejectUnauthorized:false}:undefined});

try{
 await client.connect();
 await client.query('BEGIN');
 for(const fixture of Object.values(fixtures)){
  await client.query(
   `INSERT INTO organizations(id,name) VALUES($1,$2)
    ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name`,
   [fixture.organizationId,fixture.organizationName]
  );
  await client.query(
   `INSERT INTO users(id,email,display_name,password_hash,is_active)
    VALUES($1,$2,$3,crypt($4,gen_salt('bf')),true)
    ON CONFLICT(id) DO UPDATE SET
      email=EXCLUDED.email,
      display_name=EXCLUDED.display_name,
      password_hash=EXCLUDED.password_hash,
      is_active=true,
      session_version=users.session_version+1`,
   [fixture.userId,fixture.email,fixture.projectName+' Project Manager',fixture.password]
  );
  await client.query(
   `INSERT INTO memberships(organization_id,user_id,role)
    VALUES($1,$2,'PROJECT_MANAGER')
    ON CONFLICT(organization_id,user_id) DO UPDATE SET role='PROJECT_MANAGER'`,
   [fixture.organizationId,fixture.userId]
  );
  await client.query(
   `INSERT INTO projects(id,organization_id,project_code,name,status)
    VALUES($1,$2,$3,$4,'ACTIVE')
    ON CONFLICT(id) DO UPDATE SET
      organization_id=EXCLUDED.organization_id,
      project_code=EXCLUDED.project_code,
      name=EXCLUDED.name,
      status='ACTIVE'`,
   [fixture.projectId,fixture.organizationId,fixture.projectCode,fixture.projectName]
  );
 }
 await client.query('COMMIT');
 console.log('✓ seeded two disposable authenticated tenants and projects for Spatial persistence UAT');
 console.log('✓ no asset, evidence, DIR, verification or PoVI record was created');
}catch(error){
 await client.query('ROLLBACK').catch(()=>{});
 throw error;
}finally{
 await client.end().catch(()=>{});
}
