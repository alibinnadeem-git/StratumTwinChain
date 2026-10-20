import assert from 'node:assert/strict';
import {classifyElectricalLegendDescription,detectPdfEquipmentMatrixPage,extractPdfEquipmentMatrixRecords} from '../lib/electrical-design-intelligence.ts';
import {buildLegendSymbolFingerprints,matchLegendSymbolFingerprints} from '../lib/electrical-symbol-fingerprint.ts';

assert.equal(classifyElectricalLegendDescription('DUPLEX RECEPTACLE (+18")'),'RECEPTACLE_DUPLEX');
assert.equal(classifyElectricalLegendDescription('HARD-WIRED SMOKE DETECTOR W/ BATTERY BACK UP'),'SMOKE_DETECTOR');
assert.equal(classifyElectricalLegendDescription('JUNCTION BOX.'),'JUNCTION_BOX');

const square=(cx,cy,s=.18)=>[{x:cx-s,y:cy-s},{x:cx+s,y:cy-s},{x:cx+s,y:cy+s},{x:cx-s,y:cy+s},{x:cx-s,y:cy-s}];
const triangle=(cx,cy,s=.22)=>[{x:cx,y:cy+s},{x:cx+s,y:cy-s},{x:cx-s,y:cy-s},{x:cx,y:cy+s}];
const entries=[
 {id:'legend-receptacle',page:1,componentHint:'RECEPTACLE_DUPLEX',anchor:{x:2,y:8},confidence:.9},
 {id:'legend-jbox',page:1,componentHint:'JUNCTION_BOX',anchor:{x:2,y:7},confidence:.9},
];
const fingerprints=buildLegendSymbolFingerprints({entries,polygons:[
 {id:'legend-square',page:1,vertices:square(1.2,8),confidence:.9},
 {id:'legend-triangle',page:1,vertices:triangle(1.2,7),confidence:.9},
]});
assert.equal(fingerprints.length,2);
const receptacleMatches=matchLegendSymbolFingerprints({fingerprints:fingerprints.filter(fp=>fp.componentClass==='RECEPTACLE_DUPLEX'),legendPages:new Set([1]),polygons:[
 {id:'plan-square',page:4,vertices:square(5,5,.18),confidence:.9,planFrameId:'frame-l1'},
]});
const junctionMatches=matchLegendSymbolFingerprints({fingerprints:fingerprints.filter(fp=>fp.componentClass==='JUNCTION_BOX'),legendPages:new Set([1]),polygons:[
 {id:'plan-triangle',page:4,vertices:triangle(6,5,.22),confidence:.9,planFrameId:'frame-l1'},
]});
assert.equal(receptacleMatches[0]?.componentClass,'RECEPTACLE_DUPLEX');
assert.equal(junctionMatches[0]?.componentClass,'JUNCTION_BOX');
assert.ok([...receptacleMatches,...junctionMatches].every(match=>match.page===4&&match.reviewRequired&&match.physicalTruth===false));
const ambiguous=matchLegendSymbolFingerprints({fingerprints,legendPages:new Set([1]),polygons:[
 {id:'ambiguous-square',page:4,vertices:square(7,5,.18),confidence:.9,planFrameId:'frame-l1'},
]});
assert.ok(ambiguous.length<=1,'multi-class matching must remain ambiguity-gated');

const verticalClosed=buildLegendSymbolFingerprints({
 entries:[{id:'vertical-box',page:1,componentHint:'JUNCTION_BOX',anchor:{x:4,y:1},textDirection:{x:0,y:-1},textSpan:.8,confidence:.9}],
 polygons:[{id:'vertical-square',page:1,vertices:square(4,1.18,.09),confidence:.9}]
});
assert.equal(verticalClosed.length,1,'vertical legend text must resolve its leading-edge closed symbol');

const neighborhoodEntries=[
 {id:'smoke',page:1,componentHint:'SMOKE_DETECTOR',anchor:{x:1,y:1},textDirection:{x:0,y:-1},confidence:.9},
 {id:'co',page:1,componentHint:'CO_DETECTOR',anchor:{x:2,y:1},textDirection:{x:0,y:-1},confidence:.9},
];
const neighborhoodPolygons=[
 {id:'smoke-core',page:1,vertices:square(1,1.18,.08),confidence:.9},
 {id:'co-core',page:1,vertices:square(2,1.18,.08),confidence:.9},
 {id:'plan-smoke-core',page:4,vertices:square(5,5,.08),confidence:.9},
 {id:'plan-co-core',page:4,vertices:square(6,5,.08),confidence:.9},
];
const neighborhoodSegments=[
 {page:1,x:.94,y:1.18,x2:1.06,y2:1.18},{page:1,x:1,y:1.12,x2:1,y2:1.24},
 {page:1,x:1.94,y:1.12,x2:2.06,y2:1.24},{page:1,x:1.94,y:1.24,x2:2.06,y2:1.12},
 {page:4,x:4.94,y:5,x2:5.06,y2:5},{page:4,x:5,y:4.94,x2:5,y2:5.06},
 {page:4,x:5.94,y:4.94,x2:6.06,y2:5.06},{page:4,x:5.94,y:5.06,x2:6.06,y2:4.94},
];
const neighborhoodFingerprints=buildLegendSymbolFingerprints({entries:neighborhoodEntries,polygons:neighborhoodPolygons.filter(p=>p.page===1),segments:neighborhoodSegments});
const neighborhoodMatches=matchLegendSymbolFingerprints({fingerprints:neighborhoodFingerprints,polygons:neighborhoodPolygons.filter(p=>p.page===4),segments:neighborhoodSegments,legendPages:new Set([1]),minScore:.7});
assert.ok(neighborhoodMatches.some(match=>match.componentClass==='SMOKE_DETECTOR'&&Math.abs(match.x-5)<.2),'interior-neighborhood must distinguish smoke glyph');
assert.ok(neighborhoodMatches.some(match=>match.componentClass==='CO_DETECTOR'&&Math.abs(match.x-6)<.2),'interior-neighborhood must distinguish CO glyph');


const fixtureSchedule=[
 {text:'COMMON AREA (HOUSE) LIGHT FIXTURE SCHEDULE',x:1,y:9,page:1},
 {text:'FIXTURE',x:1,y:8,page:1},{text:'DESCRIPTION',x:3,y:8,page:1},{text:'MANUFACTURER',x:6,y:8,page:1},{text:'CATALOG NUMBER',x:9,y:8,page:1},{text:'WATTS',x:11,y:8,page:1},{text:'VOLTS',x:13,y:8,page:1},
 {text:'A',x:1,y:7.4,page:1},{text:'LED WALL FIXTURE',x:3,y:7.4,page:1},{text:'ACME',x:6,y:7.4,page:1},{text:'LF-100',x:9,y:7.4,page:1},{text:'18',x:11,y:7.4,page:1},{text:'120',x:13,y:7.4,page:1},
];
assert.equal(detectPdfEquipmentMatrixPage(fixtureSchedule.map(item=>item.text)).isMatrix,true);
const records=extractPdfEquipmentMatrixRecords(fixtureSchedule,1);
assert.equal(records.length,1);
assert.equal(records[0].tag,'A');
assert.equal(records[0].model,'LF-100');
assert.equal(records[0].ratings.watts,18);
assert.equal(records[0].ratings.voltage,120);

console.log('Electrical project-legend symbol matching and fixture-schedule parsing passed.');
