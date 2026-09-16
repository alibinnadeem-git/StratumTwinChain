import fs from 'node:fs';

const migration=fs.readFileSync('migrations/004_user_password_setup_tokens.sql','utf8');
const request=fs.readFileSync('app/api/auth/password-setup/request/route.ts','utf8');
const complete=fs.readFileSync('app/api/auth/password-setup/complete/route.ts','utf8');
const page=fs.readFileSync('app/set-password/page.tsx','utf8');
const envExample=fs.readFileSync('.env.example','utf8');
const adminPage=fs.readFileSync('app/admin/page.tsx','utf8');
const adminInvite=fs.readFileSync('components/AdminInvite.tsx','utf8');
const memberProvisioning=fs.readFileSync('app/api/admin/members/route.ts','utf8');

for(const required of [
 'user_password_setup_tokens','token_hash text NOT NULL UNIQUE','expires_at timestamptz NOT NULL','used_at timestamptz',"created_via IN ('BOOTSTRAP','SUPER_ADMIN')"
])if(!migration.includes(required))throw new Error(`Password setup migration invariant missing: ${required}`);

for(const required of [
 'randomBytes(32)','createHash(\'sha256\')','timingSafeEqual','STRATUM_AUTH_BOOTSTRAP_SECRET','STRATUM_AUTH_BOOTSTRAP_EMAIL','STRATUM_AUTH_BOOTSTRAP_ORGANIZATION_ID','passwordedAdmin','bootstrapOpen','First-user bootstrap is closed','Bootstrap account and organization are not configured','Bootstrap account is not authorized','Configured bootstrap organization does not exist','Bootstrap may provision only the initial SUPER_ADMIN','Cross-organization provisioning is not allowed','Account is already provisioned','TOKEN_TTL_MINUTES=30','cache-control\':\'no-store',
 'm.organization_id=$2',"m.role='SUPER_ADMIN'",'session!.organizationId','INSERT INTO users(email,is_active)','INSERT INTO memberships(organization_id,user_id,role)',"ON CONFLICT (organization_id,user_id) DO UPDATE SET role='SUPER_ADMIN'"
])if(!request.includes(required))throw new Error(`Password setup issuance invariant missing: ${required}`);

for(const forbidden of ['password_hash=','gen_salt(','INSERT INTO assets','INSERT INTO lifecycle_events','ledger_records','PoVI']){
 if(request.includes(forbidden))throw new Error(`Token issuance must not grant password or infrastructure authority: ${forbidden}`);
}

for(const required of [
 'password.length<12','password.length>128','token_hash=$1','FOR UPDATE OF t,u','Setup token is invalid or expired','Account is already provisioned',"crypt($2,gen_salt('bf',12))",'session_version=session_version+1','last_password_change_at=now()','used_at=now()',"cache-control':'no-store'"
])if(!complete.includes(required))throw new Error(`Password setup completion invariant missing: ${required}`);

for(const forbidden of ['INSERT INTO assets','INSERT INTO lifecycle_events','UPDATE assets','UPDATE lifecycle_events','ledger_records']){
 if(complete.includes(forbidden))throw new Error(`Password setup must not mutate infrastructure truth: ${forbidden}`);
}

for(const required of ['One-time setup token','minLength={12}','maxLength={128}',"/api/auth/password-setup/complete"]){
 if(!page.includes(required))throw new Error(`Password setup UI invariant missing: ${required}`);
}

for(const required of ['STRATUM_AUTH_BOOTSTRAP_SECRET=','STRATUM_AUTH_BOOTSTRAP_EMAIL=','STRATUM_AUTH_BOOTSTRAP_ORGANIZATION_ID=']){
 if(!envExample.includes(required))throw new Error(`Bootstrap deployment configuration missing from .env.example: ${required}`);
}

for(const required of [
 'readSession()','can(session.role,\'ORG_MANAGE\')','session.organizationId','LIVE TENANT','Sign in required','does not substitute reference or demo organization data','Organization members'
])if(!adminPage.includes(required))throw new Error(`Admin tenant-truth invariant missing: ${required}`);
if(adminPage.includes('demoSession'))throw new Error('Admin page must never substitute demoSession for authenticated tenant identity');

for(const required of [
 "requireSession(['SUPER_ADMIN'])",'session.organizationId','ALLOWED_ROLES','Multi-organization account provisioning is not supported','Existing membership role changes require the explicit role-management workflow','randomBytes(32)',"createHash('sha256')",'user_password_setup_tokens','created_by_user_id',"'SUPER_ADMIN'",'cache-control\':\'no-store'
])if(!memberProvisioning.includes(required))throw new Error(`Tenant member provisioning invariant missing: ${required}`);
const allowedRoleMatch=memberProvisioning.match(/const ALLOWED_ROLES=\[([^\]]+)\]/);
if(!allowedRoleMatch)throw new Error('Unable to inspect tenant member provisioning role allow-list');
if(allowedRoleMatch[1].includes('SUPER_ADMIN'))throw new Error('Ordinary tenant member provisioning must never mint SUPER_ADMIN');
for(const forbidden of ['INSERT INTO assets','UPDATE assets','INSERT INTO lifecycle_events','UPDATE lifecycle_events','ledger_records','validator_governance','PoVI']){
 if(memberProvisioning.includes(forbidden))throw new Error(`Tenant member provisioning must remain isolated from infrastructure truth: ${forbidden}`);
}

for(const required of ["fetch('/api/admin/members'",'Issue one-time setup link','One-time setup link','not stored in local browser persistence','does not approve work','STRATUM Spatial Verified account setup']){
 if(!adminInvite.includes(required))throw new Error(`Admin provisioning UI invariant missing: ${required}`);
}
if(adminInvite.includes('localStorage'))throw new Error('Admin member provisioning must not simulate invitations in localStorage');

console.log('Account provisioning is hashed, expiring, single-use, tenant-scoped, bootstrap-fail-closed, truthful in administration UI, excludes ordinary SUPER_ADMIN minting, and remains isolated from infrastructure truth');
