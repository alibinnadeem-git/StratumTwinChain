import fs from 'node:fs';

const route=fs.readFileSync('app/api/twin/ingest/route.ts','utf8');

for(const required of [
  'LEGACY_SPATIAL_INGEST_DISABLED',
  "replacement:'/api/spatial/compilations'",
  'status:410',
  'requireSession',
  'SPATIAL_REVIEW_DOES_NOT_CREATE_DURABLE_ASSETS_OR_ESTABLISH_VERIFIED_STATE_POVI_FINALITY_OR_PHYSICAL_TRUTH'
]){
  if(!route.includes(required))throw new Error(`Legacy ingest fail-closed invariant missing: ${required}`);
}

for(const forbidden of [
  'INSERT INTO assets',
  'INSERT INTO lifecycle_events',
  'canonicalHash(',
  "asset_type,name,model,location_label,specifications",
  'STRATUM_TWIN_ENGINE'
]){
  if(route.includes(forbidden))throw new Error(`Legacy ingest must not mutate durable infrastructure state: ${forbidden}`);
}

console.log('Legacy Spatial ingest is fail-closed and cannot create durable STRATUM Assets or lifecycle state');
