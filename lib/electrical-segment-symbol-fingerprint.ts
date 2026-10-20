export type Segment={x:number;y:number;x2:number;y2:number;page:number};
export type SegmentFingerprint={
 id:string;legendEntryId:string;componentClass:string;sourcePage:number;segmentCount:number;aspect:number;
 degreeSignature:number[];lengthSignature:number[];angleHistogram:number[];centroid:{x:number;y:number};
 confidence:number;reviewRequired:true;physicalTruth:false;
};
export type SegmentSymbolMatch={
 id:string;fingerprintId:string;legendEntryId:string;componentClass:string;page:number;x:number;y:number;
 confidence:number;reviewRequired:true;physicalTruth:false;
};

type Cluster={page:number;segments:Segment[];centroid:{x:number;y:number};width:number;height:number};
const d=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
const segLen=(s:Segment)=>Math.hypot(s.x2-s.x,s.y2-s.y);

function clusterSegments(segments:Segment[],tolerance=.045):Cluster[]{
 const usable=segments.filter(s=>segLen(s)>=.015&&segLen(s)<=.75);
 const byPage=new Map<number,Segment[]>();
 for(const s of usable)byPage.set(s.page,[...(byPage.get(s.page)||[]),s]);
 const out:Cluster[]=[];
 const cell=tolerance;
 const key=(x:number,y:number)=>`${Math.floor(x/cell)}:${Math.floor(y/cell)}`;
 for(const [page,pageSegs] of byPage){
  const endpointGrid=new Map<string,Set<number>>();
  const addEndpoint=(index:number,p:{x:number;y:number})=>{
   const k=key(p.x,p.y);let bucket=endpointGrid.get(k);if(!bucket){bucket=new Set<number>();endpointGrid.set(k,bucket)}bucket.add(index);
  };
  pageSegs.forEach((seg,index)=>{addEndpoint(index,{x:seg.x,y:seg.y});addEndpoint(index,{x:seg.x2,y:seg.y2})});
  const neighbors=(p:{x:number;y:number})=>{
   const gx=Math.floor(p.x/cell),gy=Math.floor(p.y/cell),ids=new Set<number>();
   for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const id of endpointGrid.get(`${gx+dx}:${gy+dy}`)||[])ids.add(id);
   return ids;
  };
  const used=new Set<number>();
  for(let seed=0;seed<pageSegs.length;seed++){
   if(used.has(seed))continue;
   const queue=[seed],indices:number[]=[];used.add(seed);
   while(queue.length&&indices.length<30){
    const i=queue.shift()!;indices.push(i);const a=pageSegs[i],endsA=[{x:a.x,y:a.y},{x:a.x2,y:a.y2}];
    const candidateIds=new Set<number>();for(const p of endsA)for(const id of neighbors(p))candidateIds.add(id);
    for(const j of candidateIds){
     if(used.has(j)||j===i)continue;const b=pageSegs[j],endsB=[{x:b.x,y:b.y},{x:b.x2,y:b.y2}];
     if(endsA.some(p=>endsB.some(q=>d(p,q)<=tolerance))){used.add(j);queue.push(j)}
    }
   }
   const ss=indices.map(i=>pageSegs[i]);
   if(ss.length<2||ss.length>24)continue;
   const points=ss.flatMap(seg=>[{x:seg.x,y:seg.y},{x:seg.x2,y:seg.y2}]),xs=points.map(p=>p.x),ys=points.map(p=>p.y);
   const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),width=maxX-minX,height=maxY-minY;
   if(width<.02||height<.02||width>1.4||height>1.4)continue;
   out.push({page,segments:ss,centroid:{x:(minX+maxX)/2,y:(minY+maxY)/2},width,height});
  }
 }
 return out;
}
function metrics(cluster:Cluster){
 const lengths=cluster.segments.map(segLen),total=lengths.reduce((a,b)=>a+b,0)||1;
 const lengthSignature=[...lengths].sort((a,b)=>b-a).slice(0,10).map(v=>v/total);
 const angleHistogram=Array.from({length:8},()=>0);
 for(const s of cluster.segments){
  const angle=(Math.atan2(s.y2-s.y,s.x2-s.x)+Math.PI)%(Math.PI);
  const bin=Math.min(7,Math.floor(angle/Math.PI*8));angleHistogram[bin]+=segLen(s)/total;
 }
 const nodes:{x:number;y:number;degree:number}[]=[];
 const findNode=(p:{x:number;y:number})=>nodes.find(n=>d(n,p)<=.045);
 for(const s of cluster.segments)for(const p of [{x:s.x,y:s.y},{x:s.x2,y:s.y2}]){
  const node=findNode(p);if(node)node.degree++;else nodes.push({...p,degree:1});
 }
 const degreeSignature=nodes.map(n=>n.degree).sort((a,b)=>b-a).slice(0,16);
 return{segmentCount:cluster.segments.length,aspect:Math.min(cluster.width,cluster.height)/Math.max(cluster.width,cluster.height),degreeSignature,lengthSignature,angleHistogram};
}
function arrDistance(a:number[],b:number[]){
 const n=Math.max(a.length,b.length);if(!n)return 0;let total=0;
 for(let i=0;i<n;i++)total+=Math.abs((a[i]||0)-(b[i]||0));
 return total/n;
}
function circularDistance(a:number[],b:number[]){
 let best=Infinity;
 for(let shift=0;shift<a.length;shift++){
  let total=0;for(let i=0;i<a.length;i++)total+=Math.abs((a[i]||0)-(b[(i+shift)%b.length]||0));
  best=Math.min(best,total/a.length);
 }
 return best;
}
function similarity(fp:SegmentFingerprint,c:Cluster){
 const m=metrics(c);
 const countScore=1-Math.min(1,Math.abs(fp.segmentCount-m.segmentCount)/Math.max(fp.segmentCount,m.segmentCount,2));
 const aspectScore=1-Math.min(1,Math.abs(fp.aspect-m.aspect)/.55);
 const degreeScore=1-Math.min(1,arrDistance(fp.degreeSignature,m.degreeSignature)/2);
 const lengthScore=1-Math.min(1,arrDistance(fp.lengthSignature,m.lengthSignature)/.22);
 const angleScore=1-Math.min(1,circularDistance(fp.angleHistogram,m.angleHistogram)/.22);
 return .24*countScore+.14*aspectScore+.22*degreeScore+.18*lengthScore+.22*angleScore;
}

