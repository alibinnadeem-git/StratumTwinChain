import Link from 'next/link';
import AdminInvite from '@/components/AdminInvite';
import {can} from '@/lib/auth/permissions';
import {readSession,type SessionRole} from '@/lib/server/auth';
import {query} from '@/lib/server/db';

type OrganizationRow={id:string;name:string};
type MemberRow={id:string;email:string;display_name:string|null;role:SessionRole;has_password:boolean;is_active:boolean};

function initials(value:string){return value.split(/\s+|@/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()||'').join('')||'SV'}

export default async function Admin(){
 const roles=['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER','TECHNICIAN','INSPECTOR','CLIENT','VIEWER'] as const;
 const session=await readSession();

 if(!session){
  return <><div className="eyebrow">Platform Administration</div><h1 className="title">Sign in required</h1><p className="subtitle">Administration is available only to an authenticated STRATUM Spatial Verified tenant session. No reference or demo administrator identity is substituted.</p><div className="button-row"><Link className="action" href="/login">Sign in</Link></div></>;
 }

 if(!can(session.role,'ORG_MANAGE')){
  return <><div className="eyebrow">Platform Administration</div><h1 className="title">Administration access restricted</h1><p className="subtitle">Your authenticated role does not have organization-management authority.</p><div className="notice"><strong>AUTHENTICATED ROLE</strong><span>{session.email} · {session.role.replaceAll('_',' ')}</span></div></>;
 }

 try{
  const [organizationResult,membersResult]=await Promise.all([
   query<OrganizationRow>(`SELECT id,name FROM organizations WHERE id=$1 LIMIT 1`,[session.organizationId]),
   query<MemberRow>(`
     SELECT u.id,u.email::text AS email,u.display_name,m.role,(u.password_hash IS NOT NULL) AS has_password,u.is_active
     FROM memberships m
     JOIN users u ON u.id=m.user_id
     WHERE m.organization_id=$1
     ORDER BY lower(u.email::text)
   `,[session.organizationId])
  ]);
  const organization=organizationResult.rows[0];
  if(!organization)throw new Error('Authenticated organization is unavailable');
  const current=membersResult.rows.find(member=>member.id===session.userId);
  const identity=current?.display_name||session.email;

  return <><div className="eyebrow">Platform Administration</div><h1 className="title">Multi-tenant RBAC</h1><p className="subtitle">Live organization-scoped administration with deny-by-default permissions and separation between account access, event creation and approval.</p><div className="grid two"><div className="card"><div className="label">Active organization · LIVE TENANT</div><h2>{organization.name}</h2><div className="admin-user"><div className="avatar">{initials(identity)}</div><div><strong>{current?.display_name||session.email}</strong><span>{session.email}</span></div><b>{session.role.replaceAll('_',' ')}</b></div>{session.role==='SUPER_ADMIN'?<AdminInvite/>:<div className="notice"><strong>MEMBER PROVISIONING</strong><span>Only a SUPER ADMIN can issue a new member&apos;s one-time setup credential. Role changes use a separate governed workflow.</span></div>}</div><div className="card"><div className="label">Security controls</div><div className="control-list"><div><i>✓</i><span><b>Tenant isolation</b>Organization ID comes from the authenticated session</span></div><div><i>✓</i><span><b>Approval separation</b>Technicians cannot self-approve</span></div><div><i>✓</i><span><b>Credential isolation</b>Setup credentials do not create Verified state or DIR authority</span></div><div><i>✓</i><span><b>Private evidence</b>Only cryptographic fingerprints enter DIR</span></div></div></div></div><div className="card table-card"><h3>Organization members</h3><table className="table"><thead><tr><th>Member</th><th>Role</th><th>Account</th></tr></thead><tbody>{membersResult.rows.map(member=><tr key={member.id}><td><strong>{member.display_name||member.email}</strong><div className="muted">{member.email}</div></td><td>{member.role.replaceAll('_',' ')}</td><td>{member.is_active?(member.has_password?'ACTIVE':'SETUP REQUIRED'):'INACTIVE'}</td></tr>)}</tbody></table></div><div className="card table-card"><h3>Role capabilities</h3><table className="table"><thead><tr><th>Role</th><th>Create event</th><th>Approve</th><th>Upload evidence</th><th>Manage org</th></tr></thead><tbody>{roles.map(r=><tr key={r}><td><strong>{r.replaceAll('_',' ')}</strong></td><td>{can(r,'EVENT_CREATE')?'✓':'—'}</td><td>{can(r,'EVENT_APPROVE')?'✓':'—'}</td><td>{can(r,'EVIDENCE_UPLOAD')?'✓':'—'}</td><td>{can(r,'ORG_MANAGE')?'✓':'—'}</td></tr>)}</tbody></table></div></>;
 }catch{
  return <><div className="eyebrow">Platform Administration</div><h1 className="title">Administration temporarily unavailable</h1><p className="subtitle">The authenticated tenant could not be loaded. The page fails closed and does not substitute reference or demo organization data.</p></>;
 }
}
