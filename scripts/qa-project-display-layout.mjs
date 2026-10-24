import assert from 'node:assert/strict';
import {displayedEntity,projectDisplayLayout} from '../lib/project-display-layout.ts';
const original=[
 {id:'a',source:'plans.pdf',x:1,y:2,x2:4,y2:5,vertices:[{x:1,y:2},{x:4,y:5}],meta:{page:1}},
 {id:'b',source:'plans.pdf',x:1,y:2,x2:4,y2:5,meta:{page:2}},
];
const snapshot=JSON.stringify(original),layout=projectDisplayLayout(original,true);
assert.equal(layout.separatedSheets,2);
const shown=original.map(e=>displayedEntity(e,layout.offsets.get(e.id)));
assert.ok(shown[0].x2<shown[1].x||shown[1].x2<shown[0].x||shown[0].y2<shown[1].y||shown[1].y2<shown[0].y,'independent sheets do not overlap in overview');
assert.equal(shown[0].x2-shown[0].x,3);assert.equal(shown[0].y2-shown[0].y,3);
assert.equal(JSON.stringify(original),snapshot,'display transforms cannot alter source coordinates');
assert.equal(displayedEntity(original[0],projectDisplayLayout(original,false).offsets.get('a')),original[0]);
const registered=original.map(e=>({...e,meta:{...e.meta,projectXYFrameId:'reviewed-project-frame'}}));
assert.equal(projectDisplayLayout(registered,true).offsets.size,0,'registered sheets retain their shared project frame');
const mixed=projectDisplayLayout([registered[0],original[1]],true);
assert.equal(mixed.offsets.has('a'),false);assert.equal(mixed.offsets.has('b'),true);
console.log('Entire-project display passed: independent sheets separated, registered coordinates preserved, reversible source geometry unchanged.');