export function buildLegendSegmentFingerprints(args:{
 entries:Array<{id:string;page:number;componentHint:string|null;anchor:{x:number;y:number};textDirection?:{x:number;y:number};textSpan?:number;confidence:number}>;
 segments:Segment[];
}):SegmentFingerprint[]{
 const clusters=clusterSegments(args.segments),out:SegmentFingerprint[]=[];
 for(const entry of args.entries){
  if(!entry.componentHint)continue;
  const dir=entry.textDirection,mag=dir?Math.hypot(dir.x,dir.y):0,unit=dir&&mag>.1?{x:dir.x/mag,y:dir.y/mag}:null;
  const candidates=clusters.filter(c=>c.page===entry.page).map(c=>{
   if(unit){
    const vx=c.centroid.x-entry.anchor.x,vy=c.centroid.y-entry.anchor.y;
    const along=vx*unit.x+vy*unit.y,perp=Math.abs(vx*(-unit.y)+vy*unit.x);
    return{c,eligible:along>=-.95&&along<=.2&&perp<=.48,score:perp*2+Math.abs(along+.14)};
   }
   const dx=entry.anchor.x-c.centroid.x,dy=Math.abs(entry.anchor.y-c.centroid.y);
   return{c,eligible:dx>=-.2&&dx<=2.8&&dy<=.55,score:dy*2+dx};
  }).filter(x=>x.eligible).sort((a,b)=>a.score-b.score);
  const best=candidates[0];if(!best)continue;
  if(candidates[1]&&Math.abs(candidates[1].score-best.score)<.1)continue;
  const m=metrics(best.c);
  out.push({id:`legend-segment-fp-${entry.id}`,legendEntryId:entry.id,componentClass:entry.componentHint,sourcePage:entry.page,
   segmentCount:m.segmentCount,aspect:m.aspect,degreeSignature:m.degreeSignature,lengthSignature:m.lengthSignature,
   angleHistogram:m.angleHistogram,centroid:best.c.centroid,confidence:Math.min(entry.confidence,.88),reviewRequired:true,physicalTruth:false});
 }
 return out;
}

export function matchLegendSegmentFingerprints(args:{
 fingerprints:SegmentFingerprint[];segments:Segment[];legendPages:Set<number>;planPages:Set<number>;minScore?:number;
}):SegmentSymbolMatch[]{
 const minScore=args.minScore??.86,clusters=clusterSegments(args.segments).filter(c=>args.planPages.has(c.page)&&!args.legendPages.has(c.page)),out:SegmentSymbolMatch[]=[];
 for(const c of clusters){
  const ranked=args.fingerprints.map(fp=>({fp,score:similarity(fp,c)})).sort((a,b)=>b.score-a.score);
  const best=ranked[0],second=ranked[1];if(!best||best.score<minScore)continue;
  if(second&&second.fp.componentClass!==best.fp.componentClass&&best.score-second.score<.09)continue;
  out.push({id:`segment-symbol-match-${c.page}-${out.length}`,fingerprintId:best.fp.id,legendEntryId:best.fp.legendEntryId,
   componentClass:best.fp.componentClass,page:c.page,x:c.centroid.x,y:c.centroid.y,confidence:Math.min(.94,best.score*best.fp.confidence),
   reviewRequired:true,physicalTruth:false});
 }
 const deduped:SegmentSymbolMatch[]=[];
 for(const item of out.sort((a,b)=>b.confidence-a.confidence)){
  if(deduped.some(x=>x.page===item.page&&x.componentClass===item.componentClass&&Math.hypot(x.x-item.x,x.y-item.y)<.06))continue;
  deduped.push(item);
 }
 return deduped;
}
