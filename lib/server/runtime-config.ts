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

export type DatabaseRuntimeConfig={
 url:string;
 source:(typeof DATABASE_KEYS)[number];
 targetDatabase:string|null;
 retargeted:boolean;
};

function targetDatabaseName(){
 const configured=(process.env.STRATUM_DATABASE_NAME||'').trim();
 return configured||'stratum_spatial_verified';
}

export function resolveDatabaseRuntime():DatabaseRuntimeConfig|null{
 for(const source of DATABASE_KEYS){
  const value=(process.env[source]||'').trim();
  if(!value)continue;
  if(source==='DATABASE_URL'){
   let database:string|null=null;
   try{database=decodeURIComponent(new URL(value).pathname.replace(/^\//,''))||null}catch{}
   return{url:value,source,targetDatabase:database,retargeted:false};
  }
  try{
   const parsed=new URL(value);
   const target=targetDatabaseName();
   if(/^postgres(?:ql)?:$/i.test(parsed.protocol)&&/\.neon\.tech$/i.test(parsed.hostname)){
    parsed.pathname=`/${encodeURIComponent(target)}`;
    return{url:parsed.toString(),source,targetDatabase:target,retargeted:true};
   }
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
  const value=(process.env[source]||'').trim();
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
