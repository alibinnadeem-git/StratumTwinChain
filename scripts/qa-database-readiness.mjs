import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DATABASE_CAPABILITY_TABLES,REQUIRED_DATABASE_TABLES,summarizeDatabaseReadiness} from '../lib/server/database-readiness.ts';

const full=summarizeDatabaseReadiness(REQUIRED_DATABASE_TABLES);
assert.equal(full.fullSchemaReady,true);
assert.equal(full.coreReady,true);
assert.equal(full.lifecycleReady,true);
assert.equal(full.evidenceReady,true);
assert.equal(full.archiveReady,true);
assert.equal(full.spatialPersistenceReady,true);
assert.equal(full.attestationsReady,true);
assert.equal(full.dirRuntimeReady,true);
assert.equal(full.missingTables.length,0);
console.log('✓ complete canonical table set reports all database capabilities ready');

const withoutEvidence=REQUIRED_DATABASE_TABLES.filter(table=>!['evidence','evidence_files'].includes(table));
const evidenceMissing=summarizeDatabaseReadiness(withoutEvidence);
assert.equal(evidenceMissing.coreReady,true);
assert.equal(evidenceMissing.lifecycleReady,true);
assert.equal(evidenceMissing.evidenceReady,false);
assert.deepEqual(evidenceMissing.missingTables.filter(table=>table.startsWith('evidence')),['evidence','evidence_files']);
console.log('✓ evidence readiness fails independently without degrading core/lifecycle readiness');

const withoutLifecycle=REQUIRED_DATABASE_TABLES.filter(table=>table!=='lifecycle_events');
const lifecycleMissing=summarizeDatabaseReadiness(withoutLifecycle);
assert.equal(lifecycleMissing.lifecycleReady,false);
assert.equal(lifecycleMissing.evidenceReady,false);
assert.equal(lifecycleMissing.attestationsReady,false);
assert.equal(lifecycleMissing.dirRuntimeReady,false);
assert.equal(lifecycleMissing.spatialPersistenceReady,true);
console.log('✓ lifecycle absence blocks lifecycle-dependent capabilities while independent Spatial persistence remains measurable');

const withoutCore=REQUIRED_DATABASE_TABLES.filter(table=>table!=='assets');
const coreMissing=summarizeDatabaseReadiness(withoutCore);
assert.equal(coreMissing.coreReady,false);
assert.equal(coreMissing.lifecycleReady,false);
assert.equal(coreMissing.archiveReady,false);
assert.equal(coreMissing.spatialPersistenceReady,false);
console.log('✓ missing core tenant/asset schema fails dependent readiness closed');

assert.ok(DATABASE_CAPABILITY_TABLES.spatialPersistence.includes('spatial_compilations'));
assert.ok(DATABASE_CAPABILITY_TABLES.spatialPersistence.includes('spatial_compilation_reviews'));
assert.ok(DATABASE_CAPABILITY_TABLES.attestations.includes('human_attestations'));
assert.ok(DATABASE_CAPABILITY_TABLES.archive.includes('asset_archive_events'));
assert.ok(DATABASE_CAPABILITY_TABLES.dirRuntime.includes('approval_policies'));
assert.ok(DATABASE_CAPABILITY_TABLES.dirRuntime.includes('ledger_records'));
assert.ok(!DATABASE_CAPABILITY_TABLES.dirRuntime.some(table=>table.startsWith('sv_chain_')),'validator chain tables must not be duplicated into the Spatial application database');
console.log('✓ post-baseline Spatial, attestation and archive migrations are part of readiness');

const health=fs.readFileSync('app/api/health/route.ts','utf8');
assert.match(health,/DATABASE_READINESS_SQL/);
assert.match(health,/databaseReachable/);
assert.match(health,/databaseProbeStatus/);
assert.match(health,/LIVE_READY/);
assert.match(health,/LIVE_INCOMPLETE/);
assert.match(health,/REFERENCE/);
assert.match(health,/HEALTH_READINESS_NEVER_ESTABLISHES_VERIFIED_STATE_OR_POVI_FINALITY/);
assert.doesNotMatch(health,/error\.message|connectionString|password|hostname|databaseHost/i);
assert.doesNotMatch(health,/SELECT\s+\*/i);
console.log('✓ health readiness exposes capability state without secrets, row data or raw database errors');

const readiness=fs.readFileSync('lib/server/database-readiness.ts','utf8');
assert.match(readiness,/information_schema\.tables/);
assert.match(readiness,/table_schema='public'/);
assert.doesNotMatch(readiness,/INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE/i);
console.log('✓ database readiness probe is read-only schema inspection');

console.log('\nDatabase and server-backed persistence readiness contract passed.');
