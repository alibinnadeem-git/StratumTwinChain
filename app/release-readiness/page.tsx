import Link from 'next/link';
import {query} from '@/lib/server/db';
import {DATABASE_READINESS_SQL,REQUIRED_DATABASE_TABLES,summarizeDatabaseReadiness,type DatabaseReadiness} from '@/lib/server/database-readiness';
import {resolveAuthRuntime,resolveDatabaseRuntime} from '@/lib/server/runtime-config';
import {probeDirRpc} from '@/lib/server/chain';

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
 const dirRpc=await probeDirRpc();
 const chainReady=dirRpc.configured&&dirRpc.reachable&&dirRpc.connected&&dirRpc.engineReady&&dirRpc.activeValidatorCount===3&&dirRpc.requiredQuorum===3;
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
   <div className="section-head"><div><div className="eyebrow">Release review agents</div><h2>Product · Design · UI/UX · Security · QA</h2></div><span className="verified">CI ENFORCED</span></div>
   <div className="simple-kpis">
    <div><span>Product</span><strong style={{fontSize:14}}>Task flow</strong></div>
    <div><span>Design</span><strong style={{fontSize:14}}>Hierarchy</strong></div>
    <div><span>UI / UX</span><strong style={{fontSize:14}}>Simplicity</strong></div>
    <div><span>Security</span><strong style={{fontSize:14}}>Fail closed</strong></div>
   </div>
   <div className="simple-kpis" style={{marginTop:9}}>
    <div><span>QA</span><strong style={{fontSize:14}}>Browser matrix</strong></div>
    <div><span>Recovery</span><strong style={{fontSize:14}}>Model persistence</strong></div>
    <div><span>Truth boundary</span><strong style={{fontSize:14}}>No silent promotion</strong></div>
    <div><span>Release</span><strong style={{fontSize:14}}>Merge blocked on failure</strong></div>
   </div>
   <p className="muted">These are explicit automated release gates in CI. They do not claim independent human judgment; they make each review responsibility auditable and block merges when its checks fail.</p>
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
    <div><span>DIR RPC</span><strong>{!dirRpc.configured?'NOT BOUND':dirRpc.reachable?'REACHABLE':'UNREACHABLE'}</strong></div>
    <div><span>PoVI engine</span><strong>{dirRpc.engineReady?'READY':'NOT READY'}</strong></div>
    <div><span>Validator quorum</span><strong>{dirRpc.activeValidatorCount??'—'} validators · {dirRpc.requiredQuorum??'—'} required</strong></div>
    <div><span>DIR height</span><strong>{dirRpc.height??'—'}</strong></div>
   </div>
   {!runtimeReady&&<div className="notice" style={{marginTop:14}}><strong>RELEASE BLOCKER</strong><span>Complete the canonical database schema and connect a reachable Validator A PoVI RPC reporting three active validators with a three-signature quorum. STRATUM intentionally fails closed instead of inventing a tenant session or using reference data as live production state.</span></div>}
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
