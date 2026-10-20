export type SymbolPoint={x:number;y:number};
export type SymbolPolygon={id?:string;page:number;vertices:SymbolPoint[];confidence:number;planFrameId?:string|null};

export type SymbolFingerprint={
 id:string;
 sourcePage:number;
 legendEntryId:string;
 componentClass:string;
 centroid:SymbolPoint;
 vertexCount:number;
 aspect:number;
 compactness:number;
 radial:number[];
 confidence:number;
 reviewRequired:true;
 physicalTruth:false;
};

export type SymbolMatch={
 id:string;
 fingerprintId:string;
 legendEntryId:string;
 componentClass:string;
 page:number;
 x:number;y:number;
 planFrameId:string|null;
 confidence:number;
 polygonId:string|null;
 reviewRequired:true;
 physicalTruth:false;
};

const dist=(a:SymbolPoint,b:SymbolPoint)=>Math.hypot(a.x-b.x,a.y-b.y);
const cleanVertices=(vertices:SymbolPoint[])=>{
 const out=vertices.filter((p,i,a)=>i===0||dist(p,a[i-1])>1e-5);
 if(out.length>2&&dist(out[0],out[out.length-1])<1e-5)out.pop();
 return out;
};
function metrics(polygon:SymbolPolygon){
 const v=cleanVertices(polygon.vertices);if(v.length<3)return null;
 let twice=0,cx=0,cy=0,perimeter=0;
 for(let i=0;i<v.length;i++){
  const a=v[i],b=v[(i+1)%v.length],cross=a.x*b.y-b.x*a.y;
  twice+=cross;cx+=(a.x+b.x)*cross;cy+=(a.y+b.y)*cross;perimeter+=dist(a,b);
 }
 const signed=twice/2,area=Math.abs(signed);if(area<1e-6||perimeter<1e-5)return null;
 const centroid={x:cx/(3*twice),y:cy/(3*twice)};
 const xs=v.map(p=>p.x),ys=v.map(p=>p.y),width=Math.max(...xs)-Math.min(...xs),height=Math.max(...ys)-Math.min(...ys);
 if(width<.015||height<.015||width>2.2||height>2.2)return null;
 const aspect=Math.min(width,height)/Math.max(width,height);
 const compactness=Math.max(0,Math.min(1,4*Math.PI*area/(perimeter*perimeter)));
 const radii=v.map(p=>dist(p,centroid)),maxR=Math.max(...radii)||1;
 const bins=8,radial=Array.from({length:bins},()=>0),counts=Array.from({length:bins},()=>0);
 for(let i=0;i<v.length;i++){
  const p=v[i],angle=(Math.atan2(p.y-centroid.y,p.x-centroid.x)+Math.PI*2)%(Math.PI*2),bin=Math.min(bins-1,Math.floor(angle/(Math.PI*2)*bins));
  radial[bin]+=radii[i]/maxR;counts[bin]++;
 }
 for(let i=0;i<bins;i++)radial[i]=counts[i]?radial[i]/counts[i]:0;
 return{centroid,vertexCount:v.length,aspect,compactness,radial,area,width,height};
}
function radialDistance(a:number[],b:number[]){
 let best=Infinity;
 for(let shift=0;shift<a.length;shift++){
  let total=0;
  for(let i=0;i<a.length;i++)total+=Math.abs(a[i]-b[(i+shift)%b.length]);
  best=Math.min(best,total/a.length);
 }
 return best;
}
function similarity(fp:SymbolFingerprint,m:NonNullable<ReturnType<typeof metrics>>){
 const vertexScore=1-Math.min(1,Math.abs(fp.vertexCount-m.vertexCount)/Math.max(fp.vertexCount,m.vertexCount,4));
 const aspectScore=1-Math.min(1,Math.abs(fp.aspect-m.aspect)/.55);
 const compactScore=1-Math.min(1,Math.abs(fp.compactness-m.compactness)/.6);
 const radialScore=1-Math.min(1,radialDistance(fp.radial,m.radial)/.5);
 return .22*vertexScore+.24*aspectScore+.18*compactScore+.36*radialScore;
}

