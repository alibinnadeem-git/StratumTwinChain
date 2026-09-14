import Link from 'next/link';
import HumanAttestationPanel from '@/components/HumanAttestationPanel';
import {liveAsset} from '@/lib/server/live-views';

export const dynamic='force-dynamic';

export default async function AssetAttestations({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const identifier=decodeURIComponent(id);
 let asset:any=null;
 try{asset=await liveAsset(identifier)}catch{}
 if(!asset)return <><div className="page-head"><div><div className="eyebrow">Asset Passport · Human Attestations</div><h1 className="title">Live tenant asset required</h1><p className="subtitle">Human attestations are available only for an authenticated asset in the active organization. Reference/demo equipment cannot receive attestations.</p></div></div><div className="card"><Link className="action" href={`/assets/${encodeURIComponent(identifier)}`}>Return to Asset Passport</Link></div></>;
 return <>
  <div className="page-head"><div><div className="eyebrow">Asset Passport · {asset.asset_code}</div><h1 className="title">Human attestations</h1><p className="subtitle">Append-only, role-typed evidence statements for {asset.name}. Attestation is separate from lifecycle approval, DIR finality, PoVI authority and physical truth.</p></div><div className="button-row"><Link className="ghost" href={`/assets/${encodeURIComponent(asset.id)}`}>Back to Passport</Link><Link className="ghost" href={`/inspection?q=${encodeURIComponent(asset.id)}`}>Inspection</Link></div></div>
  <HumanAttestationPanel assetId={asset.id}/>
 </>;
}
