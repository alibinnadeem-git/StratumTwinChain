import assert from 'node:assert/strict';
import {detectRasterSymbolCandidates,buildRasterLegendFingerprints,matchRasterLegendFingerprints} from '../lib/electrical-raster-symbol-fingerprint.ts';

function image(width,height){
 const gray=new Uint8Array(width*height);gray.fill(255);return{width,height,gray};
}
function ink(img,x,y){if(x>=0&&y>=0&&x<img.width&&y<img.height)img.gray[y*img.width+x]=0}
function plus(img,cx,cy,s){
 for(let y=cy-s;y<=cy+s;y++)for(let x=cx-2;x<=cx+2;x++)ink(img,x,y);
 for(let y=cy-2;y<=cy+2;y++)for(let x=cx-s;x<=cx+s;x++)ink(img,x,y);
}
function box(img,cx,cy,s){
 for(let x=cx-s;x<=cx+s;x++){for(let k=0;k<3;k++){ink(img,x,cy-s+k);ink(img,x,cy+s-k)}}
 for(let y=cy-s;y<=cy+s;y++){for(let k=0;k<3;k++){ink(img,cx-s+k,y);ink(img,cx+s-k,y)}}
}
const legend=image(220,120);
plus(legend,55,35,12);box(legend,55,82,12);
// Simulated OCR text to the right must be excluded from graphic candidates.
for(let y=28;y<43;y++)for(let x=105;x<165;x++)if((x+y)%4===0)ink(legend,x,y);
const legendCandidates=detectRasterSymbolCandidates({
 image:legend,page:1,textBoxes:[{x0:100,y0:20,x1:175,y1:50}]
});
assert.ok(legendCandidates.length>=2);

const entries=[
 {id:'legend-plus',componentClass:'RECEPTACLE_DUPLEX',anchorX:110,anchorY:35,confidence:.92},
 {id:'legend-box',componentClass:'JUNCTION_BOX',anchorX:110,anchorY:82,confidence:.92},
];
const fps=buildRasterLegendFingerprints({
 page:1,image:legend,entries,candidates:legendCandidates,pixelFromAnchor:(x,y)=>({x,y})
});
assert.equal(fps.length,2);

const plan=image(260,150);
plus(plan,72,62,10);box(plan,175,62,10);
const planCandidates=detectRasterSymbolCandidates({image:plan,page:4});
const matches=matchRasterLegendFingerprints({fingerprints:fps,candidates:planCandidates,minScore:.9});
assert.ok(matches.some(m=>m.componentClass==='RECEPTACLE_DUPLEX'));
assert.ok(matches.some(m=>m.componentClass==='JUNCTION_BOX'));
assert.ok(matches.every(m=>m.page===4&&m.reviewRequired&&m.physicalTruth===false));
console.log('Raster-only project legend symbol fingerprint matching passed.');
