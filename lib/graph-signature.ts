// Cheap, stable structural signatures used for change detection, replacing full-graph
// JSON.stringify(a)===JSON.stringify(b) comparisons that froze the main thread on large
// graphs (two multi-megabyte string allocations per check, across many reactive effects).
//
// This folds an FNV-1a hash over the graph in a single pass without allocating a giant
// string. It recurses into objects so meaningful changes (projection output, coordination
// findings, room proposals, Z status) are detected, but skips a denylist of known-huge
// blobs — base64 models/rasters and deep parser-written evidence whose scalar summaries
// (counts, status) are already hashed as sibling fields. Review panels never edit those
// blobs, so skipping them cannot hide a human change from a compare-and-write.

const FNV_OFFSET=2166136261;

// Deep/heavy meta values excluded from hashing; their summaries live in scalar siblings.
const SKIP_KEYS=new Set([
 'embeddedGlb','embeddedRasterDataUrl','zConstraintGraph','zResolutionEvidence',
 'scaleValidationEvidence','geometryEvidence','geometryItems','planFrame','zEvidence',
]);

function fold(hash:number,value:string):number{
 let h=hash;
 for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}
 return h>>>0;
}

// Numbers (coordinates, mostly) are folded by their float64 bits: String(number) dominated the cost.
const numberView=new Float64Array(1),numberWords=new Uint32Array(numberView.buffer);
function foldNumber(hash:number,value:number):number{
 numberView[0]=value;
 let h=(hash^0x6e)>>>0;h=Math.imul(h,16777619);
 h^=numberWords[0];h=Math.imul(h,16777619);
 h^=numberWords[1];h=Math.imul(h,16777619);
 return h>>>0;
}

function foldUnknown(hash:number,value:unknown):number{
 if(value===null||value===undefined)return fold(hash,'\u0000');
 const type=typeof value;
 if(type==='number')return foldNumber(hash,value as number);
 if(type!=='object')return fold(hash,type[0]+String(value));
 if(Array.isArray(value)){
  let h=fold(hash,'['+value.length);
  for(const item of value)h=foldUnknown(h,item);
  return h;
 }
 let h=fold(hash,'{');
 for(const key of Object.keys(value as Record<string,unknown>).sort()){
  h=fold(h,key);
  h=SKIP_KEYS.has(key)?fold(h,'\u0001'):foldUnknown(h,(value as Record<string,unknown>)[key]);
 }
 return h;
}

export function entitiesSignature(entities:ReadonlyArray<Record<string,any>>|undefined|null):string{
 let h=FNV_OFFSET;
 const list=entities||[];
 h=fold(h,'n'+list.length);
 for(const e of list)h=foldUnknown(h,e);
 return h.toString(16);
}

// Covers every top-level field, not a hand-picked list: SpatialProjectionEngine uses this to
// detect that another panel wrote the graph (title-block confirmations, room proposals,
// alignment candidates, calibrations, ...) while a projection was running, so any field a
// panel can write must change the signature or that write is silently reverted.
export function graphSignature(graph:any):string{
 if(!graph||typeof graph!=='object')return '0';
 let h=fold(FNV_OFFSET,entitiesSignature(graph.entities));
 for(const key of Object.keys(graph).sort()){
  if(key==='entities')continue;
  h=fold(h,key);
  h=SKIP_KEYS.has(key)?fold(h,'\u0001'):foldUnknown(h,graph[key]);
 }
 return h.toString(16);
}
