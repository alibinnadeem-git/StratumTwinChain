/**
 * Durable journal for an in-flight drawing reprocess.
 *
 * processFiles strips a stale source and its entities from the in-memory
 * working set at parse START, keeping the only backup in a JS variable. A
 * reload, crash, or context loss during the parse therefore used to drop the
 * source silently: the persisted graph fell back to an older compatibility
 * shadow and the source never came back.
 *
 * This journal records only small metadata (never entity payloads) in
 * localStorage at the moment a replacement begins. If a later session finds
 * an entry whose source is missing from the persisted graph, hydration rolls
 * the source record back into the sources list (flagged for reprocess) and
 * surfaces the interruption instead of hiding it. The journal never creates
 * or promotes entities; geometry recovery belongs to the protected graph
 * generations in spatial-browser-recovery.
 */
export const SPATIAL_REPROCESS_JOURNAL_KEY='stratum_reprocess_journal_v1';

export type ReprocessJournalEntry={
  sha256:string;
  name:string;
  /** The pre-reprocess source record, restored verbatim if the session dies mid-parse. */
  sourceRecord:Record<string,unknown>;
  priorEntityCount:number;
  startedAt:string;
  state:'in-flight';
};

export type ReprocessJournal={version:1;entries:Record<string,ReprocessJournalEntry>};

export function emptyReprocessJournal():ReprocessJournal{
  return{version:1,entries:{}};
}

function isJournalEntry(value:unknown):value is ReprocessJournalEntry{
  if(!value||typeof value!=='object')return false;
  const entry=value as Partial<ReprocessJournalEntry>;
  return typeof entry.sha256==='string'&&entry.sha256.length>0&&
    typeof entry.name==='string'&&
    Boolean(entry.sourceRecord)&&typeof entry.sourceRecord==='object'&&
    Number.isFinite(Number(entry.priorEntityCount))&&
    typeof entry.startedAt==='string';
}

export function parseReprocessJournal(raw:string|null):ReprocessJournal{
  if(!raw)return emptyReprocessJournal();
  try{
    const parsed=JSON.parse(raw) as Partial<ReprocessJournal>;
    if(!parsed||parsed.version!==1||!parsed.entries||typeof parsed.entries!=='object')return emptyReprocessJournal();
    const entries:Record<string,ReprocessJournalEntry>={};
    for(const [sha256,entry] of Object.entries(parsed.entries)){
      if(isJournalEntry(entry)&&entry.sha256===sha256)entries[sha256]={...entry,state:'in-flight'};
    }
    return{version:1,entries};
  }catch{
    return emptyReprocessJournal();
  }
}

export function recordReprocessStart(journal:ReprocessJournal,entry:Omit<ReprocessJournalEntry,'state'>):ReprocessJournal{
  return{version:1,entries:{...journal.entries,[entry.sha256]:{...entry,state:'in-flight'}}};
}

export function clearReprocessEntry(journal:ReprocessJournal,sha256:string):ReprocessJournal{
  if(!journal.entries[sha256])return journal;
  const entries={...journal.entries};
  delete entries[sha256];
  return{version:1,entries};
}

export type ReprocessReconciliation={
  /** Journal entries whose source is absent from the persisted graph: roll the source record back. */
  restoreSources:ReprocessJournalEntry[];
  /** Journal entries whose source is present in the persisted graph: the reprocess resolved; clear them. */
  resolvedShas:string[];
};

export function reconcileReprocessJournal(journal:ReprocessJournal,graphSourceShas:Iterable<string>):ReprocessReconciliation{
  const present=new Set(graphSourceShas);
  const restoreSources:ReprocessJournalEntry[]=[],resolvedShas:string[]=[];
  for(const entry of Object.values(journal.entries)){
    if(present.has(entry.sha256))resolvedShas.push(entry.sha256);
    else restoreSources.push(entry);
  }
  return{restoreSources,resolvedShas};
}

/* Thin storage adapters over the pure logic above. */

export function readReprocessJournal(storage:Storage=localStorage):ReprocessJournal{
  try{return parseReprocessJournal(storage.getItem(SPATIAL_REPROCESS_JOURNAL_KEY))}catch{return emptyReprocessJournal()}
}

export function writeReprocessJournal(journal:ReprocessJournal,storage:Storage=localStorage):void{
  try{
    if(Object.keys(journal.entries).length===0)storage.removeItem(SPATIAL_REPROCESS_JOURNAL_KEY);
    else storage.setItem(SPATIAL_REPROCESS_JOURNAL_KEY,JSON.stringify(journal));
  }catch{/* Journal is best-effort durability; never block an import on it. */}
}

export function beginReprocessJournal(entry:Omit<ReprocessJournalEntry,'state'>,storage:Storage=localStorage):void{
  writeReprocessJournal(recordReprocessStart(readReprocessJournal(storage),entry),storage);
}

export function resolveReprocessJournalEntry(sha256:string,storage:Storage=localStorage):void{
  writeReprocessJournal(clearReprocessEntry(readReprocessJournal(storage),sha256),storage);
}
