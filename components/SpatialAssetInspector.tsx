'use client';

import Link from 'next/link';
import {useMemo,useState} from 'react';
import {readPrimarySpatialGraph,replaceCurrentSpatialGraph} from '@/lib/spatial-browser-recovery';
import {resolveReconciledAssetPlacement} from '@/lib/z-solution-chain';
import {resolveElectricalComponent,modelSourceRefsFor} from '@/lib/electrical-component-library';
import {recordAcceptedZInference} from '@/lib/z-history';
import {inferenceMethodLabel,type ZInference} from '@/lib/z-inference';
import {readSelectedSpatialProjectId} from '@/lib/spatial-project-selection';
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
 authenticated=false,
 onEntityUpdated,
}:{
 selected:InspectorEntity|null;
 registeredAssets:RegisteredSpatialAsset[];
 authenticated?:boolean;
 onEntityUpdated?:(entity:InspectorEntity)=>void;
}){
 const [linkId,setLinkId]=useState('');
 const [message,setMessage]=useState('');
 const binding=useMemo(()=>resolveRegisteredSpatialAsset(selected,registeredAssets),[selected,registeredAssets]);
 const component=useMemo(()=>selected?resolveElectricalComponent(selected.name):null,[selected]);
 const modelRefs=useMemo(()=>component?modelSourceRefsFor(component.key):[],[component]);
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

 async function persistZPreview(inference:ZInference|null){
  if(!selected)return;
  if(zSolution?.status==='CONFLICT'&&inference){setMessage('Z preview is blocked while independent source-grounded Z chains conflict. Resolve the source conflict first.');return;}
  if(inference&&inference.renderBaseZMeters===null){setMessage('This proposal is relative to an unresolved support/reference point and cannot be placed at an absolute 3D Z yet.');return;}
  try{
   const graph=await readPrimarySpatialGraph();
   if(!graph||!Array.isArray(graph.entities))throw new Error('No compiled graph is available');
   let updated:InspectorEntity|null=null;
   graph.entities=(graph.entities as InspectorEntity[]).map((entity:InspectorEntity)=>{
    if(entity.id!==selected.id)return entity;
    const meta={...(entity.meta||{})};
    if(inference){
     meta.zPreviewBaseMeters=inference.renderBaseZMeters;meta.zPreviewReferenceMeters=inference.absoluteReferenceZMeters;
     meta.zPreviewReferencePoint=inference.referencePoint;meta.zPreviewConfidence=inference.confidence;
     meta.zPreviewInferenceId=inference.id;meta.zPreviewMethod=inference.method;meta.zPreviewBasis=inference.basis.join('; ');
     meta.zPreviewAppliedAt=new Date().toISOString();meta.zPreviewAuthority='HUMAN_APPLIED_INFERRED_PREVIEW';
    }else{
     for(const key of ['zPreviewBaseMeters','zPreviewReferenceMeters','zPreviewReferencePoint','zPreviewConfidence','zPreviewInferenceId','zPreviewMethod','zPreviewBasis','zPreviewAppliedAt','zPreviewAuthority'])delete meta[key];
    }
    updated={...entity,meta};return updated;
   });
   await replaceCurrentSpatialGraph(graph);
   if(updated)onEntityUpdated?.(updated);
   setMessage(inference?`3D preview moved to inferred base Z ${inference.renderBaseZMeters!.toFixed(2)} m. Display only — entity.z and physical truth were not changed.`:'3D Z preview cleared.');
  }catch(error){setMessage(error instanceof Error?error.message:'Unable to update the 3D preview');}
 }

 async function acceptInferredZ(inference:ZInference){
  if(!selected)return;
  if(!authenticated){setMessage('Sign in before recording an H2 coordination-review decision. You may still preview the inference locally.');return;}
  if(zSolution?.status==='CONFLICT'){setMessage('H2 acceptance is blocked while source-grounded Z chains conflict. Resolve the source conflict instead of selecting an AI inference.');return;}
  try{
   const graph=await readPrimarySpatialGraph();
   if(!graph||!Array.isArray(graph.entities))throw new Error('No compiled graph is available');
   const projectId=readSelectedSpatialProjectId();
   const acceptedAt=new Date().toISOString();
   let updated:InspectorEntity|null=null;
   graph.entities=(graph.entities as InspectorEntity[]).map((entity:InspectorEntity)=>{
    if(entity.id!==selected.id)return entity;
    const meta:Record<string,unknown>={...(entity.meta||{}),
      zReviewDecision:'H2_ACCEPTED_INFERENCE',zReviewDecisionAt:acceptedAt,zReviewInferenceId:inference.id,
      zReviewMethod:inference.method,zReviewReferencePoint:inference.referencePoint,
      zReviewOffsetMeters:inference.offsetMeters,zReviewAbsoluteReferenceMeters:inference.absoluteReferenceZMeters,
      zReviewSupportKind:inference.support?.kind||null,zReviewSupportZMeters:inference.support?.zMeters??null,
      zReviewProjectId:projectId||null,zPlacementAuthority:'H2_ACCEPTED_INFERENCE',
      verificationState:'UNVERIFIED',physicalTruth:false,physicalElevationKnown:false,elevationKnown:false,reviewRequired:true,
      zReviewPromotionBlocked:true,zReviewActorClass:'AUTHENTICATED_SESSION',zReviewActorId:null
    };
    if(inference.renderBaseZMeters!==null){
      meta.zPreviewBaseMeters=inference.renderBaseZMeters;meta.zPreviewReferenceMeters=inference.absoluteReferenceZMeters;
      meta.zPreviewReferencePoint=inference.referencePoint;meta.zPreviewConfidence=inference.confidence;meta.zPreviewInferenceId=inference.id;
      meta.zPreviewMethod=inference.method;meta.zPreviewBasis='H2 accepted inference: '+inference.basis.join('; ');meta.zPreviewAppliedAt=acceptedAt;meta.zPreviewAuthority='H2_ACCEPTED_INFERRED_PREVIEW';
    }
    updated={...entity,meta};return updated;
   });
   await replaceCurrentSpatialGraph(graph);
   if(updated)onEntityUpdated?.(updated);
   if(projectId&&component?.key&&inference.support&&inference.offsetMeters!==null&&inference.absoluteReferenceZMeters!==null){
    recordAcceptedZInference({projectId,entityId:selected.id,componentKey:component.key,supportKind:inference.support.kind,supportZMeters:inference.support.zMeters,offsetMeters:inference.offsetMeters,referencePoint:inference.referencePoint,absoluteReferenceZMeters:inference.absoluteReferenceZMeters,inferenceMethod:inference.method,sourceInferenceId:inference.id,basis:inference.basis,sourceRefs:inference.sourceRefs});
   }
   setMessage(inference.absoluteReferenceZMeters===null
    ?`Accepted ${inference.offsetMeters?.toFixed(2)??'unresolved'} m relative mounting evidence for H2 coordination review. No absolute project Z was created.`
    :`Accepted inferred ${inference.referencePoint.replaceAll('_',' ').toLowerCase()} Z ${inference.absoluteReferenceZMeters.toFixed(2)} m for H2 coordination review. It remains AI inferred, unverified, review-required and physicalTruth:false.`);
  }catch(error){setMessage(error instanceof Error?error.message:'Unable to accept inferred Z');}
 }

 async function rejectInference(inference:ZInference){
  if(!selected)return;
  try{
   const graph=await readPrimarySpatialGraph();
   if(!graph||!Array.isArray(graph.entities))throw new Error('No compiled graph is available');
   let updated:InspectorEntity|null=null;
   graph.entities=(graph.entities as InspectorEntity[]).map((entity:InspectorEntity)=>{
    if(entity.id!==selected.id)return entity;
    const meta={...(entity.meta||{})};
    meta.rejectedZInferenceIds=[...new Set([...(Array.isArray(meta.rejectedZInferenceIds)?meta.rejectedZInferenceIds.map(String):[]),inference.id])];
    meta.zInferenceRejectedAt=new Date().toISOString();
    if(meta.zPreviewInferenceId===inference.id)for(const key of ['zPreviewBaseMeters','zPreviewReferenceMeters','zPreviewReferencePoint','zPreviewConfidence','zPreviewInferenceId','zPreviewMethod','zPreviewBasis','zPreviewAppliedAt','zPreviewAuthority'])delete meta[key];
    updated={...entity,meta};return updated;
   });
   await replaceCurrentSpatialGraph(graph);if(updated)onEntityUpdated?.(updated);
   setMessage('Inference rejected for this object. Source evidence, the reconciled Z solution and authoritative entity.z remain unchanged.');
  }catch(error){setMessage(error instanceof Error?error.message:'Unable to reject inferred Z');}
 }

 if(!selected)return <div className="inspector-empty">
  <div className="eyebrow">Inspect equipment</div>
  <h3>Click an asset in Spatial</h3>
  <p className="subtitle">Identity, placement, lifecycle work, evidence and DIR state will appear here.</p>
 </div>;

 const z=optionalNumber(selected.z);
 const zCandidate=optionalNumber(selected.meta?.zCandidateMeters);
 const zInferences=(Array.isArray(selected.meta?.zInferences)?selected.meta.zInferences:[]) as ZInference[];
 const rejectedInferenceIds=new Set(Array.isArray(selected.meta?.rejectedZInferenceIds)?selected.meta.rejectedZInferenceIds.map(String):[]);
 const visibleZInferences=zInferences.filter(inference=>!rejectedInferenceIds.has(inference.id));
 const zPreviewBase=optionalNumber(selected.meta?.zPreviewBaseMeters);
 const zAccepted=selected.meta?.zReviewDecision==='H2_ACCEPTED_INFERENCE';
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
    <div><span>Z placement</span><strong>{zReviewed?'Measured / reviewed':zSolution?.status==='CONFLICT'?'Z CONFLICT · review required':zAccepted?'H2 accepted AI inference · unverified':zPreviewBase!==null?`Inferred 3D base preview ${zPreviewBase.toFixed(2)} m · display only`:zCandidate!==null?`${zCandidateReferencePoint} design Z reference · review required`:placement&& !['UNRESOLVED','RELATIVE_TO_REVIEW_PLANE'].includes(placement.zAuthority)?`${placement.baseZ.toFixed(2)} m placement candidate · review required`:localReviewSurfaceZ!==null?`${localReviewSurfaceLabel} local review surface · object Z unresolved`:crossSheetReviewSurfaceZ!==null?`${crossSheetReviewSurfaceLabel} cross-sheet review surface · object Z unresolved`:reviewSurfaceZ!==null?`${reviewSurfaceLabel} review surface · object Z unresolved`:'Review plane · physical Z unresolved'}</strong></div>
    {zPreviewBase!==null&&<div style={{marginTop:6}}><button type="button" onClick={()=>void persistZPreview(null)}>Clear inferred 3D preview</button></div>}
  </div>
  {modelRefs.length>0&&<div className="notice" style={{marginTop:10}}>
   <strong>OEM 3D MODEL SOURCES · DISCOVERY ONLY</strong>
   <span>External research leads are not bundled or license-cleared STRATUM models. Procedural geometry remains active until exact model, format, licensing, redistribution and geometry QA all pass.</span>
   <ul style={{margin:'8px 0 0',paddingLeft:18}}>{modelRefs.map((ref,index)=><li key={index} style={{marginBottom:6}}><a href={ref.url} target="_blank" rel="noreferrer">{ref.label}</a><br/><small className="muted">{ref.status.replaceAll('_',' ')} · {ref.access.replaceAll('_',' ')} — {ref.note}</small></li>)}</ul>
  </div>}
  {visibleZInferences.length>0&&!zReviewed&&<div className="notice" role="status" style={{marginTop:10}}>
   <strong>AI INFERRED Z PROPOSALS · NOT VERIFIED</strong>
   <span>Inference is below source/review evidence in the Z hierarchy. Relative offsets never become absolute coordinates without a resolved support datum. H2 acceptance is coordination-only, requires sign-in, and cannot resolve a source-chain conflict.</span>
   <ol style={{margin:'8px 0 0',paddingLeft:18}}>{visibleZInferences.map((inference,index)=><li key={inference.id||index} style={{marginBottom:10}}>
    <b>{inference.absoluteReferenceZMeters!==null?`${inference.absoluteReferenceZMeters.toFixed(2)} m absolute ${inference.referencePoint.replaceAll('_',' ').toLowerCase()}`:`${inference.offsetMeters?.toFixed(2)??'—'} m relative ${inference.referencePoint.replaceAll('_',' ').toLowerCase()}`}</b>
    <small> · {Math.round(inference.confidence*100)}% · {inferenceMethodLabel(inference.method)}{inference.corroboratingMethods.length>1?` · corroborated by ${inference.corroboratingMethods.length} methods`:''}</small>
    <br/><small className="muted">{inference.basis.join(' — ')}</small>
    {inference.support&&<><br/><small className="muted">Support: {inference.support.kind.replaceAll('_',' ')} {inference.support.zMeters.toFixed(2)} m · {Math.round(inference.support.confidence*100)}%</small></>}
    {inference.sourceRefs.length>0&&<><br/><small className="muted">Evidence: {inference.sourceRefs.map((ref,i)=>ref.url?<span key={i}><a href={ref.url} target="_blank" rel="noreferrer">{ref.label}</a>{i<inference.sourceRefs.length-1?' · ':''}</span>:<span key={i}>{ref.label}{i<inference.sourceRefs.length-1?' · ':''}</span>)}</small></>}
    <div className="button-row" style={{marginTop:4}}>
     <button type="button" onClick={()=>void persistZPreview(inference)} disabled={inference.renderBaseZMeters===null||zSolution?.status==='CONFLICT'}>Preview in 3D</button>
     <button type="button" onClick={()=>void acceptInferredZ(inference)} disabled={!authenticated||zSolution?.status==='CONFLICT'} title={!authenticated?'Sign in to record an H2 review decision':zSolution?.status==='CONFLICT'?'Resolve the source-grounded Z conflict first':'Record an H2 coordination-review decision'}>Accept for coordination</button>
     <button type="button" className="ghost" onClick={()=>void rejectInference(inference)}>Reject</button>
    </div>
   </li>)}</ol>
  </div>}
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
  {zSolution&&<details className="secondary-details z-solution-details">
   <summary>Z solution evidence</summary>
   <p className="muted">{zSolution.explanation}</p>
   {zSolution.candidates.map(candidate=><div className="binding-panel" key={candidate.id} style={{marginTop:8}}>
    <strong>{candidate.id.replaceAll('_',' ')} · {candidate.kind.replaceAll('_',' ')}</strong>
    <small style={{display:'block',marginTop:4}}>Base {candidate.baseZ===null?'unresolved':candidate.baseZ.toFixed(3)+' m'} · {candidate.authority.replaceAll('_',' ')} · confidence {Math.round(candidate.confidence*100)}%</small>
    <ol style={{margin:'8px 0 0',paddingLeft:18}}>{candidate.steps.map((step,index)=><li key={index}><small>{step.label}{step.valueMeters!==undefined?` · ${step.valueMeters.toFixed(3)} m`:''}{step.authority?` · ${step.authority.replaceAll('_',' ')}`:''}</small></li>)}</ol>
   </div>)}
  </details>}
  {message&&<p role="status" className="muted">{message}</p>}
 </div>;
}
