import Link from 'next/link';
import {archivedAssets} from '@/lib/server/live-views';

export const dynamic='force-dynamic';

const fmt=(value:Date|string|null|undefined)=>value?new Date(value).toLocaleString('en-US',{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'—';

export default async function ArchivedAssets(){
  let assets:any[]=[];
  let errorMessage='';
  try{
    assets=await archivedAssets();
  }catch(error:any){
    if(error?.status===401||error?.status===403)errorMessage='Administrator access is required to review archived STRATUM Assets.';
    else if(error?.status===503)errorMessage='The append-only archive schema has not been deployed in this environment yet.';
    else errorMessage='The archived-asset registry is currently unavailable.';
    console.error('Archived asset registry unavailable.',error);
  }

  return <>
    <div className="page-head">
      <div>
        <div className="eyebrow">Asset Registry · Administrative history</div>
        <h1 className="title">Archived asset passports</h1>
        <p className="subtitle">Recoverable registry state for durable STRATUM Asset identities. Archiving never deletes Verified lifecycle evidence or Digital Immutable Records.</p>
      </div>
      <Link className="ghost" href="/assets">Back to active assets</Link>
    </div>

    {errorMessage&&<div className="card" role="status"><h3>Archive registry unavailable</h3><p className="muted">{errorMessage}</p></div>}

    {!errorMessage&&<div className="card table-card"><table className="table"><thead><tr><th>Asset</th><th>System / Location</th><th>Archived</th><th>Reason</th><th>Latest DIR</th></tr></thead><tbody>
      {assets.map(asset=><tr key={asset.id}>
        <td><Link href={`/assets/${encodeURIComponent(asset.id)}`}><strong>{asset.name}</strong></Link><div className="muted">{asset.asset_code} · {asset.asset_type}</div></td>
        <td>{asset.system_name||'Unassigned system'}<div className="muted">{asset.site_name} · {asset.location_label||'Location pending'}</div></td>
        <td><span className="pending">ARCHIVED</span><div className="muted">{fmt(asset.archive_occurred_at)}</div></td>
        <td>{asset.archive_reason||'Reason unavailable'}</td>
        <td>{asset.ledger_block_height?<span className="proof">✓ #{asset.ledger_block_height}</span>:<span className="muted">No finalized DIR</span>}</td>
      </tr>)}
      {!assets.length&&<tr><td colSpan={5}><div className="muted">No STRATUM Assets are currently archived.</div></td></tr>}
    </tbody></table></div>}
  </>;
}
