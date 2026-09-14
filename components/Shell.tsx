import Link from 'next/link';
import type {ReactNode} from 'react';
import {demoSession} from '@/lib/auth/session';
import CommandPalette from '@/components/CommandPalette';
import PrimaryNav from '@/components/PrimaryNav';
import SkipLink from '@/components/SkipLink';

export default function Shell({children}:{children:ReactNode}){
 return <div className="shell">
  <SkipLink/>
  <aside className="sidebar">
   <div className="sidebar-head">
    <Link href="/" className="brand">STRATUM <span>Spatial Verified</span></Link>
    <div className="network-pill"><i/> DIRs · {process.env.STRATUM_CHAIN_ID||'stratum-devnet-1'}</div>
    <div className="redbook-version">Redbook 1.0 baseline</div>
   </div>
   <CommandPalette/>
   <PrimaryNav/>
   <div className="usercard"><div className="avatar">AB</div><div><strong>{demoSession.user.name}</strong><small>{demoSession.role.replaceAll('_',' ')}</small></div></div>
  </aside>
  <main className="main" id="main-content" tabIndex={-1}>{children}</main>
 </div>
}
