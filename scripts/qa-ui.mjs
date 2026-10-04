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
 // Hard-coded internal links and simple router.push calls must point at an App Router page.
 const links=[
  ...text.matchAll(/href\s*=\s*["'](\/[A-Za-z0-9_\-/.?=#]+)["']/g),
  ...text.matchAll(/router\.push\(\s*["'](\/[A-Za-z0-9_\-/.?=#]+)["']/g)
 ].map(m=>m[1]);
 for(const href of links){if(!routeExists(href))errors.push(`${rel}: internal route ${href} has no page.tsx target`);}

 // Inspect the entire button element instead of only the opening tag. Arrow functions contain `=>`,
 // which makes a naive `[^>]*` opening-tag parser stop before onClick handlers.
 for(const m of text.matchAll(/<button\b[\s\S]*?<\/button>/g)){
   const button=m[0];
   const functional=/onClick\s*=|formAction\s*=|type\s*=\s*["'](?:submit|reset)["']/.test(button);
   const intentionallyDisabled=/\bdisabled\b/.test(button)&&!/disabled\s*=\s*\{/.test(button);
   if(!functional&&!intentionallyDisabled)errors.push(`${rel}: inert <button> detected near offset ${m.index}`);
 }

 // User-facing product language should use DIR rather than generic blockchain terminology.
 if(/\bblockchain\b/i.test(text)&&!rel.startsWith('app/api/'))warnings.push(`${rel}: public-facing "blockchain" wording remains`);
}

const spatialPagePath=path.join(root,'app','spatial','page.tsx');
const spatialPage=fs.readFileSync(spatialPagePath,'utf8');
if(!/if\(session\)try\{[\s\S]*?liveAssets\(\)/.test(spatialPage))errors.push('app/spatial/page.tsx: signed-out Spatial must not query the live asset registry');
if(/console\.error\(['"]STRATUM Spatial Verified backend data unavailable/.test(spatialPage))errors.push('app/spatial/page.tsx: signed-out/source-only state must not be logged as a backend error');

const shellPath=path.join(root,'components','Shell.tsx');
const shell=fs.readFileSync(shellPath,'utf8');
if(/demoSession/.test(shell))errors.push('components/Shell.tsx: shell must not display demo identity as authenticated user');
for(const required of ['readSession','Signed out','REFERENCE MODE']){
 if(!shell.includes(required))errors.push(`components/Shell.tsx: session-aware identity invariant missing: ${required}`);
}


for(const route of ['/import','/field','/docs','/login']){
 if(!routeExists(route))errors.push(`product route ${route} must resolve to a real page.tsx target`);
}
if(!/href="\/login"/.test(shell))errors.push('components/Shell.tsx: signed-out shell must expose a visible sign-in route');
if(!/Docs & glossary/.test(shell))errors.push('components/Shell.tsx: docs/glossary entry must be discoverable from navigation');

const compilerWorkspace=fs.readFileSync(path.join(root,'components','CompilerWorkspace.tsx'),'utf8');
if(!/async function renderSpatial\(\)/.test(compilerWorkspace)||!/stratum_spatial_render_handoff/.test(compilerWorkspace))errors.push('components/CompilerWorkspace.tsx: Render Spatial must verify the persisted graph before navigation');
if(/<Link className="action" href="\/spatial">Render Spatial Environment<\/Link>/.test(compilerWorkspace))errors.push('components/CompilerWorkspace.tsx: Render Spatial must not be a navigation-only link');

const reviewQueue=fs.readFileSync(path.join(root,'components','SpatialReviewQueue.tsx'),'utf8');
if(!/isActionableReviewEntity/.test(reviewQueue)||!/Showing \$\{Math\.min\(shown\.length,items\.length\)\} of \$\{items\.length\}/.test(reviewQueue))errors.push('components/SpatialReviewQueue.tsx: review totals must describe actionable and visible work consistently');

const zReview=fs.readFileSync(path.join(root,'components','ZResolutionReview.tsx'),'utf8');
for(const required of ['FFE / FF / FG / FS controls','Triangulated review surfaces','Resolve Z without inventing height','X/Y scale can help convert source units consistently']){
 if(!zReview.includes(required))errors.push(`components/ZResolutionReview.tsx: Z-review UX invariant missing: ${required}`);
}

console.log(`QA scanned ${sourceFiles.length} source files and ${routePatterns.length} routes.`);
if(warnings.length){console.warn('\nWarnings:');for(const w of warnings)console.warn(`- ${w}`);}
if(errors.length){console.error('\nQA failures:');for(const e of errors)console.error(`- ${e}`);process.exit(1);}
console.log('QA passed: no broken hard-coded internal routes, inert buttons, or false signed-out identity claims detected.');
