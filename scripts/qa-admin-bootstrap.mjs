import assert from 'node:assert/strict';
import fs from 'node:fs';

const route=fs.readFileSync('app/api/auth/bootstrap-first-admin/route.ts','utf8');
const page=fs.readFileSync('app/set-password/page.tsx','utf8');

assert.match(route,/BOOTSTRAP_TOKEN_SHA256='[a-f0-9]{64}'/);
assert.match(route,/timingSafeEqual/);
assert.match(route,/BOOTSTRAP_EXPIRES_AT='2026-10-01T00:00:00\.000Z'/);
assert.match(route,/BOOTSTRAP_ORGANIZATION='STRATUM Power'/);
assert.match(route,/rows\.rows\.length!==1/);
assert.match(route,/admin\.organization_name!==BOOTSTRAP_ORGANIZATION/);
assert.match(route,/if\(admin\.password_hash\)/);
assert.match(route,/password_hash=crypt\(\$2,gen_salt\('bf',12\)\)/);
assert.match(route,/session_version=session_version\+1/);
assert.match(route,/last_password_change_at=now\(\)/);
assert.match(route,/UPDATE user_password_setup_tokens SET used_at=COALESCE\(used_at,now\(\)\)/);
assert.doesNotMatch(route,/Greenpanda299/i,'Plaintext user password must never enter the repository');
assert.doesNotMatch(route,/xsdtInAPKxMVzBR8WaNehCceYeMtzm3_7Ry_Ka4aEtPy0DpFM8EkzALqmsXPO0oX/,'Raw bootstrap token must never enter the repository');
assert.match(page,/mode'\)==='bootstrap'/);
assert.match(page,/\/api\/auth\/bootstrap-first-admin/);
assert.match(page,/single-use bootstrap credential/);
console.log('Single-use first-admin bootstrap preserves tenant, expiry and credential boundaries');
