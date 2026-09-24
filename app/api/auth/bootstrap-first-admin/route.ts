import {createHash,timingSafeEqual} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {tx} from '@/lib/server/db';

const BOOTSTRAP_TOKEN_SHA256='dc6c9c82027bcce2b30a3c9cd22338e43b36a40981d6faee5bc2ff5ea41ed39a';
const BOOTSTRAP_EXPIRES_AT='2026-10-01T00:00:00.000Z';
const BOOTSTRAP_ORGANIZATION='STRATUM Power';

function tokenMatches(token:string){
 const digest=createHash('sha256').update(token).digest('hex');
 const expected=Buffer.from(BOOTSTRAP_TOKEN_SHA256,'utf8');
 const actual=Buffer.from(digest,'utf8');
 return actual.length===expected.length&&timingSafeEqual(actual,expected);
}

export async function POST(req:NextRequest){
 try{
  const body=await req.json().catch(()=>({}));
  const token=String(body.token||'').trim();
  const password=String(body.password||'');
  if(token.length<40||token.length>256||!tokenMatches(token))return NextResponse.json({error:'Bootstrap credential is invalid'},{status:400,headers:{'cache-control':'no-store'}});
  if(Date.now()>=new Date(BOOTSTRAP_EXPIRES_AT).getTime())return NextResponse.json({error:'Bootstrap credential has expired'},{status:410,headers:{'cache-control':'no-store'}});
  if(password.length<12||password.length>128)return NextResponse.json({error:'Password must be between 12 and 128 characters'},{status:400,headers:{'cache-control':'no-store'}});

  await tx(async client=>{
   const rows=await client.query<{id:string;password_hash:string|null;is_active:boolean;organization_name:string}>(`
     SELECT u.id::text,u.password_hash,u.is_active,o.name organization_name
     FROM users u
     JOIN memberships m ON m.user_id=u.id
     JOIN organizations o ON o.id=m.organization_id
     WHERE m.role='SUPER_ADMIN'
     FOR UPDATE OF u
   `);
   if(rows.rows.length!==1)throw Object.assign(new Error('Bootstrap requires exactly one SUPER_ADMIN identity'),{status:409});
   const admin=rows.rows[0];
   if(!admin.is_active)throw Object.assign(new Error('SUPER_ADMIN account is inactive'),{status:403});
   if(admin.organization_name!==BOOTSTRAP_ORGANIZATION)throw Object.assign(new Error('SUPER_ADMIN tenant does not match the bootstrap tenant'),{status:409});
   if(admin.password_hash)throw Object.assign(new Error('SUPER_ADMIN account is already provisioned'),{status:409});

   await client.query(`
     UPDATE users
     SET password_hash=crypt($2,gen_salt('bf',12)),
         session_version=session_version+1,
         last_password_change_at=now()
     WHERE id=$1 AND password_hash IS NULL
   `,[admin.id,password]);
   await client.query(`UPDATE user_password_setup_tokens SET used_at=COALESCE(used_at,now()) WHERE user_id=$1`,[admin.id]);
  });

  return NextResponse.json({ok:true,message:'SUPER_ADMIN password configured. The bootstrap path is now inert because the account is provisioned.'},{headers:{'cache-control':'no-store'}});
 }catch(error){
  const e=error as Error&{status?:number};
  return NextResponse.json({error:e.message||'Unable to bootstrap SUPER_ADMIN'},{status:e.status||500,headers:{'cache-control':'no-store'}});
 }
}
