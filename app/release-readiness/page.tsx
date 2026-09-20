import Link from 'next/link';
import {query} from '@/lib/server/db';
import {DATABASE_READINESS_SQL,REQUIRED_DATABASE_TABLES,summarizeDatabaseReadiness,type DatabaseReadiness} from '@/lib/server/database-readiness';
import {resolveAuthRuntime,resolveDatabaseRuntime} from '@/lib/server/runtime-config';
import {dirRpcConfigured} from '@/lib/server/chain';

export const dynamic='force-dynamic';

type ProbeStatus='UNCONFIGURED'|'READY'|'INCOMPLETE_SCHEMA'|'UNREACHABLE';

function statusClass(ok:boolean){return ok?'verified':'pending'}

export default async function ReleaseReadinessPage(){
 const databaseRuntime=resolveDatabaseRuntime();
 const authRuntime=resolveAuthRuntime();
 let databaseReachable=false;
 let databaseProbeStatus:ProbeStatus=databaseRuntime?'UNREACHABLE':'UNCONFIGURED';
 let schema:DatabaseReadiness|null=null;

 if(databaseRuntime){
  try{
   const result=await query<{table_name:string}>(DATABASE_READINESS_SQL,[REQUIRED_DATABASE_TABLES]);
   databaseReachable=true;
   schema=summarizeDatabaseReadiness(result.rows.map(row=>row.table_name));
   databaseProbeStatus=schema.fullSchemaReady?'READY':'INCOMPLETE_SCHEMA';
  }catch{
   databaseProbeStatus='UNREACHABLE';
  }
 }

 const databaseReady=Boolean(databaseRuntime&&databaseReachable&&schema?.coreReady&&schema?.lifecycleReady&&schema?.dirRuntimeReady);
 const authReady=Boolean(authRuntime);
 const chainReady=dirRpcConfigured();
 const runtimeReady=databaseReady&&authReady&&chainReady;
 const release=process.env.VERCEL_GIT_COMMIT_SHA||'local';
 const releaseShort=release==='local'?release:release.slice(0,12);

 return <>
  <div className="page-head"><div><div className="eyebrow">Release control</div><h1 className="title">Release readiness</h1><p className="subtitle">A truthful production checklist for runtime connectivity and the remaining physical-device acceptance gate.</p></div><div className="badge">{runtimeReady?'LIVE RUNTIME READY':'ACCEPTANCE OPEN'}</div></div>

  <section className="card">
   <div className="section-head"><div><div className="eyebrow">Current release</div><h2 className="mono">{releaseShort}</h2></div><span className="verified">DEPLOYED</span></div>
   <p className="muted">This page reports software/runtime readiness only. It does not create Verified infrastructure state, approve evidence, finalize a DIR, or establish PoVI finality.</p>
  </section>

  <section className="card" style={{marginTop:16}}>
   <div className="section-head"><div><div className="eyebrow">Production runtime</div><h2>Database and authentication</h2></div><span className={statusClass(runtimeReady)}>{runtimeReady?'READY':'BLOCKED'}</span></div>
   <div className="spec-grid">
    <div><span>Database binding</span><strong>{databaseRuntime?'CONFIGURED':'NOT BOUND'}</strong></div>
    <div><span>Connection source</span><strong>{databaseRuntime?.source||'—'}</strong></div>
    <div><span>Target database</span><strong>{databaseRuntime?.targetDatabase||'—'}</strong></div>
    <div><span>Database probe</span><strong>{databaseProbeStatus}</strong></div>
    <div><span>Core schema</span><strong>{schema?.coreReady?'READY':databaseRuntime?'NOT READY':'—'}</strong></div>
    <div><span>Lifecycle schema</span><strong>{schema?.lifecycleReady?'READY':databaseRuntime?'NOT READY':'—'}</strong></div>
    <div><span>Spatial persistence</span><strong>{schema?.spatialPersistenceReady?'READY':databaseRuntime?'NOT READY':'—'}</strong></div>
    <div><span>DIR / PoVI runtime</span><strong>{schema?.dirRuntimeReady?'READY':databaseRuntime?'NOT READY':'—'}</strong></div>
    <div><span>Authentication</span><strong>{authReady?'READY':'NOT BOUND'}</strong></div>
    <div><span>DIR RPC</span><strong>{chainReady?'CONNECTED':'NOT BOUND'}</strong></div>
   </div>
   {!runtimeReady&&<div className="notice" style={{marginTop:14}}><strong>RELEASE BLOCKER</strong><span>Bind the canonical production database and complete every required schema capability, including the DIR/PoVI runtime. STRATUM intentionally fails closed instead of inventing a tenant session or using reference data as live production state.</span></div>}
  </section>

  <section className="card" style={{marginTop:16}}>
   <div className="section-head"><div><div className="eyebrow">Physical-device gate</div><h2>WebGL · QR decoder · camera</h2></div><span className="pending">REAL DEVICE REQUIRED</span></div>
   <p className="muted">Automated desktop/tablet/mobile browser UAT is not a substitute for the real camera and GPU/browser stack on the accepted phone or tablet.</p>
   <div className="button-row">
    <Link className="action" href="/release-uat">Run physical-device UAT</Link>
    <Link className="ghost" href="/spatial">Open Spatial workspace</Link>
   </div>
  </section>
 </>;
}
