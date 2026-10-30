import {chooseAutoSheetFrame} from '../lib/sheet-frame-choice.ts';

// Auto-safe sheet isolation: Model/Review open on the plan with the most identified equipment, never on a
// one-line while a plan exists; Electrical keeps the one-line first. Frames mirror Brynhurst's order.
function ok(label,condition){if(!condition)throw new Error('FAIL: '+label);console.log('✓ '+label)}

const frames=[
  {key:'sha:2',planType:'SLD'},
  {key:'sha:3:frame-site',planType:'SITE_PLAN'},
  {key:'sha:4:frame-l1',planType:'FLOOR_PLAN'},
  {key:'sha:5:frame-l2',planType:'FLOOR_PLAN'},
  {key:'sha:7:frame-unit-109',planType:'UNIT_PLAN'},
];
const brynhurst=new Map([['sha:2',2],['sha:4:frame-l1',2],['sha:7:frame-unit-109',2]]);

ok('Model opens on the first floor plan, not the one-line',chooseAutoSheetFrame(frames,'MODEL',brynhurst)==='sha:4:frame-l1');
ok('Review follows Model',chooseAutoSheetFrame(frames,'REVIEW',brynhurst)==='sha:4:frame-l1');
ok('Electrical keeps the one-line first',chooseAutoSheetFrame(frames,'ELECTRICAL',brynhurst)==='sha:2');
ok('the plan with the most equipment wins',chooseAutoSheetFrame(frames,'MODEL',new Map([['sha:4:frame-l1',1],['sha:5:frame-l2',3]]))==='sha:5:frame-l2');
ok('a one-line with more equipment never beats a plan',chooseAutoSheetFrame(frames,'MODEL',new Map([['sha:2',9]]))==='sha:3:frame-site');
ok('no equipment anywhere -> the first plan',chooseAutoSheetFrame(frames,'MODEL',new Map())==='sha:3:frame-site');
ok('only a one-line and a raster -> the one-line',chooseAutoSheetFrame([{key:'r',planType:'RASTER_DRAWING'},{key:'s',planType:'SLD'}],'MODEL',new Map())==='s');
ok('a single frame needs no isolation',chooseAutoSheetFrame([frames[0]],'MODEL',brynhurst)===null);

console.log('\nSheet-frame choice contract passed.');
