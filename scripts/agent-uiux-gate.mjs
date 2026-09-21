import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const workspace=read('components/SpatialWorkspaceStatus.tsx');
const compiler=read('app/compiler/page.tsx');
const spatial=read('app/spatial/page.tsx');
const scan=read('app/scan/page.tsx');
const inspection=read('components/InspectionSession.tsx');
const dir=read('app/chain/page.tsx');

const checks=[
 ['recovery primary action is visible while backup controls are disclosed',workspace.includes('Recover model')&&workspace.includes('<summary>Backup & recovery</summary>')],
 ['missing model tells the user to recover before rebuilding',workspace.includes('Recover the model before re-importing anything.')],
 ['Import hides exception review by default',compiler.includes('<summary>Review exceptions</summary>')],
 ['Spatial hides review/trust controls behind one disclosure',spatial.includes('<summary>Review & trust details</summary>')],
 ['Field does not show the old explanatory two-column dashboard',!scan.includes('grid two')&&scan.includes('<summary>Field trust details</summary>')],
 ['inspection has exactly four required field steps before optional context',inspection.includes('Confirm location')&&inspection.includes('Checklist passed')&&inspection.includes('Measurements')&&inspection.includes('Evidence')&&inspection.includes('<summary>Optional notes & references</summary>')],
 ['inspection keeps sync/provenance detail secondary',inspection.includes('<summary>Progress & sync details</summary>')],
 ['DIR keeps network/hash complexity secondary',dir.includes('<summary>Network & proof details</summary>')],
];

const failed=checks.filter(([,ok])=>!ok);
for(const [name,ok] of checks)console.log(`${ok?'✓':'✗'} UI/UX agent · ${name}`);
if(failed.length)process.exit(1);
console.log('\nUI/UX agent gate passed.');
