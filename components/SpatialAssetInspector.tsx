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

 if(!selected)return <div className="inspector-empty">
  <div className="eyebrow">Inspect equipment</div>
  <h3>Click an asset in Spatial</h3>
  <p className="subtitle">Identity, placement, lifecycle work, evidence and DIR state will appear here.</p>
 </div>;

 const z=Number.isFinite(Number(selected.z))?Number(selected.z):0;
 const qr=asset?verificationUrl(asset):'';
 const zReviewed=selected.meta?.elevationKnown===true||selected.meta?.physicalElevationKnown===true||selected.meta?.zPlacementAuthority==='MEASURED_OR_REVIEWED';

 return <div className="asset-inspector">
  <div className="section-head">
   <div>
    <div className="eyebrow">{asset?'Registered asset':'Spatial object'}</div>
    <h2 style={{margin:'4px 0'}}>{asset?.name||selected.name}</h2>
    <p className="subtitle" style={{margin:0}}>{asset?(asset.asset_code+' · '+asset.status):(selected.layer+' · '+selected.kind)}</p>
   </div>
   <span className={asset?(dir.finalized?'proof':'status-chip'):'pending'}>{asset?(dir.finalized?'DIR FINALIZED':'DIR PENDING'):'UNLINKED'}</span>
  </div>

  <div className={`placement-trust ${zReviewed?'reviewed':'needs-review'}`} role="status">
    <div><span>Z placement</span><strong>{zReviewed?'Measured / reviewed':'Unverified elevation'}</strong></div>
  </div>
  {selected.kind==='imported-3d-model'&&<div className="notice" role="status"><strong>IMPORTED 3D GEOMETRY</strong><span>This is the uploaded model file. Its location and model-space dimensions are unverified; importing it does not register an installed asset or establish its DIR state.</span></div>}
  {selected.kind==='sheet-callout-candidate'&&<div className="notice" role="status"><strong>DRAWING CALLOUT · REVIEW REQUIRED</strong><span>{selected.name} appears on sheet {String(selected.meta?.sheet||'unknown')}, page {String(selected.meta?.page||'?')}, near {selected.zone||'an unresolved room'}. Equipment type, physical position and asset identity need confirmation. Maintenance can be recorded later for both existing and new registered assets; no history is implied by this drawing.</span></div>}
  {selected.kind==='annotated-asset-candidate'&&<div className="notice" role="status"><strong>REVIEWED DRAWING SYMBOL · CANDIDATE</strong><span>{selected.name} was marked on page {String(selected.meta?.page||1)} of {selected.source}. Drawing reference: {String(selected.meta?.reference||'unresolved')}. Legend or schedule: {String(selected.meta?.legendReference||'unresolved')}. Type: {String(selected.meta?.electricalComponentHint||'unresolved')}. Drawing state: {String(selected.meta?.drawingState||'unresolved')}. Sheet location is not a verified 3D position or proof of installation. Maintenance history starts when actual events are recorded.</span></div>}

  {asset?<>
   <div className="asset-summary-strip">
    <div><span>Identity</span><strong>{asset.serial_number||asset.asset_code}</strong></div>
    <div><span>Location</span><strong>{asset.location_label||selected.zone||'Pending'}</strong></div>
    <div><span>Latest work</span><strong>{asset.latest_event_type||'No lifecycle event'}</strong></div>
    <div><span>Trust</span><strong>{dir.finalized?`DIR #${dir.blockHeight}`:'Awaiting finality'}</strong></div>
   </div>

   <div className="card" style={{marginTop:12,padding:14}}>
    <div className="section-head">
     <div><div className="eyebrow">Maintenance cycle</div><h3 style={{margin:'3px 0'}}>{asset.maintenance_plan_id?'Versioned maintenance plan':'No maintenance plan recorded'}</h3></div>
     <span className={asset.maintenance_status==='ACTIVE'?'proof':'pending'}>{asset.maintenance_status||'UNPLANNED'}</span>
    </div>
    {asset.maintenance_plan_id?<div className="passport-facts">
     <div><span>Basis</span><strong>{asset.maintenance_basis?.replaceAll('_',' ')||'—'}</strong></div>
     <div><span>Revision</span><strong>{asset.maintenance_revision?'r'+asset.maintenance_revision:'—'}</strong></div>
     <div><span>Cycle</span><strong>{asset.maintenance_interval_days?asset.maintenance_interval_days+' days':asset.maintenance_interval_hours?asset.maintenance_interval_hours+' operating hours':'Condition / due-date based'}</strong></div>
     <div><span>Next due</span><strong>{asset.maintenance_next_due_at?new Date(asset.maintenance_next_due_at).toLocaleDateString():'—'}</strong></div>
    </div>:<p className="muted">No current plan is attached to this registered asset. Add a governed maintenance plan from the Asset Passport when required.</p>}
    {asset.maintenance_task_summary&&<p className="muted" style={{marginBottom:0}}>{asset.maintenance_task_summary}</p>}
    <small className="spatial-review-boundary">A maintenance plan or due date does not prove that maintenance was physically performed.</small>
   </div>

   <div className={`dir-summary-card ${dir.finalized?'finalized':''}`}>
    <div>
     <div className="eyebrow">Digital Immutable Record</div>
     <h3>{dir.finalized?'Finalized lifecycle proof':'No finalized DIR yet'}</h3>
     <p className="muted">{dir.finalized
       ?`Finalized on ${dir.network||'STRATUM Chain'} at record #${dir.blockHeight}. This secures the recorded evidence and approval history; it does not independently establish physical truth.`
       :'Work can be recorded now. Evidence, an independent approval and PoVI finality are still required before a lifecycle record becomes a finalized DIR.'}</p>
    </div>
    <Link className={dir.finalized?'ghost':'action'} href="/dir">{dir.finalized?'View DIR proof':'Review DIR status'}</Link>
   </div>

   <div className="asset-quick-actions" aria-label="Asset quick actions">
    <Link className="action" href={'/assets/'+encodeURIComponent(asset.id)}>Passport</Link>
    <Link className="ghost" href={`/inspection?q=${encodeURIComponent(asset.id)}`}>Field evidence</Link>
    <Link className="ghost" href={'/assets/'+encodeURIComponent(asset.id)+'/qr'}>Print QR</Link>
    <Link className="ghost" href={'/verify?q='+encodeURIComponent(asset.qr_token||asset.asset_code)}>Verify record</Link>
   </div>

   <details className="secondary-details">
    <summary>Asset identity & QR</summary>
    <div className="asset-identity-panel">
     <div className="passport-facts">
      <div><span>Manufacturer</span><strong>{asset.manufacturer_name||'Pending'}</strong></div>
      <div><span>Model</span><strong>{asset.model||'Pending'}</strong></div>
      <div><span>Serial</span><strong>{asset.serial_number||'—'}</strong></div>
      <div><span>Binding</span><strong>{binding?.method.replaceAll('_',' ')}</strong></div>
     </div>
     <div className="qr-inline">
      <AssetQR value={qr} size={96}/>
      <p className="muted">Scan to reopen this exact asset identity.</p>
     </div>
    </div>
   </details>

   {asset.project_id
    ?<AssetActivityPanel key={asset.id} assetId={asset.id} projectId={asset.project_id}/>
    :<div className="notice" style={{marginTop:12}}><strong>ACTIVITY UNAVAILABLE</strong><span>This asset summary is missing its project identifier. Reload the live asset registry before submitting activity.</span></div>}

   <details className="secondary-details">
    <summary>Asset binding</summary>
    <p className="muted">This is an explicit Spatial-to-registry relationship. Unlinking removes only the viewer binding; it does not delete the asset, lifecycle records, evidence or DIRs.</p>
    <button className="ghost" type="button" onClick={()=>persistBinding(null)}>Unlink Spatial object</button>
   </details>
  </>:<>
   <div className="notice" style={{marginTop:12}}>
    <strong>LINK THIS OBJECT BEFORE USING LIVE ASSET DATA</strong>
    <span>This geometry came from project sources. STRATUM will not borrow identity, activity or DIR state from a similar asset automatically.</span>
   </div>
   {registeredAssets.length>0?<div className="binding-panel">
    <label>Registered asset
     <select value={linkId} onChange={event=>setLinkId(event.target.value)} style={{width:'100%'}}>
      <option value="">Choose an asset</option>
      {registeredAssets.map(item=><option key={item.id} value={item.id}>{item.asset_code} · {item.name}</option>)}
     </select>
    </label>
    <div className="button-row">
     <button className="action" type="button" disabled={!linkId} onClick={()=>persistBinding(registeredAssets.find(item=>item.id===linkId)||null)}>Link asset</button>
     <Link className="ghost" href={'/assets/new?name='+encodeURIComponent(selected.name)+'&type='+encodeURIComponent(String(selected.meta?.componentKey||selected.kind||'EQUIPMENT'))}>Register new asset</Link>
    </div>
   </div>:<div className="binding-panel"><p className="muted" style={{margin:0}}>No live registered assets are available in the active organization yet.</p><Link className="action" href={'/assets/new?name='+encodeURIComponent(selected.name)+'&type='+encodeURIComponent(String(selected.meta?.componentKey||selected.kind||'EQUIPMENT'))}>Register this object</Link></div>}
  </>}

  <details className="secondary-details placement-details">
   <summary>Placement & source confidence</summary>
   <div className="passport-facts" style={{marginTop:10}}>
    <div><span>Floor</span><strong>{selected.floor||'UNRESOLVED'}</strong></div>
    <div><span>Plan X / Y</span><strong>{selected.x.toFixed(2)} / {selected.y.toFixed(2)}</strong></div>
    <div><span>Z</span><strong>{z.toFixed(2)} m</strong></div>
    <div><span>Source</span><strong>{selected.source}</strong></div>
    <div><span>Confidence</span><strong>{Math.round(selected.confidence*100)}%</strong></div>
    <div><span>Zone</span><strong>{selected.zone||'Unresolved'}</strong></div>
   </div>
   <details className="proof-details"><summary>Raw source details</summary><dl>{Object.entries(selected.meta||{}).filter(([key])=>key!=='embeddedGlb').map(([key,value])=><div key={key}><dt>{key}</dt><dd style={{overflowWrap:'anywhere'}}>{typeof value==='object'?JSON.stringify(value):String(value)}</dd></div>)}</dl></details>
  </details>
  {message&&<p role="status" className="muted">{message}</p>}
 </div>;
}
