import Link from 'next/link';
import PrintableAssetQr from '@/components/PrintableAssetQr';
import {liveAsset} from '@/lib/server/live-views';

export const dynamic='force-dynamic';

export default async function AssetQrPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const identifier=decodeURIComponent(id);
 let asset=null;
 try{asset=await liveAsset(identifier);}catch{}
 if(!asset)return <div className="card"><div className="eyebrow">Asset QR</div><h1>Asset unavailable</h1><p className="muted">A live tenant asset is required before a printable registry QR can be issued.</p><Link className="action" href="/assets">Return to assets</Link></div>;
 return <PrintableAssetQr assetId={asset.id} assetCode={asset.asset_code} assetName={asset.name} qrToken={asset.qr_token} projectName={asset.project_name} siteName={asset.site_name} locationLabel={asset.location_label}/>;
}
