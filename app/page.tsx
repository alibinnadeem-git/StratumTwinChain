import Link from 'next/link';
import {assets,events as referenceEvents,projects} from '@/lib/data';
import {demoSession} from '@/lib/auth/session';
import {homeSurfaceFor} from '@/lib/experience/home';
import {recentActivity} from '@/lib/server/live-views';
import AssetCard from '@/components/ui/AssetCard';

export const dynamic='force-dynamic';

export default async function Home(){
 const verified=assets.filter(a=>a.block).length;
 const surface=homeSurfaceFor(demoSession.role);
 let activity=referenceEvents;
 let activitySource='Reference dataset fallback';
 try{
  const live=await recentActivity(8);
  if(live.length){
   activity=live.map(item=>({title:item.title,meta:item.meta,kind:item.kind}));
   activitySource='Server-backed lifecycle and evidence stream';
  }
 }catch{
  activity=referenceEvents;
 }
 return <>
  <div className="topline"><div><div className="eyebrow">STRATUM Spatial Verified · {surface.eyebrow}</div><h1 className="title">{surface.title}</h1><div className="subtitle">{surface.description}</div></div><div className="badge">{demoSession.role.replaceAll('_',' ')}</div></div>

  <section className="grid two">
   <div className="card hero-copy">
    <div className="eyebrow">Start here</div>
    <h2>Your most relevant actions</h2>
    <p className="muted">STRATUM keeps the underlying Spatial, evidence, approval and PoVI layers connected while presenting the work appropriate to your role first.</p>
    <div className="timeline">
     {surface.actions.map(action=><Link href={action.href} className="event" key={action.href}>
      <i className="event-icon info">→</i><div><strong>{action.label}</strong><small>{action.description}</small></div>
     </Link>)}
    </div>
   </div>
   <div className="card layer-visual">
    <div className="layer l1"><b>Source</b><span>Documents · capture · OEM · telemetry</span></div>
    <div className="layer l2"><b>Spatial</b><span>Site · building · room · system · asset</span></div>
    <div className="layer l3"><b>Execution</b><span>Field work · QA/QC · commissioning</span></div>
    <div className="layer l4"><b>Trust</b><span>Evidence · HITL · approvals · provenance</span></div>
    <div className="layer l5"><b>PoVI</b><span>NDIR · MDIR · DIR · finality</span></div>
   </div>
  </section>

  <section className="grid kpis" style={{marginTop:16}}><div className="card"><div className="label">Tracked Assets</div><div className="metric">{projects.reduce((n,p)=>n+p.assets,0).toLocaleString()}</div><div className="muted">Current application dataset</div></div><div className="card"><div className="label">PoVI-linked Passports</div><div className="metric">{verified}/{assets.length}</div><div className="muted">Current demo/passport cohort</div></div><div className="card"><div className="label">Visible Lifecycle Events</div><div className="metric">{activity.length}</div><div className="muted">{activitySource}</div></div><div className="card"><div className="label">Trust Rule</div><div className="metric" style={{fontSize:18}}>No silent promotion</div><div className="muted">Live, approved, inferred and finalized remain distinct</div></div></section>

  <section className="grid two"><div><div className="section-head"><div><div className="eyebrow">Universal Asset View</div><h2>Infrastructure provenance at a glance</h2></div></div><AssetCard asset={assets[0]}/></div><div className="card"><div className="section-head"><div><div className="eyebrow">Activity</div><h3>Evidence and trust stream</h3><small className="muted">{activitySource}</small></div></div><div className="timeline">{activity.map(e=><div className="event" key={`${e.title}-${e.meta}`}><i className={`event-icon ${e.kind}`}>✓</i><div><strong>{e.title}</strong><small>{e.meta}</small></div></div>)}</div></div></section>

  <section className="card" style={{marginTop:16}}><div className="section-head"><div><div className="eyebrow">Implementation status</div><h2>Redbook convergence stays explicit</h2></div><Link className="ghost" href="/library">Open specialist Library</Link></div><div className="redbook-priority-grid"><div className="card redbook-priority"><span className="implementation-chip partial">P0 · PARTIAL</span><h3>Canonical Trust Foundation</h3><p className="muted">Canonical schemas and terminology, PoVI target, NDIR/MDIR/DIR hierarchy, validator registry and portable validator path.</p></div><div className="card redbook-priority"><span className="implementation-chip foundation">P1 · IN PROGRESS</span><h3>Platform Convergence</h3><p className="muted">STRATUM Spatial Verified, Data Room, AI Costing and JARVIS converge around shared canonical objects and trust semantics.</p></div><div className="card redbook-priority"><span className="implementation-chip planned">P2 · PLANNED</span><h3>Field / Engineering / OT</h3><p className="muted">OPC UA, edge runtime, Spatial reconstruction, power services, QA, safety, commissioning and operations.</p></div><div className="card redbook-priority"><span className="implementation-chip planned">P3 · PLANNED</span><h3>Ecosystem / Scale</h3><p className="muted">External connectors, Studio/SIR/WASM, enterprise certification and sovereign-scale validator deployments.</p></div></div></section>
 </>;
}
