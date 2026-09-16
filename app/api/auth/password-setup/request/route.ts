import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {readSession} from '@/lib/server/auth';
import {tx} from '@/lib/server/db';

const TOKEN_TTL_MINUTES=30;

function sameSecret(provided:string,expected:string){
 const a=Buffer.from(provided);
 const b=Buffer.from(expected);
 return a.length===b.length&&timingSafeEqual(a,b);
}

function hashToken(token:string){return createHash('sha256').update(token).digest('hex')}

export async function POST(req:NextRequest){
 try{
  const body=await req.json().catch(()=>({}));
  const email=String(body.email||'').trim().toLowerCase();
  if(!email||email.length>320)return NextResponse.json({error:'A valid account email is required'},{status:400});

  const session=await readSession();
  const bootstrapSecret=process.env.STRATUM_AUTH_BOOTSTRAP_SECRET||'';
  const bootstrapEmail=(process.env.STRATUM_AUTH_BOOTSTRAP_EMAIL||'').trim().toLowerCase();
  const bootstrapOrganizationId=(process.env.STRATUM_AUTH_BOOTSTRAP_ORGANIZATION_ID||'').trim();
  const providedSecret=req.headers.get('x-stratum-bootstrap-secret')||'';

  const result=await tx(async client=>{
   const passwordedAdmin=await client.query<{exists:boolean}>(`
     SELECT EXISTS(
       SELECT 1 FROM users u
       JOIN memberships m ON m.user_id=u.id
       WHERE u.is_active=true AND u.password_hash IS NOT NULL AND m.role='SUPER_ADMIN'
     ) AS exists
   `);
   const bootstrapOpen=!passwordedAdmin.rows[0]?.exists;
   const authenticatedAdmin=session?.role==='SUPER_ADMIN';

   if(!authenticatedAdmin){
    if(!bootstrapOpen)throw Object.assign(new Error('First-user bootstrap is closed'),{status:403});
    if(!bootstrapSecret||!providedSecret||!sameSecret(providedSecret,bootstrapSecret))throw Object.assign(new Error('Bootstrap authorization required'),{status:403});
    if(!bootstrapEmail||!bootstrapOrganizationId)throw Object.assign(new Error('Bootstrap account and organization are not configured'),{status:503});
    if(email!==bootstrapEmail)throw Object.assign(new Error('Bootstrap account is not authorized'),{status:403});

    const organization=await client.query<{id:string}>(`SELECT id FROM organizations WHERE id=$1 LIMIT 1`,[bootstrapOrganizationId]);
    if(!organization.rows[0])throw Object.assign(new Error('Configured bootstrap organization does not exist'),{status:503});

    const existing=await client.query<{id:string;is_active:boolean}>(`
      SELECT id,is_active FROM users WHERE lower(email::text)=lower($1) LIMIT 1
    `,[email]);
    let bootstrapUser=existing.rows[0];
    if(!bootstrapUser){
     const created=await client.query<{id:string;is_active:boolean}>(`
       INSERT INTO users(email,is_active) VALUES($1,true) RETURNING id,is_active
     `,[email]);
     bootstrapUser=created.rows[0];
    }
    if(!bootstrapUser?.is_active)throw Object.assign(new Error('Eligible account not found'),{status:404});

    await client.query(`
      INSERT INTO memberships(organization_id,user_id,role)
      VALUES($1,$2,'SUPER_ADMIN')
      ON CONFLICT (organization_id,user_id) DO UPDATE SET role='SUPER_ADMIN'
    `,[bootstrapOrganizationId,bootstrapUser.id]);
   }

   const target=authenticatedAdmin
    ? await client.query<{id:string;organization_id:string;role:string;password_hash:string|null;is_active:boolean}>(`
       SELECT u.id,m.organization_id,m.role,u.password_hash,u.is_active
       FROM users u JOIN memberships m ON m.user_id=u.id
       WHERE lower(u.email::text)=lower($1) AND m.organization_id=$2
       LIMIT 1
      `,[email,session!.organizationId])
    : await client.query<{id:string;organization_id:string;role:string;password_hash:string|null;is_active:boolean}>(`
       SELECT u.id,m.organization_id,m.role,u.password_hash,u.is_active
       FROM users u JOIN memberships m ON m.user_id=u.id
       WHERE lower(u.email::text)=lower($1) AND m.organization_id=$2 AND m.role='SUPER_ADMIN'
       LIMIT 1
      `,[email,bootstrapOrganizationId]);
   const user=target.rows[0];
   if(!user||!user.is_active)throw Object.assign(new Error('Eligible account not found'),{status:404});
   if(user.password_hash)throw Object.assign(new Error('Account is already provisioned'),{status:409});

   if(authenticatedAdmin&&session!.organizationId!==user.organization_id){
    throw Object.assign(new Error('Cross-organization provisioning is not allowed'),{status:403});
   }
   if(!authenticatedAdmin&&user.role!=='SUPER_ADMIN'){
    throw Object.assign(new Error('Bootstrap may provision only the initial SUPER_ADMIN'),{status:403});
   }

   const token=randomBytes(32).toString('base64url');
   const tokenHash=hashToken(token);
   await client.query(`UPDATE user_password_setup_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL`,[user.id]);
   await client.query(`
     INSERT INTO user_password_setup_tokens(user_id,token_hash,expires_at,created_by_user_id,created_via)
     VALUES($1,$2,now()+($3::text||' minutes')::interval,$4,$5)
   `,[user.id,tokenHash,TOKEN_TTL_MINUTES,authenticatedAdmin?session!.userId:null,authenticatedAdmin?'SUPER_ADMIN':'BOOTSTRAP']);
   return{token,createdVia:authenticatedAdmin?'SUPER_ADMIN':'BOOTSTRAP'};
  });

  return NextResponse.json({
   token:result.token,
   setupUrl:`/set-password?token=${encodeURIComponent(result.token)}`,
   expiresInMinutes:TOKEN_TTL_MINUTES,
   createdVia:result.createdVia,
   note:'Treat this one-time token as a credential. It is returned once and only its SHA-256 hash is stored.'
  },{headers:{'cache-control':'no-store'}});
 }catch(error){
  const e=error as Error&{status?:number};
  return NextResponse.json({error:e.message||'Unable to create setup token'},{status:e.status||500,headers:{'cache-control':'no-store'}});
 }
}
