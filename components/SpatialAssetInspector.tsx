'use client';

import Link from 'next/link';
import {useMemo,useState} from 'react';
import {readPrimarySpatialGraph,replaceCurrentSpatialGraph} from '@/lib/spatial-browser-recovery';
import {resolveReconciledAssetPlacement} from '@/lib/z-solution-chain';
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

function optionalNumber(value:unknown){if(value===null||value===undefined||value==='')return null;const number=Number(value);return Number.isFinite(number)?number:null}

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
 const reconciliation=useMemo(()=>selected?resolveReconciledAssetPlacement({name:selected.name,floor:selected.floor,z:selected.z,meta:selected.meta}):null,[selected]);
 const placement=reconciliation?.placement||null;
 const zSolution=reconciliation?.solution||null;
 const dir=useMemo(()=>spatialAssetDirState(binding),[binding]);
 const asset=binding?.asset||null;

 async function persistBinding(nextAsset:RegisteredSpatialAsset|null){
  if(!selected)return;
  try{
   const graph=await readPrimarySpatialGraph();
   if(!graph||!Array.isArray(graph.entities))throw new Error('No compiled graph is available');
   let updated:InspectorEntity|null=null;
   graph.entities=(graph.entities as InspectorEntity[]).map((entity:InspectorEntity)=>{
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
   await replaceCurrentSpatialGraph(graph);
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

 const z=optionalNumber(selected.z);
 const zCandidate=optionalNumber(selected.meta?.zCandidateMeters);
 const localReviewSurfaceZ=optionalNumber(selected.meta?.localReviewSurfaceZ);
 const localReviewSurfaceLabel=String(selected.meta?.localReviewSurfaceKind||'LOCAL SURFACE').replaceAll('_',' ');
 const crossSheetReviewSurfaceZ=optionalNumber(selected.meta?.crossSheetReviewSurfaceZ);
 const crossSheetReviewSurfaceLabel=String(selected.meta?.crossSheetReviewSurfaceKind||'CROSS-SHEET SURFACE').replaceAll('_',' ');
 const reviewSurfaceZ=optionalNumber(selected.meta?.reviewSurfaceZ);
 const reviewSurfaceLabel=String(selected.meta?.reviewSurfaceKind||'PROJECT DATUM').replaceAll('_',' ');
 const supportBaseOffset=optionalNumber(selected.meta?.supportBaseOffsetMeters);
 const zCandidateReferencePoint=String(selected.meta?.zCandidateReferencePoint||'UNSPECIFIED').replaceAll('_',' ');
 const zResolutionAuthority=String(selected.meta?.zResolutionAuthority||'');
 const qr=asset?verificationUrl(asset):'';
 const zReviewed=selected.meta?.elevationKnown!==false&&selected.meta?.physicalElevationKnown!==false&&(selected.meta?.elevationKnown===true||selected.meta?.physicalElevationKnown===true||selected.meta?.zPlacementAuthority==='MEASURED_OR_REVIEWED');
 const tierLabel:Record<string,string>={L0:'Tier 0 · Source',L1:'Tier 1 · Drawing geometry',L2:'Tier 2 · Drawing callout, review required',L3:'Tier 3 · Electrical topology',L4:'Tier 4 · Registered asset'};

 return <div className="asset-inspector">
  <div className="section-head">
   <div>
    <div className="eyebrow">{asset?'Registered asset':'Spatial object'}</div>
    <h2 style={{margin:'4px 0'}}>{asset?.name||selected.name}</h2>
    <p className="subtitle" style={{margin:0}}>{asset?(asset.asset_code+' · '+asset.status):(tierLabel[selected.layer]||'Source candidate')}</p>
   </div>
   <span className={asset?(dir.finalized?'proof':'status-chip'):'pending'}>{asset?(dir.finalized?'DIR FINALIZED':'DIR PENDING'):'UNLINKED'}</span>
  </div>

  <div className={`placement-trust ${zReviewed?'reviewed':'needs-review'}`} role="status">
    <div><span>Z placement</span><strong>{zReviewed?'Measured / reviewed':zSolution?.status==='CONFLICT'?'Z CONFLICT · review required':zCandidate!==null?`${zCandidateReferencePoint} design Z reference · review required`:placement&& !['UNRESOLVED','RELATIVE_TO_REVIEW_PLANE'].includes(placement.zAuthority)?`${placement.baseZ.toFixed(2)} m placement candidate · review required`:localReviewSurfaceZ!==null?`${localReviewSurfaceLabel} local review surface · object Z unresolved`:crossSheetReviewSurfaceZ!==null?`${crossSheetReviewSurfaceLabel} cross-sheet review surface · object Z unresolved`:reviewSurfaceZ!==null?`${reviewSurfaceLabel} review surface · object Z unresolved`:'Review plane · physical Z unresolved'}</strong></div>
  </div>
  {zSolution?.status==='CONFLICT'&&<div className="notice" role="status"><strong>Z CONFLICT · AUTO-PLACEMENT BLOCKED</strong><span>{zSolution.explanation}</span><ul style={{margin:'8px 0 0',paddingLeft:18}}>{zSolution.conflicts.map((conflict,index)=><li key={index}><small>{conflict.reason} · {conflict.candidateA} vs {conflict.candidateB} · Δ {conflict.deltaMeters.toFixed(3)} m · threshold {conflict.toleranceMeters.toFixed(3)} m</small></li>)}</ul></div>}
  {zResolutionAuthority==='AFF_REFERENCE_UNSPECIFIED'&&!zReviewed&&<div className="notice" role="status"><strong>AFF HEIGHT FOUND · REFERENCE POINT REQUIRED</strong><span>STRATUM found an object-linked height above finished floor, but the drawing does not state whether that height is to the base, bottom, centerline, top, or mounting point. The height is preserved as evidence but is not converted into absolute equipment Z.</span></div>}
  {crossSheetReviewSurfaceZ!==null&&!zReviewed&&<div className="notice" role="status"><strong>CROSS-SHEET Z REVIEW SURFACE</strong><span>{crossSheetReviewSurfaceLabel} = {crossSheetReviewSurfaceZ.toFixed(3)} m via reviewed sheet alignment · confidence {Math.round(Number(selected.meta?.crossSheetReviewSurfaceConfidence||0)*100)}%. This remains coordination-derived design evidence, not field-verified physical elevation.</span></div>}
  {selected.kind==='imported-3d-model'&&<div className="notice" role="status"><strong>IMPORTED 3D GEOMETRY · REVIEW-SCALE</strong><span>This uploaded reference model is normalized to a component review envelope for Spatial presentation when its model-space units/dimensions are not trusted. Raw GLB bounds remain preserved in source details. Review-scale rendering does not establish OEM dimensions, installed elevation, asset identity or DIR state.</span></div>}
  {selected.kind==='sheet-callout-candidate'&&<div className="notice" role="status"><strong>DRAWING CALLOUT · REVIEW REQUIRED</strong><span>{selected.name} appears on sheet {String(selected.meta?.sheet||'unknown')}, page {String(selected.meta?.page||'?')}, at sheet X {String(selected.meta?.sheetX??'unresolved')} / Y {String(selected.meta?.sheetY??'unresolved')}, near {selected.zone||'an unresolved room'}. Equipment type, physical position and asset identity need confirmation. Maintenance can be recorded later for both existing and new registered assets. No history recorded by this drawing.</span></div>}
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

   {zSolution&&<details className="secondary-details z-solution-details">
    <summary>Z solution evidence</summary>
    <p className="muted">{zSolution.explanation}</p>
    {zSolution.candidates.map(candidate=><div className="binding-panel" key={candidate.id} style={{marginTop:8}}>
      <strong>{candidate.id.replaceAll('_',' ')} · {candidate.kind.replaceAll('_',' ')}</strong>
      <small style={{display:'block',marginTop:4}}>Base {candidate.baseZ===null?'unresolved':candidate.baseZ.toFixed(3)+' m'} · {candidate.authority.replaceAll('_',' ')} · confidence {Math.round(candidate.confidence*100)}%</small>
      <ol style={{margin:'8px 0 0',paddingLeft:18}}>{candidate.steps.map((step,index)=><li key={index}><small>{step.label}{step.valueMeters!==undefined?` · ${step.valueMeters.toFixed(3)} m`:''}{step.authority?` · ${step.authority.replaceAll('_',' ')}`:''}</small></li>)}</ol>
    </div>)}
   </details>}
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
     <select className="spatial-asset-select" value={linkId} onChange={event=>setLinkId(event.target.value)} style={{width:'100%'}}>
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
    <div><span>Z</span><strong>{zReviewed&&z!==null?`${z.toFixed(2)} m`:zCandidate!==null?`${zCandidate.toFixed(2)} m candidate`:localReviewSurfaceZ!==null?`${localReviewSurfaceZ.toFixed(2)} m ${localReviewSurfaceLabel.toLowerCase()} local surface`:crossSheetReviewSurfaceZ!==null?`${crossSheetReviewSurfaceZ.toFixed(2)} m ${crossSheetReviewSurfaceLabel.toLowerCase()} cross-sheet surface`:reviewSurfaceZ!==null?`${reviewSurfaceZ.toFixed(2)} m ${reviewSurfaceLabel.toLowerCase()} review surface`:'Review plane · unresolved'}</strong></div>
    <div><span>Physical Z</span><strong>{zReviewed?'Reviewed / source-established':'Unverified'}</strong></div>
    <div><span>Source</span><strong>{selected.source}</strong></div>
    <div><span>Confidence</span><strong>{Math.round(selected.confidence*100)}%</strong></div>
    <div><span>Zone</span><strong>{selected.zone||'Unresolved'}</strong></div>
    {placement&&<><div><span>Placement base candidate</span><strong>{placement.baseZ.toFixed(3)} m</strong></div><div><span>Placement authority</span><strong>{placement.zAuthority.replaceAll('_',' ')}</strong></div><div><span>Placement confidence</span><strong>{Math.round(placement.zConfidence*100)}%</strong></div>{placement.referencePoint&&<div><span>Source Z reference</span><strong>{placement.referencePoint.replaceAll('_',' ')}{placement.referenceZ!==undefined?` · ${placement.referenceZ.toFixed(3)} m`:''}</strong></div>}</>}
    {localReviewSurfaceZ!==null&&<><div><span>Local surface authority</span><strong>{String(selected.meta?.localReviewSurfaceAuthority||'SOURCE_ELEVATION_TRIANGLE').replaceAll('_',' ')}</strong></div><div><span>Surface confidence</span><strong>{Math.round(Number(selected.meta?.localReviewSurfaceConfidence||0)*100)}%</strong></div></>}
    {crossSheetReviewSurfaceZ!==null&&<><div><span>Cross-sheet Z authority</span><strong>{String(selected.meta?.crossSheetReviewSurfaceAuthority||'HUMAN_CONFIRMED_ALIGNMENT_PLUS_SOURCE_ELEVATION_TRIANGLE').replaceAll('_',' ')}</strong></div><div><span>Cross-sheet confidence</span><strong>{Math.round(Number(selected.meta?.crossSheetReviewSurfaceConfidence||0)*100)}%</strong></div></>}
    {reviewSurfaceZ!==null&&<div><span>Datum authority</span><strong>{String(selected.meta?.reviewSurfaceAuthority||'SOURCE_PROJECT_DATUM').replaceAll('_',' ')}</strong></div>}
    {supportBaseOffset!==null&&<><div><span>Support base offset</span><strong>{supportBaseOffset.toFixed(3)} m · {String(selected.meta?.supportOffsetKind||'SUPPORT').replaceAll('_',' ')}</strong></div><div><span>Support offset authority</span><strong>{String(selected.meta?.supportOffsetAuthority||'SOURCE_SUPPORT_NOTE').replaceAll('_',' ')}</strong></div><div><span>Support offset confidence</span><strong>{Math.round(Number(selected.meta?.supportOffsetConfidence||0)*100)}%</strong></div></>}
    {Number.isFinite(Number(selected.meta?.zScaleGuideMetersPerSourceUnit))&&<div><span>XYZ unit guide</span><strong>{Number(selected.meta?.zScaleGuideMetersPerSourceUnit).toFixed(6)} m/source unit</strong></div>}
    {zSolution&&<><div><span>Z solution</span><strong>{zSolution.status.replaceAll('_',' ')}</strong></div><div><span>Z chains compared</span><strong>{zSolution.candidates.length}</strong></div>{zSolution.chosenCandidateId&&<div><span>Chosen Z chain</span><strong>{zSolution.chosenCandidateId.replaceAll('_',' ')}</strong></div>}</>}
    {placement?.recommendation&&<div><span>Placement basis</span><strong>{placement.recommendation.kind.replaceAll('_',' ')}</strong></div>}
   </div>
   <details className="proof-details"><summary>Raw source details</summary><dl>{Object.entries(selected.meta||{}).filter(([key])=>key!=='embeddedGlb'&&(zReviewed||!/(?:^z$|^inferredZCandidate$)/i.test(key))).map(([key,value])=><div key={key}><dt>{key}</dt><dd style={{overflowWrap:'anywhere'}}>{typeof value==='object'?JSON.stringify(value):String(value)}</dd></div>)}</dl></details>
  </details>
  {message&&<p role="status" className="muted">{message}</p>}
 </div>;
}
