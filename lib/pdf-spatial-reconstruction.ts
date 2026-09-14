import {pdfBoundaryCanBecomeRoom,type PdfSheetMetadata} from './pdf-spatial-metadata';

export type PdfXY={x:number;y:number};
export type PdfBoundaryCandidate={
 id:string;
 source:string;
 page:number;
 vertices:PdfXY[];
 closed:boolean;
 confidence:number;
};
export type PdfRoomLabel={
 id:string;
 source:string;
 page:number;
 name:string;
 x:number;
 y:number;
 confidence:number;
};
export type QualifiedPdfRoomCandidate={
 id:string;
 source:string;
 page:number;
 kind:'room-boundary-candidate';
 name:string;
 vertices:PdfXY[];
 floor:string;
 confidence:number;
 area:number;
 reviewRequired:true;
 geometryValidated:false;
 evidence:string[];
 metadata:{
  sheetNumber?:string;
  sheetTitle?:string;
  discipline:PdfSheetMetadata['discipline'];
  alignmentKey?:string;
  containedLabelId:string;
  reconstruction:'title-block-qualified-closed-path';
  coordinateFrame:'sheet-local';
 };
};
export type AcceptedPdfRoomBoundary=Omit<QualifiedPdfRoomCandidate,'kind'|'reviewRequired'|'geometryValidated'|'metadata'> & {
 kind:'room-boundary';
 reviewRequired:false;
 geometryValidated:true;
 metadata:QualifiedPdfRoomCandidate['metadata'] & {
  reviewedBy:string;
  reviewedAt:string;
  reviewMethod:'HITL';
 };
};

export type PdfAlignmentAnchor={x:number;y:number};
export type PdfSheetAlignment={
 scale:number;
 rotationRadians:number;
 translateX:number;
 translateY:number;
 residual:number;
 evidence:'TWO_POINT_ANCHOR';
};

export function polygonArea(vertices:PdfXY[]):number{
 if(vertices.length<3)return 0;
 let sum=0;
 for(let i=0;i<vertices.length;i++){
  const a=vertices[i],b=vertices[(i+1)%vertices.length];
  sum+=a.x*b.y-b.x*a.y;
 }
 return Math.abs(sum)/2;
}

export function pointInPolygon(point:PdfXY,vertices:PdfXY[]):boolean{
 if(vertices.length<3)return false;
 let inside=false;
 for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){
  const a=vertices[i],b=vertices[j];
  const crosses=(a.y>point.y)!==(b.y>point.y);
  if(!crosses)continue;
  const denominator=b.y-a.y;
  if(Math.abs(denominator)<Number.EPSILON)continue;
  const edgeX=(b.x-a.x)*(point.y-a.y)/denominator+a.x;
  if(point.x<edgeX)inside=!inside;
 }
 return inside;
}

export function qualifyPdfRoomCandidates(input:{
 boundaries:PdfBoundaryCandidate[];
 labels:PdfRoomLabel[];
 metadataByPage:Map<number,PdfSheetMetadata>|Record<number,PdfSheetMetadata>;
}):{qualified:QualifiedPdfRoomCandidate[];unresolved:string[]}{
 const qualified:QualifiedPdfRoomCandidate[]=[];
 const unresolved:string[]=[];
 const metadataFor=(page:number)=>input.metadataByPage instanceof Map?input.metadataByPage.get(page):input.metadataByPage[page];
 for(const boundary of input.boundaries){
  const metadata=metadataFor(boundary.page);
  if(!metadata){unresolved.push(`${boundary.id}:missing-sheet-metadata`);continue;}
  const area=polygonArea(boundary.vertices);
  const contained=input.labels.filter(label=>label.page===boundary.page&&pointInPolygon(label,boundary.vertices));
  if(!pdfBoundaryCanBecomeRoom({area,containingRoomLabels:contained.length,metadata,closed:boundary.closed})){
   const reason=!boundary.closed?'open-boundary':metadata.floor==='UNRESOLVED'?'unresolved-floor':contained.length!==1?`room-label-count-${contained.length}`:metadata.confidence<.55?'weak-sheet-evidence':'implausible-area';
   unresolved.push(`${boundary.id}:${reason}`);
   continue;
  }
  const label=contained[0];
  qualified.push({
   id:boundary.id,
   source:boundary.source,
   page:boundary.page,
   kind:'room-boundary-candidate',
   name:label.name,
   vertices:boundary.vertices,
   floor:metadata.floor,
   confidence:Number(Math.min(.92,(boundary.confidence+label.confidence+metadata.confidence)/3).toFixed(2)),
   area,
   reviewRequired:true,
   geometryValidated:false,
   evidence:[...metadata.evidence,`contained-room-label:${label.id}`,`boundary-area:${area.toFixed(3)}`],
   metadata:{
    sheetNumber:metadata.sheetNumber,
    sheetTitle:metadata.sheetTitle,
    discipline:metadata.discipline,
    alignmentKey:metadata.alignmentKey,
    containedLabelId:label.id,
    reconstruction:'title-block-qualified-closed-path',
    coordinateFrame:'sheet-local'
   }
  });
 }
 return{qualified,unresolved};
}

