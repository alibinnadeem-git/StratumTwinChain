import {recentChain} from '@/lib/server/live-views';
import {requiredPoviQuorum} from '@/lib/redbook/povi/quorum';
export const dynamic='force-dynamic';

async function rpcStatus(){
 const rpc=(process.env.STRATUM_CHAIN_RPC_URL||'').replace(/\/$/,'');
 if(!rpc)return{connected:false,poviConformant:false,chainId:process.env.STRATUM_CHAIN_ID||'stratum-devnet-1',height:0,latestBlockHash:'Not connected',validators:[],nativeDenom:'ustrm',displayDenom:'STRM'};
 try{
  const r=await fetch(`${rpc}/v1/status`,{cache:'no-store'});
  if(!r.ok)throw new Error();
  return{...await r.json(),connected:true};
 }catch{
  return{connected:false,poviConformant:false,chainId:process.env.STRATUM_CHAIN_ID||'stratum-devnet-1',height:0,latestBlockHash:'RPC unavailable',validators:[],nativeDenom:'ustrm',displayDenom:'STRM'};
 }
}

const short=(s:string|null,n=15)=>s?s.length>n*2?`${s.slice(0,n)}…${s.slice(-n)}`:s:'—';

export default async function ChainPage(){
 let db:any={state:{},blocks:[]};
 try{db=await recentChain();}catch{}
 const s:any=await rpcStatus();
 const height=Number(db.state?.height||s.height||0);
 const validators=Array.isArray(s.validators)?s.validators:[];
 const activeValidatorCount=validators.length;
 const requiredQuorum=activeValidatorCount>0?requiredPoviQuorum(activeValidatorCount):null;
 const protocolConformant=s.poviConformant===true;
 const finalityThreshold=requiredQuorum===null?'Unavailable':`${requiredQuorum} of ${activeValidatorCount}`;
 return <>
  <div className="page-head"><div><div className="eyebrow">Digital Immutable Records · DIR</div><h1 className="title">DIR Explorer</h1><div className="subtitle">Independent immutable lifecycle records for approved STRATUM Verified events. DIR keeps private project content outside the trust layer while preserving verifiable hashes, record identifiers, timestamps and validator-backed finalization.</div></div><span className={s.connected?'badge':'pending'}>{s.connected?'DIR RPC ONLINE':'DIR RPC OFFLINE'}</span></div>
  <div className="grid kpis"><div className="card"><div className="label">DIR Network</div><div className="metric" style={{fontSize:20}}>{s.chainId||db.state?.chain_id}</div></div><div className="card"><div className="label">Recorded DIR Height</div><div className="metric">{height}</div></div><div className="card"><div className="label">Active Validator Authorities</div><div className="metric">{activeValidatorCount}</div></div><div className="card"><div className="label">PoVI Protocol</div><div className="metric" style={{fontSize:20}}>{protocolConformant?'Conformant':'Not verified'}</div></div></div>
  <div className="grid two"><div className="card"><div className="section-head"><div><div className="label">Finality Safety</div><h2>PoVI finality threshold</h2></div><span className={protocolConformant?'proof':'pending'}>{protocolConformant?'PROTOCOL CONFORMANT':'CONFORMANCE UNVERIFIED'}</span></div><div className="verify-grid"><span>Recorded height</span><b>{height}</b><span>Record hash</span><b className="mono">{short(db.state?.latest_block_hash||s.latestBlockHash,22)}</b><span>Genesis</span><b className="mono">{short(db.state?.genesis_hash,22)}</b><span>Required PoVI finality</span><b>{finalityThreshold}</b></div><p className="muted" style={{marginTop:14}}>The threshold shown is the strict BFT-safe PoVI requirement for the currently reported active validator set. Network connectivity, a record height, or a signature count alone does not prove physical truth, engineering approval, or independently verified finality.</p></div><div className="card"><div className="label">Validator Authorities</div><h2>Reported active signers</h2><div className="timeline">{validators.map((v:any)=><div className="event" key={v.address}><i className="event-icon">✓</i><div><strong>{v.name}</strong><small className="mono">{v.address}</small></div></div>)}{!validators.length&&<div className="muted">Validator status will appear when a PoVI-conformant DIR RPC reports the active validator set.</div>}</div></div></div>
  <div className="card table-card" style={{marginTop:16}}><div className="section-head"><div><div className="eyebrow">Immutable Record Explorer</div><h2>Recorded proof references</h2></div><span className="proof">{db.blocks.length} shown</span></div><table className="table"><thead><tr><th>DIR #</th><th>Event / Record</th><th>Reference</th><th>Evidence Hash</th><th>Authority</th><th>Recorded signatures</th></tr></thead><tbody>{db.blocks.map((b:any)=>{const voteCount=Array.isArray(b.votes_json)?b.votes_json.length:0;return <tr key={b.block_hash}><td><strong>#{b.height}</strong><div className="muted">{new Date(b.finalized_at).toLocaleString()}</div></td><td>{b.event_type||'Proof'}<div className="muted mono">{short(b.record_id,12)}</div></td><td className="mono" title={b.tx_hash}>{short(b.tx_hash,12)}</td><td className="mono" title={b.evidence_hash||''}>{short(b.evidence_hash,12)}</td><td>{b.proposer_validator_id}</td><td><span className="status-chip">{activeValidatorCount?`${voteCount}/${activeValidatorCount}`:`${voteCount} recorded`}</span></td></tr>})}{!db.blocks.length&&<tr><td colSpan={6}><span className="muted">No recorded DIR references beyond genesis yet.</span></td></tr>}</tbody></table></div>
  <div className="card" style={{marginTop:16}}><div className="label">Privacy Boundary</div><h2>Private evidence stays outside DIR</h2><div className="subtitle">DIR stores proof identifiers, event type, evidence-package SHA-256, canonical payload SHA-256, signer reference and timestamp. Photos, drawings, contracts and customer files remain in private application storage.</div></div>
 </>;
}
