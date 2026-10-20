export type OpenSymbolSegment={id?:string;page:number;x:number;y:number;x2:number;y2:number};
export type OpenSymbolFingerprint={id:string;legendEntryId:string;componentClass:string;sourcePage:number;segmentCount:number;size:number;aspect:number;angles:number[];lengths:number[];confidence:number;physicalTruth:false;reviewRequired:true};
export type OpenSymbolMatch={id:string;fingerprintId:string;legendEntryId:string;componentClass:string;page:number;x:number;y:number;confidence:number;physicalTruth:false;reviewRequired:true};

const length=(s:OpenSymbolSegment)=>Math.hypot(s.x2-s.x,s.y2-s.y);
const cell=(x:number,y:number,t=.04)=>`${Math.round(x/t)}:${Math.round(y/t)}`;
function components(input:OpenSymbolSegment[]){
 const segments=input.filter(s=>{const l=length(s);return l>.008&&l<1.5});
 const endpoint=new Map<string,number[]>();
 segments.forEach((s,i)=>{for(const p of [[s.x,s.y],[s.x2,s.y2]]){const k=cell(p[0],p[1]);endpoint.set(k,[...(endpoint.get(k)||[]),i])}});
 const remaining=new Set(segments.map((_,i)=>i),out:OpenSymbolSegment[][]=[];
 while(remaining.size){
  const seed=remaining.values().next().value as number;remaining.delete(seed);const group:number[]=[seed],queue=[seed];
  while(queue.length&&group.length<=24){
   const i=queue.shift()!,s=segments[i],keys=[cell(s.x,s.y),cell(s.x2,s.y2)];
   for(const k of keys)for(const j of endpoint.get(k)||[])if(remaining.has(j)){remaining.delete(j);group.push(j);queue.push(j)}
  }
  if(group.length>=2&&group.length<=24)out.push(group.map(i=>segments[i]));
 }
 return out;
}
function signature(group:OpenSymbolSegment[]){
 const xs=group.flatMap(s=>[s.x,s.x2]),ys=group.flatMap(s=>[s.y,s.y2]);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),w=maxX-minX,h=maxY-minY,size=Math.hypot(w,h);
 if(size<.02||size>1.6)return null;
 const lens=group.map(length),sum=lens.reduce((a,b)=>a+b,0)||1;
 const lengths=[...lens].sort((a,b)=>b-a).slice(0,8).map(v=>v/sum);
 const angles=Array.from({length:8},()=>0);
 group.forEach((s,i)=>{const a=(Math.atan2(s.y2-s.y,s.x2-s.x)+Math.PI)%Math.PI,b=Math.min(7,Math.floor(a/Math.PI*8));angles[b]+=lens[i]/sum});
 return{segmentCount:group.length,size,aspect:Math.min(w,h)/Math.max(w,h,1e-6),angles,lengths,center:{x:(minX+maxX)/2,y:(minY+maxY)/2}};
}
function cyclicDistance(a:number[],b:number[]){let best=Infinity;for(let shift=0;shift<a.length;shift++){let d=0;for(let i=0;i<a.length;i++)d+=Math.abs(a[i]-b[(i+shift)%b.length]);best=Math.min(best,d)}return best/2}
function vectorDistance(a:number[],b:number[]){let d=0;for(let i=0;i<Math.max(a.length,b.length);i++)d+=Math.abs((a[i]||0)-(b[i]||0));return d/2}
function score(fp:OpenSymbolFingerprint,s:NonNullable<ReturnType<typeof signature>>){
 const ratio=s.size/Math.max(fp.size,1e-6);if(ratio<.55||ratio>1.8)return 0;
 const count=1-Math.min(1,Math.abs(fp.segmentCount-s.segmentCount)/Math.max(fp.segmentCount,s.segmentCount));
 const aspect=1-Math.min(1,Math.abs(fp.aspect-s.aspect)/.6),angles=1-Math.min(1,cyclicDistance(fp.angles,s.angles)),lengths=1-Math.min(1,vectorDistance(fp.lengths,s.lengths));
 const size=1-Math.min(1,Math.abs(Math.log(ratio))/Math.log(1.8));
 return .18*count+.16*aspect+.30*angles+.22*lengths+.14*size;
}
export function buildOpenLegendFingerprints(args:{entries:Array<{id:string;page:number;componentHint:string|null;anchor:{x:number;y:number};confidence:number}>;segments:OpenSymbolSegment[]}){
 const out:OpenSymbolFingerprint[]=[];
 for(const entry of args.entries){
  if(!entry.componentHint)continue;
  const local=args.segments.filter(s=>s.page===entry.page&&entry.anchor.x-(s.x+s.x2)/2>=0&&entry.anchor.x-(s.x+s.x2)/2<2.6&&Math.abs(entry.anchor.y-(s.y+s.y2)/2)<.5);
  const ranked=components(local).map(g=>({g,s:signature(g)})).filter((x):x is {g:OpenSymbolSegment[];s:NonNullable<ReturnType<typeof signature>>}=>Boolean(x.s)).sort((a,b)=>Math.hypot(a.s.center.x-entry.anchor.x,a.s.center.y-entry.anchor.y)-Math.hypot(b.s.center.x-entry.anchor.x,b.s.center.y-entry.anchor.y));
  const best=ranked[0];if(!best)continue;
  out.push({id:`open-fp-${entry.id}`,legendEntryId:entry.id,componentClass:entry.componentHint,sourcePage:entry.page,segmentCount:best.s.segmentCount,size:best.s.size,aspect:best.s.aspect,angles:best.s.angles,lengths:best.s.lengths,confidence:Math.min(.84,entry.confidence),physicalTruth:false,reviewRequired:true});
 }
 return out;
}
export function matchOpenLegendFingerprints(args:{fingerprints:OpenSymbolFingerprint[];segments:OpenSymbolSegment[];legendPages:Set<number>;minScore?:number}){
 const out:OpenSymbolMatch[]=[],min=args.minScore??.88;
 for(const page of [...new Set(args.segments.map(s=>s.page).filter(p=>!args.legendPages.has(p)))]){
  for(const s of components(args.segments.filter(x=>x.page===page)).map(signature).filter((x):x is NonNullable<ReturnType<typeof signature>>=>Boolean(x))){
   const ranked=args.fingerprints.map(fp=>({fp,v:score(fp,s)})).sort((a,b)=>b.v-a.v),best=ranked[0],second=ranked[1];
   if(!best||best.v<min||(second&&second.fp.componentClass!==best.fp.componentClass&&best.v-second.v<.08))continue;
   out.push({id:`open-match-${page}-${out.length}`,fingerprintId:best.fp.id,legendEntryId:best.fp.legendEntryId,componentClass:best.fp.componentClass,page,x:s.center.x,y:s.center.y,confidence:Math.min(.9,best.v*best.fp.confidence),physicalTruth:false,reviewRequired:true});
  }
 }
 const dedup:OpenSymbolMatch[]=[];for(const m of out.sort((a,b)=>b.confidence-a.confidence)){if(!dedup.some(x=>x.page===m.page&&x.componentClass===m.componentClass&&Math.hypot(x.x-m.x,x.y-m.y)<.05))dedup.push(m)}return dedup;
}
