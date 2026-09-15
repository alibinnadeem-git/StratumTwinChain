export type RoomPoint={x:number;y:number};
export type RoomEntity={id:string;name:string;kind:string;source:string;confidence:number;vertices?:RoomPoint[];x:number;y:number;x2?:number;y2?:number;floor?:string;meta?:Record<string,unknown>};
export type RoomProposal={candidateId:string;name:string|null;labelId:string|null;confidence:number;eligible:boolean;reasons:string[];area:number;compactness:number;reviewRequired:true;autoApply:false;geometryValidated:false};

const EPS=1e-8;
const sourceFrame=(entity:RoomEntity)=>`${String(entity.meta?.sourceSha256||entity.source).toLowerCase()}:${Number(entity.meta?.page||0)}`;
export function polygonArea(vertices:RoomPoint[]){let twice=0;for(let i=0;i<vertices.length;i++){const a=vertices[i],b=vertices[(i+1)%vertices.length];twice+=a.x*b.y-b.x*a.y}return Math.abs(twice)/2}
export function polygonPerimeter(vertices:RoomPoint[]){let total=0;for(let i=0;i<vertices.length;i++){const a=vertices[i],b=vertices[(i+1)%vertices.length];total+=Math.hypot(b.x-a.x,b.y-a.y)}return total}
export function pointInRoom(point:RoomPoint,vertices:RoomPoint[]){let inside=false;for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){const a=vertices[i],b=vertices[j];if(((a.y>point.y)!==(b.y>point.y))&&(point.x<(b.x-a.x)*(point.y-a.y)/((b.y-a.y)||EPS)+a.x))inside=!inside}return inside}
function orientation(a:RoomPoint,b:RoomPoint,c:RoomPoint){const value=(b.y-a.y)*(c.x-b.x)-(b.x-a.x)*(c.y-b.y);return Math.abs(value)<EPS?0:value>0?1:2}
function intersects(a:RoomPoint,b:RoomPoint,c:RoomPoint,d:RoomPoint){const o1=orientation(a,b,c),o2=orientation(a,b,d),o3=orientation(c,d,a),o4=orientation(c,d,b);return o1!==o2&&o3!==o4}
export function hasSelfIntersection(vertices:RoomPoint[]){const count=vertices.length;for(let i=0;i<count;i++){const a=vertices[i],b=vertices[(i+1)%count];for(let j=i+1;j<count;j++){if(Math.abs(i-j)<=1||(i===0&&j===count-1))continue;const c=vertices[j],d=vertices[(j+1)%count];if(intersects(a,b,c,d))return true}}return false}

function stableHash(value:string){let hash=2166136261;for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619)}return(hash>>>0).toString(16).padStart(8,'0')}
function centroid(vertices:RoomPoint[]){return vertices.reduce((sum,point)=>({x:sum.x+point.x/vertices.length,y:sum.y+point.y/vertices.length}),{x:0,y:0})}
function sameGeometry(candidate:{vertices:RoomPoint[];frame:string},existing:RoomEntity[],tolerance:number){
 const area=polygonArea(candidate.vertices),center=centroid(candidate.vertices);
 return existing.some(room=>{
  if(sourceFrame(room)!==candidate.frame||!room.vertices?.length)return false;
  const otherArea=polygonArea(room.vertices),otherCenter=centroid(room.vertices);
  const relative=Math.abs(area-otherArea)/Math.max(area,otherArea,EPS);
  return relative<=.05&&Math.hypot(center.x-otherCenter.x,center.y-otherCenter.y)<=tolerance*2;
 });
}

