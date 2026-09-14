'use client';

import Link from 'next/link';
import {useEffect,useState} from 'react';
import StatusChip from '@/components/ui/StatusChip';

export type AssetDrawerRecord={
 id:string;
 name:string;
 assetCode:string;
 assetType:string;
 manufacturer?:string|null;
 serial?:string|null;
 system?:string|null;
 site?:string|null;
 location?:string|null;
 status?:string|null;
 project?:string|null;
 latestEvent?:string|null;
 dirHeight?:number|string|null;
};

export default function AssetDrawer({asset}:{asset:AssetDrawerRecord}){
 const [open,setOpen]=useState(false);
 useEffect(()=>{
  if(!open)return;
  const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)};
  window.addEventListener('keydown',onKey);
  return()=>window.removeEventListener('keydown',onKey);
 },[open]);

 return <>
  <button className="asset-drawer-trigger" type="button" onClick={()=>setOpen(true)} aria-label={`Open ${asset.name} quick view`}>
   <strong>{asset.name}</strong><span>{asset.assetCode} · {asset.assetType}</span>
  </button>
  {open&&<div className="asset-drawer-backdrop" role="presentation" onMouseDown={()=>setOpen(false)}>
   <aside className="asset-drawer" role="dialog" aria-modal="true" aria-label={`${asset.name} asset details`} onMouseDown={event=>event.stopPropagation()}>
    <header>
     <div><small>Asset · {asset.assetCode}</small><h2>{asset.name}</h2></div>
     <button type="button" onClick={()=>setOpen(false)} aria-label="Close asset details">×</button>
    </header>

    <div className="asset-drawer-summary">
     <span className="status-chip">{asset.status||'UNVERIFIED'}</span>
     <StatusChip domain="trust" state={asset.dirHeight?'DIR_RECORDED':'UNVERIFIED'} label={asset.dirHeight?`DIR #${asset.dirHeight} recorded`:'DIR pending'}/>
    </div>

    <section>
     <div className="eyebrow">Identity</div>
     <dl>
      <div><dt>Type</dt><dd>{asset.assetType||'Not recorded'}</dd></div>
      <div><dt>Manufacturer</dt><dd>{asset.manufacturer||'Not recorded'}</dd></div>
      <div><dt>Serial</dt><dd className="mono">{asset.serial||'Not recorded'}</dd></div>
     </dl>
    </section>

    <section>
     <div className="eyebrow">Infrastructure context</div>
     <dl>
      <div><dt>Project</dt><dd>{asset.project||'Not assigned'}</dd></div>
      <div><dt>Site</dt><dd>{asset.site||'Not assigned'}</dd></div>
      <div><dt>System</dt><dd>{asset.system||'Not assigned'}</dd></div>
      <div><dt>Location</dt><dd>{asset.location||'Location pending'}</dd></div>
     </dl>
    </section>

    <section>
     <div className="eyebrow">Lifecycle & trust</div>
     <dl>
      <div><dt>Latest event</dt><dd>{asset.latestEvent||'No verified event'}</dd></div>
      <div><dt>Current state</dt><dd>{asset.status||'UNVERIFIED'}</dd></div>
      <div><dt>DIR reference</dt><dd>{asset.dirHeight?`DIR #${asset.dirHeight} recorded`:'Awaiting immutable lifecycle record'}</dd></div>
     </dl>
     <p className="drawer-note">A verified PoVI finality proof establishes canonical network finality. A recorded DIR reference alone does not prove finality, physical truth, work quality, or engineering approval.</p>
    </section>

    <footer>
     <Link className="action" href={`/assets/${encodeURIComponent(asset.id)}`}>Open full asset</Link>
     <Link className="ghost" href={`/verify?q=${encodeURIComponent(asset.assetCode)}`}>Verify</Link>
     <Link className="ghost" href="/workflows">Work</Link>
    </footer>
   </aside>
  </div>}
  <style jsx>{`
   .asset-drawer-trigger{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:0;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer}
   .asset-drawer-trigger strong{text-decoration:underline;text-decoration-color:transparent;text-underline-offset:3px}
   .asset-drawer-trigger:hover strong,.asset-drawer-trigger:focus strong{text-decoration-color:currentColor}
   .asset-drawer-trigger span{font-size:12px;opacity:.62}
   .asset-drawer-backdrop{position:fixed;inset:0;z-index:1200;background:rgba(0,0,0,.56);display:flex;justify-content:flex-end}
   .asset-drawer{width:min(520px,100%);height:100%;overflow:auto;background:#111827;border-left:1px solid rgba(255,255,255,.12);box-shadow:-24px 0 70px rgba(0,0,0,.45);padding:22px;display:flex;flex-direction:column;gap:18px}
   header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:1px solid rgba(255,255,255,.1);padding-bottom:16px}
   header small{opacity:.65} header h2{margin:4px 0 0;font-size:24px} header button{border:1px solid rgba(255,255,255,.14);background:transparent;color:inherit;border-radius:8px;font-size:22px;line-height:1;padding:6px 9px;cursor:pointer}
   .asset-drawer-summary{display:flex;gap:8px;flex-wrap:wrap}
   section{border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:14px}
   dl{margin:8px 0 0} dl div{display:grid;grid-template-columns:120px 1fr;gap:12px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.07)} dl div:last-child{border-bottom:0} dt{opacity:.62} dd{margin:0;font-weight:600;overflow-wrap:anywhere}
   .drawer-note{margin:12px 0 0;font-size:12px;line-height:1.5;opacity:.62}
   footer{display:flex;gap:8px;flex-wrap:wrap;margin-top:auto;padding-top:4px}
   @media(max-width:600px){.asset-drawer{width:100%;padding:18px}dl div{grid-template-columns:1fr;gap:3px}}
  `}</style>
 </>;
}
