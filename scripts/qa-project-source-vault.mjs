import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 SPATIAL_SOURCE_VAULT_CHUNK_BYTES,
 SPATIAL_SOURCE_VAULT_MAX_BYTES,
 spatialSourceVaultChunkCount,
} from '../lib/spatial-source-vault-contract.ts';

assert.equal(SPATIAL_SOURCE_VAULT_CHUNK_BYTES,2*1024*1024);
assert.equal(SPATIAL_SOURCE_VAULT_MAX_BYTES,250*1024*1024);
assert.equal(spatialSourceVaultChunkCount(1),1);
assert.equal(spatialSourceVaultChunkCount(2*1024*1024),1);
assert.equal(spatialSourceVaultChunkCount(2*1024*1024+1),2);

const migration=fs.readFileSync('migrations/011_spatial_project_source_vault.sql','utf8');
for(const table of ['spatial_project_sources','spatial_project_source_chunks','spatial_project_source_verifications']){
 assert.match(migration,new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${table}\\b`,'i'),`missing ${table}`);
}
assert.match(migration,/UNIQUE \(organization_id, project_id, sha256\)/i);
assert.match(migration,/byte_size integer NOT NULL CHECK \(byte_size > 0 AND byte_size <= 2097152\)/i);
assert.match(migration,/content bytea NOT NULL/i);
assert.match(migration,/BEFORE UPDATE OR DELETE ON spatial_project_sources/i);
assert.match(migration,/BEFORE UPDATE OR DELETE ON spatial_project_source_verifications/i);
assert.match(migration,/Verified Spatial project source chunks are immutable/i);
assert.match(migration,/Hash agreement proves byte integrity only, not engineering correctness or physical truth/i);

const route=fs.readFileSync('app/api/spatial/sources/route.ts','utf8');
assert.match(route,/requireSession\(\['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER'\]\)/);
assert.match(route,/Project not found in this organization/);
assert.match(route,/SPATIAL_SOURCE_VAULT_CHUNK_BYTES/);
assert.match(route,/Client chunk SHA-256 does not match server SHA-256/);
assert.match(route,/createHash\('sha256'\)/);
assert.match(route,/Assembled source bytes do not match the source manifest SHA-256/);
assert.match(route,/spatial-source-vault:\$\{sourceId\}/);
assert.match(route,/spatial-source-vault:\$\{body\.sourceId\}/);
assert.match(route,/Verified project source bytes are immutable/);
assert.doesNotMatch(route,/INSERT INTO assets|INSERT INTO ledger_records|registerRecord|verifyRecord/i);

const chunkRoute=fs.readFileSync('app/api/spatial/sources/[id]/chunks/[index]/route.ts','utf8');
assert.match(chunkRoute,/requireSession\(\)/);
assert.match(chunkRoute,/JOIN spatial_project_source_verifications/,'unverified chunks must not be downloadable');
assert.match(chunkRoute,/s\.organization_id=\$2/,'chunk download must remain tenant scoped');
assert.match(chunkRoute,/cache-control':'private, no-store'/);

const client=fs.readFileSync('lib/spatial-project-source-vault-client.ts','utf8');
assert.match(client,/for\(let index=0;index<count;index\+\+\)/);
assert.match(client,/chunkSha256=await digestBytes\(chunk\)/);
assert.match(client,/method:'PATCH'/);
assert.match(client,/Restored source SHA-256 does not match the project vault manifest/);
assert.match(client,/archiveSourceBytes\(/,'server restore must return through the protected browser archive');

const workspace=fs.readFileSync('components/CompilerWorkspace.tsx','utf8');
assert.doesNotMatch(workspace,/uploadArchivedSourceToProject|\/api\/spatial\/sources/,'normal parsing must not silently upload source bytes to the server');

const vault=fs.readFileSync('components/SpatialProjectSourceVault.tsx','utf8');
assert.match(vault,/Back up local project sources/);
assert.match(vault,/Restore server sources to this browser/);
assert.match(vault,/No source is uploaded automatically/);
assert.match(vault,/Source-vault verification proves exact byte preservation only/);
assert.match(vault,/writeSelectedSpatialProjectId/);

const page=fs.readFileSync('app/compiler/page.tsx','utf8');
assert.match(page,/session&&<SpatialProjectSourceVault\/>/,'source vault controls should only render for authenticated sessions');

const projectSelection=fs.readFileSync('lib/spatial-project-selection.ts','utf8');
assert.match(projectSelection,/stratum_spatial_project_id/);
assert.match(projectSelection,/previous!==projectId/,'project-selection events must not rebroadcast unchanged values');

const readiness=fs.readFileSync('lib/server/database-readiness.ts','utf8');
assert.match(readiness,/spatialSourceVault:\['organizations','users','memberships','projects','spatial_project_sources','spatial_project_source_chunks','spatial_project_source_verifications'\]/);

console.log('Project source vault contract passed: explicit tenant/project source backup uses serverless-safe chunks, server/full-file SHA-256 verification and immutable finalized bytes without changing Spatial/asset/DIR/PoVI truth.');
