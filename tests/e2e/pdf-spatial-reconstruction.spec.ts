import {expect,test} from '@playwright/test';
import {acceptPdfRoomCandidate,applyPdfAlignment,qualifyPdfRoomCandidates,solveTwoPointPdfAlignment} from '../../lib/pdf-spatial-reconstruction';
import type {PdfSheetMetadata} from '../../lib/pdf-spatial-metadata';

const metadata:PdfSheetMetadata={
 page:1,
 sheetNumber:'A-101',
 sheetTitle:'LEVEL 1 FLOOR PLAN',
 floor:'L1',
 discipline:'Architectural',
 scaleText:'1/8" = 1\'-0"',
 scaleRatio:96,
 titleBlockDetected:true,
 alignmentKey:'A-101|L1|Architectural',
 confidence:.9,
 evidence:['sheet-number:A-101','floor:L1','discipline:Architectural','title-block:position-supported']
};

test('PDF reconstruction qualifies but does not silently authorize a room boundary',()=>{
 const result=qualifyPdfRoomCandidates({
  boundaries:[{id:'b1',source:'A-101.pdf',page:1,vertices:[{x:0,y:0},{x:10,y:0},{x:10,y:8},{x:0,y:8}],closed:true,confidence:.8}],
  labels:[{id:'r1',source:'A-101.pdf',page:1,name:'ELECTRICAL ROOM 101',x:5,y:4,confidence:.9}],
  metadataByPage:{1:metadata}
 });
 expect(result.unresolved).toEqual([]);
 expect(result.qualified).toHaveLength(1);
 const candidate=result.qualified[0];
 expect(candidate.kind).toBe('room-boundary-candidate');
 expect(candidate.reviewRequired).toBeTruthy();
 expect(candidate.geometryValidated).toBeFalsy();
 expect(candidate.floor).toBe('L1');
 expect(candidate.name).toBe('ELECTRICAL ROOM 101');
 expect(candidate.metadata.coordinateFrame).toBe('sheet-local');
});

test('ambiguous or unlabeled closed PDF paths remain unresolved instead of becoming rooms',()=>{
 const boundaries=[{id:'b1',source:'A-101.pdf',page:1,vertices:[{x:0,y:0},{x:10,y:0},{x:10,y:8},{x:0,y:8}],closed:true,confidence:.8}];
 const ambiguous=qualifyPdfRoomCandidates({
  boundaries,
  labels:[
   {id:'r1',source:'A-101.pdf',page:1,name:'ROOM 101',x:3,y:4,confidence:.8},
   {id:'r2',source:'A-101.pdf',page:1,name:'ROOM 102',x:7,y:4,confidence:.8}
  ],
  metadataByPage:{1:metadata}
 });
 expect(ambiguous.qualified).toHaveLength(0);
 expect(ambiguous.unresolved[0]).toContain('room-label-count-2');
 const unlabeled=qualifyPdfRoomCandidates({boundaries,labels:[],metadataByPage:{1:metadata}});
 expect(unlabeled.qualified).toHaveLength(0);
 expect(unlabeled.unresolved[0]).toContain('room-label-count-0');
});

test('human review is required before a qualified PDF room becomes authoritative geometry',()=>{
 const candidate=qualifyPdfRoomCandidates({
  boundaries:[{id:'b1',source:'A-101.pdf',page:1,vertices:[{x:0,y:0},{x:6,y:0},{x:6,y:5},{x:0,y:5}],closed:true,confidence:.8}],
  labels:[{id:'r1',source:'A-101.pdf',page:1,name:'UPS ROOM',x:3,y:2,confidence:.9}],
  metadataByPage:{1:metadata}
 }).qualified[0];
 expect(()=>acceptPdfRoomCandidate(candidate,{reviewedBy:' '})).toThrow(/named reviewer/i);
 const accepted=acceptPdfRoomCandidate(candidate,{reviewedBy:'Field Reviewer',reviewedAt:'2026-09-14T03:00:00.000Z'});
 expect(accepted.kind).toBe('room-boundary');
 expect(accepted.reviewRequired).toBeFalsy();
 expect(accepted.geometryValidated).toBeTruthy();
 expect(accepted.metadata.reviewMethod).toBe('HITL');
 expect(accepted.evidence).toContain('hitl-reviewed-by:Field Reviewer');
});

test('cross-sheet transforms require explicit two-point correspondence and solve a reproducible similarity transform',()=>{
 const alignment=solveTwoPointPdfAlignment({source:[{x:0,y:0},{x:10,y:0}],target:[{x:5,y:7},{x:5,y:27}]});
 expect(alignment.scale).toBeCloseTo(2,8);
 expect(alignment.rotationRadians).toBeCloseTo(Math.PI/2,8);
 expect(alignment.residual).toBeLessThan(1e-9);
 const mapped=applyPdfAlignment({x:4,y:3},alignment);
 expect(mapped.x).toBeCloseTo(-1,8);
 expect(mapped.y).toBeCloseTo(15,8);
 expect(()=>solveTwoPointPdfAlignment({source:[{x:1,y:1},{x:1,y:1}],target:[{x:0,y:0},{x:2,y:0}]})).toThrow(/distinct source/i);
});
