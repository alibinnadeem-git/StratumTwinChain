import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const page=read('app/page.tsx');
const launcher=read('components/TaskLauncher.tsx');
const shell=read('components/Shell.tsx');
const service=read('lib/server/command-center.ts');
const livePassport=read('components/LiveAssetSummary.tsx');

const checks=[
 ['command center server service requires an authenticated session',service.includes('requireSession()')],
 ['command center lifecycle metrics are organization scoped',service.includes('lifecycle_events le WHERE le.organization_id=$1')],
 ['command center evidence metrics are organization scoped',service.includes('evidence ev WHERE ev.organization_id=$1')],
 ['activity lifecycle rows join an asset in the same organization',service.includes('JOIN assets a ON a.id=le.asset_id AND a.organization_id=$1')],
 ['activity evidence rows join an asset in the same organization',service.includes('JOIN assets a ON a.id=ev.asset_id AND a.organization_id=$1')],
 ['home resolves authentication before selecting tenant data',page.includes('const session=await readSession()')],
 ['home does not substitute reference assets when live data is unavailable',!page.includes('referenceAssets')&&!page.includes('referenceEvents')&&!page.includes('AssetPassport')],
 ['home exposes the browser Spatial recovery workspace before task complexity',page.includes('SpatialWorkspaceStatus')&&page.indexOf('<SpatialWorkspaceStatus')<page.indexOf('<TaskLauncher')],
 ['authenticated path uses tenant snapshot and active tenant assets',page.includes('commandCenterSnapshot()')&&page.includes('liveAssets()')],
 ['live empty tenant remains explicitly empty',page.includes('No active registered assets')],
 ['signed-out state keeps browser project recovery available',page.includes('Your browser Spatial model can still be recovered and backed up')],
 ['server-unavailable state refuses demonstration substitution',page.includes('will not replace your project with demonstration data')],
 ['task-first home exposes import, Spatial, field and DIR work',launcher.includes('Import project sources')&&launcher.includes('Review Spatial')&&launcher.includes('Update in the field')&&launcher.includes('Review DIR & history')],
 ['primary navigation keeps core work visible and advanced tools progressively disclosed',shell.includes("['/compiler','Import']")&&shell.includes("['/spatial','Spatial']")&&shell.includes("['/scan','Field']")&&shell.includes("['/dir','DIR']")&&shell.includes('More tools')],
 ['command center does not claim PoVI verification from mere DIR presence',!page.includes('POVI_VERIFIED')],
 ['live asset card is explicitly tenant data',livePassport.includes('Live tenant record')],
 ['live asset card denies DIR-as-physical-truth inference',livePassport.includes('does not, by itself, a claim')||livePassport.includes('does not by itself')||livePassport.includes('not, by itself, a claim')],
 ['home still states trust states remain distinct',page.includes('Observed, inferred, approved and finalized states remain distinct')],
 ['home still denies visualization or DIR as physical truth',page.includes('never silently becomes physical truth')]
];

const failed=checks.filter(([,ok])=>!ok);
for(const [name,ok] of checks)console.log(`${ok?'✓':'✗'} ${name}`);
if(failed.length){
 console.error(`\n${failed.length} command-center trust-boundary check(s) failed.`);
 process.exit(1);
}
console.log('\nCommand-center tenant/recovery and task-first UX contract passed.');
