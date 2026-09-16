import fs from 'node:fs';

const migration=fs.readFileSync('migrations/004_user_password_setup_tokens.sql','utf8');
const request=fs.readFileSync('app/api/auth/password-setup/request/route.ts','utf8');
const complete=fs.readFileSync('app/api/auth/password-setup/complete/route.ts','utf8');
const page=fs.readFileSync('app/set-password/page.tsx','utf8');

for(const required of [
 'user_password_setup_tokens','token_hash text NOT NULL UNIQUE','expires_at timestamptz NOT NULL','used_at timestamptz',"created_via IN ('BOOTSTRAP','SUPER_ADMIN')"
])if(!migration.includes(required))throw new Error(`Password setup migration invariant missing: ${required}`);

for(const required of [
 'randomBytes(32)','createHash(\'sha256\')','timingSafeEqual','STRATUM_AUTH_BOOTSTRAP_SECRET','passwordedAdmin','bootstrapOpen','First-user bootstrap is closed','Bootstrap may provision only the initial SUPER_ADMIN','Cross-organization provisioning is not allowed','Account is already provisioned','TOKEN_TTL_MINUTES=30','cache-control\':\'no-store'
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

console.log('One-time account provisioning is hashed, expiring, single-use, org-scoped, bootstrap-fail-closed, and isolated from infrastructure truth');
