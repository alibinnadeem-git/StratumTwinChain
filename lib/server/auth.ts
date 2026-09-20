import {cookies} from 'next/headers';
import {SignJWT,jwtVerify} from 'jose';
import {query} from './db';
import {resolveAuthRuntime} from './runtime-config';

export type SessionRole='SUPER_ADMIN'|'ORG_ADMIN'|'PROJECT_MANAGER'|'TECHNICIAN'|'CLIENT'|'INSPECTOR'|'VIEWER';
export type Session={userId:string;email:string;organizationId:string;role:SessionRole};
type SessionClaims=Session&{sessionVersion:number};

const COOKIE='stratum_session';

function key(){
 const runtime=resolveAuthRuntime();
 if(!runtime)throw new Error('No supported session signing secret is configured');
 return runtime.key;
}

async function canonicalSession(userId:string,organizationId:string){
 const result=await query<{email:string;session_version:number;role:SessionRole}>(`
   SELECT u.email,u.session_version,m.role
   FROM users u
   JOIN memberships m ON m.user_id=u.id
   WHERE u.id=$1
     AND m.organization_id=$2
     AND u.is_active=true
   LIMIT 1
 `,[userId,organizationId]);
 return result.rows[0]||null;
}

export async function createSession(session:Session){
 const current=await canonicalSession(session.userId,session.organizationId);
 if(!current)throw Object.assign(new Error('Unauthorized'),{status:401});
 const claims:SessionClaims={
  userId:session.userId,
  email:current.email,
  organizationId:session.organizationId,
  role:current.role,
  sessionVersion:current.session_version,
 };
 return new SignJWT(claims)
  .setProtectedHeader({alg:'HS256'})
  .setIssuedAt()
  .setExpirationTime('12h')
  .sign(key());
}

export async function readSession():Promise<Session|null>{
 try{
  const token=(await cookies()).get(COOKIE)?.value;
  if(!token)return null;
  const {payload}=await jwtVerify(token,key());
  const userId=typeof payload.userId==='string'?payload.userId:'';
  const organizationId=typeof payload.organizationId==='string'?payload.organizationId:'';
  const sessionVersion=typeof payload.sessionVersion==='number'?payload.sessionVersion:Number.NaN;
  if(!userId||!organizationId||!Number.isInteger(sessionVersion))return null;

  const current=await canonicalSession(userId,organizationId);
  if(!current||current.session_version!==sessionVersion)return null;
  return{
   userId,
   email:current.email,
   organizationId,
   role:current.role,
  };
 }catch{
  return null;
 }
}

export async function requireSession(roles?:SessionRole[]){
 const session=await readSession();
 if(!session)throw Object.assign(new Error('Unauthorized'),{status:401});
 if(roles&&!roles.includes(session.role))throw Object.assign(new Error('Forbidden'),{status:403});
 return session;
}

export async function authenticate(email:string,password:string){
 const result=await query<{id:string;email:string;password_ok:boolean;organization_id:string;role:SessionRole}>(`
   SELECT u.id,u.email,
          (u.password_hash IS NOT NULL AND u.password_hash=crypt($2,u.password_hash)) AS password_ok,
          m.organization_id,m.role
   FROM users u
   JOIN memberships m ON m.user_id=u.id
   WHERE lower(u.email::text)=lower($1)
     AND u.is_active=true
   LIMIT 1
 `,[email,password]);
 const user=result.rows[0];
 if(!user?.password_ok)return null;
 await query(`UPDATE users SET last_login_at=now() WHERE id=$1`,[user.id]);
 return{
  userId:user.id,
  email:user.email,
  organizationId:user.organization_id,
  role:user.role,
 } satisfies Session;
}

export async function setSessionCookie(token:string){
 (await cookies()).set(COOKIE,token,{
  httpOnly:true,
  secure:process.env.NODE_ENV==='production',
  sameSite:'lax',
  path:'/',
  maxAge:60*60*12,
 });
}

export async function clearSessionCookie(){
 (await cookies()).set(COOKIE,'',{
  httpOnly:true,
  secure:process.env.NODE_ENV==='production',
  sameSite:'lax',
  path:'/',
  maxAge:0,
 });
}
