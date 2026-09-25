import assert from 'node:assert/strict';
import {OEM_CAD_CANDIDATES} from '../lib/oem-cad-candidates.ts';

const byId=new Map(OEM_CAD_CANDIDATES.map(item=>[item.id,item]));
const approved=OEM_CAD_CANDIDATES.filter(item=>item.status==='GLB_APPROVED');
const pending=OEM_CAD_CANDIDATES.filter(item=>item.status!=='GLB_APPROVED');

assert.ok(approved.length>=1,'at least one exact OEM CAD conversion remains approved');
for(const item of approved){
 assert.ok(item.modelUrl?.startsWith('/models/oem/'),`${item.id}: approved geometry must resolve to the controlled OEM model path`);
 assert.match(item.sourceSha256||'',/^[a-f0-9]{64}$/,`${item.id}: approved source CAD requires SHA-256`);
 assert.match(item.modelSha256||'',/^[a-f0-9]{64}$/,`${item.id}: approved GLB requires SHA-256`);
}
for(const item of pending){
 assert.equal(item.modelUrl,undefined,`${item.id}: acquisition-only candidate cannot activate a viewer model`);
 assert.equal(item.modelSha256,undefined,`${item.id}: pending candidate cannot claim an approved GLB hash`);
}

const schneider=byId.get('schneider-c10n32d100');
assert.ok(schneider,'Schneider exact SKU acquisition record exists');
assert.equal(schneider.status,'CAD_DOWNLOAD_IDENTIFIED');
assert.equal(schneider.sku,'C10N32D100');
assert.match(schneider.cadFormat,/MCADPP0000031_3D-simplified\.stp/);

const eaton=byId.get('eaton-pdg23m0100e2wl');
assert.ok(eaton,'Eaton exact SKU acquisition record exists');
assert.equal(eaton.status,'CAD_DOWNLOAD_IDENTIFIED');
assert.equal(eaton.sku,'PDG23M0100E2WL');
assert.deepEqual(eaton.dimensionsMeters,[.1046,.1524,.0889]);
assert.match(eaton.cadFormat,/3D CAD drawing package/i);

console.log(`OEM CAD registry contract passed: ${approved.length} approved exact model(s), ${pending.length} acquisition/review candidate(s), and no pending CAD lead is active geometry.`);
