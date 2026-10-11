import {resolveDatabaseRuntime} from './runtime-config';
/**
 * Executed by the preview-only demo entrypoint before rendering.
 * DB-backed seeding is forbidden, including when preview shares production secrets.
 * With no configured production host comparison, the only permissible mode is memory-only.
 */
export function assertDemoReadOnlyStartup(env:NodeJS.ProcessEnv):void{
 if(env.VERCEL_ENV!=='preview')throw Error('DEMO module cannot start outside a preview deployment');
 if(env.STRATUM_DEMO_ENABLE_DB_SEED==='true'||env.STRATUM_DEMO_PERSISTENCE==='true')
  throw Error('DEMO database writes are never permitted');
 const db=resolveDatabaseRuntime();
 if(db){
  let host:string;
  try{host=new URL(db.url).hostname.toLowerCase()}catch{throw Error('DEMO database host cannot be inspected safely')}
  const prodHost=(env.STRATUM_PRODUCTION_DATABASE_HOST||'').trim().toLowerCase();
  // A DB seeder must fail closed unless the prod hostname is known and demonstrably different.
  assertSafeDemoSeederDatabaseHost(host,prodHost);
 }
}
export function assertSafeDemoSeederDatabaseHost(previewHost:string,productionHost:string):void{
 if(!previewHost||!productionHost||previewHost===productionHost)
  throw Error('DEMO seeding blocked: production DB hostname separation is unverified');
}
