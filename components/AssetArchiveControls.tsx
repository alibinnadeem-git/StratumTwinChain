'use client';

import {FormEvent,useState} from 'react';
import {useRouter} from 'next/navigation';

type Props={
  assetId:string;
  archived:boolean;
  archiveSchemaReady:boolean;
  canManage:boolean;
  archiveReason?:string|null;
  archiveOccurredAt?:string|Date|null;
};

export default function AssetArchiveControls({assetId,archived,archiveSchemaReady,canManage,archiveReason,archiveOccurredAt}:Props){
  const router=useRouter();
  const [mode,setMode]=useState<'ARCHIVE'|'RESTORE'|null>(null);
  const [reason,setReason]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');

  async function submit(event:FormEvent){
    event.preventDefault();
    if(!mode||busy)return;
    const cleaned=reason.trim();
    if(cleaned.length<5){setMessage('Enter a reason of at least 5 characters.');return;}
    setBusy(true);setMessage('');
    try{
      const response=await fetch(`/api/assets/${encodeURIComponent(assetId)}`,{
        method:mode==='ARCHIVE'?'DELETE':'PATCH',
        headers:{'content-type':'application/json'},
        body:JSON.stringify(mode==='ARCHIVE'?{reason:cleaned}:{action:'RESTORE',reason:cleaned})
      });
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body?.error||`Request failed (${response.status})`);
      setMessage(mode==='ARCHIVE'?'Asset archived. Verified history was preserved.':'Asset restored to the active registry.');
      setMode(null);setReason('');
      router.refresh();
    }catch(error){
      setMessage(error instanceof Error?error.message:'Unable to update archive state.');
    }finally{setBusy(false);}
  }

  return <section className="card" aria-label="Administrative asset state" style={{marginBottom:16,borderColor:archived?'#8a6334':undefined}}>
    <div className="section-head">
      <div>
        <div className="eyebrow">Administrative registry state</div>
        <h3>{archived?'Archived from active registry':'Active in registry'}</h3>
      </div>
      <span className={archived?'pending':'proof'}>{archived?'ARCHIVED':'ACTIVE'}</span>
    </div>
    <p className="muted">
      {archived
        ?`Archived${archiveOccurredAt?` ${new Date(archiveOccurredAt).toLocaleString()}`:''}${archiveReason?` · ${archiveReason}`:''}. This does not revoke or rewrite Verified lifecycle evidence or DIR history.`
        :'Archiving changes registry visibility only. It does not delete the STRATUM Asset, evidence, lifecycle records, or Digital Immutable Records.'}
    </p>
    {canManage&&!archiveSchemaReady&&<p className="pending" role="status">Archive controls are unavailable until the append-only archive schema is deployed.</p>}
    {canManage&&archiveSchemaReady&&!mode&&<div className="button-row">
      <button className={archived?'action':'ghost'} type="button" onClick={()=>setMode(archived?'RESTORE':'ARCHIVE')}>
        {archived?'Restore asset':'Archive asset'}
      </button>
      {archived&&<a className="ghost" href="/assets/archived">View archived assets</a>}
    </div>}
    {canManage&&archiveSchemaReady&&mode&&<form onSubmit={submit} style={{marginTop:14}}>
      <label className="field-label" htmlFor="asset-archive-reason">{mode==='ARCHIVE'?'Reason for archive':'Reason for restore'}</label>
      <textarea id="asset-archive-reason" aria-label={mode==='ARCHIVE'?'Reason for archive':'Reason for restore'} value={reason} onChange={event=>setReason(event.target.value)} minLength={5} maxLength={500} required rows={3} placeholder={mode==='ARCHIVE'?'Example: duplicate administrative registration; physical asset identity retained.':'Example: asset returned to active project registry.'}/>
      <p className="muted">This action is recorded as administrative provenance only; it cannot establish, revoke, or alter PoVI finality or physical truth.</p>
      <div className="button-row">
        <button className="action" type="submit" disabled={busy}>{busy?'Saving…':mode==='ARCHIVE'?'Confirm archive':'Confirm restore'}</button>
        <button className="ghost" type="button" disabled={busy} onClick={()=>{setMode(null);setReason('');setMessage('');}}>Cancel</button>
      </div>
    </form>}
    {message&&<p role="status" className="muted" style={{marginTop:10}}>{message}</p>}
  </section>;
}
