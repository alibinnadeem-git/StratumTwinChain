import Link from 'next/link';
import type {ReactNode} from 'react';
import {readSession} from '@/lib/server/auth';

const primaryTasks=[
 ['/','Home'],
 ['/import','Import'],
 ['/spatial','Spatial'],
 ['/field','Field'],
 ['/dir','DIR']
] as const;

const moreGroups=[
 {label:'Assets & projects',links:[['/assets','Asset Passports'],['/projects','Projects'],['/sites','Sites']]},
 {label:'Engineering',links:[['/component-library','Component Library'],['/references','Standards & OEM'],['/reality','Reality Capture & Reconciliation'],['/simulation','Simulation']]},
 {label:'Operations',links:[['/workflows','Field Work & Commissioning'],['/maintenance','Maintenance'],['/predictive','Predictive Intelligence'],['/evidence','Evidence']]},
 {label:'Trust & handover',links:[['/handover','Digital Handover'],['/provenance','Provenance Explorer'],['/verify','Verify Record']]},
 {label:'Platform',links:[['/docs','Docs & glossary'],['/admin','Admin & RBAC'],['/release-readiness','Release readiness'],['/release-uat','Physical-device UAT']]}
] as const;

function initials(email:string){
 const local=(email.split('@')[0]||'').trim();
 const parts=local.split(/[._-]+/).filter(Boolean);
 const value=parts.length>1?`${parts[0]?.[0]||''}${parts[1]?.[0]||''}`:local.slice(0,2);
 return value.toUpperCase()||'U';
}

export default async function Shell({children}:{children:ReactNode}){
 const session=await readSession();
 const identity=session
  ? {avatar:initials(session.email),primary:session.email,secondary:session.role.replaceAll('_',' ')}
  : {avatar:'—',primary:'Signed out',secondary:'REFERENCE MODE'};

 return <div className="shell">
  <a className="skip-link" href="#main-content">Skip to main content</a>
  <aside className="sidebar">
   <div className="sidebar-head">
    <Link href="/" className="brand">STRATUM <span>Spatial Verified</span></Link>
    <div className="network-pill"><i/>{session?'Tenant session':'Reference mode'}</div>
   </div>
   <nav className="nav" aria-label="Primary navigation">
    <div className="primary-task-nav"><small>Work</small>{primaryTasks.map(([href,label])=><Link href={href} key={href}>{label}</Link>)}</div>
    <details className="nav-more">
     <summary>More tools</summary>
     <div className="nav-more-body">{moreGroups.map(group=><div className="nav-group" key={group.label}><small>{group.label}</small>{group.links.map(([href,label])=><Link href={href} key={`${group.label}-${href}`}>{label}</Link>)}</div>)}</div>
    </details>
   </nav>
   {session?<div className="usercard"><div className="avatar" aria-hidden="true">{identity.avatar}</div><div><strong>{identity.primary}</strong><small>{identity.secondary}</small></div></div>:<Link className="usercard" href="/login" aria-label="Sign in to STRATUM"><div className="avatar" aria-hidden="true">{identity.avatar}</div><div><strong>Sign in</strong><small>REFERENCE MODE</small></div></Link>}
  </aside>
  <main id="main-content" className="main" tabIndex={-1}>{children}</main>
 </div>
}
