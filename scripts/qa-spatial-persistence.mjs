import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const migration=read('migrations/002_spatial_compilation_persistence.sql');
const api=read('app/api/spatial/compilations/route.ts');
const ui=read('components/SpatialCompilationPersistence.tsx');
const autoSync=read('components/SpatialAutoSync.tsx');
const recovery=read('lib/spatial-browser-recovery.ts');
const guard=read('components/SpatialPersistenceGuard.tsx');
const compilerPage=read('app/compiler/page.tsx');
const spatialPage=read('app/spatial/page.tsx');
const workspaceStatus=read('components/SpatialWorkspaceStatus.tsx');
const serverHydrator=read('components/SpatialServerHydrator.tsx');
const compiler=read('components/CompilerWorkspace.tsx');
const experience=read('components/SpatialExperience.tsx');

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
 ['API accepts projected SLD feeder relationships for server snapshots',api.includes("'SLD_FEEDS'")],
 ['API makes identical graph save idempotent',api.includes('graph_sha256=$3')&&api.includes('idempotent:true')],
 ['API creates append-only revisions instead of mutating prior compilations',api.includes('supersedes_compilation_id')&&api.includes('revision=(prior.rows[0]?.revision||0)+1')],
 ['API records explicit human review transitions',api.includes("'ACCEPT_REVIEW_BASELINE','REOPEN_REVIEW'")&&api.includes('INSERT INTO spatial_compilation_reviews')],
 ['API performs no asset/lifecycle/chain state mutation',forbiddenMutations.every(pattern=>!pattern.test(api))],
 ['manual review UI still supports explicit save/load and human accept/reopen',ui.includes('Save review snapshot')&&ui.includes('Confirm load')&&ui.includes('Accept as Spatial review baseline')&&ui.includes('Reopen review')],
 ['manual server load still requires second confirmation',ui.includes('loadArmed')&&ui.includes('Confirm load')],
 ['human review decisions still require a reason',ui.includes('reason.trim()')&&ui.includes('cleaned.length<5')],
 ['project selection is remembered for safe background snapshots',ui.includes("stratum_spatial_project_id")&&ui.includes('localStorage.setItem(PROJECT_KEY')],
 ['automatic sync only stores the primary browser graph as a review snapshot',autoSync.includes('readPrimarySpatialGraph')&&autoSync.includes("method:'POST'")&&autoSync.includes('/api/spatial/compilations')],
 ['automatic sync requires a real server project and never invents one',autoSync.includes("state:'PROJECT_REQUIRED'")&&autoSync.includes('projects.length===1')],
 ['automatic sync uses same-origin authenticated calls',autoSync.includes("credentials:'same-origin'")],
 ['automatic sync never performs review acceptance, approval or DIR finality',!autoSync.includes("method:'PATCH'")&&!autoSync.includes('/api/approvals')&&!autoSync.includes('getLedger')],
 ['browser recovery keeps a last-good and previous graph copy',recovery.includes('SPATIAL_LAST_GOOD_KEY')&&recovery.includes('SPATIAL_PREVIOUS_KEY')],
 ['browser recovery adds IndexedDB protection',recovery.includes("indexedDB.open")&&recovery.includes("idbPut('latest'")],
 ['compiler protects every renderable graph through the primary replacement path',compiler.includes('replaceCurrentSpatialGraph(graph)')&&recovery.includes('await protectSpatialGraph(graph,current)')],
 ['Spatial experience auto-restores recovery state before declaring the model missing',experience.includes('restoreBestSpatialGraph')&&experience.includes('await restoreBestSpatialGraph()')],
 ['recovery prefers a graph with renderable entities over a zero-entity current shell',recovery.includes('indexedCurrent&&indexedCurrent.entities.length>0')&&recovery.includes('item.graph.entities.length>0')],
 ['global persistence guard captures graph updates',guard.includes("stratum:graph-updated")&&guard.includes('protectSpatialGraph')],
 ['compiler keeps server review controls secondary',compilerPage.includes('<summary>Server sync & review baseline</summary>')],
 ['authenticated compiler mounts automatic append-only Spatial sync',compilerPage.includes('session&&<SpatialAutoSync/>')],
 ['Spatial route mounts server hydration before rendering the project workspace',spatialPage.includes('<SpatialServerHydrator/>')],
 ['server hydrator only restores a renderable graph from an organization project',serverHydrator.includes('validRenderableGraph')&&serverHydrator.includes('projects.some(project=>project.id===restorable)')&&serverHydrator.includes('replaceCurrentSpatialGraph(graph)')],
 ['server suggests only a saved, nonempty compilation scoped to the organization',api.includes('restorableProjectId')&&api.includes('WHERE organization_id=$1 AND entity_count>0')],
 ['legacy recovery remains available after hydration and clears prior project selection',workspaceStatus.includes('{sourceSheetOnly&&<button className="ghost" type="button" onClick={recoverLegacy}>')&&workspaceStatus.includes('{graph&&!sourceSheetOnly&&<button className="ghost" type="button" onClick={recoverLegacy}>')&&workspaceStatus.includes("localStorage.removeItem('stratum_spatial_project_id')")],
 ['server hydration uses same-origin authenticated compilation API calls',serverHydrator.includes("credentials:'same-origin'")&&serverHydrator.includes('/api/spatial/compilations')],
 ["server hydration publishes a durable LOADING state before remote lookup",serverHydrator.includes("SERVER_HYDRATION_STATE_KEY")&&serverHydrator.includes("publish({state:'LOADING'})")],
 ["Spatial empty-state waits while the latest server model is being restored",experience.includes('serverPending')&&experience.includes('Restoring latest project model…')&&experience.includes("state==='LOADING'")],
 ['new persistence path does not call deprecated twin ingest route',!ui.includes('/api/twin/ingest')&&!autoSync.includes('/api/twin/ingest')&&!api.includes('/api/twin/ingest')]
];

const failed=checks.filter(([,ok])=>!ok);
for(const [name,ok] of checks)console.log(`${ok?'✓':'✗'} ${name}`);
if(failed.length){
  console.error(`\n${failed.length} Spatial persistence safety check(s) failed.`);
  process.exit(1);
}
console.log('\nSpatial persistence, recovery and human-review safety contract passed.');
