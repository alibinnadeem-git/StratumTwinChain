import Link from 'next/link';
import ProjectManager from '@/components/ProjectManager';
import {readSession} from '@/lib/server/auth';

export const dynamic='force-dynamic';

export default async function ProjectsPage(){
 const session=await readSession();
 if(!session)return <section className="card" style={{maxWidth:760,margin:'7vh auto'}}>
  <div className="eyebrow">Projects</div>
  <h1 className="title">Sign in required</h1>
  <p className="subtitle">Tenant projects are organization-scoped server records. STRATUM will not substitute browser-only or reference project identities for a real project.</p>
  <div className="button-row"><Link className="action" href="/login">Sign in</Link><Link className="ghost" href="/compiler">Return to Import</Link></div>
 </section>;
 return <ProjectManager canManage={['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER'].includes(session.role)}/>;
}
