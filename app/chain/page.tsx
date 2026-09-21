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
 if(!session)return <div className="card"><div className="eyebrow">Digital Immutable Records · DIR</div><h1>Sign in to inspect DIR history</h1><p className="muted">DIR history is read from the authoritative PoVI validator network through the authenticated STRATUM application.</p><Link className="action" href="/login">Sign in</Link></div>;

 const status=await probeDirRpc();
 let explorer:any={state:null,blocks:[]};
 try{explorer=await recentChain();}catch{}
 const height=Number(explorer.state?.height||status.height||0);
 const latestHash=explorer.state?.latest_block_hash||null;
 const genesisHash=explorer.state?.genesis_hash||null;
 const chainReady=status.reachable&&status.connected&&status.engineReady&&status.activeValidatorCount===3&&status.requiredQuorum===3;

 return <>
  <div className="page-head">
   <div><div className="eyebrow">Digital Immutable Records · DIR</div><h1 className="title">DIR</h1><div className="subtitle">See which lifecycle records reached PoVI finality, what authority signed them, and the proof behind each record. Project files remain private outside the chain.</div></div>
   <span className={chainReady?'badge':'pending'}>{chainReady?'NETWORK READY':'NETWORK NOT READY'}</span>
  </div>

  <section className="card dir-overview">
   <div className="section-head"><div><div className="eyebrow">How a DIR is created</div><h2>Reported work does not jump straight to finality</h2></div></div>
   <div className="dir-flow dir-flow-large" aria-label="DIR finalization stages">
    <span className="dir-node done">1<span>Activity</span></span><span className="dir-connector done"/>
    <span className="dir-node done">2<span>Evidence</span></span><span className="dir-connector done"/>
    <span className="dir-node done">3<span>Approval</span></span><span className="dir-connector done"/>
    <span className="dir-node done">4<span>PoVI finality</span></span>
   </div>
   <p className="muted" style={{marginBottom:0}}>A finalized DIR proves that a governed record reached validator finality. It does not, by cryptography alone, prove that the physical condition was true.</p>
  </section>

  <div className="grid kpis">
   <div className="card"><div className="label">Network</div><div className="metric" style={{fontSize:20}}>{status.chainId||explorer.state?.chain_id||'—'}</div><div className="muted">{chainReady?'Connected':'Check runtime binding'}</div></div>
   <div className="card"><div className="label">Latest DIR</div><div className="metric">#{height}</div><div className="muted">Finalized record height</div></div>
   <div className="card"><div className="label">Validators</div><div className="metric">{status.activeValidatorCount??0}</div><div className="muted">Independent authorities</div></div>
   <div className="card"><div className="label">Quorum</div><div className="metric">{status.requiredQuorum??'—'}</div><div className="muted">Required signatures</div></div>
  </div>

  <div className="grid two">
   <div className="card">
    <div className="section-head"><div><div className="label">Latest finality</div><h2>{height>0?`DIR #${height}`:'No finalized DIR yet'}</h2></div><span className={height>0?'proof':'pending'}>{height>0?'FINALIZED':'EMPTY'}</span></div>
    <div className="verify-grid">
     <span>Record hash</span><b className="mono">{short(latestHash,22)}</b>
     <span>Genesis</span><b className="mono">{short(genesisHash,22)}</b>
     <span>PoVI engine</span><b>{status.engineReady?'READY':'NOT READY'}</b>
     <span>Authority</span><b>{status.requiredQuorum??'—'} of {status.activeValidatorCount??'—'}</b>
    </div>
   </div>
   <div className="card">
    <div className="label">Validator authorities</div><h2>Who can finalize</h2>
    <div className="timeline">{status.validators.map((validator,index)=><div className="event" key={validator.id||validator.address||index}><i className="event-icon">✓</i><div><strong>{validator.name||validator.id||`Validator ${index+1}`}</strong><small className="mono">{validator.address||'Address unavailable'}</small></div></div>)}{!status.validators.length&&<div className="muted">Validator status will appear when Validator A is reachable and configured.</div>}</div>
   </div>
  </div>

  <div className="card table-card" style={{marginTop:16}}>
   <div className="section-head"><div><div className="eyebrow">Finalized history</div><h2>Immutable lifecycle records</h2></div><span className="proof">{explorer.blocks.length} shown</span></div>
   <table className="table dir-table">
    <thead><tr><th>DIR</th><th>Event</th><th>Asset</th><th>Finalized</th><th>Quorum</th><th>Proof</th></tr></thead>
    <tbody>
     {explorer.blocks.map((block:any)=>{
      const votes=voteCount(block.votes_json);
      return <tr key={block.block_hash}>
       <td><strong>#{block.height}</strong></td>
       <td>{block.event_type||'Lifecycle proof'}<div className="muted mono">{short(block.record_id,10)}</div></td>
       <td className="mono">{short(block.asset_id,10)}</td>
       <td>{new Date(block.finalized_at).toLocaleString()}</td>
       <td><span className="proof">{votes}/{status.activeValidatorCount||3}</span></td>
       <td><details className="proof-details"><summary>View</summary><div className="verify-grid proof-grid"><span>Transaction</span><b className="mono" title={block.tx_hash}>{short(block.tx_hash,14)}</b><span>Evidence hash</span><b className="mono" title={block.evidence_hash||''}>{short(block.evidence_hash,14)}</b><span>Record hash</span><b className="mono" title={block.block_hash}>{short(block.block_hash,14)}</b><span>Proposer</span><b>{block.proposer_validator_id}</b></div></details></td>
      </tr>;
     })}
     {!explorer.blocks.length&&<tr><td colSpan={6}><span className="muted">{status.reachable?'No finalized DIR records returned by the authoritative explorer.':'Validator A explorer is unavailable.'}</span></td></tr>}
    </tbody>
   </table>
  </div>

  <details className="secondary-details card" style={{marginTop:16}}>
   <summary>Trust, privacy & architecture details</summary>
   <div style={{marginTop:12}}>
    <h3>One authoritative chain</h3>
    <p className="muted">The Spatial application database stores tenant assets, evidence, approvals and finalized ledger references. Canonical PoVI consensus state remains on Validator A/B/C; STRATUM does not maintain a second tenant-side copy of chain state.</p>
    <h3>Private project content stays off-chain</h3>
    <p className="muted">DIR carries proof identifiers, hashes, timestamps and validator finality. Photos, drawings, contracts and customer files remain in private application storage.</p>
   </div>
  </details>
 </>;
}
