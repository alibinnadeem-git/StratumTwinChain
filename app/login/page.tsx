'use client';
import Link from 'next/link';
import {FormEvent,useState} from 'react';
import {useRouter} from 'next/navigation';

export default function Login(){
 const r=useRouter();
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setError('');
  const f=new FormData(e.currentTarget);
  try{
   const res=await fetch('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:f.get('email'),password:f.get('password')})});
   const j=await res.json().catch(()=>({}));
   if(!res.ok){
    setError(res.status===401
      ?'Sign-in failed. If this is the initial STRATUM administrator account, its password may still need to be provisioned.'
      :(j.error||'Login failed'));
    return;
   }
   r.push('/');r.refresh();
  }catch{
   setError('Sign-in service is temporarily unavailable.');
  }finally{setBusy(false)}
 }
 return <main style={{maxWidth:520,margin:'10vh auto',padding:24}}><div className="card">
  <div className="eyebrow">STRATUM Spatial Verified</div>
  <h1>Sign in</h1>
  <p className="muted">Access is organization-scoped and role-controlled.</p>
  <form onSubmit={submit} style={{display:'grid',gap:12}}>
   <input name="email" type="email" required placeholder="Email" autoComplete="email"/>
   <input name="password" type="password" minLength={12} required placeholder="Password" autoComplete="current-password"/>
   <button type="submit" className="action" disabled={busy}>{busy?'Signing in…':'Sign in'}</button>
   {error&&<p role="alert">{error}</p>}
  </form>
  <div className="button-row" style={{marginTop:16}}>
   <Link className="ghost" href="/set-password">Configure initial password</Link>
   <Link className="ghost" href="/spatial">Return to Spatial</Link>
  </div>
  <p className="muted" style={{marginTop:12}}>Initial password setup requires a one-time account setup token. This prevents an unprovisioned administrator account from being claimed by another user.</p>
 </div></main>
}
