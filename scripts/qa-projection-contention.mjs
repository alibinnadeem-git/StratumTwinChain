import assert from 'node:assert/strict';
import fs from 'node:fs';
import {graphSignature} from '../lib/graph-signature.ts';

// Projection write contention (docs/SPATIAL_RENDER_ACCURACY_REPORT.md §4 #1, fixed 2026-10-29). On the golden
// fixture every graph write re-puts ~39 MB of chunks, so redundant writes and racing projection passes made
// the first projection land ~38 s after render and kept Apply drawing scale waiting 33 s.
const ok=(label,condition)=>{assert.ok(condition,label);console.log(`✓ ${label}`)};
const engine=fs.readFileSync('components/SpatialProjectionEngine.tsx','utf8');
const guard=fs.readFileSync('components/SpatialPersistenceGuard.tsx','utf8');

// 1. One projection pass at a time across the Import and Spatial page mounts.
ok('passes are serialized across mounts by a module-level chain',/^let passInFlight:Promise<void>=Promise\.resolve\(\);/m.test(engine)&&/await previousPass;/.test(engine)&&/releasePass\(\)/.test(engine));
ok('a pass whose page unmounted stops before writing, and says so',/return\(\)=>\{active=false;/.test(engine)&&/PROJECT_CANCELLED_UNMOUNTED/.test(engine)
  &&engine.indexOf('if(stopIfUnmounted())return;\n    if(graphSignature(enriched)===before)')>0&&engine.indexOf('stopIfUnmounted')<engine.indexOf('writePrimarySpatialGraphIfUnchanged(enriched'));
ok('a stale-read write is still refused (compare-and-write kept)',/writePrimarySpatialGraphIfUnchanged\(enriched as any,before\)/.test(engine));

// 2. The persistence guard no longer rewrites the primary graph it just read after every update (main's
// large-graph fix, merged 2026-10-29): only a genuinely newer local copy is promoted.
ok('only a newer local copy is promoted',/if\(differs&&local\)await writePrimarySpatialGraph\(local\);/.test(guard)&&/const localNewer=/.test(guard)&&/graphSignature\(local\)!==graphSignature\(indexed\)&&localNewer/.test(guard));
ok('the indexed graph is never written back to itself',!/await writePrimarySpatialGraph\(indexed\)/.test(guard.slice(guard.indexOf('const captureGraphUpdate'),guard.indexOf('const reconcileStorageEvent'))));
ok('recovery generations are still refreshed on change',/await protectSpatialGraph\(graph,previous&&graphSignature\(previous\)!==graphSignature\(graph\)\?previous:null\);/.test(guard));

// 3. Change detection skips the per-page text layer but still sees real edits.
const graph=phrases=>({version:'1',entities:[{id:'t',kind:'pdf-text-layer',meta:{page:4,textPhrases:phrases}},{id:'hp1',kind:'text-asset-candidate',x:1,y:2,meta:{candidateRole:'INSTANCE'}}],links:[]});
ok('the text layer is not hashed (parser output, replaced only by a re-parse)',graphSignature(graph([{t:'HP1'}]))===graphSignature(graph([{t:'HP1'},{t:'HL'}])));
const edited=graph([{t:'HP1'}]);edited.entities[1].meta.candidateRole='LABEL';
ok('a human or projection edit still changes the signature',graphSignature(edited)!==graphSignature(graph([{t:'HP1'}])));

console.log('\nProjection write-contention contract passed.');
