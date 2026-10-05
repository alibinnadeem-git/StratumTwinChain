import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const roots=['app','components','lib','workers'];
const forbidden=[/\bBrynhurst\b/i,/\b5749\b/i,/5749\s+Brynhurst/i,/A106\s+Grade\s+Plane\s+Exhibit/i];

function walk(dir){
  if(!fs.existsSync(dir))return[];
  const out=[];
  for(const name of fs.readdirSync(dir)){
    const full=path.join(dir,name),stat=fs.statSync(full);
    if(stat.isDirectory())out.push(...walk(full));
    else if(/\.(?:ts|tsx|js|jsx|mjs)$/.test(name))out.push(full);
  }
  return out;
}
const violations=[];
for(const root of roots)for(const file of walk(root)){
  const content=fs.readFileSync(file,'utf8');
  for(const pattern of forbidden)if(pattern.test(content))violations.push({file,pattern:String(pattern)});
}
assert.deepEqual(violations,[],'Production code must remain project-agnostic. Real drawing-set names/identifiers are allowed only in QA fixtures and tests.');
console.log('Generalization guard passed: runtime Spatial/Z logic is project-agnostic; real plans are regression fixtures only.');
