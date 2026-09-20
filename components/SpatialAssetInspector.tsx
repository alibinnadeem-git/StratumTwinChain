'use client';

import Link from 'next/link';
import {useMemo,useState} from 'react';
import AssetActivityPanel from '@/components/AssetActivityPanel';
import AssetQR from '@/components/AssetQR';
import {
 resolveRegisteredSpatialAsset,
 spatialAssetDirState,
 type RegisteredSpatialAsset,
 type SpatialAssetEntity,
} from '@/lib/spatial-asset-link';

type InspectorEntity=SpatialAssetEntity&{
 source:string;
 kind:string;
 floor?:string;
 zone?:string;
 x:number;
 y:number;
 z?:number;
 confidence:number;
 meta?:Record<string,unknown>;
};

const GRAPH_KEY='stratum_compiled_graph';

function verificationUrl(asset:RegisteredSpatialAsset){
 const base=typeof window==='undefined'?'https://stratumspatialverified.vercel.app':window.location.origin;
 const identity=asset.qr_token||asset.asset_code;
 return base+'/verify?q='+encodeURIComponent(identity);
}

export default function SpatialAssetInspector({
 selected,
 registeredAssets,
 onEntityUpdated,
}:{
 selected:InspectorEntity|null;
 registeredAssets:RegisteredSpatialAsset[];
 onEntityUpdated?:(entity:InspectorEntity)=>void;
}){
 const [linkId,setLinkId]=useState('');
 const [message,setMessage]=useState('');
 const binding=useMemo(()=>resolveRegisteredSpatialAsset(selected,registeredAssets),[selected,registeredAssets]);
 const dir=useMemo(()=>spatialAssetDirState(binding),[binding]);
 const asset=binding?.asset||null;

 function persistBinding(nextAsset:RegisteredSpatialAsset|null){
  if(!selected)return;
  try{
   const graph=JSON.parse(localStorage.getItem(GRAPH_KEY)||'{}');
   if(!Array.isArray(graph.entities))throw new Error('No compiled graph is available');
   let updated:InspectorEntity|null=null;
   graph.entities=graph.entities.map((entity:InspectorEntity)=>{
    if(entity.id!==selected.id)return entity;
    const meta={...(entity.meta||{})};
    for(const key of ['registeredAssetId','registeredAssetCode','registeredAssetSerial','registryAssetId','registryAssetCode'])delete meta[key];
    if(nextAsset){
     meta.registeredAssetId=nextAsset.id;
     meta.registeredAssetCode=nextAsset.asset_code;
     if(nextAsset.serial_number)meta.registeredAssetSerial=nextAsset.serial_number;
     meta.assetBindingMethod='HUMAN_EXPLICIT';
     meta.assetBindingUpdatedAt=new Date().toISOString();
    }else{
     delete meta.assetBindingMethod;
     delete meta.assetBindingUpdatedAt;
    }
    updated={...entity,meta};
    return updated;
   });
   localStorage.setItem(GRAPH_KEY,JSON.stringify(graph));
   window.dispatchEvent(new Event('stratum:graph-updated'));
   if(updated)onEntityUpdated?.(updated);
   setMessage(nextAsset?'Spatial object linked to '+nextAsset.asset_code+'.':'Spatial object unlinked from the registered asset.');
   setLinkId('');
  }catch(error){
   setMessage(error instanceof Error?error.message:'Unable to update asset binding');
  }
 }

 if(!selected)return <>
  <div className="eyebrow" style={{marginTop:14}}>HOW TO USE</div>
  <p className="subtitle">Click equipment to inspect placement, asset identity, current activity and DIR state.</p>
 </>;

 const z=Number.isFinite(Number(selected.z))?Number(selected.z):0;
 const qr=asset?verificationUrl(asset):'';

 return <>
  <div className="eyebrow" style={{marginTop:14}}>{asset?'ASSET PASSPORT':'SPATIAL OBJECT'}</div>
  <h2 style={{margin:'4px 0'}}>{asset?.name||selected.name}</h2>
  <p className="subtitle">{asset?(asset.asset_code+' · '+asset.status):(selected.layer+' · '+selected.kind)}</p>

  {asset?<>
   <div className="passport-facts">
    <div><span>Manufacturer</span><strong>{asset.manufacturer_name||'Pending'}</strong></div>
    <div><span>Model</span><strong>{asset.model||'Pending'}</strong></div>
    <div><span>Serial</span><strong>{asset.serial_number||'—'}</strong></div>
    <div><span>Location</span><strong>{asset.location_label||selected.zone||'Pending'}</strong></div>
    <div><span>Lifecycle</span><strong>{asset.latest_event_type||'No lifecycle event'}</strong></div>
    <div><span>Binding</span><strong>{binding?.method.replaceAll('_',' ')}</strong></div>
   </div>

   <div className="notice" style={{marginTop:12,borderColor:dir.finalized?'#2d7252':'#75592e'}}>
    <strong>{dir.finalized?'DIR FINALIZED':'NO FINALIZED DIR'}</strong>
    <span>{dir.finalized
      ?('Immutable record '+dir.blockHeight+' on '+(dir.network||'STRATUM Chain')+'. Latest lifecycle: '+(dir.latestEventType||'recorded')+' '+(dir.latestEventStatus||'')+'.')
      :'This registered asset has no finalized DIR yet. Lifecycle activity remains reviewable without being silently promoted.'}</span>
   </div>

   <div style={{display:'grid',gridTemplateColumns:'auto 1fr',gap:12,alignItems:'center',marginTop:12}}>
    <AssetQR value={qr} size={108}/>
    <div>
     <div className="eyebrow">ASSET QR</div>
     <p className="muted" style={{margin:'4px 0 8px'}}>Print this label, attach it to the equipment, and scan it later to reopen the same asset identity.</p>
     <div className="button-row">
      <Link className="action" href={'/assets/'+encodeURIComponent(asset.id)}>Open Passport</Link>
      <Link className="ghost" href={'/assets/'+encodeURIComponent(asset.id)+'/qr'}>Print QR label</Link>
      <Link className="ghost" href={'/verify?q='+encodeURIComponent(asset.qr_token||asset.asset_code)}>Verify DIR</Link>
     </div>
    </div>
   </div>

   {asset.project_id
    ?<AssetActivityPanel key={asset.id} assetId={asset.id} projectId={asset.project_id}/>
    :<div className="notice" style={{marginTop:12}}><strong>ACTIVITY UNAVAILABLE</strong><span>This asset summary is missing its project identifier. Reload the live asset registry before submitting activity.</span></div>}

   <details style={{marginTop:12}}>
    <summary>Asset binding</summary>
    <p className="muted">This is an explicit Spatial-to-registry relationship. Unlinking it removes only the viewer binding; it does not delete the asset, lifecycle records, evidence or DIRs.</p>
    <button className="ghost" type="button" onClick={()=>persistBinding(null)}>Unlink Spatial object</button>
   </details>
  </>:<>
   <div className="notice" style={{marginTop:12}}>
    <strong>NOT LINKED TO A REGISTERED ASSET</strong>
    <span>This object came from project geometry. Link it explicitly before showing tenant activity or DIR state.</span>
   </div>
   {registeredAssets.length>0?<div style={{display:'grid',gap:8,marginTop:12}}>
    <label>Registered asset
     <select value={linkId} onChange={event=>setLinkId(event.target.value)} style={{width:'100%'}}>
      <option value="">Choose an asset</option>
      {registeredAssets.map(item=><option key={item.id} value={item.id}>{item.asset_code} · {item.name}</option>)}
     </select>
    </label>
    <button className="action" type="button" disabled={!linkId} onClick={()=>persistBinding(registeredAssets.find(item=>item.id===linkId)||null)}>Link selected asset</button>
   </div>:<p className="muted">No live registered assets are available in the active organization yet.</p>}
  </>}

  <div className="passport-facts" style={{marginTop:12}}>
   <div><span>Floor</span><strong>{selected.floor||'UNRESOLVED'}</strong></div>
   <div><span>Plan X / Y</span><strong>{selected.x.toFixed(2)} / {selected.y.toFixed(2)}</strong></div>
   <div><span>Z</span><strong>{z.toFixed(2)} m</strong></div>
   <div><span>Source</span><strong>{selected.source}</strong></div>
   <div><span>Confidence</span><strong>{Math.round(selected.confidence*100)}%</strong></div>
   <div><span>Zone</span><strong>{selected.zone||'Unresolved'}</strong></div>
  </div>
  {message&&<p role="status" className="muted">{message}</p>}
  <details style={{marginTop:12}}><summary>Source details</summary><dl>{Object.entries(selected.meta||{}).map(([key,value])=><div key={key}><dt>{key}</dt><dd style={{overflowWrap:'anywhere'}}>{typeof value==='object'?JSON.stringify(value):String(value)}</dd></div>)}</dl></details>
 </>;
}
