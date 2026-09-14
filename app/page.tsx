import Link from 'next/link';
import {assets as referenceAssets,events as referenceEvents} from '@/lib/data';
import AssetPassport from '@/components/AssetPassport';
import LiveAssetSummary from '@/components/LiveAssetSummary';
import {readSession} from '@/lib/server/auth';
import {commandCenterSnapshot,type CommandCenterActivity,type CommandCenterMetrics} from '@/lib/server/command-center';
import {liveAssets,type LiveAssetRow} from '@/lib/server/live-views';

export const dynamic='force-dynamic';

type CommandCenterMode='LIVE'|'REFERENCE_SIGNED_OUT'|'REFERENCE_UNAVAILABLE';

function stamp(value:Date|string|null|undefined){
 if(!value)return 'Time not recorded';
 return new Date(value).toLocaleString('en-US',{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
}

function LiveActivity({activity}:{activity:CommandCenterActivity}){
 const lifecycle=activity.source==='LIFECYCLE';
 const recorded=Boolean(activity.ledger_block_height);
 return <div className="event">
  <i className={`event-icon ${recorded?'verified':lifecycle?'pending':'evidence'}`}>{recorded?'✓':lifecycle?'●':'+'}</i>
  <div>
   <strong>{activity.activity_type} · {activity.asset_name}</strong>
   <small>{activity.source} · {activity.asset_code} · {activity.trust_state}{activity.actor_name?` · ${activity.actor_name}`:''} · {stamp(activity.occurred_at)}{recorded?` · DIR #${activity.ledger_block_height}`:''}</small>
  </div>
 </div>;
}

export default async function Home(){
 const session=await readSession();
 let mode:CommandCenterMode=session?'REFERENCE_UNAVAILABLE':'REFERENCE_SIGNED_OUT';
 let snapshot:{organizationId:string;metrics:CommandCenterMetrics;activities:CommandCenterActivity[]}|null=null;
 let tenantAssets:LiveAssetRow[]=[];

 if(session){
  try{
   [snapshot,tenantAssets]=await Promise.all([commandCenterSnapshot(),liveAssets()]);
   mode='LIVE';
  }catch(error){
   console.error('Live command-center data unavailable; rendering explicitly labeled reference mode.',error);
  }
 }

 const live=mode==='LIVE'&&snapshot;
 const metrics=live?snapshot.metrics:null;
 const dirLinked=metrics?.dir_linked_assets??0;
 const registered=metrics?.registered_assets??0;

 return <>
  <div className="topline"><div><div className="eyebrow">STRATUM Spatial Verified · Universal Command Center</div><h1 className="title">Know what exists. Know what happened. Know why it is trusted.</h1><div className="subtitle">STRATUM Spatial Verified is the spatial operating and trust model for physical infrastructure. It keeps source, observed state, engineering approval, evidence, DIR provenance and PoVI finality distinct while connecting them through one attributable history.</div></div><div className="badge">DIR · Micro DIR · Nano DIR</div></div>

  {mode==='REFERENCE_SIGNED_OUT'&&<section className="card" role="status" style={{marginBottom:16,borderColor:'#75592e'}}><div className="eyebrow">Reference mode · Signed out</div><h3>Reference data — not live tenant infrastructure</h3><p className="muted">The command center is showing interface reference data because no authenticated tenant session is present. Sign in to view organization-scoped STRATUM Assets, lifecycle records and evidence.</p><Link className="action" href="/login">Sign in for live tenant view</Link></section>}
  {mode==='REFERENCE_UNAVAILABLE'&&<section className="card" role="alert" style={{marginBottom:16,borderColor:'#75592e'}}><div className="eyebrow">Reference mode · Live service unavailable</div><h3>Live tenant data unavailable — reference data shown</h3><p className="muted">The authenticated tenant session remains distinct from the reference interface. No reference value below should be interpreted as current infrastructure state, Verified state or PoVI finality.</p></section>}
  {mode==='LIVE'&&<section className="card" role="status" style={{marginBottom:16}}><div className="eyebrow">Live tenant view</div><p className="muted" style={{margin:0}}>Organization-scoped registry, lifecycle and evidence data. Observed, approved, DIR-recorded and PoVI-finalized states remain distinct; no silent promotion is permitted.</p></section>}

  <section className="hero"><div className="card hero-copy"><div className="eyebrow">Spatial → Evidence → Approval → Finality</div><h2>One durable infrastructure identity across design, installation, commissioning and operations.</h2><p className="muted">The product follows the Redbook truth boundary: cryptographic integrity and provenance strengthen evidence, but they do not by themselves establish physical truth. Human and deterministic validation remain explicit.</p><div className="button-row"><Link className="action" href="/spatial">Open Spatial workspace</Link><Link className="ghost" href="/dir">Open DIR Explorer</Link></div><div className="trust-row"><span className="status-chip">{mode==='LIVE'?'TENANT SCOPED':'REFERENCE MODE'}</span><span className="status-chip">OBSERVED ≠ VERIFIED</span><span className="status-chip">DIR ≠ PHYSICAL TRUTH</span></div></div><div className="card layer-visual"><div className="layer l1"><b>Source</b><span>Documents · capture · OEM · telemetry</span></div><div className="layer l2"><b>Spatial</b><span>Site · building · room · system · asset</span></div><div className="layer l3"><b>Execution</b><span>Field work · QA/QC · commissioning</span></div><div className="layer l4"><b>Trust</b><span>Evidence · HITL · approvals · provenance</span></div><div className="layer l5"><b>PoVI</b><span>Nano DIR · Micro DIR · DIR · finality</span></div></div></section>

  <section className="card"><div className="section-head"><div><div className="eyebrow">Redbook implementation order</div><h2>Build by convergence, not replacement</h2></div></div><div className="redbook-priority-grid"><div className="card redbook-priority"><span className="implementation-chip partial">P0 · PARTIAL</span><h3>Canonical Trust Foundation</h3><p className="muted">Canonical schemas and terminology, PoVI safety, Nano DIR / Micro DIR / DIR hierarchy, validator registry and portable validator path.</p></div><div className="card redbook-priority"><span className="implementation-chip foundation">P1 · IN PROGRESS</span><h3>Platform Convergence</h3><p className="muted">STRATUM Spatial Verified, Data Room, AI Costing and JARVIS converge around shared canonical objects and trust semantics.</p></div><div className="card redbook-priority"><span className="implementation-chip planned">P2 · PLANNED</span><h3>Field / Engineering / OT</h3><p className="muted">OPC UA, edge runtime, Spatial reconstruction, power services, QA, safety, commissioning and operations.</p></div><div className="card redbook-priority"><span className="implementation-chip planned">P3 · PLANNED</span><h3>Ecosystem / Scale</h3><p className="muted">External connectors, Studio/SIR/WASM, enterprise certification and sovereign-scale validator deployments.</p></div></div></section>

  {live?<section className="grid kpis" style={{marginTop:16}}><div className="card"><div className="label">Registered identities</div><div className="metric">{registered.toLocaleString()}</div><div className="muted">STRATUM Assets in this organization</div></div><div className="card"><div className="label">DIR-linked assets</div><div className="metric">{dirLinked.toLocaleString()}</div><div className="muted">Assets with at least one lifecycle record carrying a DIR height</div></div><div className="card"><div className="label">Lifecycle records</div><div className="metric">{metrics!.lifecycle_records.toLocaleString()}</div><div className="muted">Organization-scoped lifecycle history</div></div><div className="card"><div className="label">Evidence records</div><div className="metric">{metrics!.evidence_records.toLocaleString()}</div><div className="muted">Organization-scoped evidence entries</div></div></section>:<section className="grid kpis" style={{marginTop:16}}><div className="card"><div className="label">Reference assets</div><div className="metric">{referenceAssets.length}</div><div className="muted">Interface examples only</div></div><div className="card"><div className="label">Reference DIR-linked</div><div className="metric">{referenceAssets.filter(asset=>asset.block).length}</div><div className="muted">Example record associations, not live tenant state</div></div><div className="card"><div className="label">Reference events</div><div className="metric">{referenceEvents.length}</div><div className="muted">Interface examples only</div></div><div className="card"><div className="label">Trust rule</div><div className="metric" style={{fontSize:18}}>No silent promotion</div><div className="muted">Observed, approved, recorded and finalized remain distinct</div></div></section>}

  <section className="grid two"><div><div className="section-head"><div><div className="eyebrow">Universal Asset View</div><h2>Infrastructure provenance at a glance</h2></div></div>{live?(tenantAssets[0]?<LiveAssetSummary asset={tenantAssets[0]}/>:<div className="card"><h3>No active STRATUM Assets</h3><p className="muted">This organization has no active registered assets. The live tenant view remains empty rather than substituting reference equipment.</p><Link className="action" href="/workflows">Register an asset</Link></div>):<AssetPassport asset={referenceAssets[0]} reference/>}</div><div className="card"><div className="section-head"><div><div className="eyebrow">Activity</div><h3>{live?'Tenant evidence and lifecycle stream':'Reference evidence and trust stream'}</h3></div></div>{live?<div className="timeline">{snapshot.activities.map(activity=><LiveActivity key={`${activity.source}-${activity.id}`} activity={activity}/>)}{!snapshot.activities.length&&<p className="muted">No lifecycle or evidence activity is recorded for this organization yet.</p>}</div>:<div className="timeline">{referenceEvents.map(event=><div className="event" key={event.meta}><i className={`event-icon ${event.kind}`}>•</i><div><strong>{event.title}</strong><small>REFERENCE · {event.meta}</small></div></div>)}</div>}</div></section>
 </>;
}
