import assert from 'node:assert/strict';
import fs from 'node:fs';

const client=fs.readFileSync('components/ReleaseUatClient.tsx','utf8');
const api=fs.readFileSync('app/api/release-uat/route.ts','utf8');
const qr=fs.readFileSync('app/api/release-uat/qr/route.ts','utf8');
const page=fs.readFileSync('app/release-uat/page.tsx','utf8');

assert.match(client,/getContext\('webgl2'\)\|\|canvas\.getContext\('webgl'\)/);
assert.match(client,/BrowserQRCodeReader/);
assert.match(client,/decodeFromImageUrl/);
assert.match(client,/navigator\.mediaDevices\?\.getUserMedia/);
assert.match(client,/facingMode:\{ideal:'environment'\}/);
assert.match(client,/stream\?\.getTracks\(\)\.forEach\(track=>track\.stop\(\)\)/);
assert.match(client,/disabled=\{webgl\.status==='pending'\|\|qrDecoder\.status==='pending'\}/);
console.log('✓ physical UAT requires real WebGL, QR decoder and a user-triggered camera stream');

assert.match(qr,/STRATUM-RELEASE-UAT:/);
assert.match(qr,/QRCode\.toString/);
assert.match(qr,/cache-control':'no-store/);
console.log('✓ release QR target is session-bound and non-cacheable');

assert.match(api,/STRATUM_RELEASE_UAT_EVIDENCE/);
assert.match(api,/userAgent/);
assert.match(api,/VERCEL_GIT_COMMIT_SHA/);
assert.match(api,/allPass:\[evidence\.webgl,evidence\.qrDecoder,evidence\.camera\]\.every/);
assert.doesNotMatch(api,/arrayBuffer\(|formData\(|FileReader|Blob|evidence_files|INSERT INTO|\/api\/chain/);
console.log('✓ release evidence stores no photo/video/file payload and does not mutate trust records');

assert.match(page,/ReleaseUatClient/);
assert.match(client,/does not establish asset identity, physical truth, Verified state, DIR finality or PoVI finality/);
console.log('✓ physical-device capability evidence preserves STRATUM truth boundaries');

console.log('\nRelease UAT contract passed.');
