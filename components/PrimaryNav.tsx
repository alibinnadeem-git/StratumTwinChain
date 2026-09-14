'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';

const primary=[
 ['/','Home'],
 ['/sites','Sites'],
 ['/workflows','Work'],
 ['/verify','Verify'],
 ['/library','Library']
] as const;

export default function PrimaryNav(){
 const pathname=usePathname();
 return <nav className="nav" aria-label="Primary navigation">
  <div className="nav-group">
   <small>Workspace</small>
   {primary.map(([href,label])=>{
    const active=href==='/'?pathname===href:pathname===href||pathname.startsWith(`${href}/`);
    return <Link href={href} key={href} aria-current={active?'page':undefined}>{label}</Link>;
   })}
  </div>
 </nav>;
}
