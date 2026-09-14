import assert from 'node:assert/strict';
import fs from 'node:fs';
import {proposeRooms} from '../lib/room-reconstruction.ts';

const sha='a'.repeat(64);
const meta={sourceSha256:sha,page:1,coordinateUnits:'sheet',reviewRequired:true,geometryValidated:false};
const rectangle=(id,x0,y0,x1,y1)=>({id,name:`Boundary ${id}`,kind:'vector-boundary-candidate',source:'A-101.pdf',confidence:.76,x:(x0+x1)/2,y:(y0+y1)/2,vertices:[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}],meta});
const label=(id,name,x,y)=>({id,name,kind:'room-label',source:'A-101.pdf',confidence:.82,x,y,meta});

const single=proposeRooms([rectangle('room-1',0,0,10,6),label('label-1','Electrical Room 101',5,3)]);
assert.equal(single.length,1);
assert.equal(single[0].eligible,true);
assert.equal(single[0].name,'Electrical Room 101');
assert.equal(single[0].reviewRequired,true);
assert.equal(single[0].autoApply,false);
assert.equal(single[0].geometryValidated,false);
console.log('✓ one contained source label yields a reviewable room proposal');
console.log('✓ room proposal is explicitly review-required and cannot auto-apply');

const ambiguous=proposeRooms([rectangle('room-2',0,0,10,6),label('label-2a','Room 201',3,3),label('label-2b','Room 202',7,3)]);
assert.equal(ambiguous[0].eligible,false);
assert.match(ambiguous[0].reasons.join(' '),/Multiple room labels/i);
console.log('✓ multiple contained labels fail closed');

const nested=proposeRooms([
 rectangle('outer',0,0,10,10),
 rectangle('inner',2,2,8,8),
 label('label-nested','Data Hall 1',5,5)
]);
const inner=nested.find(item=>item.candidateId==='inner');
const outer=nested.find(item=>item.candidateId==='outer');
assert.equal(inner?.eligible,true);
assert.equal(outer?.eligible,false);
assert.match(outer?.reasons.join(' ')||'',/smaller closed boundary/i);
console.log('✓ nested duplicate geometry prefers the smaller source-grounded boundary');

const crossing={...rectangle('crossing',0,0,10,10),vertices:[{x:0,y:0},{x:10,y:10},{x:0,y:10},{x:10,y:0}]};
const invalid=proposeRooms([crossing,label('label-cross','Office 1',5,5)]);
assert.equal(invalid[0].eligible,false);
assert.match(invalid[0].reasons.join(' '),/self-intersects/i);
console.log('✓ self-intersecting geometry is rejected');

const wrongFrame=proposeRooms([rectangle('frame',0,0,10,6),{...label('wrong','Room X',5,3),meta:{...meta,page:2}}]);
assert.equal(wrongFrame[0].eligible,false);
assert.match(wrongFrame[0].reasons.join(' '),/No source-grounded room label/i);
console.log('✓ labels from another source frame cannot authorize a proposal');

const component=fs.readFileSync('components/RoomReconstructionReview.tsx','utf8');
const review=fs.readFileSync('components/SheetReview.tsx','utf8');
const page=fs.readFileSync('app/compiler/page.tsx','utf8');
assert.match(page,/RoomReconstructionReview/);
assert.match(component,/Automatic room proposals do not set/);
assert.match(component,/geometryValidated/);
assert.doesNotMatch(component,/fetch\(['"`]\/api\/(assets|lifecycle|chain|verify|dir)/);
assert.match(review,/Confirm selected boundary as room/);
assert.match(review,/automaticProposalAccepted:Boolean\(chosenProposal\?\.eligible\)/);
assert.match(review,/geometryValidated:true/);
console.log('✓ compiler mounts deterministic room reconstruction review');
console.log('✓ proposal component has no asset/lifecycle/chain mutation path');
console.log('✓ only explicit Drawing review confirmation promotes geometryValidated=true');

console.log('\nRoom reconstruction proposal and HITL safety contract passed.');
