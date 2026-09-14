import Link from 'next/link';
import AssetQR from '@/components/AssetQR';
import AssetArchiveControls from '@/components/AssetArchiveControls';
import HumanAttestationPanel from '@/components/HumanAttestationPanel';
import {assetArchiveHistory,assetLifecycle,liveAsset,publicEvidence} from '@/lib/server/live-views';
import {readSession} from '@/lib/server/auth';
import {findAsset,evidence as demoEvidence} from '@/lib/data';
import {calculateAssetReadiness} from '@/lib/twin-intelligence';

export const dynamic='force-dynamic';
const date=(d:Date|string|null|undefined)=>d?new Date(d).toLocaleString('en-US',{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'—';
const short=(s:string|null|undefined,n=18)=>s?s.length>n*2?`${s.slice(0,n)}…${s.slice(-n)}`:s:'—';

function demoToPassport(identifier:string){
 const d=findAsset(identifier);if(!d)return null;
 const p=(d.project||'').toString();
 return {
  id:d.id,asset_code:d.id,asset_type:d.type,name:d.name,model:d.model||null,serial_number:d.serial||null,location_label:d.location||null,status:d.status,qr_token:d.qrToken,specifications:d.specs||{},installed_at:d.installedAt||null,commissioned_at:d.commissionedAt||null,warranty_expires_at:d.warranty||null,project_code:p,project_name:p,site_name:d.site,system_name:d.system,manufacturer_name:d.manufacturer,latest_event_id:d.tx||null,latest_event_type:d.stages?.slice().reverse().find(s=>s.status==='verified')?.stage||'REGISTER_ASSET',latest_event_status:d.block?'VERIFIED':'PENDING',ledger_network:'stratum-devnet-1',ledger_tx_hash:d.tx||null,ledger_block_height:d.block||null,anchored_at:d.commissionedAt||d.installedAt||null,
  archived:false,archive_action:null,archive_reason:null,archive_occurred_at:null,archive_schema_ready:false,
  __demo:true,
  __stages:d.stages||[]
 } as any;
}

export default async function AssetDetail({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const identifier=decodeURIComponent(id);
 let asset:any=null,events:any[]=[];let evidence:any[]=[];let archiveEvents:any[]=[];let backendOnline=true;let referenceMode=false;
 try{
  asset=await liveAsset(identifier);
  if(asset)[events,evidence,archiveEvents]=await Promise.all([assetLifecycle(asset.id),publicEvidence(asset.id),assetArchiveHistory(asset.id)]);
 }catch(error){
  backendOnline=false;
  console.error('Asset passport backend unavailable; reference mode may be used.',error);
  asset=demoToPassport(identifier);
  referenceMode=Boolean(asset);
  if(asset){
   events=asset.__stages.map((s:any,i:number)=>({id:`demo-${i}`,event_type:s.stage,status:s.status==='verified'?'VERIFIED':s.status==='pending'?'SUBMITTED':'PLANNED',occurred_at:s.date||null,payload_sha256:null,evidence_package_sha256:null,performed_by_name:s.actor||null,approved_by_name:null,ledger_block_height:s.block||null}));
   evidence=demoEvidence.filter(e=>e.assetId===asset.id).map(e=>({id:e.id,kind:e.kind,sha256:e.hash,visibility:e.privacy,captured_at:null}));
  }
 }

 if(!asset)return <><div className="page-head"><div><div className="eyebrow">Asset Passport</div><h1 className="title">Asset not found</h1><p className="subtitle">This asset identifier does not exist in the active organization. Reference equipment is never substituted for a live tenant miss.</p></div></div><div className="card"><div className="button-row"><Link className="action" href="/assets">Return to Asset Passports</Link><Link className="ghost" href="/scan">Scan equipment</Link><Link className="ghost" href="/spatial">Open STRATUM Spatial Verified</Link></div></div></>;

 const session=await readSession();
 const liveTenant=!referenceMode&&!asset.__demo;
 const canManage=Boolean(session&&(session.role==='SUPER_ADMIN'||session.role==='ORG_ADMIN'))&&liveTenant;
 const appBase=(process.env.NEXT_PUBLIC_APP_URL||'https://stratumspatialverified.vercel.app').replace(/\/$/,'');
 const qr=`${appBase}/verify?q=${encodeURIComponent(asset.asset_code)}`;
 const readiness=referenceMode&&findAsset(identifier)?calculateAssetReadiness(findAsset(identifier)!):null;
 const dirFinalized=Boolean(asset.ledger_block_height&&asset.ledger_tx_hash);
 const verifiedEvents=events.filter((event:any)=>event.status==='VERIFIED').length;
 const submittedEvents=events.filter((event:any)=>event.status==='SUBMITTED').length;

 return <>
 {referenceMode&&<div className="card" style={{marginBottom:16,borderColor:'#75592e'}}><div className="eyebrow">REFERENCE MODE · LIVE TENANT BACKEND UNAVAILABLE</div><p className="subtitle" style={{marginTop:6}}>The information below is explicitly reference data. It is not live tenant state and cannot be used to approve work, establish asset identity in a tenant, or establish Verified infrastructure state.</p></div>}
 {!backendOnline&&!referenceMode&&<div className="card" style={{marginBottom:16,borderColor:'#75592e'}}><div className="eyebrow">LIVE BACKEND UNAVAILABLE</div><p className="subtitle" style={{marginTop:6}}>No reference asset was substituted. Retry after the tenant data connection is available.</p></div>}
 {liveTenant&&<AssetArchiveControls assetId={asset.id} archived={Boolean(asset.archived)} archiveSchemaReady={Boolean(asset.archive_schema_ready)} canManage={canManage} archiveReason={asset.archive_reason} archiveOccurredAt={asset.archive_occurred_at}/>} 

 <div className="page-head"><div><div className="eyebrow">Asset Passport · {asset.asset_code}</div><h1 className="title">{asset.name}</h1><p className="subtitle">{asset.manufacturer_name||'Manufacturer pending'} {asset.model||''} · Serial {asset.serial_number||'—'}</p></div><div className="button-row"><Link className="ghost" href={`/verify?q=${encodeURIComponent(asset.asset_code)}`}>Public verification</Link><Link className="ghost" href="/scan">Scan equipment</Link>{liveTenant&&!asset.archived&&<Link className="action" href={`/inspection?q=${encodeURIComponent(asset.id)}`}>Start inspection</Link>}</div></div>

 <section className="card" style={{marginBottom:16}}><div className="section-head"><div><div className="eyebrow">Passport truth boundary</div><h2>Identity, evidence and finality are separate claims</h2></div><span className={referenceMode?'pending':'proof'}>{referenceMode?'REFERENCE':'LIVE TENANT'}</span></div><div className="spec-grid"><div><span>Asset identity</span><strong>{liveTenant?'Tenant registry record':'Reference identity only'}</strong></div><div><span>Lifecycle records</span><strong>{events.length} total · {verifiedEvents} VERIFIED status</strong></div><div><span>Evidence fingerprints</span><strong>{evidence.length} public metadata record{evidence.length===1?'':'s'}</strong></div><div><span>DIR state</span><strong>{dirFinalized?'DIR FINALIZED':'NO FINALIZED DIR'}</strong></div><div><span>Administrative state</span><strong>{asset.archived?'ARCHIVED':'ACTIVE REGISTRY'}</strong></div><div><span>Physical truth</span><strong>Never inferred from identity, signature, hash or DIR alone</strong></div></div><p className="muted" style={{marginBottom:0}}>Observed field conditions, authorized human approval, provenance and deterministic validation remain distinct from immutable record finality. Cryptography ≠ Physical Truth.</p></section>

 <section className="grid asset-top"><div className="card"><div className="asset-identity"><div><span className="status-chip">{asset.status}</span>{asset.archived&&<span className="pending" style={{marginLeft:8}}>ADMIN ARCHIVE</span>}<h2>{asset.system_name||'System unassigned'}</h2><p className="muted">{asset.project_name} · {asset.site_name} · {asset.location_label||'Location pending'}</p></div><div className="qr-wrap"><AssetQR value={qr} size={150}/><small>{asset.asset_code}</small></div></div><div className="spec-grid">{Object.entries(asset.specifications||{}).map(([k,v])=><div key={k}><span>{k}</span><strong>{typeof v==='string'?v:JSON.stringify(v)}</strong></div>)}<div><span>Installed</span><strong>{date(asset.installed_at)}</strong></div><div><span>Commissioned</span><strong>{date(asset.commissioned_at)}</strong></div><div><span>Warranty through</span><strong>{date(asset.warranty_expires_at)}</strong></div></div></div>
 <div className="card proof-panel"><div className="eyebrow">Latest Digital Immutable Record</div>{dirFinalized?<><div className="proof-seal">✓</div><h2>DIR FINALIZED</h2><p className="muted">An immutable lifecycle record is finalized. This establishes record finality/integrity under the applicable trust process; it does not by itself establish physical truth.</p><div className="proof-data"><span>Lifecycle status</span><b>{asset.latest_event_status||'—'}</b><span>Record network</span><b>{asset.ledger_network||'stratum-devnet-1'}</b><span>Immutable record</span><b>#{asset.ledger_block_height}</b><span>Transaction reference</span><b className="mono" title={asset.ledger_tx_hash||''}>{short(asset.ledger_tx_hash)}</b><span>Lifecycle record</span><b className="mono">{short(asset.latest_event_id)}</b><span>Finalized</span><b>{date(asset.anchored_at)}</b></div></>:<><div className="proof-seal pending-seal">…</div><h2>No finalized DIR yet</h2><p className="muted">Lifecycle evidence may exist before finality. A missing DIR is not silently upgraded to a Verified claim.</p></>}</div></section>

 <section className="card lifecycle-card"><div className="section-head"><div><div className="eyebrow">Lifecycle</div><h2>Lifecycle record history</h2></div><span className="proof">{verifiedEvents} VERIFIED · {submittedEvents} SUBMITTED</span></div><div className="vertical-timeline">{events.map((e:any)=><div className={`life-event ${e.status==='VERIFIED'?'verified':e.status==='SUBMITTED'?'pending':''}`} key={e.id}><i>{e.status==='VERIFIED'?'✓':e.status==='SUBMITTED'?'●':'○'}</i><div><strong>{e.event_type}</strong><span>{date(e.occurred_at)} · {e.performed_by_name||'Actor recorded'}{e.approved_by_name?` → approved by ${e.approved_by_name}`:''}</span><small className="mono">Payload {short(e.payload_sha256,14)} · Evidence {short(e.evidence_package_sha256,14)}</small></div><b>{e.ledger_block_height?`DIR ${e.ledger_block_height}`:e.status}</b></div>)}{!events.length&&<p className="muted">No lifecycle events recorded yet.</p>}</div><p className="muted">A lifecycle event carrying status VERIFIED is a governed record state. The Passport does not convert that label into an unsupported assertion about current physical condition.</p></section>

 {liveTenant&&<HumanAttestationPanel assetId={asset.id}/>} 

 {liveTenant&&<section className="card" style={{marginTop:16}}><div className="section-head"><div><div className="eyebrow">Administrative provenance</div><h2>Archive / restore history</h2></div><span className="muted">Not physical truth</span></div>{archiveEvents.length?<div className="vertical-timeline">{archiveEvents.map((event:any)=><div className="life-event" key={event.id}><i>{event.action==='ARCHIVE'?'−':'↺'}</i><div><strong>{event.action==='ARCHIVE'?'Archived from active registry':'Restored to active registry'}</strong><span>{date(event.occurred_at)} · {event.actor_name||'Authorized administrator'}</span><small>{event.reason}</small></div><b>{event.action}</b></div>)}</div>:<p className="muted">No administrative archive/restore events have been recorded for this asset.</p>}<p className="muted">These events control registry visibility only. They do not rewrite lifecycle evidence, DIR/PFC finality, PoVI authority, or Verified infrastructure state.</p></section>}

 <section className="grid two"><div className="card"><div className="section-head"><div><div className="eyebrow">Evidence fingerprints</div><h3>Private files, verifiable integrity</h3></div></div>{evidence.length?evidence.map((d:any)=><div className="file-row" key={d.id}><div className="file-icon">SHA</div><div><strong>{d.kind}</strong><small>SHA-256 <span className="mono">{short(d.sha256,16)}</span> · {date(d.captured_at)}</small></div><span className="proof">{d.visibility}</span></div>):<p className="muted">No evidence linked yet.</p>}<p className="muted">Private file contents are not exposed by this Passport; only permitted verification metadata and cryptographic fingerprints are shown.</p></div><div className="card"><div className="eyebrow">Provenance</div><h3>Asset context</h3><div className="custody"><div><i/>Project<span>{asset.project_code} · {asset.project_name}</span></div><div><i/>Physical site<span>{asset.site_name}</span></div><div><i/>Electrical system<span>{asset.system_name||'Unassigned'}</span></div><div><i/>Equipment identity<span>{asset.asset_code} · {asset.serial_number||'No serial'}</span></div><div><i/>DIR<span>{dirFinalized?`Finalized immutable record ${asset.ledger_block_height}`:'No finalized immutable record'}</span></div></div></div></section>

 <section className="card" style={{marginTop:16}}><div className="section-head"><div><div className="eyebrow">Field & operations</div><h2>Continue from the same asset identity</h2></div><span className={asset.archived?'pending':'proof'}>{asset.archived?'ARCHIVED':'ACTIVE'}</span></div><div className="button-row"><Link className="ghost" href="/scan">Scan another asset</Link>{liveTenant&&!asset.archived&&<Link className="action" href={`/inspection?q=${encodeURIComponent(asset.id)}`}>Inspection & evidence</Link>}{liveTenant&&<Link className="ghost" href={`/assets/${encodeURIComponent(asset.id)}/attestations`}>Human attestations</Link>}<Link className="ghost" href="/maintenance">Maintenance</Link><Link className="ghost" href="/spatial">Locate in Spatial</Link><Link className="ghost" href={`/verify?q=${encodeURIComponent(asset.asset_code)}`}>Public verification</Link></div><p className="muted" style={{marginBottom:0}}>Field actions reference this asset identity but remain separate governed workflows. A scan, Passport view, attestation view or navigation action never changes Verified state.</p></section>

 {readiness&&<section className="card" style={{marginTop:16}}><div className="section-head"><div><div className="eyebrow">Reference continuous handover</div><h2>{readiness.score}% turnover ready · {readiness.commissioningScore}% commissioning ready</h2></div><span className={readiness.ready?'proof':'pending'}>{readiness.ready?'READY':'BLOCKED'}</span></div><div className="spec-grid">{readiness.items.map(item=><div key={item.key}><span>{item.complete?'✓':'○'} {item.label}</span><strong>{item.complete?'Complete':item.critical?'Required blocker':'Outstanding'}</strong></div>)}</div><p className="muted">This readiness projection is reference-only while the live tenant backend is unavailable.</p></section>}
 </>;
}
