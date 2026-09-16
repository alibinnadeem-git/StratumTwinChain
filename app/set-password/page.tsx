'use client';

import Link from 'next/link';
import {FormEvent,useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';

export default function SetPasswordPage(){
 const router=useRouter();
 const [token,setToken]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);

 useEffect(()=>{setToken(new URLSearchParams(window.location.search).get('token')||'')},[]);

 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  setBusy(true);setError('');
  const form=new FormData(event.currentTarget);
  const password=String(form.get('password')||'');
  const confirm=String(form.get('confirm')||'');
  if(password!==confirm){setError('Passwords do not match');setBusy(false);return}
  const response=await fetch('/api/auth/password-setup/complete',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,password})});
  const body=await response.json();
  if(!response.ok){setError(body.error||'Password setup failed');setBusy(false);return}
  router.push('/login?setup=complete');
  router.refresh();
 }

 return <main style={{maxWidth:560,margin:'8vh auto',padding:24}}><div className="card">
  <div className="eyebrow">STRATUM Spatial Verified</div>
  <h1>Configure your account password</h1>
  <p className="muted">Use the short-lived one-time setup token issued for your account. The token is a credential and should not be shared.</p>
  <form onSubmit={submit} style={{display:'grid',gap:12}}>
   <input aria-label="One-time setup token" value={token} onChange={e=>setToken(e.target.value)} required minLength={20} maxLength={256} placeholder="One-time setup token" autoComplete="off"/>
   <input name="password" type="password" minLength={12} maxLength={128} required placeholder="New password" autoComplete="new-password"/>
   <input name="confirm" type="password" minLength={12} maxLength={128} required placeholder="Confirm new password" autoComplete="new-password"/>
   <button type="submit" className="action" disabled={busy}>{busy?'Configuring…':'Configure password'}</button>
   {error&&<p role="alert">{error}</p>}
  </form>
  <p className="muted" style={{marginTop:16}}>Already provisioned? <Link href="/login">Return to sign in</Link>.</p>
 </div></main>
}
