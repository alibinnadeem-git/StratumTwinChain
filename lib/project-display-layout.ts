type DisplayEntity={id:string;source:string;x:number;y:number;x2?:number;y2?:number;vertices?:{x:number;y:number}[];meta?:Record<string,unknown>};
export type DisplayOffset={x:number;y:number};

/** Review layout only: independent sheets stay separate; registered project coordinates stay assembled. */
export function projectDisplayLayout(entities:DisplayEntity[],enabled:boolean){
 const offsets=new Map<string,DisplayOffset>();
 if(!enabled)return{offsets,separatedSheets:0};
 const sheets=new Map<string,{ids:string[];minX:number;minY:number;maxX:number;maxY:number}>();
 let projectMaxX=-Infinity,projectMinY=Infinity;
 for(const e of entities){
  const page=Number(e.meta?.page),key=Number.isInteger(page)&&page>0&&!e.meta?.projectXYFrameId
   ?`${String(e.meta?.sourceSha256||e.source)}:${page}`:null;
  const points=[{x:e.x,y:e.y},...(Number.isFinite(e.x2)&&Number.isFinite(e.y2)?[{x:e.x2!,y:e.y2!}]:[]),...(e.vertices||[])].filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
  if(!points.length)continue;
  if(!key){for(const p of points){projectMaxX=Math.max(projectMaxX,p.x);projectMinY=Math.min(projectMinY,p.y)}continue}
  let group=sheets.get(key);
  if(!group){group={ids:[],minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};sheets.set(key,group)}
  group.ids.push(e.id);for(const p of points){group.minX=Math.min(group.minX,p.x);group.minY=Math.min(group.minY,p.y);group.maxX=Math.max(group.maxX,p.x);group.maxY=Math.max(group.maxY,p.y)}
 }
 if(sheets.size<=1&&!Number.isFinite(projectMaxX))return{offsets,separatedSheets:0};
 const groups=[...sheets.values()],columns=Math.ceil(Math.sqrt(groups.length));
 const cellWidth=Math.max(1,...groups.map(g=>g.maxX-g.minX))+4,cellHeight=Math.max(1,...groups.map(g=>g.maxY-g.minY))+4;
 const startX=Number.isFinite(projectMaxX)?projectMaxX+4:-columns*cellWidth/2;
 const startY=Number.isFinite(projectMinY)?projectMinY:-Math.ceil(groups.length/columns)*cellHeight/2;
 groups.forEach((group,i)=>{
  const offset={x:startX+(i%columns)*cellWidth-group.minX,y:startY+Math.floor(i/columns)*cellHeight-group.minY};
  for(const id of group.ids)offsets.set(id,offset);
 });
 return{offsets,separatedSheets:groups.length};
}

export function displayedEntity<T extends DisplayEntity>(entity:T,offset:DisplayOffset|undefined):T{
 if(!offset)return entity;
 return{...entity,x:entity.x+offset.x,y:entity.y+offset.y,
  ...(Number.isFinite(entity.x2)?{x2:entity.x2!+offset.x}:{}),...(Number.isFinite(entity.y2)?{y2:entity.y2!+offset.y}:{}),
  ...(entity.vertices?{vertices:entity.vertices.map(p=>({x:p.x+offset.x,y:p.y+offset.y}))}:{})};
}
