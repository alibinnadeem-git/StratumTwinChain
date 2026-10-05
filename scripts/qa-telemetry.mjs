import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync('migrations/013_telemetry_observed_runtime.sql','utf8');
const service=fs.readFileSync('lib/server/telemetry.ts','utf8');
const ingest=fs.readFileSync('app/api/telemetry/ingest/route.ts','utf8');
const latest=fs.readFileSync('app/api/telemetry/latest/route.ts','utf8');
const stream=fs.readFileSync('app/api/telemetry/stream/route.ts','utf8');
const simulator=fs.readFileSync('app/api/telemetry/simulate/route.ts','utf8');
const panel=fs.readFileSync('components/AssetTelemetryPanel.tsx','utf8');
const inspector=fs.readFileSync('components/SpatialAssetInspector.tsx','utf8');

for(const table of ['telemetry_points','telemetry_readings']){
 assert.match(migration,new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${table}\\b`,'i'));
}
assert.match(migration,/source_protocol text NOT NULL CHECK \(source_protocol IN \('OPC_UA','MQTT','REST_WEBHOOK','BACNET_IP','MODBUS_TCP','SIMULATOR'\)\)/);
assert.match(migration,/telemetry_readings are append-only/);
assert.match(migration,/OBSERVED_OPERATIONAL_DATA_NOT_VERIFIED_PHYSICAL_TRUTH/);
assert.doesNotMatch(migration,/UPDATE\s+assets\s+SET\s+status|VERIFIED/i);

assert.match(service,/TELEMETRY_PROTOCOLS=\['OPC_UA','MQTT','REST_WEBHOOK','BACNET_IP','MODBUS_TCP','SIMULATOR'\]/);
assert.match(service,/WHERE organization_id=\$1 AND id=\$2/,'asset lookup must be tenant-scoped');
assert.match(service,/INSERT INTO telemetry_readings/);
assert.match(service,/OBSERVED_OPERATIONAL_DATA_NOT_VERIFIED_PHYSICAL_TRUTH/);
assert.doesNotMatch(service,/UPDATE\s+assets\s+SET\s+status/i);

assert.match(ingest,/requireSession\(\['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER','TECHNICIAN'\]\)/);
assert.match(ingest,/ingestTelemetry\(session\.organizationId,body\)/);
assert.match(simulator,/ingestTelemetry\(session\.organizationId/,'simulator must use the same ingestion service');
assert.match(simulator,/SIMULATED_OBSERVED_DATA_NOT_FIELD_MEASUREMENT/);
assert.match(latest,/latestTelemetry\(session\.organizationId,assetId\)/);
assert.match(stream,/text\/event-stream/);
assert.match(stream,/telemetrySince\(session\.organizationId,assetId,cursor\)/);

assert.match(panel,/new EventSource\('\/api\/telemetry\/stream\?assetId='/);
assert.match(panel,/Operational telemetry is Observed data/);
assert.match(panel,/never silently changes Verified state/);
assert.match(inspector,/<AssetTelemetryPanel assetId=\{asset\.id\}\/>/);

console.log('Telemetry contract passed: tenant-bound Observed readings, shared physical/simulator ingestion service, SSE live delivery and no Verified-state mutation.');
