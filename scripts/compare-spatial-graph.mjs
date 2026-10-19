// Semantic diff for two exported STRATUM compiled-graph JSON files.
//
// The 3D render is a pure function of the compiled graph, so comparing the graph exported
// BEFORE vs AFTER a code change (for the SAME source file) proves whether the render changed.
//
// Usage:
//   node scripts/compare-spatial-graph.mjs before.json after.json
//
// Exits 0 if the graphs are equivalent (ignoring volatile fields like createdAt), 1 if they
// differ, printing a summary of the first differences.

import fs from 'node:fs';

const [,,beforePath,afterPath]=process.argv;
if(!beforePath||!afterPath){
 console.error('Usage: node scripts/compare-spatial-graph.mjs <before.json> <after.json>');
 process.exit(2);
}

// Fields that legitimately change on every save and must be ignored in the comparison.
const IGNORE_KEYS=new Set(['createdAt','at','occurredAt','generatedAt','timestamp']);

function canonical(value){
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object'){
  const out={};
  for(const key of Object.keys(value).sort()){
   if(IGNORE_KEYS.has(key))continue;
   out[key]=canonical(value[key]);
  }
  return out;
 }
 // Normalize -0 and NaN so they compare stably.
 if(typeof value==='number'){if(Object.is(value,-0))return 0;if(Number.isNaN(value))return 'NaN';}
 return value;
}

function keyOf(item,index){
 if(item&&typeof item==='object'){
  return String(item.id??item.sha256??item.candidateId??item.name??index);
 }
 return String(index);
}

function indexBy(arr){
 const map=new Map();
 (arr||[]).forEach((item,i)=>map.set(keyOf(item,i),item));
 return map;
}

const before=JSON.parse(fs.readFileSync(beforePath,'utf8'));
const after=JSON.parse(fs.readFileSync(afterPath,'utf8'));

const diffs=[];

function summarizeCollection(name,beforeArr,afterArr){
 const b=indexBy(beforeArr),a=indexBy(afterArr);
 const removed=[...b.keys()].filter(k=>!a.has(k));
 const added=[...a.keys()].filter(k=>!b.has(k));
 const changed=[];
 for(const k of b.keys()){
  if(!a.has(k))continue;
  if(JSON.stringify(canonical(b.get(k)))!==JSON.stringify(canonical(a.get(k))))changed.push(k);
 }
 if(removed.length||added.length||changed.length){
  diffs.push({name,counts:{before:beforeArr?.length||0,after:afterArr?.length||0},removed,added,changed});
 }
}

summarizeCollection('entities',before.entities,after.entities);
summarizeCollection('links',before.links,after.links);
summarizeCollection('sources',before.sources,after.sources);

// Everything else (reviewState, coordinationIntelligence, stats, proposals, etc.)
const scalarBefore=canonical({...before,entities:undefined,links:undefined,sources:undefined});
const scalarAfter=canonical({...after,entities:undefined,links:undefined,sources:undefined});
const scalarEqual=JSON.stringify(scalarBefore)===JSON.stringify(scalarAfter);

console.log(`entities: ${before.entities?.length||0} -> ${after.entities?.length||0}`);
console.log(`links:    ${before.links?.length||0} -> ${after.links?.length||0}`);
console.log(`sources:  ${before.sources?.length||0} -> ${after.sources?.length||0}`);
console.log('');

if(!diffs.length&&scalarEqual){
 console.log('✓ EQUIVALENT — the compiled graph is identical (ignoring timestamps).');
 console.log('  The 3D render is a pure function of this graph, so the render is unchanged.');
 process.exit(0);
}

for(const d of diffs){
 console.log(`✗ ${d.name}: ${d.counts.before} -> ${d.counts.after} | added ${d.added.length}, removed ${d.removed.length}, changed ${d.changed.length}`);
 const show=arr=>arr.slice(0,8).join(', ')+(arr.length>8?` … (+${arr.length-8} more)`:'');
 if(d.added.length)console.log(`    added:   ${show(d.added)}`);
 if(d.removed.length)console.log(`    removed: ${show(d.removed)}`);
 if(d.changed.length)console.log(`    changed: ${show(d.changed)}`);
}
if(!scalarEqual)console.log('✗ top-level fields differ (reviewState / coordinationIntelligence / stats / proposals)');

console.log('\nResult: graphs DIFFER — inspect the entities/fields listed above.');
process.exit(1);