type SnapNode={x:number;y:number;count:number;edges:number[]};
type SegmentEdge={id:string;a:number;b:number;entity:RoomEntity};
function snapPoint(point:RoomPoint,nodes:SnapNode[],tolerance:number){
 let best=-1,bestDistance=Infinity;
 for(let i=0;i<nodes.length;i++){const distance=Math.hypot(nodes[i].x-point.x,nodes[i].y-point.y);if(distance<=tolerance&&distance<bestDistance){best=i;bestDistance=distance}}
 if(best>=0){const node=nodes[best],nextCount=node.count+1;node.x=(node.x*node.count+point.x)/nextCount;node.y=(node.y*node.count+point.y)/nextCount;node.count=nextCount;return best}
 nodes.push({x:point.x,y:point.y,count:1,edges:[]});return nodes.length-1;
}
function connectedEdgeGroups(edges:SegmentEdge[],nodes:SnapNode[]){
 const groups:SegmentEdge[][]=[];const visited=new Set<number>();
 for(let start=0;start<edges.length;start++){
  if(visited.has(start))continue;
  const queue=[start],indices:number[]=[];visited.add(start);
  while(queue.length){const edgeIndex=queue.shift()!;indices.push(edgeIndex);const edge=edges[edgeIndex];for(const nodeIndex of [edge.a,edge.b])for(const adjacent of nodes[nodeIndex].edges)if(!visited.has(adjacent)){visited.add(adjacent);queue.push(adjacent)}}
  groups.push(indices.map(index=>edges[index]));
 }
 return groups;
}
function traverseSimpleCycle(group:SegmentEdge[],nodes:SnapNode[]){
 const edgeSet=new Set(group.map(edge=>edge.id));
 const nodeIds=[...new Set(group.flatMap(edge=>[edge.a,edge.b]))];
 if(group.length<3||group.length>64||nodeIds.length!==group.length)return null;
 if(nodeIds.some(nodeId=>nodes[nodeId].edges.filter(edgeIndex=>edgeSet.has(String(edgeIndex))||group.some(edge=>edge===group[edgeIndex])).length!==2)){
  // The global edge indexes are not guaranteed to equal group indexes; perform exact degree below.
 }
 const degree=new Map<number,SegmentEdge[]>();for(const edge of group){for(const nodeId of [edge.a,edge.b]){const list=degree.get(nodeId)||[];list.push(edge);degree.set(nodeId,list)}}
 if([...degree.values()].some(list=>list.length!==2))return null;
 const start=[...degree.keys()].sort((a,b)=>nodes[a].x-nodes[b].x||nodes[a].y-nodes[b].y||a-b)[0];
 const vertices:RoomPoint[]=[];const used=new Set<string>();let current=start,previousEdge:string|null=null;
 for(let step=0;step<=group.length;step++){
  vertices.push({x:nodes[current].x,y:nodes[current].y});
  const options=(degree.get(current)||[]).filter(edge=>edge.id!==previousEdge&&!used.has(edge.id)).sort((a,b)=>a.id.localeCompare(b.id));
  if(!options.length){if(current===start&&used.size===group.length)break;return null}
  const edge=options[0];used.add(edge.id);previousEdge=edge.id;current=edge.a===current?edge.b:edge.a;
  if(current===start){if(used.size!==group.length)return null;break}
 }
 return used.size===group.length&&vertices.length>=3?vertices:null;
}

export function reconstructWallLoopCandidates(entities:RoomEntity[],tolerance=.12):RoomEntity[]{
 const segments=entities.filter(entity=>entity.kind==='wall-segment'&&Number.isFinite(entity.x)&&Number.isFinite(entity.y)&&Number.isFinite(entity.x2)&&Number.isFinite(entity.y2));
 const existingRooms=entities.filter(entity=>entity.kind==='room-boundary'&&entity.vertices?.length);
 const groups=new Map<string,RoomEntity[]>();for(const segment of segments){const frame=sourceFrame(segment),list=groups.get(frame)||[];list.push(segment);groups.set(frame,list)}
 const out:RoomEntity[]=[];
 for(const [frame,frameSegments] of [...groups.entries()].sort(([a],[b])=>a.localeCompare(b))){
  const nodes:SnapNode[]=[],edges:SegmentEdge[]=[];
  for(const segment of [...frameSegments].sort((a,b)=>a.id.localeCompare(b.id))){
   const a=snapPoint({x:segment.x,y:segment.y},nodes,tolerance),b=snapPoint({x:segment.x2!,y:segment.y2!},nodes,tolerance);if(a===b)continue;
   const edge:SegmentEdge={id:segment.id,a,b,entity:segment};const index=edges.length;edges.push(edge);nodes[a].edges.push(index);nodes[b].edges.push(index);
  }
  for(const component of connectedEdgeGroups(edges,nodes)){
   const vertices=traverseSimpleCycle(component,nodes);if(!vertices||hasSelfIntersection(vertices))continue;
   const area=polygonArea(vertices),perimeter=polygonPerimeter(vertices);if(area<.08||area>190||perimeter<EPS)continue;
   if(sameGeometry({vertices,frame},existingRooms,tolerance))continue;
   const center=centroid(vertices),sourceSegments=component.map(edge=>edge.entity).sort((a,b)=>a.id.localeCompare(b.id)),ids=sourceSegments.map(entity=>entity.id),averageConfidence=sourceSegments.reduce((sum,entity)=>sum+entity.confidence,0)/sourceSegments.length;
   const confidence=Number(Math.min(.9,averageConfidence*.75+.15).toFixed(3)),first=sourceSegments[0];
   out.push({id:`wall-loop-${stableHash(`${frame}:${ids.join('|')}`)}`,name:`Stitched wall loop · page ${Number(first.meta?.page||0)||'source'}`,kind:'vector-boundary-candidate',source:first.source,confidence,vertices,x:center.x,y:center.y,floor:first.floor,meta:{...(first.meta||{}),reconstruction:'wall-segment-loop',sourceSegmentIds:ids,snapTolerance:tolerance,reviewRequired:true,geometryValidated:false,automaticClosure:true}});
  }
 }
 return out.sort((a,b)=>sourceFrame(a).localeCompare(sourceFrame(b))||a.id.localeCompare(b.id));
}