export function buildLegendSymbolFingerprints(args:{
 entries:Array<{id:string;page:number;componentHint:string|null;anchor:{x:number;y:number};confidence:number}>;
 polygons:SymbolPolygon[];
}):SymbolFingerprint[]{
 const out:SymbolFingerprint[]=[];
 for(const entry of args.entries){
  if(!entry.componentHint)continue;
  const candidates=args.polygons.filter(p=>p.page===entry.page).map(p=>({p,m:metrics(p)}))
   .filter((x):x is {p:SymbolPolygon;m:NonNullable<ReturnType<typeof metrics>>}=>Boolean(x.m))
   // Project legends conventionally place the symbol immediately left of its text/abbreviation.
   .map(x=>({...x,dx:entry.anchor.x-x.m.centroid.x,dy:Math.abs(entry.anchor.y-x.m.centroid.y)}))
   .filter(x=>x.dx>=-.25&&x.dx<=2.8&&x.dy<=.45)
   .sort((a,b)=>(a.dy*2+a.dx)-(b.dy*2+b.dx));
  const best=candidates[0];if(!best)continue;
  const ambiguous=candidates[1]&&Math.abs((candidates[1].dy*2+candidates[1].dx)-(best.dy*2+best.dx))<.12;
  if(ambiguous)continue;
  out.push({
   id:`legend-fingerprint-${entry.id}`,sourcePage:entry.page,legendEntryId:entry.id,componentClass:entry.componentHint,
   centroid:best.m.centroid,vertexCount:best.m.vertexCount,aspect:best.m.aspect,compactness:best.m.compactness,
   radial:best.m.radial,confidence:Math.min(entry.confidence,best.p.confidence,.9),reviewRequired:true,physicalTruth:false
  });
 }
 return [...new Map(out.map(fp=>[fp.componentClass+'|'+fp.vertexCount+'|'+fp.aspect.toFixed(2)+'|'+fp.compactness.toFixed(2),fp])).values()];
}

export function matchLegendSymbolFingerprints(args:{
 fingerprints:SymbolFingerprint[];
 polygons:SymbolPolygon[];
 legendPages:Set<number>;
 frameAt?:(page:number,x:number,y:number)=>{id?:string|null}|null;
 minScore?:number;
}):SymbolMatch[]{
 const minScore=args.minScore??.84,out:SymbolMatch[]=[];
 const prepared=args.polygons.filter(p=>!args.legendPages.has(p.page)).map(p=>({p,m:metrics(p)}))
  .filter((x):x is {p:SymbolPolygon;m:NonNullable<ReturnType<typeof metrics>>}=>Boolean(x.m));
 for(const candidate of prepared){
  const ranked=args.fingerprints.map(fp=>({fp,score:similarity(fp,candidate.m)})).sort((a,b)=>b.score-a.score);
  const best=ranked[0],second=ranked[1];if(!best||best.score<minScore)continue;
  // Require class-separation so visually common rectangles/circles do not explode takeoff counts.
  if(second&&second.fp.componentClass!==best.fp.componentClass&&best.score-second.score<.08)continue;
  const frame=args.frameAt?.(candidate.p.page,candidate.m.centroid.x,candidate.m.centroid.y)||null;
  out.push({
   id:`symbol-match-${candidate.p.page}-${out.length}`,fingerprintId:best.fp.id,legendEntryId:best.fp.legendEntryId,
   componentClass:best.fp.componentClass,page:candidate.p.page,x:candidate.m.centroid.x,y:candidate.m.centroid.y,
   planFrameId:frame?.id||candidate.p.planFrameId||null,polygonId:candidate.p.id||null,
   confidence:Math.min(.96,best.score*best.fp.confidence),reviewRequired:true,physicalTruth:false
  });
 }
 // Deduplicate nearly identical polygons from PDF stroke/fill repetitions.
 const deduped:SymbolMatch[]=[];
 for(const item of out.sort((a,b)=>b.confidence-a.confidence)){
  if(deduped.some(x=>x.page===item.page&&x.componentClass===item.componentClass&&Math.hypot(x.x-item.x,x.y-item.y)<.04))continue;
  deduped.push(item);
 }
 return deduped;
}
