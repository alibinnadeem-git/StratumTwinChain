import {Pool,PoolClient,QueryResultRow} from 'pg';
import {resolveDatabaseRuntime} from './runtime-config';

let pool:Pool|undefined;
let poolUrl:string|undefined;

export function db(){
 const runtime=resolveDatabaseRuntime();
 if(!runtime)throw new Error('No supported database connection secret is configured');
 if(!pool||poolUrl!==runtime.url){
  if(pool)void pool.end().catch(()=>{});
  pool=new Pool({
   connectionString:runtime.url,
   ssl:process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:undefined,
   max:process.env.NODE_ENV==='production'?2:10,
  });
  poolUrl=runtime.url;
 }
 return pool;
}
export async function query<T extends QueryResultRow=QueryResultRow>(text:string,values:unknown[]=[]){return db().query<T>(text,values)}
export async function tx<T>(fn:(client:PoolClient)=>Promise<T>){
 const c=await db().connect();
 try{await c.query('BEGIN');const out=await fn(c);await c.query('COMMIT');return out}
 catch(e){await c.query('ROLLBACK');throw e}
 finally{c.release()}
}
