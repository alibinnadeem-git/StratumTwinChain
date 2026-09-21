import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const css=read('app/task-ui.css');
const responsive=read('app/responsive.css');
const pages=['app/page.tsx','app/compiler/page.tsx','app/spatial/page.tsx','app/scan/page.tsx','app/chain/page.tsx'].map(read).join('\n');

const checks=[
 ['project workspace has a consistent visual container',css.includes('.workspace-status{')&&css.includes('.workspace-status-main')],
 ['recovery actions collapse to one column on small screens',css.includes('@media(max-width:600px)')&&css.includes('.workspace-actions{display:grid;grid-template-columns:1fr}')],
 ['inspection is visually constrained instead of full-dashboard width',css.includes('.inspection-simple{max-width:860px}')],
 ['field scanner is constrained to a readable primary width',css.includes('.field-primary{max-width:760px}')],
 ['primary pages avoid the previous three-card onboarding strip',!pages.includes('grid three')],
 ['responsive shell remains mobile-first',responsive.includes('@media(max-width:900px)')&&responsive.includes('.shell{display:block')],
];

const failed=checks.filter(([,ok])=>!ok);
for(const [name,ok] of checks)console.log(`${ok?'✓':'✗'} Design agent · ${name}`);
if(failed.length)process.exit(1);
console.log('\nDesign agent gate passed.');
