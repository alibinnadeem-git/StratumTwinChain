import Link from 'next/link';
import LiveAssetSummary from '@/components/LiveAssetSummary';
import SpatialWorkspaceStatus from '@/components/SpatialWorkspaceStatus';
import TaskLauncher from '@/components/TaskLauncher';
import {readSession} from '@/lib/server/auth';
import {commandCenterSnapshot,type CommandCenterActivity,type CommandCenterMetrics} from '@/lib/server/command-center';
import {liveAssets,type LiveAssetRow} from '@/lib/server/live-views';

export const dynamic='force-dynamic';

type CommandCenterSnapshot={organizationId:string;metrics:CommandCenterMetrics;activities:CommandCenterActivity[]};

function stamp(value:Date|string|null|undefined){
 if(!value)return 'Time not recorded';
 return new Date(value).toLocaleString('en-US',{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
}

function LiveActivity({activity}:{activity:CommandCenterActivity}){
 const finalized=Boolean(activity.ledger_block_height);
 return <div className="event"><i className={`event-icon ${finalized?'verified':'pending'}`}>{finalized?'✓':'●'}</i><div><strong>{activity.activity_type} · {activity.asset_name}</strong><small>{activity.asset_code} · {activity.trust_state} · {stamp(activity.occurred_at)}{finalized?` · DIR #${activity.ledger_block_height}`:''}</small></div></div>;
}

export default async function Home(){
 const session=await readSession();
 let snapshot:CommandCenterSnapshot|null=null;
 let tenantAssets:LiveAssetRow[]=[];
 let liveUnavailable=false;

 if(session){
  try{[snapshot,tenantAssets]=await Promise.all([commandCenterSnapshot(),liveAssets()]);}
  catch(error){liveUnavailable=true;console.error('Live command-center data unavailable.',error);}
 }

 return <>
  <div className="topline home-intro"><div><div className="eyebrow">STRATUM Spatial Verified</div><h1 className="title">Continue your project.</h1><div className="subtitle">Recover or open the Spatial model first, then choose the one task you need. Advanced engineering, trust and administration controls stay out of the way.</div></div><div className="badge">{snapshot?'LIVE TENANT':session?'SERVER OFFLINE':'BROWSER WORKSPACE'}</div></div>

  <SpatialWorkspaceStatus/>

  <TaskLauncher/>

  {!session&&<section className="card simple-status" role="status"><div><div className="eyebrow">Live tenant data</div><strong>Signed out</strong><p className="muted">Your browser Spatial model can still be recovered and backed up. Sign in only when you need tenant assets, evidence, approvals or DIR history.</p></div><Link className="ghost" href="/login">Sign in</Link></section>}

  {session&&liveUnavailable&&<section className="card simple-status" role="alert"><div><div className="eyebrow">Live tenant data</div><strong>Server connection is not bound in production</strong><p className="muted">The interface will not replace your project with demonstration data. Browser model recovery remains available above.</p></div><Link className="ghost" href="/release-readiness">View readiness</Link></section>}

  {snapshot&&<details className="secondary-details card">
   <summary>Live project data</summary>
   <div className="simple-kpis">
    <div><span>Assets</span><strong>{snapshot.metrics.registered_assets.toLocaleString()}</strong></div>
    <div><span>DIR-linked</span><strong>{snapshot.metrics.dir_linked_assets.toLocaleString()}</strong></div>
    <div><span>Lifecycle</span><strong>{snapshot.metrics.lifecycle_records.toLocaleString()}</strong></div>
    <div><span>Evidence</span><strong>{snapshot.metrics.evidence_records.toLocaleString()}</strong></div>
   </div>
   <div className="grid two" style={{marginTop:14}}>
    <div>{tenantAssets[0]?<LiveAssetSummary asset={tenantAssets[0]}/>:<div className="card"><h3>No active registered assets</h3><p className="muted">Import/review the project model first, then register only the equipment you want to manage.</p></div>}</div>
    <div className="card"><div className="eyebrow">Recent activity</div><div className="timeline">{snapshot.activities.slice(0,5).map(activity=><LiveActivity key={`${activity.source}-${activity.id}`} activity={activity}/>)}{!snapshot.activities.length&&<p className="muted">No tenant activity recorded yet.</p>}</div></div>
   </div>
  </details>}

  <details className="secondary-details card">
   <summary>Trust details</summary>
   <p className="muted">Observed, inferred, approved and finalized states remain distinct. A Spatial visualization, QR lookup or finalized DIR never silently becomes physical truth.</p>
   <div className="button-row"><Link className="ghost" href="/dir">DIR</Link><Link className="ghost" href="/provenance">Provenance</Link><Link className="ghost" href="/release-readiness">Release readiness</Link></div>
  </details>
 </>;
}
