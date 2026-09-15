import Link from 'next/link';
import type {ReactNode} from 'react';
import {demoSession} from '@/lib/auth/session';

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
 {label:'Platform',links:[['/admin','Admin & RBAC']]}
] as const;

export default function Shell({children}:{children:ReactNode}){
 return <div className="shell">
  <aside className="sidebar">
   <div className="sidebar-head"><Link href="/" className="brand">STRATUM <span>Spatial Verified</span></Link><div className="network-pill"><i/> Trust records active</div></div>
   <nav className="nav" aria-label="Primary navigation">
    <div className="primary-task-nav"><small>Tasks</small>{primaryTasks.map(([href,label])=><Link href={href} key={href}>{label}</Link>)}</div>
    <details className="nav-more"><summary>More tools</summary><div className="nav-more-body">{moreGroups.map(group=><div className="nav-group" key={group.label}><small>{group.label}</small>{group.links.map(([href,label])=><Link href={href} key={`${group.label}-${href}`}>{label}</Link>)}</div>)}</div></details>
   </nav>
   <div className="usercard"><div className="avatar">AB</div><div><strong>{demoSession.user.name}</strong><small>{demoSession.role.replaceAll('_',' ')}</small></div></div>
  </aside>
  <main className="main">{children}</main>
 </div>
}