import Link from 'next/link';
import type {ReactNode} from 'react';
import {readSession} from '@/lib/server/auth';

const primaryTasks=[
 ['/','Home'],
 ['/compiler','Start from drawing'],
 ['/spatial','Review model'],
 ['/scan','Scan & inspect'],
 ['/assets','Asset Passports']
] as const;

const moreGroups=[
 {label:'Project',links:[['/projects','Projects'],['/sites','Sites'],['/reality','Reality Capture & Reconciliation']]},
 {label:'Engineering',links:[['/compiler','Spatial Compiler'],['/spatial','STRATUM Spatial Verified'],['/component-library','Component Library']]},
 {label:'Operations',links:[['/workflows','Field Work & Commissioning'],['/maintenance','Maintenance'],['/predictive','Predictive Intelligence'],['/simulation','Simulation'],['/evidence','Evidence']]},
 {label:'Trust & handover',links:[['/handover','Digital Handover'],['/provenance','Provenance Explorer'],['/verify','Verify Record'],['/dir','DIR Explorer']]},
 {label:'Platform',links:[['/admin','Admin & RBAC'],['/release-readiness','Release readiness'],['/release-uat','Physical-device UAT']]}
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
   <div className="sidebar-head"><Link href="/" className="brand">STRATUM <span>Spatial Verified</span></Link><div className="network-pill"><i/> Trust records active</div></div>
   <nav className="nav" aria-label="Primary navigation">
    <div className="primary-task-nav"><small>Tasks</small>{primaryTasks.map(([href,label])=><Link href={href} key={href}>{label}</Link>)}</div>
    <details className="nav-more"><summary>More tools</summary><div className="nav-more-body">{moreGroups.map(group=><div className="nav-group" key={group.label}><small>{group.label}</small>{group.links.map(([href,label])=><Link href={href} key={`${group.label}-${href}`}>{label}</Link>)}</div>)}</div></details>
   </nav>
   <div className="usercard"><div className="avatar" aria-hidden="true">{identity.avatar}</div><div><strong>{identity.primary}</strong><small>{identity.secondary}</small></div></div>
  </aside>
  <main id="main-content" className="main" tabIndex={-1}>{children}</main>
 </div>
}
