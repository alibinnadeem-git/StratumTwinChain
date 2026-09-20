import {createHash,randomBytes} from 'node:crypto';
import pg from 'pg';

const {Client}=pg;
const apply=process.argv.includes('--apply');
const TOKEN_TTL_MINUTES=30;
const organizationId=(process.env.STRATUM_AUTH_BOOTSTRAP_ORGANIZATION_ID||'').trim();
const email=(process.env.STRATUM_BOOTSTRAP_SUPER_ADMIN_EMAIL||'').trim().toLowerCase();
const displayName=(process.env.STRATUM_BOOTSTRAP_SUPER_ADMIN_DISPLAY_NAME||'').trim();
const publicOrigin=(process.env.STRATUM_PUBLIC_ORIGIN||'').trim().replace(/\/$/,'');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function hashToken(token){return createHash('sha256').update(token).digest('hex')}

if(!uuid.test(organizationId)){
  throw new Error('STRATUM_AUTH_BOOTSTRAP_ORGANIZATION_ID must be a valid UUID');
}
if(!/^\S+@\S+\.\S+$/.test(email)||email.length>320){
  throw new Error('STRATUM_BOOTSTRAP_SUPER_ADMIN_EMAIL must be a valid email address');
}
if(displayName.length>160){
  throw new Error('STRATUM_BOOTSTRAP_SUPER_ADMIN_DISPLAY_NAME must be 160 characters or fewer');
}

if(!apply){
  console.log('STRATUM first SUPER_ADMIN bootstrap plan');
  console.log(`- organization id: ${organizationId}`);
  console.log(`- account email: ${email}`);
  console.log(`- display name: ${displayName||'(not set)'}`);
  console.log('- role: SUPER_ADMIN');
  console.log(`- setup credential lifetime: ${TOKEN_TTL_MINUTES} minutes`);
  console.log('- password: not accepted by this command; user configures it through the one-time setup link');
  console.log('- infrastructure truth: no asset, evidence, DIR, verification or PoVI state will be created');
  console.log('\nPlan only. Re-run with --apply and DATABASE_URL to create or resume the first administrator setup.');
  process.exit(0);
}

const databaseUrl=(process.env.DATABASE_URL||'').trim();
if(!databaseUrl)throw new Error('DATABASE_URL is required when --apply is used');

const client=new Client({
  connectionString:databaseUrl,
  ssl:/sslmode=(require|verify-ca|verify-full)/i.test(databaseUrl)?{rejectUnauthorized:false}:undefined,
});

let setupToken=null;
let setupEmail=email;
let alreadyProvisioned=false;

try{
  await client.connect();
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['stratum-first-super-admin-bootstrap-v1']);

  const organization=await client.query(
    'SELECT id::text,name FROM organizations WHERE id=$1 FOR UPDATE',
    [organizationId]
  );
  if(!organization.rows[0]){
    throw new Error('Bootstrap organization does not exist. Run db:bootstrap-organization first.');
  }

  const existingAdmins=await client.query(`
    SELECT u.id::text,u.email::text,u.password_hash
    FROM memberships m
    JOIN users u ON u.id=m.user_id
    WHERE m.organization_id=$1
      AND m.role='SUPER_ADMIN'
    ORDER BY u.created_at
    FOR UPDATE OF u,m
  `,[organizationId]);

  if(existingAdmins.rows.length>1){
    throw new Error('Multiple SUPER_ADMIN memberships already exist; first-admin bootstrap is no longer eligible.');
  }
  if(existingAdmins.rows.length===1){
    const current=existingAdmins.rows[0];
    if(String(current.email).toLowerCase()!==email){
      throw new Error('A different SUPER_ADMIN already exists; first-admin bootstrap is no longer eligible.');
    }
    if(current.password_hash){
      alreadyProvisioned=true;
      setupEmail=String(current.email);
      await client.query('COMMIT');
    }else{
      const token=randomBytes(32).toString('base64url');
      await client.query(
        'UPDATE user_password_setup_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL',
        [current.id]
      );
      await client.query(`
        INSERT INTO user_password_setup_tokens(
          user_id,token_hash,expires_at,created_by_user_id,created_via
        )
        VALUES($1,$2,now()+($3::text||' minutes')::interval,NULL,'BOOTSTRAP')
      `,[current.id,hashToken(token),TOKEN_TTL_MINUTES]);
      setupToken=token;
      setupEmail=String(current.email);
      await client.query('COMMIT');
    }
  }else{
    const existingUser=await client.query(`
      SELECT id::text,email::text,display_name,password_hash,is_active
      FROM users
      WHERE lower(email::text)=lower($1)
      LIMIT 1
      FOR UPDATE
    `,[email]);
    let user=existingUser.rows[0];

    if(user&&!user.is_active)throw new Error('Existing account is inactive and cannot be promoted by bootstrap.');

    if(user){
      const memberships=await client.query(
        'SELECT organization_id::text,role FROM memberships WHERE user_id=$1 ORDER BY organization_id',
        [user.id]
      );
      if(memberships.rows.length){
        throw new Error('Existing account already has a membership; first-admin bootstrap will not change or elevate an existing role.');
      }
      if(user.password_hash){
        throw new Error('Existing account already has a password; first-admin bootstrap will not repurpose a provisioned identity.');
      }
      if(displayName&&displayName!==user.display_name){
        await client.query('UPDATE users SET display_name=$2 WHERE id=$1',[user.id,displayName]);
      }
    }else{
      const created=await client.query(`
        INSERT INTO users(email,display_name,is_active)
        VALUES($1,$2,true)
        RETURNING id::text,email::text,display_name,password_hash,is_active
      `,[email,displayName||null]);
      user=created.rows[0];
    }

    await client.query(
      "INSERT INTO memberships(organization_id,user_id,role) VALUES($1,$2,'SUPER_ADMIN')",
      [organizationId,user.id]
    );

    const token=randomBytes(32).toString('base64url');
    await client.query(
      'UPDATE user_password_setup_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL',
      [user.id]
    );
    await client.query(`
      INSERT INTO user_password_setup_tokens(
        user_id,token_hash,expires_at,created_by_user_id,created_via
      )
      VALUES($1,$2,now()+($3::text||' minutes')::interval,NULL,'BOOTSTRAP')
    `,[user.id,hashToken(token),TOKEN_TTL_MINUTES]);
    setupToken=token;
    setupEmail=String(user.email);
    await client.query('COMMIT');
  }
}catch(error){
  await client.query('ROLLBACK').catch(()=>{});
  throw error;
}finally{
  await client.end().catch(()=>{});
}

if(alreadyProvisioned){
  console.log(`✓ first SUPER_ADMIN is already provisioned: ${setupEmail}`);
  console.log('No credential was issued and no database state was changed.');
  process.exit(0);
}

if(!setupToken)throw new Error('SUPER_ADMIN bootstrap completed without a setup credential');
const relative=`/set-password?token=${encodeURIComponent(setupToken)}`;
const setupUrl=publicOrigin?`${publicOrigin}${relative}`:relative;
console.log(`✓ first SUPER_ADMIN account is ready for one-time setup: ${setupEmail}`);
console.log(`✓ setup credential expires in ${TOKEN_TTL_MINUTES} minutes`);
console.log('\nONE-TIME SETUP LINK');
console.log(setupUrl);
console.log('\nTreat this link as a credential. Only its SHA-256 hash is stored. No password, infrastructure evidence, DIR or PoVI authority was created by this bootstrap.');
