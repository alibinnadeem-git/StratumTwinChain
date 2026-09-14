import Link from 'next/link';
import type {Asset} from '@/lib/data';
import StatusChip from '@/components/ui/StatusChip';

export default function AssetCard({asset}:{asset:Asset}){
 const operationState=asset.status==='Operational'?'ACTIVE':asset.status==='Inspection'?'MAINTENANCE':'INACTIVE';
 return <article className="shared-asset-card" data-asset-id={asset.id}>
  <header><div><div className="eyebrow">{asset.type} · {asset.id}</div><h3>{asset.name}</h3><small>{asset.site} · {asset.location}</small></div><StatusChip domain="operation" state={operationState} label={asset.status}/></header>
  <div className="shared-asset-context"><span>{asset.system}</span><span>{asset.manufacturer} · {asset.model}</span></div>
  <div className="shared-asset-trust"><StatusChip domain="trust" state={asset.block?'POVI_VERIFIED':'UNVERIFIED'} label={asset.block?`DIR ${asset.block}`:'DIR pending'}/></div>
  <footer><Link className="action" href={`/assets/${asset.id}`}>Open asset</Link><Link className="ghost" href={`/verify?q=${asset.id}`}>Verify</Link></footer>
 </article>;
}
