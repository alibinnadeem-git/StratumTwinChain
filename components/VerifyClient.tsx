'use client';

import Link from 'next/link';
import {FormEvent,useState} from 'react';
import EvidenceHasher from './EvidenceHasher';

type Rec={record_id:string;event_type:string;occurred_at:string;payload_sha256:string;evidence_package_sha256:string;ledger_network:string;ledger_tx_hash:string;ledger_block_height:number;asset_code:string;asset_name:string;serial_number:string;project_code:string;project_name:string};

const when=(value:string)=>value?new Date(value).toLocaleString('en-US',{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Not recorded';

export default function VerifyClient({initial=''}:{initial?:string}){
 const [q,setQ]=useState(initial);
 const [busy,setBusy]=useState(false);
 const [result,setResult]=useState<{verified:boolean;records:Rec[];error?:string}|null>(null);
 async function submit(e:FormEvent){
  e.preventDefault();
  setBusy(true);
  try{
   const response=await fetch(`/api/verify?q=${encodeURIComponent(q)}`,{cache:'no-store'});
   setResult(await response.json());
  }finally{setBusy(false);}
 }
 return <>
  <div className="verify-search card">
   <form onSubmit={submit}><input value={q} onChange={e=>setQ(e.target.value)} aria-label="Verification identifier" placeholder="Asset ID, serial, record reference or SHA-256"/><button className="action" type="submit" disabled={busy}>{busy?'Checking…':'Verify'}</button></form>
   <div className="verify-tabs"><span>Asset ID</span><span>Serial</span><span>Record</span><span>SHA-256</span></div>
  </div>

  <div aria-live="polite">
   {result&&(result.verified?
    <div>{result.records.map(r=><div className="verification-result card" key={r.record_id}>
     <div className="big-check">✓</div>
     <div>
      <div className="eyebrow">Verification index match</div>
      <h2>Recorded fingerprint matched</h2>
      <p className="muted">The submitted identifier matches a STRATUM record for <strong>{r.asset_name}</strong> ({r.asset_code}) in {r.project_name}.</p>
      <div className="card" style={{marginTop:14}}>
       <div className="verify-grid"><span>Lifecycle event</span><b>{r.event_type}</b><span>Recorded DIR</span><b>#{r.ledger_block_height}</b><span>Recorded at</span><b>{when(r.occurred_at)}</b><span>Asset serial</span><b>{r.serial_number||'Not recorded'}</b></div>
      </div>
      <p className="muted" style={{marginTop:12}}>This result establishes a match to the referenced digital record in the STRATUM verification index. It does not independently prove physical truth, work quality, installation correctness, or engineering approval.</p>
      <div className="button-row" style={{marginTop:12}}><Link className="action" href={`/assets/${encodeURIComponent(r.asset_code)}`}>Open asset passport</Link><button className="ghost" type="button" onClick={()=>{setQ('');setResult(null);}}>Verify another record</button></div>
      <details className="card" style={{marginTop:14}}>
       <summary><strong>Technical proof details</strong></summary>
       <div className="verify-grid" style={{marginTop:12}}><span>DIR network</span><b>{r.ledger_network}</b><span>Record ID</span><b className="mono">{r.record_id}</b><span>Transaction reference</span><b className="mono">{r.ledger_tx_hash}</b><span>Payload SHA-256</span><b className="mono">{r.payload_sha256}</b><span>Evidence package SHA-256</span><b className="mono">{r.evidence_package_sha256}</b></div>
      </details>
     </div>
    </div>)}</div>
    :<div className="card empty"><h2>No matching verification record</h2><p className="muted">The identifier is not present in the current STRATUM verification index. Check the identifier or confirm that the lifecycle record has been finalized and published to the index.</p></div>)}
  </div>
  <EvidenceHasher/>
 </>;
}
