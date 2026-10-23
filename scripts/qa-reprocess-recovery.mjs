import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  SPATIAL_REPROCESS_JOURNAL_KEY,
  beginReprocessJournal,
  clearReprocessEntry,
  emptyReprocessJournal,
  parseReprocessJournal,
  readReprocessJournal,
  recordReprocessStart,
  reconcileReprocessJournal,
  resolveReprocessJournalEntry,
} from '../lib/spatial-reprocess-journal.ts';

const shaA='a'.repeat(64),shaB='b'.repeat(64);
const entryA={sha256:shaA,name:'5749_Brynhurst_-_Electrical_-_Bid_Set_2025.04.17__1.pdf',sourceRecord:{name:'5749_Brynhurst_-_Electrical_-_Bid_Set_2025.04.17__1.pdf',sha256:shaA,ext:'pdf',state:'parsed',entities:28770},priorEntityCount:28770,startedAt:'2026-10-20T19:53:00.000Z'};

/* Pure round-trip: record -> serialize -> parse -> clear. */
let journal=recordReprocessStart(emptyReprocessJournal(),entryA);
assert.equal(journal.entries[shaA].state,'in-flight','journal entry must record the in-flight state');
assert.equal(journal.entries[shaA].priorEntityCount,28770,'journal must retain the prior entity count as metadata only');
const roundTripped=parseReprocessJournal(JSON.stringify(journal));
assert.deepEqual(roundTripped,journal,'journal must survive a serialize/parse round-trip unchanged');
journal=recordReprocessStart(roundTripped,{...entryA,sha256:shaB,name:'E601 One Line.pdf',priorEntityCount:4});
assert.deepEqual(Object.keys(journal.entries).sort(),[shaA,shaB].sort(),'concurrent reprocesses must journal independently per SHA');
journal=clearReprocessEntry(journal,shaA);
assert.deepEqual(Object.keys(journal.entries),[shaB],'clearing one entry must not disturb another in-flight reprocess');
assert.equal(clearReprocessEntry(journal,shaA),journal,'clearing an absent entry must be a no-op');

/* Corrupt or foreign payloads must never crash hydration or invent entries. */
assert.deepEqual(parseReprocessJournal(null),emptyReprocessJournal());
assert.deepEqual(parseReprocessJournal('not json'),emptyReprocessJournal());
assert.deepEqual(parseReprocessJournal('{"version":99,"entries":{}}'),emptyReprocessJournal(),'unknown journal versions must be ignored, not guessed');
assert.deepEqual(parseReprocessJournal(JSON.stringify({version:1,entries:{bad:{sha256:'other'}}})),emptyReprocessJournal(),'entries whose key and SHA disagree must be dropped');

/* Storage adapters against an in-memory Storage stub. */
const backing=new Map();
const storage={
  getItem:key=>backing.has(key)?backing.get(key):null,
  setItem:(key,value)=>{backing.set(key,String(value))},
  removeItem:key=>{backing.delete(key)},
};
beginReprocessJournal(entryA,storage);
assert.ok(backing.has(SPATIAL_REPROCESS_JOURNAL_KEY),'begin must persist the journal under the versioned key');
assert.deepEqual(readReprocessJournal(storage).entries[shaA],{...entryA,state:'in-flight'},'adapter read must return the recorded entry');
assert.ok(!JSON.stringify(readReprocessJournal(storage)).includes('"entities":[{'),'journal must never carry entity payloads');
resolveReprocessJournalEntry(shaA,storage);
assert.deepEqual(readReprocessJournal(storage),emptyReprocessJournal(),'resolving the last entry must empty the journal');
assert.ok(!backing.has(SPATIAL_REPROCESS_JOURNAL_KEY),'an empty journal must remove the storage key');

