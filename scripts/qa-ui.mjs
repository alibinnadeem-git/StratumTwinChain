import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const scanRoots=['app','components'];
const sourceFiles=[];
function walk(dir){if(!fs.existsSync(dir))return;for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.isDirectory())walk(p);else if(/\.(tsx|ts|jsx|js)$/.test(ent.name))sourceFiles.push(p);}}
for(const d of scanRoots)walk(path.join(root,d));

const pageFiles=sourceFiles.filter(f=>f.startsWith(path.join(root,'app'))&&path.basename(f)==='page.tsx');
const routePatterns=pageFiles.map(file=>{
 const rel=path.relative(path.join(root,'app'),path.dirname(file)).replaceAll(path.sep,'/');
 const route='/' + (rel==='.'?'':rel);
 const source='^'+route.split('/').map(seg=>seg.startsWith('[')&&seg.endsWith(']')?'[^/]+':seg.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('/')+'/?$';
 return {route:route==='/'?'/':route.replace(/\/$/,''),re:new RegExp(source)};
});

const errors=[];const warnings=[];
function routeExists(href){const clean=href.split(/[?#]/)[0]||'/';return routePatterns.some(r=>r.re.test(clean));}

for(const file of sourceFiles){
 const rel=path.relative(root,file).replaceAll(path.sep,'/');
 const text=fs.readFileSync(file,'utf8');
 // Hard-coded internal links and router pushes must point at an App Router page.
 const links=[...text.matchAll(/(?:href\s*=\s*["']|router\.push\(\s*["'])(\/[A-Za-z0-9_\-/.?=#]+)["']/g)].map(m=>m[1]);
 for(const href of links){if(!routeExists(href))errors.push(`${rel}: internal route ${href} has no page.tsx target`);}
 // A rendered button must have a real behavior or be an actual form submit/reset control.
 for(const m of text.matchAll(/<button\b([^>]*)>/gms)){
   const attrs=m[1];
   const functional=/onClick\s*=|formAction\s*=|type\s*=\s*["'](?:submit|reset)["']/.test(attrs);
   const intentionallyDisabled=/disabled(?:\s|=|>)/.test(attrs)&&!/disabled\s*=\s*\{/.test(attrs);
   if(!functional&&!intentionallyDisabled)errors.push(`${rel}: inert <button> detected near offset ${m.index}`);
 }
 // Avoid legacy public-facing blockchain wording. Technical implementation filenames/APIs are exempt; UI copy is not.
 if(/\bblockchain\b/i.test(text)&&!rel.startsWith('app/api/'))warnings.push(`${rel}: public-facing "blockchain" wording remains`);
}

console.log(`QA scanned ${sourceFiles.length} source files and ${routePatterns.length} routes.`);
if(warnings.length){console.warn('\nWarnings:');for(const w of warnings)console.warn(`- ${w}`);}
if(errors.length){console.error('\nQA failures:');for(const e of errors)console.error(`- ${e}`);process.exit(1);}
console.log('QA passed: no broken hard-coded internal routes or inert buttons detected.');
