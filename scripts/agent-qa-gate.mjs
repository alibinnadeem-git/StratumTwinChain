import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const testDir=path.join(root,'tests/e2e');
const tests=fs.readdirSync(testDir).filter(name=>name.endsWith('.spec.ts')).map(name=>fs.readFileSync(path.join(testDir,name),'utf8')).join('\n');
const ci=fs.readFileSync(path.join(root,'.github/workflows/ci.yml'),'utf8');
const routes=fs.readFileSync(path.join(testDir,'stratum.spec.ts'),'utf8');

const checks=[
 ['no focused tests are committed',!/\btest\.only\b|\bdescribe\.only\b/.test(tests)],
 ['no skipped tests are committed',!/\btest\.skip\b|\bdescribe\.skip\b/.test(tests)],
 ['primary Home/Import/Spatial/Field/DIR routes are browser-tested',["'/'","'/compiler'","'/spatial'","'/scan'","'/dir'"].every(route=>routes.includes(route))],
 ['Spatial recovery has dedicated browser regression coverage',fs.existsSync(path.join(testDir,'spatial-recovery.spec.ts'))],
 ['desktop/tablet/mobile browser UAT remains a release gate',ci.includes('Run desktop tablet mobile browser UAT')&&ci.includes('npm run qa:e2e')],
 ['typecheck and production build remain release gates',ci.includes('npm run typecheck')&&ci.includes('npm run build')],
];

const failed=checks.filter(([,ok])=>!ok);
for(const [name,ok] of checks)console.log(`${ok?'✓':'✗'} QA agent · ${name}`);
if(failed.length)process.exit(1);
console.log('\nQA agent gate passed.');
