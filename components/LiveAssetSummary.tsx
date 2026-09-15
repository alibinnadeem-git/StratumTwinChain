import Link from 'next/link';
import AssetQR from './AssetQR';
import type {LiveAssetRow} from '@/lib/server/live-views';

function stamp(value:Date|string|null|undefined){
  if(!value)return '—';
  return new Date(value).toLocaleString('en-US',{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
}

export default function LiveAssetSummary({asset}:{asset:LiveAssetRow}){
  const verifyUrl=`https://stratumspatialverified.vercel.app/verify?q=${encodeURIComponent(asset.asset_code)}`;
  const hasDir=Boolean(asset.ledger_block_height);
  return <div className="passport card">
    <div className="passport-head">
      <div>
        <div className="eyebrow">STRATUM Asset Passport · Live tenant record</div>
        <h2>{asset.name}</h2>
        <div className="muted">{asset.manufacturer_name||'Manufacturer pending'}{asset.model?` · ${asset.model}`:''}</div>
      </div>
      <div className={`verify-seal ${hasDir?'':'pending-seal'}`}>{hasDir?'DIR RECORDED':'NO DIR'}</div>
    </div>
    <div className="passport-grid">
      <div className="passport-facts">
        <div><span>Asset ID</span><strong>{asset.asset_code}</strong></div>
        <div><span>Serial Number</span><strong>{asset.serial_number||'Not recorded'}</strong></div>
        <div><span>System</span><strong>{asset.system_name||'Unassigned'}</strong></div>
        <div><span>Location</span><strong>{asset.location_label||asset.site_name}</strong></div>
        <div><span>Lifecycle status</span><strong>{asset.status}</strong></div>
        <div><span>Latest DIR</span><strong>{asset.ledger_block_height?`#${asset.ledger_block_height}`:'Not recorded'}</strong></div>
      </div>
      <div className="qr-wrap"><AssetQR value={verifyUrl}/><small>Open public verification</small></div>
    </div>
    <div className="card" style={{marginTop:12,padding:12}}>
      <div className="eyebrow">Latest recorded lifecycle context</div>
      <div className="spec-grid">
        <div><span>Event</span><strong>{asset.latest_event_type||'No finalized lifecycle event'}</strong></div>
        <div><span>Record status</span><strong>{asset.latest_event_status||'—'}</strong></div>
        <div><span>Recorded</span><strong>{stamp(asset.anchored_at)}</strong></div>
      </div>
      <p className="muted" style={{marginBottom:0}}>A DIR record is cryptographic/provenance evidence. It is not, by itself, a claim that the physical asset is correct or currently matches the field.</p>
    </div>
    <div className="passport-actions"><Link className="action" href={`/assets/${encodeURIComponent(asset.id)}`}>Open full passport</Link><Link className="ghost" href={`/verify?q=${encodeURIComponent(asset.asset_code)}`}>Verify record</Link></div>
  </div>;
}
