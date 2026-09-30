import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync('migrations/010_oem_cad_verifications.sql','utf8');
const route=fs.readFileSync('app/api/oem/cad-verifications/route.ts','utf8');
const workbench=fs.readFileSync('components/OemCadVerificationWorkbench.tsx','utf8');
const queue=fs.readFileSync('components/OemCadAcquisitionQueue.tsx','utf8');
const readiness=fs.readFileSync('lib/server/database-readiness.ts','utf8');

for(const table of ['oem_cad_verifications','oem_cad_source_files']){
 assert.match(migration,new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${table}\\b`,'i'),`missing migration table ${table}`);
}
assert.match(migration,/verification_status\s+text\s+NOT NULL\s+DEFAULT 'FILE_VERIFIED'/i);
assert.match(migration,/UNIQUE \(organization_id,candidate_id,source_sha256\)/i);
assert.match(migration,/content\s+bytea\s+NOT NULL/i);
assert.match(migration,/BEFORE UPDATE OR DELETE ON oem_cad_verifications/i);
assert.match(migration,/BEFORE UPDATE OR DELETE ON oem_cad_source_files/i);
assert.match(migration,/do not approve browser GLB geometry/i);

assert.match(route,/requireSession\(\['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER'\]\)/);
assert.match(route,/const MAX=25\*1024\*1024/);
assert.match(route,/OEM_CAD_CANDIDATES\.find\(item=>item\.id===candidateId\)/);
assert.match(route,/const digest=sha256\(bytes\)/);
assert.match(route,/Client SHA-256 does not match server SHA-256/);
assert.match(route,/INSERT INTO oem_cad_verifications/i);
assert.match(route,/INSERT INTO oem_cad_source_files/i);
assert.match(route,/FILE_VERIFIED_IS_SOURCE_PROVENANCE_ONLY_AND_DOES_NOT_ACTIVATE_VIEWER_GEOMETRY/);
assert.doesNotMatch(route,/GLB_APPROVED/);
assert.doesNotMatch(route,/ELECTRICAL_MODEL_REGISTRY_STORAGE_KEY|stratum:model-registry-updated/);

assert.match(workbench,/crypto\.subtle\.digest\('SHA-256'/);
assert.match(workbench,/form\.set\('sha256',clientSha\)/);
assert.match(workbench,/\/api\/oem\/cad-verifications/);
assert.match(workbench,/This advances evidence to FILE VERIFIED only/);
assert.match(workbench,/does not mean the file has been converted to a controlled GLB/i);
assert.doesNotMatch(workbench,/ELECTRICAL_MODEL_REGISTRY_STORAGE_KEY|stratum:model-registry-updated|modelUrl\s*=/i);
assert.match(workbench,/stratum:oem-cad-verification-updated/);

assert.match(queue,/\/api\/oem\/cad-verifications/);
assert.match(queue,/stratum:oem-cad-verification-updated/);
assert.match(queue,/status:'FILE_VERIFIED'/);
assert.match(queue,/sourceSha256:verification\.source_sha256/);
assert.match(queue,/reuseTerms:verification\.reuse_terms/);
assert.match(queue,/candidate\.status==='GLB_APPROVED'\|\|!verification\?candidate/);
assert.doesNotMatch(queue,/ELECTRICAL_MODEL_REGISTRY_STORAGE_KEY|stratum:model-registry-updated|modelUrl\s*=/i);

assert.match(readiness,/oemCadVerification:\['organizations','users','memberships','oem_cad_verifications','oem_cad_source_files'\]/);

console.log('OEM CAD source verification contract passed: tenant-scoped immutable file hashing advances only to FILE_VERIFIED and cannot activate viewer geometry.');
