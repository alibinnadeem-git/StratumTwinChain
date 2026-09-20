import Link from 'next/link';
import {recentChain} from '@/lib/server/live-views';
import {probeDirRpc} from '@/lib/server/chain';
import {readSession} from '@/lib/server/auth';

export const dynamic='force-dynamic';

const short=(value:string|null|undefined,n=15)=>value?value.length>n*2?`${value.slice(0,n)}…${value.slice(-n)}`:value:'—';

function voteCount(value:unknown){
 if(Array.isArray(value))return value.length;
 if(!value||typeof value!=='object')return 0;
 const record=value as any;
 if(Array.isArray(record.PFC?.COMMITSignatures))return new Set(record.PFC.COMMITSignatures.map((item:any)=>item.validatorId).filter(Boolean)).size;
 if(Array.isArray(record.PFC?.signerIds))return new Set(record.PFC.signerIds).size;
 if(Array.isArray(record.signerIds))return new Set(record.signerIds).size;
 return 0;
}

export default async function ChainPage(){
 const session=await readSession();
 if(!session)return <div className="card"><div className="eyebrow">Digital Immutable Records · DIR</div><h1>Sign in to inspect DIR history</h1><p className="muted">Validator chain metadata is read through the authenticated STRATUM application, not exposed by duplicating chain tables into the tenant database.</p><Link className="action" href="/login">Sign in</Link></div>;

 const status=await probeDirRpc();
 let explorer:any={state:null,blocks:[]};
 try{explorer=await recentChain();}catch{}
 const height=Number(explorer.state?.height||status.height||0);
 const latestHash=explorer.state?.latest_block_hash||null;
 const genesisHash=explorer.state?.genesis_hash||null;
 const chainReady=status.reachable&&status.connected&&status.engineReady&&status.activeValidatorCount===3&&status.requiredQuorum===3;

 return <>
  <div className="page-head"><div><div className="eyebrow">Digital Immutable Records · DIR</div><h1 className="title">DIR Explorer</h1><div className="subtitle">Authoritative immutable lifecycle records are read from Validator A and its PoVI validator network. The Spatial application database stores tenant data and ledger references, not a second copy of chain state.</div></div><span className={chainReady?'badge':'pending'}>{chainReady?'DIR NETWORK ONLINE':'DIR NETWORK NOT READY'}</span></div>

  <div className="grid kpis">
   <div className="card"><div className="label">DIR Network</div><div className="metric" style={{fontSize:20}}>{status.chainId||explorer.state?.chain_id||'—'}</div></div>
   <div className="card"><div className="label">Finalized Record Height</div><div className="metric">{height}</div></div>
   <div className="card"><div className="label">Validator Authorities</div><div className="metric">{status.activeValidatorCount??0}</div></div>
   <div className="card"><div className="label">Required Quorum</div><div className="metric">{status.requiredQuorum??'—'}</div></div>
  </div>

  <div className="grid two">
   <div className="card"><div className="section-head"><div><div className="label">Finalization State</div><h2>Latest immutable record group</h2></div><span className={height>0?'proof':'pending'}>{height>0?'DIR FINALIZED':'GENESIS / EMPTY'}</span></div>
    <div className="verify-grid"><span>Record height</span><b>{height}</b><span>Record hash</span><b className="mono">{short(latestHash,22)}</b><span>Genesis</span><b className="mono">{short(genesisHash,22)}</b><span>PoVI engine</span><b>{status.engineReady?'READY':'NOT READY'}</b><span>Required authority</span><b>{status.requiredQuorum??'—'} of {status.activeValidatorCount??'—'}</b></div>
   </div>
   <div className="card"><div className="label">Validator Authorities</div><h2>Independent signers</h2><div className="timeline">{status.validators.map((validator,index)=><div className="event" key={validator.id||validator.address||index}><i className="event-icon">✓</i><div><strong>{validator.name||validator.id||`Validator ${index+1}`}</strong><small className="mono">{validator.address||'Address unavailable'}</small></div></div>)}{!status.validators.length&&<div className="muted">Validator status will appear when Validator A is reachable and configured.</div>}</div></div>
  </div>

  <div className="card table-card" style={{marginTop:16}}>
   <div className="section-head"><div><div className="eyebrow">Immutable Record Explorer</div><h2>Finalized proof records</h2></div><span className="proof">{explorer.blocks.length} shown</span></div>
   <table className="table"><thead><tr><th>Record #</th><th>Event / Record</th><th>Reference</th><th>Evidence Hash</th><th>Authority</th><th>Votes</th></tr></thead><tbody>
    {explorer.blocks.map((block:any)=><tr key={block.block_hash}><td><strong>#{block.height}</strong><div className="muted">{new Date(block.finalized_at).toLocaleString()}</div></td><td>{block.event_type||'Proof'}<div className="muted mono">{short(block.record_id,12)}</div></td><td className="mono" title={block.tx_hash}>{short(block.tx_hash,12)}</td><td className="mono" title={block.evidence_hash||''}>{short(block.evidence_hash,12)}</td><td>{block.proposer_validator_id}</td><td><span className="proof">{voteCount(block.votes_json)}/{status.activeValidatorCount||3}</span></td></tr>)}
    {!explorer.blocks.length&&<tr><td colSpan={6}><span className="muted">{status.reachable?'No finalized DIR records returned by the authoritative explorer.':'Validator A explorer is unavailable.'}</span></td></tr>}
   </tbody></table>
  </div>

  <div className="card" style={{marginTop:16}}><div className="label">Trust & privacy boundary</div><h2>One authoritative chain, private project content outside it</h2><div className="subtitle">DIR carries proof identifiers, hashes, timestamps and validator finality. Photos, drawings, contracts and customer files remain in private application storage. DIR finality secures the immutable record; it does not independently establish physical truth.</div></div>
 </>;
}
