import {sameSourceFrame} from './compiler-source';

// Shared compiled-graph primitives. These live outside the React component so the
// same post-parse assembly (room/zone assignment + logical link building) can run
// either on the main thread or inside workers/graph-assembly.worker.ts without drift.
export type Layer='L0'|'L1'|'L2'|'L3'|'L4';
export type XY={x:number;y:number};
export type GraphEntity={id:string;source:string;layer:Layer;kind:string;name:string;x:number;y:number;z?:number;x2?:number;y2?:number;z2?:number;rotation?:number;scale?:number;floor?:string;zone?:string;vertices?:XY[];confidence:number;meta?:Record<string,unknown>};
export type GraphLink={id:string;from:string;to:string;type:'SAME_TAG'|'DERIVED_ASSET'|'SOURCE_RELATION';confidence:number};

const cleanTag=(s:string)=>s.toUpperCase().replace(/[^A-Z0-9-]/g,'').replace(/^(PANEL|PNL|TRANSFORMER|XFMR|SWITCHBOARD|SWBD|SWITCHGEAR|SWGR|GENERATOR|GEN|ATS|UPS|EVSE|MCC|PDU|VFD|MDP|MDB|MSB|CB|MCCB|ACB)/,'');
const pointInPolygon=(p:XY,poly:XY[])=>{let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];const hit=((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/((b.y-a.y)||1e-9)+a.x);if(hit)inside=!inside}return inside};

export function assignZones(entities:GraphEntity[]){const rooms=entities.filter(e=>e.kind==='room-boundary'&&e.vertices?.length);const labels=entities.filter(e=>e.kind==='room-label');const namedRooms=rooms.map(r=>{const inside=labels.filter(l=>sameSourceFrame(l,r)&&pointInPolygon({x:l.x,y:l.y},r.vertices!));if(!inside.length)return r;inside.sort((a,b)=>b.confidence-a.confidence);return{...r,name:inside[0].name,zone:inside[0].name}});const replacements=new Map(namedRooms.map(r=>[r.id,r]));return entities.map(original=>{const e=replacements.get(original.id)||original;if(e.meta?.nonSpatial===true||e.layer==='L1'||e.zone)return e;const containing=namedRooms.filter(r=>sameSourceFrame(r,e)&&r.vertices&&pointInPolygon({x:e.x,y:e.y},r.vertices));if(containing.length)return{...e,zone:containing[0].name};const sameLabels=labels.filter(r=>sameSourceFrame(r,e));let best:GraphEntity|undefined,dist=Infinity;for(const r of sameLabels){const d=Math.hypot(e.x-r.x,e.y-r.y);if(d<dist){dist=d;best=r}}return best&&dist<3?{...e,zone:best.name}:e})}

export function buildLinks(entities:GraphEntity[]){const links:GraphLink[]=[];const seen=new Map<string,GraphEntity[]>();for(const e of entities.filter(x=>x.layer==='L2'||x.layer==='L3')){const key=cleanTag(e.name);if(key.length<2)continue;const arr=seen.get(key)||[];arr.push(e);seen.set(key,arr)}for(const [key,arr] of seen){if(arr.length<2)continue;for(let i=1;i<arr.length;i++)links.push({id:`tag-${key}-${i}`,from:arr[0].id,to:arr[i].id,type:'SAME_TAG',confidence:.82})}for(const e of entities.filter(x=>x.layer==='L4')){const from=String(e.meta?.derivedFrom||'');if(from)links.push({id:`asset-${e.id}`,from,to:e.id,type:'DERIVED_ASSET',confidence:.99})}return links}

// One call so the worker and the synchronous fallback stay identical.
export function assembleGraph(entities:GraphEntity[]):{zoned:GraphEntity[];links:GraphLink[]}{
 const zoned=assignZones(entities);
 const links=buildLinks(zoned);
 return{zoned,links};
}
