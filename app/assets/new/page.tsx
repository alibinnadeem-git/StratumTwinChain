import Link from 'next/link';
import AssetRegistrationForm from '@/components/AssetRegistrationForm';
import {readSession} from '@/lib/server/auth';
import {query} from '@/lib/server/db';

export const dynamic='force-dynamic';

export default async function NewAssetPage({searchParams}:{searchParams:Promise<{name?:string;type?:string}>}){
 const session=await readSession();
 if(!session)return <div className="card"><div className="eyebrow">Asset registration</div><h1>Sign in required</h1><p className="muted">Durable asset identity can only be created inside an authenticated organization.</p><Link className="action" href="/login">Sign in</Link></div>;
 if(!['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER'].includes(session.role))return <div className="card"><div className="eyebrow">Asset registration</div><h1>Registration restricted</h1><p className="muted">Your role can inspect existing assets but cannot create durable equipment identities.</p><Link className="ghost" href="/assets">Return to assets</Link></div>;
 const [projectResult,siteResult,systemResult,manufacturerResult]=await Promise.all([
  query<{id:string;project_code:string;name:string}>('SELECT id::text,project_code,name FROM projects WHERE organization_id=$1 ORDER BY name',[session.organizationId]),
  query<{id:string;project_id:string;name:string}>('SELECT id::text,project_id::text,name FROM sites WHERE organization_id=$1 ORDER BY name',[session.organizationId]),
  query<{id:string;project_id:string;name:string}>('SELECT id::text,project_id::text,name FROM systems WHERE organization_id=$1 ORDER BY name',[session.organizationId]),
  query<{id:string;name:string}>('SELECT id::text,name FROM manufacturers WHERE organization_id=$1 OR organization_id IS NULL ORDER BY name',[session.organizationId]),
 ]);
 const search=await searchParams;
 return <>
  <div className="page-head"><div><div className="eyebrow">Asset Registry</div><h1 className="title">Register equipment</h1><p className="subtitle">Create the durable asset identity, then use Spatial and field workflows to link evidence and lifecycle activity.</p></div><Link className="ghost" href="/assets">Asset Passports</Link></div>
  <AssetRegistrationForm projects={projectResult.rows} sites={siteResult.rows} systems={systemResult.rows} manufacturers={manufacturerResult.rows} initialName={search.name||''} initialType={search.type||''}/>
 </>;
}
