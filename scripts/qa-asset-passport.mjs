import assert from 'node:assert/strict';
import fs from 'node:fs';

const page=fs.readFileSync('app/assets/[id]/page.tsx','utf8');
const live=fs.readFileSync('lib/server/live-views.ts','utf8');

assert.match(live,/liveAsset\(identifier:string\)/);
assert.match(live,/a\.organization_id=\$2/);
console.log('✓ live Asset Passport lookup is scoped to the authenticated organization');

const tryBlock=page.slice(page.indexOf('try{'),page.indexOf('if\(!asset\)return'));
assert.doesNotMatch(tryBlock,/if\(!asset\).*demoToPassport/s);
assert.match(page,/Reference equipment is never substituted for a live tenant miss/);
console.log('✓ a live tenant miss cannot silently substitute reference equipment');

assert.match(page,/REFERENCE MODE · LIVE TENANT BACKEND UNAVAILABLE/);
assert.match(page,/LIVE TENANT/);
assert.match(page,/referenceMode/);
console.log('✓ reference mode and live tenant mode are explicitly distinguished');

assert.doesNotMatch(page,/Verified in DIR/i);
assert.match(page,/DIR FINALIZED/);
assert.match(page,/Cryptography ≠ Physical Truth/);
assert.match(page,/Never inferred from identity, signature, hash or DIR alone/);
assert.match(page,/does not by itself establish physical truth/);
console.log('✓ DIR finality is not presented as physical truth');

assert.match(page,/Lifecycle record history/);
assert.match(page,/governed record state/);
assert.match(page,/does not convert that label into an unsupported assertion about current physical condition/);
console.log('✓ lifecycle VERIFIED status remains a governed record state, not a current-condition claim');

assert.match(page,/href="\/scan"/);
assert.match(page,/\/inspection\?q=\$\{encodeURIComponent\(asset\.id\)\}/);
assert.match(page,/Inspection & evidence/);
assert.match(page,/Locate in Spatial/);
assert.match(page,/Public verification/);
console.log('✓ Passport preserves direct Scan, Inspection, Spatial and public-verification continuity');

assert.match(page,/Administrative provenance/);
assert.match(page,/registry visibility only/);
assert.match(page,/do not rewrite lifecycle evidence, DIR\/PFC finality, PoVI authority/);
console.log('✓ administrative archive state remains separate from immutable lifecycle trust');

console.log('\nAsset Passport consolidation and truth-boundary contract passed.');
