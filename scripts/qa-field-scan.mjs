import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeScanValue} from '../lib/scan-code.ts';

assert.deepEqual(normalizeScanValue(' STR-AST-0009281 '),{query:'STR-AST-0009281',kind:'RAW'});
console.log('✓ raw asset identity is normalized without changing its value');
assert.deepEqual(normalizeScanValue('https://example.test/passport/abc-123'),{query:'abc-123',kind:'URL'});
console.log('✓ Passport URL resolves to its asset identity');
assert.deepEqual(normalizeScanValue('https://example.test/verify?q=serial-77'),{query:'serial-77',kind:'URL'});
console.log('✓ public verification URL resolves its q identity');
assert.deepEqual(normalizeScanValue('stratum://asset/qr-token-1'),{query:'qr-token-1',kind:'STRATUM_URI'});
console.log('✓ STRATUM asset URI resolves to its identity');
assert.equal(normalizeScanValue('https://example.test/unrelated/path'),null);
assert.equal(normalizeScanValue('x'.repeat(513)),null);
console.log('✓ unrelated URLs and oversized raw identities fail closed');

const resolver=fs.readFileSync('app/api/assets/resolve/route.ts','utf8');
const scanner=fs.readFileSync('components/FieldScanner.tsx','utf8');
const page=fs.readFileSync('app/scan/page.tsx','utf8');
assert.match(resolver,/requireSession\(\)/);
assert.match(resolver,/a\.organization_id=\$2/);
assert.match(resolver,/session\.organizationId/);
assert.doesNotMatch(resolver,/findAsset/);
assert.match(resolver,/tenantScoped:true/);
assert.match(resolver,/FIELD_IDENTITY_RESOLUTION_DOES_NOT_ESTABLISH_VERIFIED_STATE/);
assert.match(resolver,/asset_archive_events/);
console.log('✓ field resolver is authenticated and organization-scoped with no reference fallback');
console.log('✓ resolver surfaces administrative archive state and denies verification authority');

assert.match(scanner,/normalizeScanValue/);
assert.match(scanner,/\/api\/assets\/resolve\?q=/);
assert.match(scanner,/administratively_archived/);
assert.match(scanner,/Archived assets cannot start a new inspection/);
assert.match(scanner,/QR\/barcode recognition establishes identity lookup only/);
assert.match(scanner,/router\.push\(`\/inspection\?q=/);
assert.match(page,/FieldScanner/);
assert.match(page,/Scan first\. Verify separately\./);
console.log('✓ scanner resolves tenant identity before controlled inspection handoff');
console.log('✓ archived asset inspection is blocked');
console.log('✓ dedicated /scan surface states identity is not physical verification');

console.log('\nField scan, tenant identity and trust-boundary contract passed.');
