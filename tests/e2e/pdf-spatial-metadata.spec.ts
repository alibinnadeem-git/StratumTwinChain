import {expect,test} from '@playwright/test';
import {inferPdfFloor,inferPdfSheetMetadata,parsePdfScale,pdfBoundaryCanBecomeRoom,type PdfSpatialTextItem} from '../../lib/pdf-spatial-metadata';

test('architectural and engineering drawing scales are normalized without inventing units',()=>{
 expect(parsePdfScale('SCALE: 1:100')?.ratio).toBe(100);
 expect(parsePdfScale('1/8" = 1\'-0"')?.ratio).toBe(96);
 expect(parsePdfScale('NTS')).toBeNull();
});

test('conflicting floor evidence remains unresolved instead of choosing a convenient level',()=>{
 expect(inferPdfFloor(['LEVEL 1 PLAN','LEVEL 2 PLAN'],'E-101.pdf')).toBe('UNRESOLVED');
 expect(inferPdfFloor(['SECOND FLOOR PLAN'],'E-201.pdf')).toBe('L2');
});

test('title-block evidence produces a conservative sheet identity and alignment candidate',()=>{
 const items:PdfSpatialTextItem[]=[
  {str:'LEVEL 2 ELECTRICAL POWER PLAN',x:.62,y:.72,page:1},
  {str:'E-201',x:.83,y:.86,page:1},
  {str:'1/8" = 1\'-0"',x:.74,y:.9,page:1},
  {str:'REV',x:.63,y:.94,page:1},
  {str:'3',x:.69,y:.94,page:1},
  {str:'PANEL LP-2',x:.3,y:.4,page:1}
 ];
 const metadata=inferPdfSheetMetadata(items,1,'Campus-Level-2-Electrical.pdf');
 expect(metadata.sheetNumber).toBe('E-201');
 expect(metadata.sheetTitle).toContain('LEVEL 2');
 expect(metadata.floor).toBe('L2');
 expect(metadata.discipline).toBe('Electrical');
 expect(metadata.scaleRatio).toBe(96);
 expect(metadata.titleBlockDetected).toBeTruthy();
 expect(metadata.alignmentKey).toBe('E-201|L2|Electrical');
 expect(metadata.confidence).toBeGreaterThanOrEqual(.8);
});

test('closed PDF geometry is not promoted to a room without a single contained room label and resolved sheet evidence',()=>{
 const metadata=inferPdfSheetMetadata([
  {str:'LEVEL 1 FLOOR PLAN',x:.7,y:.74,page:1},
  {str:'A-101',x:.82,y:.88,page:1}
 ],1,'Level-1-Architectural.pdf');
 expect(pdfBoundaryCanBecomeRoom({area:24,containingRoomLabels:1,metadata,closed:true})).toBeTruthy();
 expect(pdfBoundaryCanBecomeRoom({area:24,containingRoomLabels:0,metadata,closed:true})).toBeFalsy();
 expect(pdfBoundaryCanBecomeRoom({area:24,containingRoomLabels:2,metadata,closed:true})).toBeFalsy();
 expect(pdfBoundaryCanBecomeRoom({area:24,containingRoomLabels:1,metadata:{...metadata,floor:'UNRESOLVED'},closed:true})).toBeFalsy();
});
