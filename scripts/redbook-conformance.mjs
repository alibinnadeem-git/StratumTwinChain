import fs from 'node:fs';

const userFacingFiles=[
  'app/page.tsx',
  'app/layout.tsx',
  'components/Shell.tsx',
  'app/spatial/page.tsx',
  'app/compiler/page.tsx',
  'app/reality/page.tsx',
  'README.md',
];

const forbidden=[
  {pattern:/\bdigital twin\b/i,label:'digital twin'},
  {pattern:/STRATUM Verified Twin/i,label:'STRATUM Verified Twin'},
  {pattern:/STRATUM Twin(?!Chain)/i,label:'STRATUM Twin'},
];

let failed=false;
for(const file of userFacingFiles){
  const text=fs.readFileSync(file,'utf8');
  for(const rule of forbidden){
    if(rule.pattern.test(text)){
      console.error(`[Redbook] ${file}: deprecated user-facing term "${rule.label}"`);
      failed=true;
    }
  }
}

const terminology=fs.readFileSync('lib/redbook/terminology.ts','utf8');
for(const required of ['STRATUM Spatial Verified','Proof of Verified Infrastructure (PoVI)','Digital Immutable Record','JARVIS — STRATUM Chief AI Orchestrator']){
  if(!terminology.includes(required)){
    console.error(`[Redbook] canonical terminology missing: ${required}`);
    failed=true;
  }
}

if(failed)process.exit(1);
console.log('Redbook terminology conformance passed.');
