import {createHmac} from 'node:crypto';

const DATABASE_KEYS=[
 'DATABASE_URL',
 'POSTGRES_URL',
 'POSTGRES_PRISMA_URL',
 'NEON_DATABASE_URL',
 'DATABASE_URL_UNPOOLED',
 'POSTGRES_URL_NON_POOLING',
] as const;

const AUTH_KEYS=['AUTH_SECRET','NEXTAUTH_SECRET','SESSION_SECRET','STRATUM_AUTH_SECRET'] as const;

type DatabaseKey=(typeof DATABASE_KEYS)[number];
type AuthKey=(typeof AUTH_KEYS)[number];

function readDatabaseEnv(source:DatabaseKey){
 switch(source){
  case 'DATABASE_URL':return process.env.DATABASE_URL;
  case 'POSTGRES_URL':return process.env.POSTGRES_URL;
  case 'POSTGRES_PRISMA_URL':return process.env.POSTGRES_PRISMA_URL;
  case 'NEON_DATABASE_URL':return process.env.NEON_DATABASE_URL;
  case 'DATABASE_URL_UNPOOLED':return process.env.DATABASE_URL_UNPOOLED;
  case 'POSTGRES_URL_NON_POOLING':return process.env.POSTGRES_URL_NON_POOLING;
 }
}

function readAuthEnv(source:AuthKey){
 switch(source){
  case 'AUTH_SECRET':return process.env.AUTH_SECRET;
  case 'NEXTAUTH_SECRET':return process.env.NEXTAUTH_SECRET;
  case 'SESSION_SECRET':return process.env.SESSION_SECRET;
  case 'STRATUM_AUTH_SECRET':return process.env.STRATUM_AUTH_SECRET;
 }
}

export type DatabaseRuntimeConfig={
 url:string;
 source:DatabaseKey;
 targetDatabase:string|null;
 retargeted:boolean;
};

function targetDatabaseName(){
 const configured=(process.env.STRATUM_DATABASE_NAME||'').trim();
 return configured||'stratum_spatial_verified';
}

export function resolveDatabaseRuntime():DatabaseRuntimeConfig|null{
 for(const source of DATABASE_KEYS){
  const value=(readDatabaseEnv(source)||'').trim();
  if(!value)continue;
  try{
   const parsed=new URL(value);
   const target=targetDatabaseName();
   const current=decodeURIComponent(parsed.pathname.replace(/^\//,''))||null;
   const neonPostgres=/^postgres(?:ql)?:$/i.test(parsed.protocol)&&/\.neon\.tech$/i.test(parsed.hostname);
   const explicitTarget=Boolean((process.env.STRATUM_DATABASE_NAME||'').trim());
   const neonDefaultDatabase=!current||current==='neondb';
   if(neonPostgres&&(source!=='DATABASE_URL'||explicitTarget||neonDefaultDatabase)){
    parsed.pathname=`/${encodeURIComponent(target)}`;
    return{url:parsed.toString(),source,targetDatabase:target,retargeted:current!==target};
   }
   if(source==='DATABASE_URL')return{url:value,source,targetDatabase:current,retargeted:false};
  }catch{}
  return{url:value,source,targetDatabase:null,retargeted:false};
 }
 return null;
}

export type AuthRuntimeConfig={
 key:Uint8Array;
 source:string;
 derived:boolean;
};

export function resolveAuthRuntime():AuthRuntimeConfig|null{
 for(const source of AUTH_KEYS){
  const value=(readAuthEnv(source)||'').trim();
  if(value.length>=32)return{key:new TextEncoder().encode(value),source,derived:false};
 }
 const database=resolveDatabaseRuntime();
 if(!database)return null;
 try{
  const parsed=new URL(database.url);
  const password=decodeURIComponent(parsed.password||'');
  if(password.length<24)return null;
  const digest=createHmac('sha256',password)
   .update('STRATUM_SPATIAL_VERIFIED_SESSION_SIGNING_V1','utf8')
   .digest();
  return{key:new Uint8Array(digest),source:`DERIVED_FROM_${database.source}`,derived:true};
 }catch{
  return null;
 }
}
