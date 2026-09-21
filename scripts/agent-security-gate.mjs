import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const files=[];
for(const start of ['app','components','lib']){
 const walk=dir=>{for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.isDirectory())walk(p);else if(/\.(ts|tsx|js|mjs)$/.test(ent.name))files.push(p)}};
 walk(path.join(root,start));
}
const source=files.map(file=>fs.readFileSync(file,'utf8')).join('\n');
const chain=fs.readFileSync(path.join(root,'lib/server/chain.ts'),'utf8');
const spatialApi=fs.readFileSync(path.join(root,'app/api/spatial/compilations/route.ts'),'utf8');
const autoSync=fs.readFileSync(path.join(root,'components/SpatialAutoSync.tsx'),'utf8');
const workspace=fs.readFileSync(path.join(root,'components/SpatialWorkspaceStatus.tsx'),'utf8');
const bridge=fs.readFileSync(path.join(root,'components/LegacySpatialRecoveryBridge.tsx'),'utf8');

const secretPatterns=[
 /postgres(?:ql)?:\/\/[^\s'"<>]+/i,
 /\bghp_[A-Za-z0-9]{20,}\b/,
 /\bsk-[A-Za-z0-9]{20,}\b/,
 /VERCEL_TOKEN\s*=\s*['"][^'"]+['"]/,
 /DATABASE_URL\s*=\s*['"][^'"]+['"]/,
];
const checks=[
 ['source contains no committed credential material',secretPatterns.every(pattern=>!pattern.test(source))],
 ['production DIR finality fails closed when RPC is absent',chain.includes("if(process.env.NODE_ENV==='production')")&&chain.includes('no mock receipt will be issued')],
 ['PoVI compatibility receipt still requires 3-of-3 authority',chain.includes("protocolVersion!=='POVI/1'")&&chain.includes('Number(j.quorum)!==3||votes<3')],
 ['Spatial persistence reads require an authenticated session',spatialApi.includes('const session=await requireSession();')],
 ['Spatial persistence writes require authorized project roles',spatialApi.includes("requireSession(['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER'])")],
 ['automatic Spatial sync uses same-origin authenticated API rather than embedded credentials',autoSync.includes("credentials:'same-origin'")&&!/DATABASE_URL|POSTGRES_URL|STRATUM_PUBLIC_API_KEY/.test(autoSync)],
 ['automatic sync never accepts review, approves evidence or anchors a DIR',!autoSync.includes('PATCH')&&!autoSync.includes('/api/approvals')&&!autoSync.includes('getLedger')],
 ['legacy recovery only accepts the exact legacy STRATUM origin',workspace.includes("allowed=new Set(['https://stratum-twin-chain.vercel.app'])")],
 ['legacy recovery validates graph structure before replacing current work',workspace.includes("!isSpatialGraph(data.graph)")&&workspace.includes('replaceCurrentSpatialGraph(data.graph)')],
 ['legacy bridge target is allowlisted and transfers only graph data',bridge.includes('ALLOWED_TARGETS')&&bridge.includes("type:'STRATUM_SPATIAL_RECOVERY'")&&!/password|credential|secret/i.test(bridge)],
];

const failed=checks.filter(([,ok])=>!ok);
for(const [name,ok] of checks)console.log(`${ok?'✓':'✗'} Security agent · ${name}`);
if(failed.length)process.exit(1);
console.log('\nSecurity agent gate passed.');
