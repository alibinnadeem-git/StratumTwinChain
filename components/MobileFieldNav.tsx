'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';

const actions=[
 {href:'/workflows',label:'My Work',icon:'✓'},
 {href:'/scan',label:'Scan',icon:'⌗'},
 {href:'/capture',label:'Capture',icon:'+'}
] as const;

export default function MobileFieldNav(){
 const pathname=usePathname();
 return <nav className="mobile-field-nav" aria-label="Field navigation">
  {actions.map(action=>{
   const active=pathname===action.href||pathname.startsWith(`${action.href}/`);
   return <Link href={action.href} key={action.href} aria-current={active?'page':undefined}><span aria-hidden="true">{action.icon}</span><strong>{action.label}</strong></Link>;
  })}
 </nav>;
}
