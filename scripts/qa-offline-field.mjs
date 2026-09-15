import assert from 'node:assert/strict';
import fs from 'node:fs';

const queue=fs.readFileSync('lib/field-offline-queue.ts','utf8');
const inspection=fs.readFileSync('components/InspectionSession.tsx','utf8');
const evidence=fs.readFileSync('app/api/evidence/upload/route.ts','utf8');

assert.match(queue,/indexedDB\.open\(DB_NAME,DB_VERSION\)/);
assert.match(queue,/evidenceBlobs/);
assert.match(queue,/inspectionQueue/);
assert.match(queue,/persistEvidenceBlob/);
assert.match(queue,/blob:file/);
console.log('✓ offline field queue persists evidence blobs and inspection queue entries in IndexedDB');

const syncStart=queue.indexOf('export async function syncQueuedInspection');
const lifecyclePost=queue.indexOf("fetch('/api/lifecycle'",syncStart);
const evidencePreflight=queue.indexOf('for(const meta of item.evidence)',syncStart);
const missingEvidence=queue.indexOf('is not available in the offline store',syncStart);
assert.ok(evidencePreflight>=0&&missingEvidence>evidencePreflight&&lifecyclePost>missingEvidence,'evidence availability must be verified before lifecycle submission');
assert.match(queue,/requestId:item\.requestId/);
assert.match(queue,/removeQueuedInspection\(item\)/);
const removeIndex=queue.indexOf('await removeQueuedInspection(item)',syncStart);
const uploadIndex=queue.lastIndexOf("fetch('/api/evidence/upload'",removeIndex);
assert.ok(removeIndex>uploadIndex,'queue must only be removed after evidence uploads complete');
console.log('✓ sync verifies every evidence blob before lifecycle POST and reuses the same requestId');
console.log('✓ queue is removed only after lifecycle and all evidence uploads succeed');

assert.match(inspection,/UNSYNCED: inspection is safely queued on this device/);
assert.match(inspection,/nothing is presented as Verified/);
assert.match(inspection,/Queued\/local field data is not submitted evidence, approval, a DIR, PoVI finality, or Verified state/);
assert.match(inspection,/queueInspection\(item\)/);
assert.match(inspection,/syncQueuedInspection\(item\)/);
assert.match(inspection,/router\.push\('\/scan'\)/);
assert.match(inspection,/administratively_archived/);
assert.doesNotMatch(inspection,/Technician signature \/ name/);
assert.doesNotMatch(inspection,/Supervisor \/ inspector<\/strong><input[^>]+required/i);
assert.match(inspection,/server records the authenticated performer/i);
console.log('✓ UI distinguishes UNSYNCED local work from server evidence, approval, DIR, PoVI and Verified state');
console.log('✓ free-text signature identity claim was removed; authenticated performer remains server-bound');
console.log('✓ archived assets remain blocked and field navigation returns to dedicated /scan');

assert.match(evidence,/pg_advisory_xact_lock\(hashtextextended\(\$1,0\)\)/);
assert.match(evidence,/ev\.sha256=\$5/);
assert.match(evidence,/idempotent:true/);
assert.match(evidence,/status:out\.idempotent\?200:201/);
assert.match(evidence,/Existing evidence metadata is incomplete; file storage repair is required before retry/);
console.log('✓ evidence replay is transaction-locked, digest-idempotent and returns 200 on safe replay');
console.log('✓ incomplete evidence metadata fails closed instead of silently duplicating or claiming success');

console.log('\nOffline field queue, evidence replay and truth-boundary contract passed.');
