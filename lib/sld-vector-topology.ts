export type SldVectorSegment={x:number;y:number;x2:number;y2:number};
export type SldVectorLabel={id:string;x:number;y:number};

export type SldVectorAttachment={
 labelId:string;
 component:number;
 distance:number;
 componentAttachmentCount:number;
};

export type SldVectorTopology={
 segments:Array<SldVectorSegment&{component:number}>;
 attachments:SldVectorAttachment[];
};

function finite(value:number){return Number.isFinite(value)}
function length(segment:SldVectorSegment){return Math.hypot(segment.x2-segment.x,segment.y2-segment.y)}
function pointSegmentDistance(px:number,py:number,segment:SldVectorSegment){
 const vx=segment.x2-segment.x,vy=segment.y2-segment.y;
 const wx=px-segment.x,wy=py-segment.y;
 const denom=vx*vx+vy*vy;
 if(denom<=1e-12)return Math.hypot(px-segment.x,py-segment.y);
 const t=Math.max(0,Math.min(1,(wx*vx+wy*vy)/denom));
 return Math.hypot(px-(segment.x+t*vx),py-(segment.y+t*vy));
}
function endpointTouches(a:SldVectorSegment,b:SldVectorSegment,tolerance:number){
 return pointSegmentDistance(a.x,a.y,b)<=tolerance||
  pointSegmentDistance(a.x2,a.y2,b)<=tolerance||
  pointSegmentDistance(b.x,b.y,a)<=tolerance||
  pointSegmentDistance(b.x2,b.y2,a)<=tolerance;
}

export function buildSldVectorTopology(
 rawSegments:SldVectorSegment[],
 labels:SldVectorLabel[],
 options:{snapTolerance?:number;labelDistance?:number;minSegmentLength?:number}={},
):SldVectorTopology{
 const snapTolerance=options.snapTolerance??0.18;
 const labelDistance=options.labelDistance??0.9;
 const minSegmentLength=options.minSegmentLength??0.08;
 const segments=rawSegments.filter(segment=>
  [segment.x,segment.y,segment.x2,segment.y2].every(finite)&&length(segment)>=minSegmentLength
 );
 const parent=segments.map((_,index)=>index);
 const find=(index:number):number=>parent[index]===index?index:(parent[index]=find(parent[index]));
 const union=(a:number,b:number)=>{const ra=find(a),rb=find(b);if(ra!==rb)parent[rb]=ra};
 // Spatial grid to avoid O(n^2) pairwise checks on large segment sets.
 // Cell size 2x tolerance ensures touching endpoints share or neighbor cells.
 const cellSize=Math.max(snapTolerance*2,1e-6);
 const gridKey=(cx:number,cy:number)=>`${cx},${cy}`;
 const grid=new Map<string,number[]>();
 const cellOf=(x:number,y:number)=>[Math.floor(x/cellSize),Math.floor(y/cellSize)] as const;
 segments.forEach((segment,index)=>{
  for(const [px,py] of [[segment.x,segment.y],[segment.x2,segment.y2]] as const){
   const [cx,cy]=cellOf(px,py);
   const key=gridKey(cx,cy);
   let bucket=grid.get(key);
   if(!bucket){bucket=[];grid.set(key,bucket);}
   if(!bucket.includes(index))bucket.push(index);
  }
 });
 const checkedPairs=new Set<string>();
 for(let i=0;i<segments.length;i++){
  const segment=segments[i];
  const neighborCells=new Set<string>();
  for(const [px,py] of [[segment.x,segment.y],[segment.x2,segment.y2]] as const){
   const [cx,cy]=cellOf(px,py);
   for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)neighborCells.add(gridKey(cx+dx,cy+dy));
  }
  for(const cellKey of neighborCells){
   const bucket=grid.get(cellKey);
   if(!bucket)continue;
   for(const j of bucket){
    if(j<=i)continue;
    const pairKey=`${i}:${j}`;
    if(checkedPairs.has(pairKey))continue;
    checkedPairs.add(pairKey);
    if(endpointTouches(segment,segments[j],snapTolerance))union(i,j);
   }
  }
 }
 const roots=[...new Set(segments.map((_,index)=>find(index)))];
 const componentIndex=new Map(roots.map((root,index)=>[root,index]));
 const withComponent=segments.map((segment,index)=>({...segment,component:componentIndex.get(find(index))??0}));
 const preliminary:{labelId:string;component:number;distance:number}[]=[];
 // Grid-accelerated label matching: only check segments near each label.
 const labelCellSize=Math.max(labelDistance*2,1e-6);
 const labelGrid=new Map<string,number[]>();
 withComponent.forEach((segment,index)=>{
  const minX=Math.min(segment.x,segment.x2)-labelDistance,maxX=Math.max(segment.x,segment.x2)+labelDistance;
  const minY=Math.min(segment.y,segment.y2)-labelDistance,maxY=Math.max(segment.y,segment.y2)+labelDistance;
  for(let cx=Math.floor(minX/labelCellSize);cx<=Math.floor(maxX/labelCellSize);cx++)
   for(let cy=Math.floor(minY/labelCellSize);cy<=Math.floor(maxY/labelCellSize);cy++){
    const key=`${cx},${cy}`;
    let bucket=labelGrid.get(key);
    if(!bucket){bucket=[];labelGrid.set(key,bucket);}
    bucket.push(index);
   }
 });
 for(const label of labels){
  let best:{component:number;distance:number}|null=null;
  const key=`${Math.floor(label.x/labelCellSize)},${Math.floor(label.y/labelCellSize)}`;
  const candidates=labelGrid.get(key);
  if(candidates)for(const index of candidates){
   const segment=withComponent[index];
   const distance=pointSegmentDistance(label.x,label.y,segment);
   if(!best||distance<best.distance)best={component:segment.component,distance};
  }
  // Fallback: if grid missed (shouldn't happen), skip to avoid O(n*m) scan.
  if(best&&best.distance<=labelDistance)preliminary.push({labelId:label.id,component:best.component,distance:best.distance});
 }
 const counts=new Map<number,number>();
 for(const attachment of preliminary)counts.set(attachment.component,(counts.get(attachment.component)||0)+1);
 return{
  segments:withComponent,
  attachments:preliminary.map(attachment=>({...attachment,componentAttachmentCount:counts.get(attachment.component)||0})),
 };
}
