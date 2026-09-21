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
 if(!session)return <div className="card"><div className="eyebrow">DIR</div><h1>Sign in to view finalized records</h1><p className="muted">DIR history is read from the authoritative PoVI validator network through the authenticated STRATUM application.</p><Link className="action" href="/login">Sign in</Link></div>;

 const status=await probeDirRpc();
 let explorer:any={state:null,blocks:[]};
 try{explorer=await recentChain();}catch{}
 const height=Number(explorer.state?.height||status.height||0);
 const latestHash=explorer.state?.latest_block_hash||null;
 const genesisHash=explorer.state?.genesis_hash||null;
 const chainReady=status.reachable&&status.connected&&status.engineReady&&status.activeValidatorCount===3&&status.requiredQuorum===3;

 return <>
  <div className="page-head"><div><div className="eyebrow">Digital Immutable Records</div><h1 className="title">DIR</h1><p className="subtitle">See finalized lifecycle records first. Validator, hash and architecture details stay available when you need to audit them.</p></div><span className={chainReady?'badge':'pending'}>{chainReady?'NETWORK READY':'NETWORK OFFLINE'}</span></div>

  <section className="card simple-status dir-primary-status">
   <div><div className="eyebrow">Latest finalized record</div><strong>{height>0?`DIR #${height}`:'No finalized DIR available'}</strong><p className="muted">{chainReady?`${status.requiredQuorum} of ${status.activeValidatorCount} validator authority required for finality.`:'Production DIR RPC is not currently bound/reachable from this application.'}</p></div>
   <span className={height>0?'proof':'pending'}>{height>0?'FINALIZED':'NO FINALITY'}</span>
  </section>

  <section className="card table-card">
   <div className="section-head"><div><div className="eyebrow">History</div><h2>Finalized lifecycle records</h2></div><span className="status-chip">{explorer.blocks.length} shown</span></div>
   <table className="table dir-table">
    <thead><tr><th>DIR</th><th>Event</th><th>Asset</th><th>Finalized</th><th>Status</th></tr></thead>
    <tbody>
     {explorer.blocks.map((block:any)=>{
      const votes=voteCount(block.votes_json);
      return <tr key={block.block_hash}>
       <td><strong>#{block.height}</strong></td>
       <td>{block.event_type||'Lifecycle proof'}<div className="muted mono">{short(block.record_id,10)}</div></td>
       <td className="mono">{short(block.asset_id,10)}</td>
       <td>{new Date(block.finalized_at).toLocaleString()}</td>
       <td><span className="proof">{votes}/{status.activeValidatorCount||3} FINAL</span></td>
      </tr>;
     })}
     {!explorer.blocks.length&&<tr><td colSpan={5}><span className="muted">{status.reachable?'No finalized DIR records were returned.':'DIR network is unavailable from this production runtime.'}</span></td></tr>}
    </tbody>
   </table>
  </section>

  <details className="secondary-details card">
   <summary>How DIR finality works</summary>
   <div className="dir-flow dir-flow-large" aria-label="DIR finalization stages">
    <span className="dir-node done">1<span>Activity</span></span><span className="dir-connector done"/>
    <span className="dir-node done">2<span>Evidence</span></span><span className="dir-connector done"/>
    <span className="dir-node done">3<span>Approval</span></span><span className="dir-connector done"/>
    <span className="dir-node done">4<span>PoVI DIR</span></span>
   </div>
   <p className="muted">A finalized DIR proves that a governed record reached validator finality. Cryptography does not, by itself, prove the underlying physical condition.</p>
  </details>

  <details className="secondary-details card">
   <summary>Network & proof details</summary>
   <div className="simple-kpis">
    <div><span>Network</span><strong style={{fontSize:14}}>{status.chainId||explorer.state?.chain_id||'—'}</strong></div>
    <div><span>Validators</span><strong>{status.activeValidatorCount??0}</strong></div>
    <div><span>Quorum</span><strong>{status.requiredQuorum??'—'}</strong></div>
    <div><span>PoVI engine</span><strong style={{fontSize:14}}>{status.engineReady?'READY':'NOT READY'}</strong></div>
   </div>
   <div className="verify-grid" style={{marginTop:14}}><span>Latest hash</span><b className="mono">{short(latestHash,22)}</b><span>Genesis</span><b className="mono">{short(genesisHash,22)}</b></div>
   <div className="timeline" style={{marginTop:14}}>{status.validators.map((validator,index)=><div className="event" key={validator.id||validator.address||index}><i className="event-icon">✓</i><div><strong>{validator.name||validator.id||`Validator ${index+1}`}</strong><small className="mono">{validator.address||'Address unavailable'}</small></div></div>)}{!status.validators.length&&<p className="muted">No validator telemetry available.</p>}</div>
   <p className="muted">Project files remain off-chain. The application stores tenant data and finalized ledger references; canonical PoVI consensus state remains on Validator A/B/C.</p>
  </details>
 </>;
}
