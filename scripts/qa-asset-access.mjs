import assert from 'node:assert/strict';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import ts from 'typescript';
const url=new URL(`../lib/server/.qa-access-${randomUUID()}.mjs`,import.meta.url);
try{
 let source=await readFile(new URL('../lib/server/live-views.ts',import.meta.url),'utf8');
 source=source.replace("import {query} from './db';",'const calls:any[]=[];async function query<T>(sql:string,params?:unknown[]){calls.push({sql,params});return {rows:[] as T[]}};').replace("import {requireSession} from './auth';",'let signedIn=true;async function requireSession(){if(!signedIn)throw new Error("Unauthorized");return {organizationId:"tenant-a"}};export {calls};export function signOut(){signedIn=false}');
 await writeFile(url,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
 const views=await import(url.href);
 await views.liveAssets();await views.liveAsset('asset-code');await views.assetLifecycle('asset-id');await views.publicEvidence('asset-id');
 for(const call of views.calls){assert.ok(call.params.includes('tenant-a'));assert.match(call.sql,/organization_id=\$[12]/)}
 assert.match(views.calls[1].sql,/\(a.id::text=\$1 OR a.asset_code=\$1\) AND a.organization_id=\$2/);
 assert.match(views.calls[3].sql,/visibility='PUBLIC'/);
 views.signOut();const count=views.calls.length;
 for(const name of ['liveAssets','liveAsset','assetLifecycle','publicEvidence'])await assert.rejects(()=>views[name]('asset-id'),/Unauthorized/);
 assert.equal(views.calls.length,count,'signed out access must never issue a data query');
 console.log('PASS: session requirement, parameterized organization scope, identifier grouping and public evidence visibility');
}finally{await unlink(url)}
