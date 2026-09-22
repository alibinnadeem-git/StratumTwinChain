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

for(const required of ['PUBLISHED_REFERENCE','AHJ_ADOPTED','CONTRACTUAL','OEM_PUBLISHED','PROJECT_SUBMITTAL','HISTORICAL_REFERENCE','PUBLISHED_REFERENCE_IS_NOT_PROJECT_APPLICABILITY','A published reference cannot become project-applicable'])
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
for(const id of [
 'nfpa-70b-2023','nfpa-20-2025','nfpa-99-2024','nfpa-101-2024','nfpa-855-2026',
 'neca-1-2023','neca-91-2023','neca-100-2024','neca-402-2020','neca-413-2024','neca-430-2025','neca-714-2025',
 'icc-ibc-2024','icc-ifc-2024','icc-iecc-2024','icc-imc-2024','icc-izc-2024',
 'ca-title24-part2-2025','ca-title24-part3-2025','ca-title24-part4-2025','ca-title24-part6-2025','ca-title24-part9-2025','ca-title24-part11-2025',
 'asce-7-22','aisc-360-22','aisc-341-22','ieee-1584-2018','iso-19650-1-2018','ada-2010','osha-1910-subpart-s','nist-csf-2-0','hipaa-security-rule-current','ul-1008-current'
])assert.ok(registry.includes(`id:'${id}'`),'Published reference registry missing '+id);
const referenceIds=[...registry.matchAll(/\{id:'([^']+)'/g)].map(match=>match[1]);
assert.equal(new Set(referenceIds).size,referenceIds.length,'Published reference IDs must remain unique');
const applicabilityCount=(registry.match(/,applicability:'REFERENCE_ONLY_UNTIL_PROJECT_AHJ_RESOLUTION'/g)||[]).length;
assert.equal(applicabilityCount,referenceIds.length,'Every built-in reference must remain reference-only until project/AHJ resolution');
const publisherUrlCount=(registry.match(/publisherUrl:'https:\/\//g)||[]).length;
assert.equal(publisherUrlCount,referenceIds.length,'Every built-in reference must point to an HTTPS publisher/government source');
console.log('Expected Power persistence, standards/OEM authority, and maintenance revision truth boundaries passed');
