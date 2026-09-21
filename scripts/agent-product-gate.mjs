import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const shell=read('components/Shell.tsx');
const home=read('app/page.tsx');
const launcher=read('components/TaskLauncher.tsx');
const compiler=read('app/compiler/page.tsx');
const spatial=read('app/spatial/page.tsx');
const scan=read('app/scan/page.tsx');
const dir=read('app/chain/page.tsx');

const checks=[
 ['primary navigation is limited to Home/Import/Spatial/Field/DIR',["['/','Home']","['/compiler','Import']","['/spatial','Spatial']","['/scan','Field']","['/dir','DIR']"].every(v=>shell.includes(v))],
 ['advanced tools remain progressively disclosed',shell.includes('More tools')&&shell.includes('nav-more')],
 ['home starts from the real project workspace, not reference data',home.includes('SpatialWorkspaceStatus')&&!home.includes('referenceAssets')&&!home.includes('referenceEvents')],
 ['home preserves the four-task launcher',launcher.includes('Import project sources')&&launcher.includes('Review Spatial')&&launcher.includes('Update in the field')&&launcher.includes('Review DIR & history')],
 ['Import has one primary job and hides review complexity',compiler.includes('Add project sources.')&&compiler.includes('<summary>Review exceptions</summary>')],
 ['Spatial makes the model primary before review details',spatial.indexOf('<SpatialExperience')<spatial.indexOf('<SpatialReviewQueue')&&spatial.includes('<summary>Review & trust details</summary>')],
 ['Field starts with scanner and hides trust explanation',scan.includes('<FieldScanner/>')&&scan.includes('<summary>Field trust details</summary>')],
 ['DIR prioritizes finalized history and hides network internals',dir.includes('Finalized lifecycle records')&&dir.includes('<summary>Network & proof details</summary>')],
];

const failed=checks.filter(([,ok])=>!ok);
for(const [name,ok] of checks)console.log(`${ok?'✓':'✗'} Product agent · ${name}`);
if(failed.length)process.exit(1);
console.log('\nProduct agent gate passed.');
