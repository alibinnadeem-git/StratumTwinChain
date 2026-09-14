import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const migration=read('migrations/002_spatial_compilation_persistence.sql');
const api=read('app/api/spatial/compilations/route.ts');
const ui=read('components/SpatialCompilationPersistence.tsx');
const compilerPage=read('app/compiler/page.tsx');

const forbiddenMutations=[
  /INSERT\s+INTO\s+assets/i,/UPDATE\s+assets/i,/DELETE\s+FROM\s+assets/i,
  /INSERT\s+INTO\s+lifecycle_events/i,/UPDATE\s+lifecycle_events/i,
  /INSERT\s+INTO\s+sv_chain/i,/UPDATE\s+sv_chain/i
];

const checks=[
 ['compilation snapshots are organization/project scoped',migration.includes('organization_id uuid NOT NULL')&&migration.includes('project_id uuid NOT NULL')],
 ['compilation revisions are append-only',migration.includes('stratum_prevent_spatial_compilation_update')&&migration.includes('BEFORE UPDATE OR DELETE ON spatial_compilations')],
 ['review decisions are append-only',migration.includes('BEFORE UPDATE OR DELETE ON spatial_compilation_reviews')&&migration.includes('previous_review_id')],
 ['schema states stored compilation is not Verified state or PoVI finality',migration.includes('not Verified infrastructure state')&&migration.includes('not a DIR or PoVI finality assertion')],
 ['schema states review acceptance does not establish physical truth',migration.includes('does not create STRATUM Assets')&&migration.includes('physical truth')],
 ['API requires authentication for reads',api.includes('const session=await requireSession();')],
 ['API restricts persistence/review mutations to authorized project roles',api.includes("requireSession(['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER'])")],
 ['API validates project belongs to session organization',api.includes('WHERE id=$1 AND organization_id=$2 FOR SHARE')],
 ['API uses a domain-separated canonical compilation hash',api.includes("domain:'STRATUM/SPATIAL/COMPILATION/1'")&&api.includes('canonicalHash(')],
 ['API makes identical graph save idempotent',api.includes('graph_sha256=$3')&&api.includes('idempotent:true')],
 ['API creates a new append-only revision instead of mutating prior compilation',api.includes('supersedes_compilation_id')&&api.includes('revision=(prior.rows[0]?.revision||0)+1')],
 ['API records explicit review state transitions',api.includes("'ACCEPT_REVIEW_BASELINE','REOPEN_REVIEW'")&&api.includes('INSERT INTO spatial_compilation_reviews')],
 ['API truth boundary says storage does not create or verify assets',api.includes('STORED_COMPILATION_DOES_NOT_CREATE_OR_VERIFY_ASSETS')],
 ['API truth boundary says review acceptance is not PoVI finality',api.includes('REVIEW_ACCEPTANCE_IS_NOT_VERIFIED_STATE_OR_POVI_FINALITY')],
 ['API performs no asset/lifecycle/chain state mutation',forbiddenMutations.every(pattern=>!pattern.test(api))],
 ['UI save is an explicit user action',ui.includes('Save review snapshot')&&ui.includes('onClick={saveSnapshot}')],
 ['UI does not autosave browser compilation to server',!ui.includes("useEffect(()=>saveSnapshot")&&!ui.includes("useEffect(saveSnapshot")],
 ['UI load from server requires a second explicit confirmation',ui.includes('Confirm load')&&ui.includes('loadArmed')],
 ['UI loads only into browser review graph and dispatches graph update',ui.includes("localStorage.setItem('stratum_compiled_graph'")&&ui.includes("stratum:graph-updated")],
 ['UI requires a reason for review decisions',ui.includes('reason.trim()')&&ui.includes('cleaned.length<5')],
 ['UI exposes explicit human accept/reopen controls',ui.includes('Accept as Spatial review baseline')&&ui.includes('Reopen review')],
 ['UI denies asset/DIR/PoVI/physical-truth promotion',ui.includes('does not create a STRATUM Asset')&&ui.includes('finalize a DIR')&&ui.includes('establish PoVI finality')&&ui.includes('establish physical truth')],
 ['compiler page includes server-backed review surface',compilerPage.includes('SpatialCompilationPersistence')],
 ['compiler page states L4 candidates are not durable assets until authorized promotion',compilerPage.includes('L4 compiler candidates remain source-derived review objects')&&compilerPage.includes('does not perform that promotion')],
 ['new persistence path does not call deprecated twin ingest route',!ui.includes('/api/twin/ingest')&&!api.includes('/api/twin/ingest')]
];

const failed=checks.filter(([,ok])=>!ok);
for(const [name,ok] of checks)console.log(`${ok?'✓':'✗'} ${name}`);
if(failed.length){
  console.error(`\n${failed.length} Spatial persistence safety check(s) failed.`);
  process.exit(1);
}
console.log('\nSpatial compilation persistence and human-review safety contract passed.');
