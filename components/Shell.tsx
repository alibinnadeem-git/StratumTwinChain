import Link from 'next/link';
import type {ReactNode} from 'react';
import {demoSession} from '@/lib/auth/session';

const groups=[
 {label:'Command',links:[['/','Command Center'],['/spatial','STRATUM Spatial Verified'],['/compiler','Spatial Compiler'],['/component-library','Component Library'],['/reality','Reality Capture & Reconciliation']]},
 {label:'Infrastructure',links:[['/projects','Projects'],['/sites','Sites'],['/assets','Asset Passports']]},
 {label:'Operations',links:[['/scan','Scan Equipment'],['/workflows','Field Work & Commissioning'],['/maintenance','Maintenance'],['/predictive','Predictive Intelligence'],['/simulation','Simulation'],['/evidence','Evidence']]},
 {label:'Trust',links:[['/handover','Digital Handover'],['/provenance','Provenance Explorer'],['/verify','Verify Record'],['/dir','DIR Explorer']]},
 {label:'Platform',links:[['/admin','Admin & RBAC']]}
];

export default function Shell({children}:{children:ReactNode}){
 return <div className="shell">
  <aside className="sidebar">
   <div className="sidebar-head"><Link href="/" className="brand">STRATUM <span>Spatial Verified</span></Link><div className="network-pill"><i/> DIRs · {process.env.STRATUM_CHAIN_ID||'stratum-devnet-1'}</div><div className="redbook-version">Redbook 1.0 baseline</div></div>
   <nav className="nav" aria-label="Primary navigation">{groups.map(g=><div className="nav-group" key={g.label}><small>{g.label}</small>{g.links.map(([href,label])=><Link href={href} key={href}>{label}</Link>)}</div>)}</nav>
   <div className="usercard"><div className="avatar">AB</div><div><strong>{demoSession.user.name}</strong><small>{demoSession.role.replaceAll('_',' ')}</small></div></div>
  </aside>
  <main className="main">{children}</main>
 </div>
}
