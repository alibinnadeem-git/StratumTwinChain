import {createHash,randomBytes} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {requireSession,type SessionRole} from '@/lib/server/auth';
import {tx} from '@/lib/server/db';

const TOKEN_TTL_MINUTES=30;
const ALLOWED_ROLES=['ORG_ADMIN','PROJECT_MANAGER','TECHNICIAN','INSPECTOR','CLIENT','VIEWER'] as const satisfies readonly SessionRole[];
type ProvisionableRole=(typeof ALLOWED_ROLES)[number];

function hashToken(token:string){return createHash('sha256').update(token).digest('hex')}
function isProvisionableRole(value:string):value is ProvisionableRole{return (ALLOWED_ROLES as readonly string[]).includes(value)}

export async function POST(req:NextRequest){
 try{
  const session=await requireSession(['SUPER_ADMIN']);
  const body=await req.json().catch(()=>({}));
  const email=String(body.email||'').trim().toLowerCase();
  const displayName=String(body.displayName||'').trim();
  const role=String(body.role||'');

  if(!/^\S+@\S+\.\S+$/.test(email)||email.length>320)return NextResponse.json({error:'A valid account email is required'},{status:400});
  if(displayName.length>160)return NextResponse.json({error:'Display name is too long'},{status:400});
  if(!isProvisionableRole(role))return NextResponse.json({error:'Role is not eligible for tenant provisioning'},{status:400});

  const result=await tx(async client=>{
   const organization=await client.query<{id:string;name:string}>(`SELECT id,name FROM organizations WHERE id=$1 LIMIT 1`,[session.organizationId]);
   if(!organization.rows[0])throw Object.assign(new Error('Session organization is unavailable'),{status:403});

   const existing=await client.query<{id:string;email:string;display_name:string|null;password_hash:string|null;is_active:boolean}>(`
     SELECT id,email::text AS email,display_name,password_hash,is_active
     FROM users
     WHERE lower(email::text)=lower($1)
     LIMIT 1
     FOR UPDATE
   `,[email]);
   let user=existing.rows[0];

   if(user&&!user.is_active)throw Object.assign(new Error('Existing account is inactive'),{status:409});
   if(user){
    const memberships=await client.query<{organization_id:string;role:SessionRole}>(`
      SELECT organization_id,role FROM memberships WHERE user_id=$1 ORDER BY organization_id
    `,[user.id]);
    const crossOrganization=memberships.rows.find(m=>m.organization_id!==session.organizationId);
    if(crossOrganization)throw Object.assign(new Error('Multi-organization account provisioning is not supported until organization selection is implemented'),{status:409});
    const current=memberships.rows.find(m=>m.organization_id===session.organizationId);
    if(current&&current.role!==role)throw Object.assign(new Error('Existing membership role changes require the explicit role-management workflow'),{status:409});
    if(user.password_hash)throw Object.assign(new Error('Account is already provisioned; no setup credential was issued'),{status:409});
    if(displayName&&displayName!==user.display_name){
     await client.query(`UPDATE users SET display_name=$2 WHERE id=$1`,[user.id,displayName]);
    }
   }else{
    const created=await client.query<{id:string;email:string;display_name:string|null;password_hash:string|null;is_active:boolean}>(`
      INSERT INTO users(email,display_name,is_active)
      VALUES($1,$2,true)
      RETURNING id,email::text AS email,display_name,password_hash,is_active
    `,[email,displayName||null]);
    user=created.rows[0];
   }

   const membership=await client.query<{role:SessionRole}>(`
     SELECT role FROM memberships WHERE organization_id=$1 AND user_id=$2 LIMIT 1
   `,[session.organizationId,user.id]);
   if(!membership.rows[0]){
    await client.query(`INSERT INTO memberships(organization_id,user_id,role) VALUES($1,$2,$3)`,[session.organizationId,user.id,role]);
   }

   const token=randomBytes(32).toString('base64url');
   const tokenHash=hashToken(token);
   await client.query(`UPDATE user_password_setup_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL`,[user.id]);
   await client.query(`
     INSERT INTO user_password_setup_tokens(user_id,token_hash,expires_at,created_by_user_id,created_via)
     VALUES($1,$2,now()+($3::text||' minutes')::interval,$4,'SUPER_ADMIN')
   `,[user.id,tokenHash,TOKEN_TTL_MINUTES,session.userId]);

   return{token,email:user.email,role,organizationName:organization.rows[0].name};
  });

  return NextResponse.json({
   email:result.email,
   role:result.role,
   organizationName:result.organizationName,
   setupUrl:`/set-password?token=${encodeURIComponent(result.token)}`,
   token:result.token,
   expiresInMinutes:TOKEN_TTL_MINUTES,
   note:'This one-time setup credential is returned once. Only its SHA-256 hash is stored. It grants account setup only and no infrastructure truth authority.'
  },{status:201,headers:{'cache-control':'no-store'}});
 }catch(error){
  const e=error as Error&{status?:number};
  return NextResponse.json({error:e.message||'Unable to provision tenant member'},{status:e.status||500,headers:{'cache-control':'no-store'}});
 }
}
