import {query} from '@/lib/server/db';
import {DATABASE_READINESS_SQL,REQUIRED_DATABASE_TABLES,summarizeDatabaseReadiness,type DatabaseReadiness} from '@/lib/server/database-readiness';

type ReadinessProbeStatus='UNCONFIGURED'|'READY'|'INCOMPLETE_SCHEMA'|'UNREACHABLE';

export async function GET(){
 const databaseConfigured=Boolean(process.env.DATABASE_URL);
 const authConfigured=Boolean(process.env.AUTH_SECRET&&process.env.AUTH_SECRET.length>=32);
 let databaseReachable=false;
 let probeStatus:ReadinessProbeStatus=databaseConfigured?'UNREACHABLE':'UNCONFIGURED';
 let schema:DatabaseReadiness|null=null;
 if(databaseConfigured){
  try{
   const result=await query<{table_name:string}>(DATABASE_READINESS_SQL,[REQUIRED_DATABASE_TABLES]);
   databaseReachable=true;
   schema=summarizeDatabaseReadiness(result.rows.map(row=>row.table_name));
   probeStatus=schema.fullSchemaReady?'READY':'INCOMPLETE_SCHEMA';
  }catch{
   databaseReachable=false;
   probeStatus='UNREACHABLE';
  }
 }
 const liveDataReady=authConfigured&&databaseReachable&&Boolean(schema?.coreReady&&schema.lifecycleReady);
 const mode=!databaseConfigured&&!authConfigured?'REFERENCE':liveDataReady?'LIVE_READY':'LIVE_INCOMPLETE';
 return Response.json({
  ok:true,
  service:'stratum-verified',
  network:process.env.STRATUM_CHAIN_ID||'stratum-devnet-1',
  ledgerAdapter:process.env.STRATUM_CHAIN_RPC_URL?'stratum-rpc':'deterministic-devnet',
  mode,
  liveDataReady,
  databaseConfigured,
  databaseReachable,
  databaseProbeStatus:probeStatus,
  authConfigured,
  schema,
  truthBoundary:'HEALTH_READINESS_NEVER_ESTABLISHES_VERIFIED_STATE_OR_POVI_FINALITY',
 });
}
