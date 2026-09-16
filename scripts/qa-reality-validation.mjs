import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const foundation=read('lib/reality-validation.ts');
const route=read('app/api/twin-agent/route.ts');
const page=read('app/reality/page.tsx');

const requireText=(source,text,label)=>{
 if(!source.includes(text))throw new Error(`Reality Validation conformance missing ${label}: ${text}`);
};

for(const [text,label] of [
 ['REALITY_VALIDATION_AUTHORITY=\'REFERENCE_ONLY\'','reference-only authority'],
 ['REALITY_TRUTH_BOUNDARY=\'OBSERVED_NEVER_OVERWRITES_VERIFIED\'','Observed/Verified truth boundary'],
 ["reviewState:'REVIEW_REQUIRED'",'human review requirement'],
 ['Verified state remains unchanged pending authorized review.','non-mutation disposition'],
 ['structuredClone(designedStates)','separate Verified reference state']
])requireText(foundation,text,label);

for(const [text,label] of [
 ['compareObservedToDesigned','controlled comparison action'],
 ['listRealityDiscrepancies','controlled discrepancy action'],
 ['traceRealityImpact','controlled impact action'],
 ['normalizeOEMAsset','OEM normalization action'],
 ['truthBoundary:REALITY_TRUTH_BOUNDARY','API truth-boundary response'],
 ['authority:REALITY_VALIDATION_AUTHORITY','API authority response']
])requireText(route,text,label);

for(const [text,label] of [
 ['REFERENCE DATA · HITL · READ-ONLY','reference workspace labeling'],
 ['Observed never overwrites Verified.','user-visible truth boundary'],
 ['tenant-backed capture and persistence remain pending','honest persistence status'],
 ['Authorized review before state change','human authorization boundary']
])requireText(page,text,label);

const forbidden=[
 /verifiedStates\s*\[[^\]]+\]\s*=/,
 /Object\.assign\s*\(\s*verifiedStates/,
 /REALITY_VALIDATION_AUTHORITY=['"]LIVE/,
 /PoVI finality[^\n]{0,80}(established|complete|verified)/i
];
for(const pattern of forbidden){
 if(pattern.test(foundation)||pattern.test(route)||pattern.test(page))throw new Error(`Reality Validation conformance found forbidden pattern: ${pattern}`);
}

console.log('Reality Validation reference authority, state isolation, HITL review, and Observed≠Verified invariants passed');
