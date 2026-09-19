import pg from 'pg';

const {Client}=pg;
const apply=process.argv.includes('--apply');
const organizationId=(process.env.STRATUM_AUTH_BOOTSTRAP_ORGANIZATION_ID||'').trim();
const organizationName=(process.env.STRATUM_BOOTSTRAP_ORGANIZATION_NAME||'').trim();
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

if(!uuid.test(organizationId)){
  throw new Error('STRATUM_AUTH_BOOTSTRAP_ORGANIZATION_ID must be a valid UUID');
}
if(organizationName.length<1||organizationName.length>200){
  throw new Error('STRATUM_BOOTSTRAP_ORGANIZATION_NAME must be 1–200 characters');
}

if(!apply){
  console.log('STRATUM production organization bootstrap plan');
  console.log(`- organization id: ${organizationId}`);
  console.log(`- organization name: ${organizationName}`);
  console.log('- users/memberships: none; first SUPER_ADMIN remains governed by one-time password setup');
  console.log('\nPlan only. Re-run with --apply and DATABASE_URL to create/verify this tenant identity.');
  process.exit(0);
}

const databaseUrl=process.env.DATABASE_URL;
if(!databaseUrl)throw new Error('DATABASE_URL is required when --apply is used');

const client=new Client({
  connectionString:databaseUrl,
  ssl:/sslmode=(require|verify-ca|verify-full)/i.test(databaseUrl)?{rejectUnauthorized:false}:undefined,
});

try{
  await client.connect();
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['stratum-production-organization-bootstrap-v1']);
  const current=await client.query('SELECT id::text,name FROM organizations WHERE id=$1 FOR UPDATE',[organizationId]);
  if(current.rows[0]){
    if(String(current.rows[0].name)!==organizationName){
      throw new Error('Configured bootstrap organization ID already exists with a different name');
    }
    await client.query('COMMIT');
    console.log(`✓ production organization already exists: ${organizationId}`);
  }else{
    await client.query('INSERT INTO organizations(id,name) VALUES($1,$2)',[organizationId,organizationName]);
    await client.query('COMMIT');
    console.log(`✓ production organization created: ${organizationId}`);
  }
  console.log('No user, password, membership, asset, evidence, DIR or PoVI record was created.');
}catch(error){
  await client.query('ROLLBACK').catch(()=>{});
  throw error;
}finally{
  await client.end().catch(()=>{});
}
