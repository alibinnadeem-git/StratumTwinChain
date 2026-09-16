'use client';

import {useState} from 'react';

const roles=['ORG_ADMIN','PROJECT_MANAGER','TECHNICIAN','INSPECTOR','CLIENT','VIEWER'] as const;
type ProvisioningResult={email:string;role:string;organizationName:string;setupUrl:string;token:string;expiresInMinutes:number;note:string};

export default function AdminInvite(){
 const [open,setOpen]=useState(false);
 const [email,setEmail]=useState('');
 const [displayName,setDisplayName]=useState('');
 const [role,setRole]=useState<(typeof roles)[number]>('VIEWER');
 const [message,setMessage]=useState('');
 const [result,setResult]=useState<ProvisioningResult|null>(null);
 const [busy,setBusy]=useState(false);

 async function provision(){
  const clean=email.trim().toLowerCase();
  if(!/^\S+@\S+\.\S+$/.test(clean)){setMessage('Enter a valid email address.');return;}
  setBusy(true);setMessage('');setResult(null);
  try{
   const response=await fetch('/api/admin/members',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:clean,displayName:displayName.trim(),role})});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||'Unable to provision member');
   setResult(data as ProvisioningResult);
   setMessage('Tenant membership created and a one-time setup credential issued.');
  }catch(error){setMessage(error instanceof Error?error.message:'Unable to provision member');}
  finally{setBusy(false);}
 }

 const absoluteSetupUrl=result&&typeof location!=='undefined'?`${location.origin}${result.setupUrl}`:'';
 async function copySetupUrl(){
  if(!absoluteSetupUrl)return;
  try{await navigator.clipboard.writeText(absoluteSetupUrl);setMessage('One-time setup link copied. Share it only with the intended member.');}
  catch{setMessage('Copy was blocked by the browser. Select the setup link and copy it manually.');}
 }

 return <div><button type="button" className="action" onClick={()=>{setOpen(v=>!v);setResult(null);setMessage('');}}>{open?'Close member provisioning':'Provision member'}</button>{open&&<div className="card" style={{marginTop:12}}><div className="eyebrow">Tenant member provisioning</div><p className="muted">Creates or resumes an account only inside your authenticated organization. Ordinary provisioning cannot create a SUPER ADMIN and cannot change an existing member&apos;s role.</p><div style={{display:'grid',gap:8,marginTop:10}}><input type="text" value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Display name (optional)" maxLength={160}/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="user@company.com"/><select value={role} onChange={e=>setRole(e.target.value as (typeof roles)[number])}>{roles.map(r=><option key={r} value={r}>{r.replaceAll('_',' ')}</option>)}</select><div className="button-row"><button type="button" onClick={provision} disabled={busy}>{busy?'Provisioning…':'Issue one-time setup link'}</button></div>{message&&<div className="notice"><strong>STATUS</strong><span>{message}</span></div>}{result&&<div className="notice"><strong>ONE-TIME CREDENTIAL · {result.expiresInMinutes} MIN</strong><span>{result.email} · {result.role.replaceAll('_',' ')} · {result.organizationName}</span><input aria-label="One-time setup link" readOnly value={absoluteSetupUrl}/><div className="button-row"><button type="button" onClick={copySetupUrl}>Copy setup link</button><a className="ghost" href={`mailto:${encodeURIComponent(result.email)}?subject=${encodeURIComponent('STRATUM Spatial Verified account setup')}&body=${encodeURIComponent(`Your STRATUM Spatial Verified account is ready. Use this one-time setup link within ${result.expiresInMinutes} minutes:\n\n${absoluteSetupUrl}\n\nTreat this link as a credential and do not forward it.`)}`}>Open mail</a></div><small className="muted">{result.note} The raw token remains only in this page state and is not stored in local browser persistence.</small></div>}<small className="muted">Account provisioning grants application access only. It does not approve work, establish physical identity, create a DIR, grant PoVI authority, or establish Verified physical truth.</small></div></div>}</div>;
}
