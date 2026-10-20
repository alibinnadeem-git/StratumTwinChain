import assert from 'node:assert/strict';
import {buildLegendSegmentFingerprints,matchLegendSegmentFingerprints} from '../lib/electrical-segment-symbol-fingerprint.ts';

const symbol=(page,cx,cy,scale=1)=>[
 {page,x:cx-.2*scale,y:cy,x2:cx+.2*scale,y2:cy},
 {page,x:cx,y:cy-.15*scale,x2:cx,y2:cy+.15*scale},
 {page,x:cx+.2*scale,y:cy,x2:cx+.28*scale,y2:cy+.1*scale},
];
const alt=(page,cx,cy,scale=1)=>[
 {page,x:cx-.2*scale,y:cy-.2*scale,x2:cx+.2*scale,y2:cy-.2*scale},
 {page,x:cx+.2*scale,y:cy-.2*scale,x2:cx+.2*scale,y2:cy+.2*scale},
 {page,x:cx+.2*scale,y:cy+.2*scale,x2:cx-.2*scale,y2:cy+.2*scale},
 {page,x:cx-.2*scale,y:cy+.2*scale,x2:cx-.2*scale,y2:cy-.2*scale},
];

const entries=[
 {id:'legend-switch',page:1,componentHint:'SWITCH_SINGLE_POLE',anchor:{x:2,y:8},confidence:.9},
 {id:'legend-box',page:1,componentHint:'JUNCTION_BOX',anchor:{x:2,y:7},confidence:.9},
];
const fps=buildLegendSegmentFingerprints({entries,segments:[
 ...symbol(1,1.2,8,1),
 ...alt(1,1.2,7,1),
]});
assert.equal(fps.length,2);

const matches=matchLegendSegmentFingerprints({
 fingerprints:fps,
 segments:[
  ...symbol(4,5,5,.55),
  ...alt(4,6,5,.55),
 ],
 legendPages:new Set([1]),
 planPages:new Set([4])
});
assert.ok(matches.some(m=>m.componentClass==='SWITCH_SINGLE_POLE'));
assert.ok(matches.some(m=>m.componentClass==='JUNCTION_BOX'));
assert.ok(matches.every(m=>m.reviewRequired&&m.physicalTruth===false));
console.log('Open-vector electrical symbol fingerprint matching passed.');
