import assert from 'node:assert/strict';
import fs from 'node:fs';
import {proposeRooms,reconstructWallLoopCandidates} from '../lib/room-reconstruction.ts';

const sha='a'.repeat(64);
const meta={sourceSha256:sha,page:1,coordinateUnits:'sheet',reviewRequired:true,geometryValidated:false};
const rectangle=(id,x0,y0,x1,y1)=>({id,name:`Boundary ${id}`,kind:'vector-boundary-candidate',source:'A-101.pdf',confidence:.76,x:(x0+x1)/2,y:(y0+y1)/2,vertices:[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}],meta});
const label=(id,name,x,y,overrides={})=>({id,name,kind:'room-label',source:'A-101.pdf',confidence:.82,x,y,meta:{...meta,...overrides}});
const segment=(id,x,y,x2,y2,overrides={})=>({id,name:`Wall ${id}`,kind:'wall-segment',source:'A-101.pdf',confidence:.98,x,y,x2,y2,floor:'L1',meta:{...meta,...overrides}});

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

const nearClosed=[
 segment('w1',0,0,10,0),
 segment('w2',10.04,.02,10,6),
 segment('w3',10,6.03,0,6),
 segment('w4',-.03,6,.02,.03)
];
const stitched=reconstructWallLoopCandidates(nearClosed,.12);
assert.equal(stitched.length,1);
assert.equal(stitched[0].kind,'vector-boundary-candidate');
assert.equal(stitched[0].meta?.reconstruction,'wall-segment-loop');
assert.equal(stitched[0].meta?.geometryValidated,false);
assert.ok(Array.isArray(stitched[0].meta?.sourceSegmentIds)&&stitched[0].meta.sourceSegmentIds.length===4);
const stitchedProposal=proposeRooms([...nearClosed,...stitched,label('wall-label','Switchgear Room',5,3)]);
assert.equal(stitchedProposal.length,1);
assert.equal(stitchedProposal[0].eligible,true);
assert.equal(stitchedProposal[0].name,'Switchgear Room');
assert.equal(stitchedProposal[0].geometryValidated,false);
console.log('✓ small same-frame wall endpoint gaps form a deterministic review-only room candidate');

const openLoop=[segment('o1',0,0,10,0),segment('o2',10.4,0,10,6),segment('o3',10,6,0,6),segment('o4',0,6,0,0)];
assert.equal(reconstructWallLoopCandidates(openLoop,.12).length,0);
console.log('✓ wall gaps beyond snap tolerance fail closed');

const branched=[...nearClosed,segment('branch',10,0,12,0)];
assert.equal(reconstructWallLoopCandidates(branched,.12).length,0);
console.log('✓ branching wall topology is not converted into a room loop');

const crossFrame=[
 segment('f1',0,0,10,0,{page:1}),segment('f2',10,0,10,6,{page:1}),
 segment('f3',10,6,0,6,{page:2}),segment('f4',0,6,0,0,{page:2})
];
assert.equal(reconstructWallLoopCandidates(crossFrame,.12).length,0);
console.log('✓ wall segments from different source pages never combine');

const existingRoom={id:'existing-room',name:'Room',kind:'room-boundary',source:'A-101.pdf',confidence:.99,x:5,y:3,vertices:[{x:0,y:0},{x:10,y:0},{x:10,y:6},{x:0,y:6}],meta};
assert.equal(reconstructWallLoopCandidates([...nearClosed,existingRoom],.12).length,0);
console.log('✓ existing source room geometry suppresses duplicate stitched boundaries');

const component=fs.readFileSync('components/RoomReconstructionReview.tsx','utf8');
const review=fs.readFileSync('components/SheetReview.tsx','utf8');
const page=fs.readFileSync('app/compiler/page.tsx','utf8');
assert.match(page,/RoomReconstructionReview/);
assert.match(component,/reconstructWallLoopCandidates/);
assert.match(component,/reconstruction!=='wall-segment-loop'/);
assert.match(component,/Branching or open topology fails closed/);
assert.match(component,/Automatic room proposals do not set/);
assert.match(component,/geometryValidated/);
assert.doesNotMatch(component,/fetch\(['"`]\/api\/(assets|lifecycle|chain|verify|dir)/);
assert.match(review,/Confirm selected boundary as room/);
assert.match(review,/automaticProposalAccepted:Boolean\(chosenProposal\?\.eligible\)/);
assert.match(review,/geometryValidated:true/);
console.log('✓ compiler mounts deterministic closed-path and wall-loop room reconstruction review');
console.log('✓ proposal component has no asset/lifecycle/chain mutation path');
console.log('✓ only explicit Drawing review confirmation promotes geometryValidated=true');

console.log('\nRoom reconstruction proposal and HITL safety contract passed.');