export function proposeRooms(entities:RoomEntity[]):RoomProposal[]{
 const candidates=entities.filter(entity=>entity.kind==='vector-boundary-candidate'&&entity.vertices&&entity.vertices.length>=3);
 const labels=entities.filter(entity=>entity.kind==='room-label');
 const provisional=candidates.map(candidate=>{
  const vertices=candidate.vertices!;const area=polygonArea(vertices),perimeter=polygonPerimeter(vertices),compactness=perimeter>EPS?4*Math.PI*area/(perimeter*perimeter):0;
  const reasons:string[]=[];
  if(!vertices.every(point=>Number.isFinite(point.x)&&Number.isFinite(point.y)))reasons.push('Boundary contains non-finite coordinates.');
  if(area<.08)reasons.push('Boundary area is too small for room reconstruction.');
  if(area>190)reasons.push('Boundary area exceeds the sheet-space room review range.');
  if(perimeter<EPS)reasons.push('Boundary perimeter is degenerate.');
  if(compactness<.015)reasons.push('Boundary compactness is too low for automatic room proposal.');
  if(hasSelfIntersection(vertices))reasons.push('Boundary self-intersects.');
  const contained=labels.filter(label=>sourceFrame(label)===sourceFrame(candidate)&&pointInRoom({x:label.x,y:label.y},vertices));
  if(contained.length===0)reasons.push('No source-grounded room label is contained by this boundary.');
  if(contained.length>1)reasons.push('Multiple room labels are contained by this boundary.');
  const label=contained.length===1?contained[0]:null;
  const confidence=Math.max(0,Math.min(1,candidate.confidence*.5+(label?.confidence||0)*.32+Math.min(compactness/.55,1)*.13+(label?.name?.trim()?0.05:0)));
  return{candidateId:candidate.id,name:label?.name?.trim()||null,labelId:label?.id||null,confidence:Number(confidence.toFixed(3)),eligible:reasons.length===0&&confidence>=.7,reasons,area:Number(area.toFixed(6)),compactness:Number(compactness.toFixed(4)),reviewRequired:true as const,autoApply:false as const,geometryValidated:false as const};
 });
 const byLabel=new Map<string,RoomProposal[]>();for(const proposal of provisional){if(!proposal.labelId)continue;const list=byLabel.get(proposal.labelId)||[];list.push(proposal);byLabel.set(proposal.labelId,list)}
 for(const list of byLabel.values())if(list.length>1){list.sort((a,b)=>a.area-b.area);for(const duplicate of list.slice(1)){duplicate.eligible=false;duplicate.reasons.push('A smaller closed boundary contains the same room label; review nested/duplicate geometry.')}}
 return provisional.sort((a,b)=>Number(b.eligible)-Number(a.eligible)||b.confidence-a.confidence||a.area-b.area||a.candidateId.localeCompare(b.candidateId));
}
