import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
assert.notEqual(process.env.VERCEL_ENV,'preview','Run production exclusion on a non-preview build');
const base='.next';
assert.ok(fs.existsSync(base),'Build must complete before scanning production artifacts');
const forbidden=['demo_spatial_e101','demo:synthetic:e101','demo_msb-01','DEMO / SYNTHETIC E-101'];
const matches=[];
function visit(dir){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  if(entry.name.endsWith('.map'))continue;
  const p=path.join(dir,entry.name);
  if(entry.isDirectory()){visit(p);continue}
  if(!/\.(js|mjs|html)$/.test(entry.name))continue;
  const content=fs.readFileSync(p,'utf8');
  for(const signal of forbidden)if(content.includes(signal))matches.push({file:p,signal});
 }
}
visit(base);
assert.equal(matches.length,0,'Production bundle contains synthetic source IDs: '+JSON.stringify(matches.slice(0,8)));
console.log('Production JS/server bundle excludes all preview source IDs and DEMO fixture content.');
