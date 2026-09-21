import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const page=read('app/page.tsx');
const launcher=read('components/TaskLauncher.tsx');
const shell=read('components/Shell.tsx');
const service=read('lib/server/command-center.ts');
const referencePassport=read('components/AssetPassport.tsx');
const livePassport=read('components/LiveAssetSummary.tsx');

const checks=[
 ['command center server service requires an authenticated session',service.includes('requireSession()')],
 ['command center lifecycle metrics are organization scoped',service.includes('lifecycle_events le WHERE le.organization_id=$1')],
 ['command center evidence metrics are organization scoped',service.includes('evidence ev WHERE ev.organization_id=$1')],
 ['activity lifecycle rows join an asset in the same organization',service.includes('JOIN assets a ON a.id=le.asset_id AND a.organization_id=$1')],
 ['activity evidence rows join an asset in the same organization',service.includes('JOIN assets a ON a.id=ev.asset_id AND a.organization_id=$1')],
 ['home page resolves authentication before selecting live/reference mode',page.includes('const session=await readSession()')],
 ['home page has an explicit signed-out reference mode',page.includes('REFERENCE_SIGNED_OUT')&&page.includes('Reference mode · Signed out')],
 ['home page has an explicit unavailable-backend reference mode',page.includes('REFERENCE_UNAVAILABLE')&&page.includes('Live service unavailable')&&page.includes('Reference data is shown temporarily')],
 ['authenticated path uses tenant snapshot and active tenant assets',page.includes('commandCenterSnapshot()')&&page.includes('liveAssets()')],
 ['live empty tenant remains explicitly empty',page.includes('No active STRATUM Assets')&&page.includes('has no active registered assets yet')],
 ['task-first home exposes import, Spatial, field and DIR work',launcher.includes('Import project sources')&&launcher.includes('Review Spatial')&&launcher.includes('Update in the field')&&launcher.includes('Review DIR & history')],
 ['primary navigation keeps core work visible and advanced tools progressively disclosed',shell.includes("['/compiler','Import']")&&shell.includes("['/spatial','Spatial']")&&shell.includes("['/scan','Field']")&&shell.includes("['/dir','DIR']")&&shell.includes('More tools')&&shell.includes('nav-more')],
 ['command center does not claim PoVI verification from demo or DIR presence',!page.includes('POVI_VERIFIED')],
 ['compact reference passport has no unconditional VERIFIED seal',!referencePassport.includes('✓ VERIFIED')&&!referencePassport.includes('STRATUM Verified Asset Passport')],
 ['compact passport explicitly distinguishes DIR presence',referencePassport.includes('DIR RECORDED')&&referencePassport.includes('NO DIR')],
 ['reference passport states that DIR does not establish physical truth',referencePassport.includes('DIR reference does not by itself establish physical truth')],
 ['live asset card is explicitly tenant data',livePassport.includes('Live tenant record')],
 ['live asset card denies DIR-as-physical-truth inference',livePassport.includes('does not, by itself, a claim')||livePassport.includes('does not by itself')||livePassport.includes('not, by itself, a claim')],
 ['home page states observed and Verified are distinct',page.includes('OBSERVED ≠ VERIFIED')],
 ['home page keeps no-silent-promotion rule visible',page.includes('NO SILENT PROMOTION')],
 ['home page still states cryptographic provenance does not establish physical truth',page.includes('do not by themselves establish physical truth')]
];

const failed=checks.filter(([,ok])=>!ok);
for(const [name,ok] of checks)console.log(`${ok?'✓':'✗'} ${name}`);
if(failed.length){
 console.error(`\n${failed.length} command-center trust-boundary check(s) failed.`);
 process.exit(1);
}
console.log('\nCommand-center tenant/reference and task-first UX contract passed.');