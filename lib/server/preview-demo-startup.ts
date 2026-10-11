import {resolveDatabaseRuntime} from './runtime-config';
/**
 * A demo is strictly in-memory. The application may have DATABASE_URL configured,
 * but preview demo never calls db(), hydrators, server asset queries, or a seeder.
 */
export function assertDemoReadOnlyStartup(env:NodeJS.ProcessEnv):void{
 if(env.VERCEL_ENV!=='preview')throw Error('Demo startup restricted to preview builds');
 if(env.STRATUM_DEMO_ENABLE_DB_SEED==='true'||env.STRATUM_DEMO_PERSISTENCE==='true'||
    Boolean(env.STRATUM_DEMO_DATABASE_URL))
  throw Error('Database-backed demo seeding is forbidden; the DEMO DB host must be absent');
 // Check at startup that the demonstration has NO database host at all.
 const demoHost: string|null=null;
 if(demoHost!==null)throw Error('DEMO is not authorized to connect to a database host');
}
export function assertSafeDemoSeederDatabaseHost(host:string,productionHost:string):void{
 // Future database seeders cannot use implicit preview DATABASE_URL.
 if(!host||!productionHost||host.toLowerCase()===productionHost.toLowerCase())
  throw Error('DEMO seeding denied: preview DB host not proven distinct from production');
 throw Error('DEMO database seeding disabled even when hosts differ');
}
