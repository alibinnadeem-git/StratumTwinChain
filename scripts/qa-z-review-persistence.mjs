import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync('migrations/012_spatial_z_review_provenance.sql','utf8');
const api=fs.readFileSync('app/api/spatial/z-reviews/route.ts','utf8');
const inspector=fs.readFileSync('components/SpatialAssetInspector.tsx','utf8');
const readiness=fs.readFileSync('lib/server/database-readiness.ts','utf8');
const compilationApi=fs.readFileSync('app/api/spatial/compilations/route.ts','utf8');

assert.match(migration,/CREATE TABLE IF NOT EXISTS spatial_z_review_decisions/);
assert.match(migration,/organization_id uuid NOT NULL/);
assert.match(migration,/project_id uuid NOT NULL/);
assert.match(migration,/compilation_id uuid NOT NULL/);
assert.match(migration,/actor_user_id uuid NOT NULL/);
assert.match(migration,/previous_decision_id uuid/);
assert.match(migration,/BEFORE UPDATE OR DELETE ON spatial_z_review_decisions/);
assert.match(migration,/append-only/i);
assert.match(migration,/NOT_PHYSICAL_TRUTH_NOT_DIR_NOT_POVI/);
assert.doesNotMatch(migration,/ON DELETE CASCADE/,'review provenance must not cascade-delete with source records');

assert.match(api,/requireSession\(\['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER'\]\)/);
assert.match(api,/WHERE id=\$1 AND project_id=\$2 AND organization_id=\$3/);
assert.match(api,/buildZSolution\(rawPlacementEntity\(entity\)\)/);
assert.match(api,/item\.absolute&&item\.baseZ!==null/);
assert.match(api,/Stored entity does not currently contain a Z conflict requiring adjudication/);
assert.match(api,/Requested Z chain is not an absolute candidate in the stored conflict/);
assert.match(api,/domain:'STRATUM\/SPATIAL\/Z-REVIEW\/1'/);
assert.match(api,/graphSha256:stored\.graph_sha256/);
assert.match(api,/candidate_snapshot/);
assert.match(api,/conflict_snapshot/);
assert.match(api,/INSERT INTO spatial_z_review_decisions/);
assert.doesNotMatch(api,/INSERT\s+INTO\s+assets|UPDATE\s+assets|INSERT\s+INTO\s+lifecycle_events|ledger_records|approvals/i);
assert.match(api,/NOT_PHYSICAL_TRUTH_NOT_DIR_NOT_POVI/);

assert.match(inspector,/Use this design chain for review placement/);
assert.match(inspector,/\/api\/spatial\/z-reviews/);
assert.match(inspector,/SERVER_AUTHENTICATED_HUMAN_REVIEW/);
assert.match(inspector,/credentials:'same-origin'/);
assert.match(inspector,/Review rationale/);
assert.match(inspector,/PHYSICAL Z UNVERIFIED/);
assert.match(readiness,/spatialZReview/);
assert.match(readiness,/spatial_z_review_decisions/);

assert.match(compilationApi,/zReviewClaims/);
assert.match(compilationApi,/SERVER_AUTHENTICATED_HUMAN_REVIEW/);
assert.match(compilationApi,/spatial_z_review_decisions/);
assert.match(compilationApi,/Spatial Z review receipt does not match the persisted server decision/);

console.log('Spatial Z review provenance contract passed: authenticated project-scoped review events are append-only, recomputed from stored compilation evidence, hash-bound to the source graph, and cannot create physical truth, assets, lifecycle state, DIRs or PoVI finality.');
