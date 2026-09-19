import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {REQUIRED_DATABASE_TABLES} from '../lib/server/database-readiness.ts';

const migrationsDir='migrations';
const names=fs.readdirSync(migrationsDir).filter(name=>/^\d{3}_.+\.sql$/.test(name)).sort();
assert.equal(names[0],'000_core_platform.sql','Core platform schema must run before additive migrations');

const core=fs.readFileSync(path.join(migrationsDir,'000_core_platform.sql'),'utf8');
const combined=names.map(name=>fs.readFileSync(path.join(migrationsDir,name),'utf8')).join('\n');

function creates(table){
  return new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${table}\\b`,'i').test(combined);
}
for(const table of REQUIRED_DATABASE_TABLES){
  assert.ok(creates(table),`Migration chain does not create required readiness table: ${table}`);
}
console.log(`✓ migration chain creates all ${REQUIRED_DATABASE_TABLES.length} health/readiness tables`);

for(const table of [
  'systems','manufacturers','work_orders','approvals','ledger_records','user_password_setup_tokens'
]){
  assert.ok(creates(table),`Migration chain does not create runtime support table: ${table}`);
}
console.log('✓ runtime support tables required by current APIs are migration-backed');

assert.match(core,/CREATE EXTENSION IF NOT EXISTS pgcrypto/i);
assert.match(core,/password_hash\s+text/i);
assert.match(core,/session_version\s+integer\s+NOT NULL\s+DEFAULT\s+1/i);
assert.match(core,/organization_id\s+uuid\s+NOT NULL\s+REFERENCES organizations/i);
assert.match(core,/PRIMARY KEY \(organization_id,user_id\)/i);
for(const role of ['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER','TECHNICIAN','CLIENT','INSPECTOR','VIEWER']){
  assert.ok(core.includes(`'${role}'`),`RBAC role missing from membership constraint: ${role}`);
}
console.log('✓ password/session and tenant-scoped RBAC primitives are present');

for(const column of [
  'asset_code','asset_type','qr_token','specifications','installed_at','commissioned_at','warranty_expires_at'
]){
  assert.match(core,new RegExp(`\\b${column}\\b`,'i'),`Asset runtime column missing: ${column}`);
}
for(const column of [
  'canonical_payload','payload_sha256','evidence_package_sha256','ledger_network','ledger_tx_hash','ledger_block_height','anchored_at'
]){
  assert.match(core,new RegExp(`\\b${column}\\b`,'i'),`Lifecycle runtime column missing: ${column}`);
}
for(const column of ['file_name','mime_type','storage_uri','sha256','visibility','captured_by','captured_at','metadata']){
  assert.match(core,new RegExp(`\\b${column}\\b`,'i'),`Evidence runtime column missing: ${column}`);
}
assert.match(core,/content\s+bytea\s+NOT NULL/i);
assert.match(core,/byte_size\s+bigint\s+NOT NULL/i);
console.log('✓ live asset, lifecycle and evidence APIs have baseline columns');

assert.doesNotMatch(core,/INSERT\s+INTO\s+(organizations|users|memberships|projects|sites|assets|lifecycle_events|evidence)\b/i);
assert.doesNotMatch(core,/demo|sample tenant|reference tenant/i);
console.log('✓ baseline migration creates no fake tenant or infrastructure records');

assert.match(core,/Registration alone is not physical verification/i);
assert.match(core,/Cryptographic anchoring does not independently establish physical truth/i);
console.log('✓ database bootstrap preserves STRATUM truth boundaries');


const runner=fs.readFileSync('scripts/apply-database-migrations.mjs','utf8');
const packageJson=JSON.parse(fs.readFileSync('package.json','utf8'));
assert.match(runner,/process\.argv\.includes\('--apply'\)/);
assert.match(runner,/Plan only\. Re-run with --apply and DATABASE_URL/i);
assert.match(runner,/DATABASE_URL is required when --apply is used/);
assert.match(runner,/stratum_schema_migrations/);
assert.match(runner,/Applied migration checksum changed/);
assert.match(runner,/pg_advisory_lock/);
assert.equal(packageJson.scripts['db:migrate'],'node scripts/apply-database-migrations.mjs');
console.log('✓ migration runner is plan-only by default, checksum-locked and explicit-apply only');


const tenantBootstrap=fs.readFileSync('scripts/bootstrap-production-organization.mjs','utf8');
const packageAfterBootstrap=JSON.parse(fs.readFileSync('package.json','utf8'));
assert.match(tenantBootstrap,/process\.argv\.includes\('--apply'\)/);
assert.match(tenantBootstrap,/STRATUM_AUTH_BOOTSTRAP_ORGANIZATION_ID/);
assert.match(tenantBootstrap,/STRATUM_BOOTSTRAP_ORGANIZATION_NAME/);
assert.match(tenantBootstrap,/INSERT INTO organizations\(id,name\)/);
assert.doesNotMatch(tenantBootstrap,/INSERT\s+INTO\s+(users|memberships|assets|lifecycle_events|evidence)\b/i);
assert.match(tenantBootstrap,/No user, password, membership, asset, evidence, DIR or PoVI record was created/);
assert.equal(packageAfterBootstrap.scripts['db:bootstrap-organization'],'node scripts/bootstrap-production-organization.mjs');
console.log('✓ production tenant bootstrap is explicit, deterministic and does not mint accounts or infrastructure truth');

console.log('\nProduction database bootstrap migration contract passed.');
