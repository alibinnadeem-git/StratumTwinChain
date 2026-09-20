import Link from 'next/link';
import {liveAssets} from '@/lib/server/live-views';

export const dynamic='force-dynamic';
const fmt=(d:Date|string|null|undefined)=>d?new Date(d).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}):'—';

export default async function Assets(){
 let assets:any[]=[];let backendOnline=true;
 try{assets=await liveAssets();}catch(error){backendOnline=false;console.error('Asset registry backend unavailable; no reference data substituted.',error);}
 return <>
 <div className="page-head"><div><div className="eyebrow">Asset Registry</div><h1 className="title">Asset passports</h1><p className="subtitle">Durable equipment identities with lifecycle evidence and Digital Immutable Records (DIR) verification.</p></div><div className="button-row"><Link className="ghost" href="/assets/archived">Archived assets</Link><Link className="action" href="/assets/new">+ Register asset</Link></div></div>
 {!backendOnline&&<div className="card" style={{marginBottom:16,borderColor:'#75592e'}}><div className="eyebrow">Live registry unavailable</div><p className="subtitle" style={{marginTop:6}}>The production tenant registry could not be loaded. STRATUM will not substitute demonstration assets for live equipment.</p></div>}
 <div className="card table-card"><table className="table"><thead><tr><th>Asset</th><th>Manufacturer / Serial</th><th>System / Location</th><th>Lifecycle</th><th>Latest event</th><th>DIR</th></tr></thead><tbody>
 {assets.map(a=><tr key={a.id}><td><Link href={`/assets/${encodeURIComponent(a.id)}`}><strong>{a.name}</strong></Link><div className="muted">{a.asset_code} · {a.asset_type}</div><div className="button-row" style={{marginTop:6}}><Link className="ghost" href={`/assets/${encodeURIComponent(a.id)}/qr`}>QR</Link></div></td><td>{a.manufacturer_name||'Manufacturer not recorded'}<div className="muted mono">{a.serial_number||'No serial'}</div></td><td>{a.system_name||'Unassigned system'}<div className="muted">{a.site_name} · {a.location_label||'Location pending'}</div></td><td><span className="status-chip">{a.status}</span><div className="muted">{a.project_code}</div></td><td>{a.latest_event_type||'No verified event'}<div className="muted">{fmt(a.anchored_at)}</div></td><td>{a.ledger_block_height?<span className="proof">✓ #{a.ledger_block_height}</span>:<span className="pending">Pending</span>}</td></tr>)}
 {!assets.length&&<tr><td colSpan={6}><div className="muted">No active STRATUM Assets are registered in this organization. Archived identities are available from the Archived assets view to authorized administrators.</div></td></tr>}</tbody></table></div></>;
}
