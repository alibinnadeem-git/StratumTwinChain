import {createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {tx} from '@/lib/server/db';

function hashToken(token:string){return createHash('sha256').update(token).digest('hex')}

export async function POST(req:NextRequest){
 try{
  const body=await req.json().catch(()=>({}));
  const token=String(body.token||'').trim();
  const password=String(body.password||'');
  if(token.length<20||token.length>256)return NextResponse.json({error:'A valid one-time setup token is required'},{status:400});
  if(password.length<12||password.length>128)return NextResponse.json({error:'Password must be between 12 and 128 characters'},{status:400});

  await tx(async client=>{
   const row=await client.query<{id:string;user_id:string;expires_at:Date;used_at:Date|null;password_hash:string|null;is_active:boolean}>(`
     SELECT t.id,t.user_id,t.expires_at,t.used_at,u.password_hash,u.is_active
     FROM user_password_setup_tokens t
     JOIN users u ON u.id=t.user_id
     WHERE t.token_hash=$1
     FOR UPDATE OF t,u
   `,[hashToken(token)]);
   const setup=row.rows[0];
   if(!setup||setup.used_at||new Date(setup.expires_at).getTime()<=Date.now())throw Object.assign(new Error('Setup token is invalid or expired'),{status:400});
   if(!setup.is_active)throw Object.assign(new Error('Account is inactive'),{status:403});
   if(setup.password_hash)throw Object.assign(new Error('Account is already provisioned'),{status:409});

   await client.query(`
     UPDATE users
     SET password_hash=crypt($2,gen_salt('bf',12)),
         session_version=session_version+1,
         last_password_change_at=now()
     WHERE id=$1
   `,[setup.user_id,password]);
   await client.query(`UPDATE user_password_setup_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL`,[setup.user_id]);
  });

  return NextResponse.json({ok:true,message:'Password configured. Sign in with your account email and new password.'},{headers:{'cache-control':'no-store'}});
 }catch(error){
  const e=error as Error&{status?:number};
  return NextResponse.json({error:e.message||'Unable to configure password'},{status:e.status||500,headers:{'cache-control':'no-store'}});
 }
}
