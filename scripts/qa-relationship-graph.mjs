import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync('migrations/014_relationship_graph_foundation.sql','utf8');
const service=fs.readFileSync('lib/server/relationship-graph.ts','utf8');
const api=fs.readFileSync('app/api/relationships/route.ts','utf8');
const evidenceApi=fs.readFileSync('app/api/relationships/[id]/evidence/route.ts','utf8');
const reviewApi=fs.readFileSync('app/api/relationships/[id]/review/route.ts','utf8');
const traverseApi=fs.readFileSync('app/api/relationships/traverse/route.ts','utf8');

for(const table of ['relationship_types','asset_relationships','relationship_evidence','relationship_review_events']){
 assert.match(migration,new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${table}\\b`,'i'));
}
assert.match(migration,/asset_relationship_distinct_assets_ck/);
assert.match(migration,/relationship source asset is outside the organization\/project/);
assert.match(migration,/relationship target asset is outside the organization\/project/);
assert.match(migration,/evidence is required before a relationship may become trusted/);
assert.match(migration,/relationship graph records are append-only/);
assert.match(migration,/relationship_types_append_only/,'relationship type semantics must be immutable once published');
assert.match(migration,/initial relationship review must VERIFY or REJECT the candidate/);
assert.match(migration,/rejected or deprecated relationships must be reopened before new verification/);
assert.match(migration,/relationship review must extend the latest append-only review state/);
assert.match(migration,/impact_direction text NOT NULL DEFAULT 'NONE'/);
assert.match(migration,/\('DEPENDS_ON','OPERATIONAL'.*'REVERSE'/);
assert.match(migration,/\('FEEDS','ELECTRICAL'.*'FORWARD'/);
assert.match(migration,/RELATIONSHIP_CANDIDATE_NOT_OPERATIONAL_TRUTH_UNTIL_EVIDENCE_BACKED_HUMAN_VERIFIED/);
assert.doesNotMatch(migration,/UPDATE\s+assets\s+SET\s+status/i);

assert.match(service,/latest\.action IN \('VERIFY','MAINTAIN'\)/,'traversal must use only currently trusted review actions');
assert.match(service,/rt\.impact_direction <> 'NONE'/,'non-propagating relationship types must fail closed in traversal');
assert.match(service,/NOT \(/,'cycle guard must reject already visited assets');
assert.match(service,/Evidence is required before a relationship may become trusted/);
assert.match(service,/reviewTransitionAllowed/,'service must reject illegal review transitions before database insertion');
assert.match(service,/Invalid relationship review transition/);
assert.match(service,/ON CONFLICT\(organization_id,candidate_sha256\) DO NOTHING/,'candidate creation must be idempotent');
assert.match(service,/ON CONFLICT\(organization_id,evidence_sha256\) DO NOTHING/,'evidence append must be idempotent');
assert.match(service,/RELATIONSHIP_CANDIDATE_NOT_OPERATIONAL_TRUTH_UNTIL_EVIDENCE_BACKED_HUMAN_VERIFIED/);
assert.doesNotMatch(service,/UPDATE\s+asset_relationships/i,'relationship candidates must never be mutated into trusted state');

assert.match(api,/requireSession\(\['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER','INSPECTOR','TECHNICIAN'\]\)/);
assert.match(reviewApi,/requireSession\(\['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER','INSPECTOR'\]\)/);
assert.match(evidenceApi,/appendRelationshipEvidence/);
assert.match(traverseApi,/traceTrustedRelationships/);
assert.match(traverseApi,/cache-control':'private, no-store'/);

console.log('Relationship graph contract passed: tenant/project-bound append-only candidates, evidence-gated human review, idempotent provenance, and trusted-only cycle-safe traversal.');
