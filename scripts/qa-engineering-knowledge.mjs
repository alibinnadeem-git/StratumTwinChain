import fs from 'node:fs';
import assert from 'node:assert/strict';

const powerMigration=fs.readFileSync('migrations/007_power_intelligence_persistence.sql','utf8');
const knowledgeMigration=fs.readFileSync('migrations/008_engineering_references_maintenance.sql','utf8');
const spatialRoute=fs.readFileSync('app/api/spatial/compilations/route.ts','utf8');
const powerRoute=fs.readFileSync('app/api/power/findings/route.ts','utf8');
const referenceRoute=fs.readFileSync('app/api/engineering/references/route.ts','utf8');
const maintenanceRoute=fs.readFileSync('app/api/assets/[id]/maintenance-plans/route.ts','utf8');
const liveViews=fs.readFileSync('lib/server/live-views.ts','utf8');
const inspector=fs.readFileSync('components/SpatialAssetInspector.tsx','utf8');
const passport=fs.readFileSync('app/assets/[id]/page.tsx','utf8');
const registry=fs.readFileSync('lib/engineering-reference-registry.ts','utf8');

for(const required of [
 'power_intelligence_snapshots','expected_power_requirements','power_gap_findings','power_finding_dispositions',
 'stratum_prevent_power_snapshot_update','stratum_prevent_expected_power_update','stratum_prevent_power_finding_update','stratum_prevent_power_disposition_update'
])assert.ok(powerMigration.includes(required),'Missing Expected Power persistence invariant: '+required);

for(const required of [
 'engineering_applicability_records','oem_reference_documents','asset_maintenance_plans',
 'stratum_prevent_engineering_applicability_update','stratum_prevent_oem_reference_update','stratum_prevent_maintenance_plan_update'
])assert.ok(knowledgeMigration.includes(required),'Missing engineering knowledge persistence invariant: '+required);

for(const required of ['parsePowerIntelligence','persistPowerIntelligence','new Set(graph.entities.map(entity=>entity.id))'])
 assert.ok(spatialRoute.includes(required),'Spatial save must server-validate/persist power intelligence: '+required);

for(const required of ["requireSession(['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER'])",'power_finding_dispositions','ENGINEERING_REVIEW_REQUIRED','FINDING_DISPOSITION_DOES_NOT_ESTABLISH_CODE_COMPLIANCE_ENGINEERING_APPROVAL_OR_PHYSICAL_TRUTH'])
 assert.ok(powerRoute.includes(required),'Power finding review invariant missing: '+required);

for(const required of ['PUBLISHED_REFERENCE','AHJ_ADOPTED','CONTRACTUAL','OEM_PUBLISHED','PROJECT_SUBMITTAL','HISTORICAL_REFERENCE','PUBLISHED_REFERENCE_IS_NOT_PROJECT_APPLICABILITY'])
 assert.ok(referenceRoute.includes(required)||registry.includes(required),'Engineering reference authority boundary missing: '+required);

for(const required of ["basis:z.enum(['OEM','NFPA_70B','NECA','PROJECT_SPEC','OWNER_STANDARD','CONDITION_BASED','USER_DEFINED'])",'supersedes_plan_id','revision=(prior.rows[0]?.revision||0)+1','MAINTENANCE_PLAN_IS_NOT_PROOF_MAINTENANCE_WAS_PERFORMED'])
 assert.ok(maintenanceRoute.includes(required),'Maintenance revision invariant missing: '+required);

assert.ok(liveViews.includes('maintenance_plan_id'),'Live asset view must expose latest maintenance plan');
assert.ok(inspector.includes('Maintenance cycle'),'Spatial inspector must show maintenance cycle');
assert.ok(passport.includes('MaintenancePlanPanel'),'Asset Passport must show maintenance planning');

for(const forbidden of [
 ['app/api/power/findings/route.ts','UPDATE power_gap_findings'],
 ['app/api/power/findings/route.ts','DELETE FROM power_gap_findings'],
 ['app/api/assets/[id]/maintenance-plans/route.ts','UPDATE asset_maintenance_plans'],
 ['app/api/engineering/references/route.ts','UPDATE engineering_applicability_records']
]){
 const source=fs.readFileSync(forbidden[0],'utf8');
 assert.ok(!source.includes(forbidden[1]),forbidden[0]+' must remain append-only: '+forbidden[1]);
}

assert.match(registry,/ashrae-90-1-2025/);
assert.match(registry,/REFERENCE_ONLY_UNTIL_PROJECT_AHJ_RESOLUTION/);
console.log('Expected Power persistence, standards/OEM authority, and maintenance revision truth boundaries passed');
