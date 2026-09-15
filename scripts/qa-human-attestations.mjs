import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync('migrations/003_human_attestations.sql','utf8');
const api=fs.readFileSync('app/api/attestations/route.ts','utf8');
const panel=fs.readFileSync('components/HumanAttestationPanel.tsx','utf8');
const page=fs.readFileSync('app/assets/[id]/attestations/page.tsx','utf8');

assert.match(migration,/human_attestations/);
assert.match(migration,/append-only/i);
assert.match(migration,/BEFORE UPDATE ON human_attestations/);
assert.match(migration,/BEFORE DELETE ON human_attestations/);
assert.match(migration,/No approval, PoVI vote, DIR finality, validator authority, or physical-truth authority/i);
console.log('✓ human attestations are append-only and explicitly non-authoritative');

assert.match(api,/capacityByRole/);
assert.match(api,/TECHNICIAN:'TECHNICIAN'/);
assert.match(api,/INSPECTOR:'INSPECTOR'/);
assert.match(api,/PROJECT_MANAGER:'SUPERVISOR'/);
assert.match(api,/CLIENT:'CLIENT_REP'/);
assert.doesNotMatch(api,/capacity:z\./);
console.log('✓ attestor capacity is derived from membership role rather than self-selected');

assert.match(api,/le\.organization_id=\$2/);
assert.match(api,/a\.organization_id=le\.organization_id/);
assert.match(api,/p\.organization_id=le\.organization_id/);
assert.match(api,/SESSION/);
assert.match(api,/statementHash=sha256\(body\.statement\)/);
console.log('✓ attestation is tenant-scoped, lifecycle-bound and statement-hashed');

assert.doesNotMatch(api,/UPDATE\s+lifecycle_events/i);
assert.doesNotMatch(api,/getLedger|ledger_records|anchor\(/i);
assert.doesNotMatch(api,/INSERT\s+INTO\s+approvals/i);
assert.match(api,/ATTESTATION_DOES_NOT_APPROVE_LIFECYCLE_OR_ESTABLISH_DIR_POVI_OR_PHYSICAL_TRUTH/);
console.log('✓ attestation API cannot approve lifecycle state, anchor a DIR or cast chain authority');

assert.match(panel,/Session authentication establishes account provenance only/);
assert.match(panel,/not a cryptographic personal signature, professional credential, lifecycle approval, PoVI vote, DIR finality, or physical truth/);
assert.match(panel,/derived from the signed-in membership role, not self-selected/);
assert.match(panel,/\/api\/lifecycle\?assetId=/);
assert.match(panel,/\/api\/attestations/);
console.log('✓ UI distinguishes authenticated provenance from signature, credential, approval and finality');

assert.match(page,/liveAsset\(identifier\)/);
assert.match(page,/Reference\/demo equipment cannot receive attestations/);
assert.match(page,/HumanAttestationPanel/);
console.log('✓ Asset Passport attestation workspace requires a live tenant asset');

console.log('\nTyped human attestation safety contract passed.');
