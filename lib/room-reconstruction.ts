export type RoomPoint={x:number;y:number};
export type RoomEntity={id:string;name:string;kind:string;source:string;confidence:number;vertices?:RoomPoint[];x:number;y:number;meta?:Record<string,unknown>};
export type RoomProposal={candidateId:string;name:string|null;labelId:string|null;confidence:number;eligible:boolean;reasons:string[];area:number;compactness:number;reviewRequired:true;autoApply:false;geometryValidated:false};

const EPS=1e-8;
const sourceFrame=(entity:RoomEntity)=>`${String(entity.meta?.sourceSha256||entity.source).toLowerCase()}:${Number(entity.meta?.page||0)}`;
export function polygonArea(vertices:RoomPoint[]){let twice=0;for(let i=0;i<vertices.length;i++){const a=vertices[i],b=vertices[(i+1)%vertices.length];twice+=a.x*b.y-b.x*a.y}return Math.abs(twice)/2}
export function polygonPerimeter(vertices:RoomPoint[]){let total=0;for(let i=0;i<vertices.length;i++){const a=vertices[i],b=vertices[(i+1)%vertices.length];total+=Math.hypot(b.x-a.x,b.y-a.y)}return total}
export function pointInRoom(point:RoomPoint,vertices:RoomPoint[]){let inside=false;for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){const a=vertices[i],b=vertices[j];if(((a.y>point.y)!==(b.y>point.y))&&(point.x<(b.x-a.x)*(point.y-a.y)/((b.y-a.y)||EPS)+a.x))inside=!inside}return inside}
function orientation(a:RoomPoint,b:RoomPoint,c:RoomPoint){const value=(b.y-a.y)*(c.x-b.x)-(b.x-a.x)*(c.y-b.y);return Math.abs(value)<EPS?0:value>0?1:2}
function intersects(a:RoomPoint,b:RoomPoint,c:RoomPoint,d:RoomPoint){const o1=orientation(a,b,c),o2=orientation(a,b,d),o3=orientation(c,d,a),o4=orientation(c,d,b);return o1!==o2&&o3!==o4}
export function hasSelfIntersection(vertices:RoomPoint[]){const count=vertices.length;for(let i=0;i<count;i++){const a=vertices[i],b=vertices[(i+1)%count];for(let j=i+1;j<count;j++){if(Math.abs(i-j)<=1||(i===0&&j===count-1))continue;const c=vertices[j],d=vertices[(j+1)%count];if(intersects(a,b,c,d))return true}}return false}

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