/* Recovery decisions: journal present + source missing => restore-source; present => clear. */
const two=recordReprocessStart(recordReprocessStart(emptyReprocessJournal(),entryA),{...entryA,sha256:shaB,name:'E601 One Line.pdf'});
const decision=reconcileReprocessJournal(two,[shaB,'c'.repeat(64)]);
assert.deepEqual(decision.resolvedShas,[shaB],'a source present in the persisted graph resolves its journal entry');
assert.deepEqual(decision.restoreSources.map(entry=>entry.sha256),[shaA],'a source missing from the persisted graph must roll back from the journal');
assert.deepEqual(reconcileReprocessJournal(two,[shaA,shaB]),{restoreSources:[],resolvedShas:[shaA,shaB]},'all sources present means nothing to restore');
assert.deepEqual(reconcileReprocessJournal(emptyReprocessJournal(),[]),{restoreSources:[],resolvedShas:[]},'no journal means no recovery work');

/* Source-text contract: CompilerWorkspace journal wiring. */
const compiler=fs.readFileSync('components/CompilerWorkspace.tsx','utf8');
const replacementAt=compiler.indexOf('replacementBackup={source:existing');
const journalWriteAt=compiler.indexOf('beginReprocessJournal({sha256:digest');
const parseAt=compiler.indexOf('parsed=await parsePdfOffThread');
assert.ok(replacementAt>=0&&journalWriteAt>replacementAt,'the journal must be written when the replacement backup is established');
assert.ok(parseAt>journalWriteAt,'the journal must be durable BEFORE the replacement parse starts');
assert.match(compiler,/priorEntityCount:replacementBackup\.entities\.length/,'journal must record the prior compilation size from the backup it replaces');
assert.match(compiler,/await saveGraph\(nextFiles,nextEntities,replacementSource\?\[replacementSource\]:\[\],graphController\.signal\);if\(reprocessJournalSha\)resolveReprocessJournalEntry\(reprocessJournalSha\)/,'journal must clear only after saveGraph commits (success and failure-restore both persist through that call)');
assert.match(compiler,/reconcileReprocessJournal\(readReprocessJournal\(\),restored\.map\(item=>item\.sha256\)\)/,'hydration must reconcile the journal against the persisted graph sources');
assert.match(compiler,/Interrupted reprocess rolled back/,'an interrupted reprocess must be surfaced to the user, never hidden');
assert.match(compiler,/state:'review',summary:'Reprocess was interrupted/,'a rolled-back source must return flagged for review/reprocess, with no fabricated entities');
assert.match(compiler,/parseBusyRef\.current\?\{restoreSources:\[\],resolvedShas:\[\]\}/,'hydration must not resolve the journal out from under a parse running in this same session');

/* Source-text contract: recovery generations consulted before the shadow. */
const recovery=fs.readFileSync('lib/spatial-browser-recovery.ts','utf8');
const currentFn=recovery.slice(recovery.indexOf('export async function readIndexedCurrentSpatialGraph'),recovery.indexOf('const recoveryTick'));
assert.match(currentFn,/getChunkedGraph\(PRIMARY_KEY\)/,'current read must still try the chunked graph first');
assert.doesNotMatch(currentFn,/catch\{return null\}\s*try\{return await idbGet/,'a throwing chunked read must fall through to the plain IndexedDB copy, not return null');
assert.match(currentFn,/await idbGet\(PRIMARY_KEY\)/,'current read must fall through to the plain IndexedDB copy');
const primaryFn=recovery.slice(recovery.indexOf('export async function readPrimarySpatialGraph'),recovery.indexOf('export async function writePrimarySpatialGraph'));
const latestAt=primaryFn.indexOf("readIndexedRecovery('latest')"),previousAt=primaryFn.indexOf("readIndexedRecovery('previous')"),shadowAt=primaryFn.indexOf('return shadow');
assert.ok(latestAt>=0&&previousAt>latestAt&&shadowAt>previousAt,'primary read must consult latest, then previous recovery generations, and only then the localStorage shadow');
assert.match(primaryFn,/fromRecovery=Boolean\(indexed\)/,'recovery fallback must be tracked so it is never healed back over current');
assert.match(primaryFn,/if\(indexed&&fromRecovery\)return indexed;/,'recovery fallback is read-only on the load path; promotion stays with restoreBestSpatialGraph');

console.log('Reprocess recovery contract passed: durable journal round-trips, per-SHA clear, restore-source vs resolve decisions, corrupt-journal tolerance, workspace wiring (journal before parse, clear after commit, hydration rollback surfaced), and primary read falls back latest -> previous -> shadow.');
