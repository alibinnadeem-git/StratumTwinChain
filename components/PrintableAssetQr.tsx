'use client';

import Link from 'next/link';
import {useMemo,useState} from 'react';
import AssetQR from '@/components/AssetQR';

const printCss='.qr-print-page{max-width:920px;margin:0 auto}.qr-label{background:#fff;color:#07131f;border:2px solid #07131f;border-radius:18px;padding:28px}.qr-brand{font-size:24px;font-weight:950;letter-spacing:.08em;border-bottom:2px solid #07131f;padding-bottom:12px}.qr-brand span{font-weight:650;letter-spacing:0}.qr-grid{display:grid;grid-template-columns:300px 1fr;gap:28px;align-items:center;padding:26px 0}.qr-copy h1{font-size:42px;margin:4px 0}.qr-copy h2{font-size:24px;margin:0 0 18px}.qr-copy dl{display:grid;grid-template-columns:95px 1fr;gap:5px 12px}.qr-copy dt{font-weight:800}.qr-copy dd{margin:0}.qr-copy small{display:block;line-height:1.4}.qr-token{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;border-top:1px solid #777;padding-top:10px;overflow-wrap:anywhere}@media(max-width:700px){.qr-grid{grid-template-columns:1fr}.qr-label{padding:18px}}@media print{body{background:#fff!important}.shell-nav,.shell-topbar,.no-print{display:none!important}.shell-main{padding:0!important;margin:0!important;max-width:none!important}.qr-print-page{max-width:none!important}.qr-label{border:2px solid #000!important;border-radius:0!important;break-inside:avoid;margin:0!important}}';

export default function PrintableAssetQr({
 assetId,
 assetCode,
 assetName,
 qrToken,
 projectName,
 siteName,
 locationLabel,
}:{
 assetId:string;
 assetCode:string;
 assetName:string;
 qrToken:string;
 projectName?:string|null;
 siteName?:string|null;
 locationLabel?:string|null;
}){
 const [message,setMessage]=useState('');
 const value=useMemo(()=>{
  const base=typeof window==='undefined'?'https://stratumspatialverified.vercel.app':window.location.origin;
  return base+'/verify?q='+encodeURIComponent(qrToken);
 },[qrToken]);

 async function copy(){
  try{await navigator.clipboard.writeText(value);setMessage('QR destination copied.');}
  catch{setMessage('Browser copy was blocked. Use the printed QR or copy the verification URL manually.');}
 }

 return <main className="qr-print-page">
  <div className="button-row no-print" style={{marginBottom:16}}>
   <Link className="ghost" href={'/assets/'+encodeURIComponent(assetId)}>Back to Asset Passport</Link>
   <button className="action" type="button" onClick={()=>window.print()}>Print QR label</button>
   <button className="ghost" type="button" onClick={copy}>Copy verification URL</button>
  </div>
  {message&&<p className="no-print" role="status">{message}</p>}
  <section className="qr-label">
   <div className="qr-brand">STRATUM <span>Spatial Verified</span></div>
   <div className="qr-grid">
    <AssetQR value={value} size={280}/>
    <div className="qr-copy">
     <div className="eyebrow">ASSET IDENTITY</div>
     <h1>{assetCode}</h1>
     <h2>{assetName}</h2>
     <dl>
      {projectName&&<><dt>Project</dt><dd>{projectName}</dd></>}
      {siteName&&<><dt>Site</dt><dd>{siteName}</dd></>}
      {locationLabel&&<><dt>Location</dt><dd>{locationLabel}</dd></>}
     </dl>
     <p><strong>Scan to open the asset verification record.</strong></p>
     <small>QR lookup establishes registry identity only. Inspect/approve evidence separately. DIR finality does not by itself prove current physical condition.</small>
    </div>
   </div>
   <div className="qr-token">Registry token · {qrToken}</div>
  </section>
  <style jsx global>{printCss}</style>
 </main>;
}
