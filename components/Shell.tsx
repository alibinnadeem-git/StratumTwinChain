import Link from 'next/link';
import type {ReactNode} from 'react';
import {demoSession} from '@/lib/auth/session';
import CommandPalette from '@/components/CommandPalette';

const primary=[
 ['/','Home'],
 ['/sites','Sites'],
 ['/workflows','Work'],
 ['/verify','Verify'],
 ['/library','Library']
];

export default function Shell({children}:{children:ReactNode}){
 return <div className="shell">
  <aside className="sidebar">
   <div className="sidebar-head">
    <Link href="/" className="brand">STRATUM <span>Spatial Verified</span></Link>
    <div className="network-pill"><i/> DIRs · {process.env.STRATUM_CHAIN_ID||'stratum-devnet-1'}</div>
    <div className="redbook-version">Redbook 1.0 baseline</div>
   </div>
   <CommandPalette/>
   <nav className="nav" aria-label="Primary navigation">
    <div className="nav-group">
     <small>Workspace</small>
     {primary.map(([href,label])=><Link href={href} key={href}>{label}</Link>)}
    </div>
   </nav>
   <div className="usercard"><div className="avatar">AB</div><div><strong>{demoSession.user.name}</strong><small>{demoSession.role.replaceAll('_',' ')}</small></div></div>
  </aside>
  <main className="main">{children}</main>
 </div>
}