export function acceptPdfRoomCandidate(candidate:QualifiedPdfRoomCandidate,review:{reviewedBy:string;reviewedAt?:string}):AcceptedPdfRoomBoundary{
 const reviewedBy=review.reviewedBy.trim();
 if(!reviewedBy)throw new Error('A named reviewer is required before PDF room geometry can become authoritative.');
 const reviewedAt=review.reviewedAt||new Date().toISOString();
 return{
  ...candidate,
  kind:'room-boundary',
  reviewRequired:false,
  geometryValidated:true,
  evidence:[...candidate.evidence,`hitl-reviewed-by:${reviewedBy}`,`hitl-reviewed-at:${reviewedAt}`],
  metadata:{...candidate.metadata,reviewedBy,reviewedAt,reviewMethod:'HITL'}
 };
}

export function solveTwoPointPdfAlignment(input:{source:[PdfAlignmentAnchor,PdfAlignmentAnchor];target:[PdfAlignmentAnchor,PdfAlignmentAnchor]}):PdfSheetAlignment{
 const [s1,s2]=input.source,[t1,t2]=input.target;
 const sv={x:s2.x-s1.x,y:s2.y-s1.y},tv={x:t2.x-t1.x,y:t2.y-t1.y};
 const sourceLength=Math.hypot(sv.x,sv.y),targetLength=Math.hypot(tv.x,tv.y);
 if(sourceLength<=1e-9||targetLength<=1e-9)throw new Error('Two distinct source and target anchors are required for sheet alignment.');
 const scale=targetLength/sourceLength;
 const rotationRadians=Math.atan2(tv.y,tv.x)-Math.atan2(sv.y,sv.x);
 const cos=Math.cos(rotationRadians),sin=Math.sin(rotationRadians);
 const transformedS1={x:scale*(s1.x*cos-s1.y*sin),y:scale*(s1.x*sin+s1.y*cos)};
 const translateX=t1.x-transformedS1.x,translateY=t1.y-transformedS1.y;
 const transform=(p:PdfAlignmentAnchor)=>({x:scale*(p.x*cos-p.y*sin)+translateX,y:scale*(p.x*sin+p.y*cos)+translateY});
 const mappedS2=transform(s2);
 const residual=Math.hypot(mappedS2.x-t2.x,mappedS2.y-t2.y);
 return{scale,rotationRadians,translateX,translateY,residual,evidence:'TWO_POINT_ANCHOR'};
}

export function applyPdfAlignment(point:PdfAlignmentAnchor,alignment:PdfSheetAlignment):PdfAlignmentAnchor{
 const cos=Math.cos(alignment.rotationRadians),sin=Math.sin(alignment.rotationRadians);
 return{
  x:alignment.scale*(point.x*cos-point.y*sin)+alignment.translateX,
  y:alignment.scale*(point.x*sin+point.y*cos)+alignment.translateY
 };
}
