import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const route=read('app/api/assets/[id]/route.ts');
const views=read('lib/server/live-views.ts');
const verify=read('app/api/verify/route.ts');
const component=read('components/AssetArchiveControls.tsx');
const migration=read('migrations/001_asset_archive_events.sql');
const appendOnlyMigration=read('migrations/005_asset_archive_append_only.sql');

const checks=[
  ['asset API contains no physical DELETE FROM assets',!/DELETE\s+FROM\s+assets/i.test(route)],
  ['archive and restore are admin-only',route.includes("requireSession([...ADMIN_ROLES])")&&route.includes("'SUPER_ADMIN','ORG_ADMIN'")],
  ['archive state mutations are transactional',route.includes('tx(async c=>')],
  ['archive is append-only at API layer',route.includes('INSERT INTO asset_archive_events')&&route.includes("'ARCHIVE'")],
  ['restore is append-only at API layer',route.includes('INSERT INTO asset_archive_events')&&route.includes("'RESTORE'")],
  ['archive and restore require a bounded reason',route.includes("reason.length<5||reason.length>500")],
  ['archive operations lock the tenant-scoped asset',route.includes('organization_id=$1')&&route.includes('FOR UPDATE')],
  ['schema blocks physical asset deletion',migration.includes('stratum_prevent_asset_physical_delete')&&migration.includes('BEFORE DELETE ON assets')],
  ['schema records prior administrative event',migration.includes('previous_event_id')],
  ['schema explicitly denies physical-truth authority',migration.includes('never establishes or mutates Verified physical state')],
  ['database blocks archive-history UPDATE',appendOnlyMigration.includes('stratum_prevent_asset_archive_event_update')&&appendOnlyMigration.includes('BEFORE UPDATE ON asset_archive_events')],
  ['database blocks archive-history DELETE',appendOnlyMigration.includes('stratum_prevent_asset_archive_event_delete')&&appendOnlyMigration.includes('BEFORE DELETE ON asset_archive_events')],
  ['append-only database guard denies trust authority',appendOnlyMigration.includes('grants no Verified-state, DIR, PoVI, validator, evidence, or physical-truth authority')],
  ['active asset registry excludes current archives',views.includes("COALESCE(ae.action,'RESTORE') <> 'ARCHIVE'")],
  ['archived asset recovery view is server-authorized',views.includes("requireSession(['SUPER_ADMIN','ORG_ADMIN'])")&&views.includes("ae.action='ARCHIVE'")],
  ['asset passport exposes append-only archive history',views.includes('assetArchiveHistory')&&views.includes('ORDER BY ae.occurred_at DESC,ae.id DESC')],
  ['public verification preserves archive-separated verified history',verify.includes("ADMINISTRATIVE_ARCHIVE_NEVER_REWRITES_VERIFIED_HISTORY")&&verify.includes('administratively_archived')],
  ['UI uses archive/restore terminology instead of permanent delete',component.includes('Archive asset')&&component.includes('Restore asset')&&!component.includes('Delete asset')],
  ['UI states archive cannot rewrite PoVI or physical truth',component.includes('cannot establish, revoke, or alter PoVI finality or physical truth')]
];

const failed=checks.filter(([,ok])=>!ok);
for(const [name,ok] of checks)console.log(`${ok?'✓':'✗'} ${name}`);
if(failed.length){
  console.error(`\n${failed.length} asset archive safety check(s) failed.`);
  process.exit(1);
}
console.log('\nAsset archive/restore safety contract passed.');
