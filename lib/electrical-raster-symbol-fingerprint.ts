export type RasterImage={width:number;height:number;gray:Uint8Array};
export type RasterBox={x0:number;y0:number;x1:number;y1:number};
export type RasterLegendEntry={id:string;componentClass:string;anchorX:number;anchorY:number;dirX?:number;dirY?:number;confidence:number};
export type RasterCandidate={
 id:string;page:number;box:RasterBox;centerX:number;centerY:number;width:number;height:number;
 density:number;aspect:number;grid:number[];confidence:number;
};
export type RasterFingerprint={
 id:string;legendEntryId:string;componentClass:string;sourcePage:number;grid:number[];
 aspect:number;density:number;confidence:number;physicalTruth:false;reviewRequired:true;
};
export type RasterSymbolMatch={
 id:string;page:number;componentClass:string;legendEntryId:string;fingerprintId:string;
 centerX:number;centerY:number;box:RasterBox;confidence:number;physicalTruth:false;reviewRequired:true;
};

const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,v));
const overlap=(a:RasterBox,b:RasterBox)=>{
 const x=Math.max(0,Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0));
 const y=Math.max(0,Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0));
 const area=x*y,den=Math.max(1,(a.x1-a.x0)*(a.y1-a.y0));
 return area/den;
};
export function rasterFromRgba(data:Uint8ClampedArray,width:number,height:number):RasterImage{
 const gray=new Uint8Array(width*height);
 for(let i=0;i<width*height;i++){
  const o=i*4;gray[i]=Math.round(.299*data[o]+.587*data[o+1]+.114*data[o+2]);
 }
 return{width,height,gray};
}
function otsuThreshold(image:RasterImage){
 const hist=new Array(256).fill(0);for(const v of image.gray)hist[v]++;
 const total=image.gray.length;let sum=0;for(let i=0;i<256;i++)sum+=i*hist[i];
 let sumB=0,wB=0,best=160,maxVar=-1;
 for(let t=24;t<246;t++){wB+=hist[t];if(!wB)continue;const wF=total-wB;if(!wF)break;sumB+=t*hist[t];const mB=sumB/wB,mF=(sum-sumB)/wF,v=wB*wF*(mB-mF)*(mB-mF);if(v>maxVar){maxVar=v;best=t}}
 return Math.min(210,Math.max(80,best));
}
function descriptor(image:RasterImage,box:RasterBox,gridSize=12){
 const w=Math.max(1,box.x1-box.x0),h=Math.max(1,box.y1-box.y0),threshold=otsuThreshold(image),grid=new Array(gridSize*gridSize).fill(0),counts=new Array(gridSize*gridSize).fill(0);let ink=0,total=0;
 for(let y=box.y0;y<box.y1;y++)for(let x=box.x0;x<box.x1;x++){
  const fg=image.gray[y*image.width+x]<threshold?1:0;ink+=fg;total++;
  const gx=Math.min(gridSize-1,Math.floor((x-box.x0)/w*gridSize)),gy=Math.min(gridSize-1,Math.floor((y-box.y0)/h*gridSize)),i=gy*gridSize+gx;
  grid[i]+=fg;counts[i]++;
 }
 for(let i=0;i<grid.length;i++)grid[i]=counts[i]?grid[i]/counts[i]:0;
 return{grid,density:total?ink/total:0,aspect:Math.min(w,h)/Math.max(w,h)};
}
export function detectRasterSymbolCandidates(args:{
 image:RasterImage;page:number;textBoxes?:RasterBox[];minPixels?:number;maxPixels?:number;
}):RasterCandidate[]{
 const {image,page}=args,threshold=otsuThreshold(image),minPixels=args.minPixels??8,maxPixels=args.maxPixels??2200;
 const maxDim=Math.max(image.width,image.height),maxW=Math.max(32,Math.round(maxDim*.035)),maxH=maxW,minW=3,minH=3;
 const visited=new Uint8Array(image.width*image.height),out:RasterCandidate[]=[];
 const idx=(x:number,y:number)=>y*image.width+x;
 const foreground=(x:number,y:number)=>image.gray[idx(x,y)]<threshold;
 for(let y=1;y<image.height-1;y++)for(let x=1;x<image.width-1;x++){
  const start=idx(x,y);if(visited[start]||!foreground(x,y))continue;
  const qx=[x],qy=[y];visited[start]=1;let q=0,count=0,x0=x,x1=x,y0=y,y1=y;
  while(q<qx.length&&count<=maxPixels){
   const cx=qx[q],cy=qy[q];q++;count++;x0=Math.min(x0,cx);x1=Math.max(x1,cx);y0=Math.min(y0,cy);y1=Math.max(y1,cy);
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const nx=cx+dx,ny=cy+dy;if(nx<1||ny<1||nx>=image.width-1||ny>=image.height-1)continue;const ni=idx(nx,ny);
    if(!visited[ni]&&foreground(nx,ny)){visited[ni]=1;qx.push(nx);qy.push(ny)}
   }
  }
  const width=x1-x0+1,height=y1-y0+1;if(count<minPixels||count>maxPixels||width<minW||height<minH||width>maxW||height>maxH)continue;
  const pad=Math.max(1,Math.round(Math.max(width,height)*.12)),box={x0:Math.max(0,x0-pad),y0:Math.max(0,y0-pad),x1:Math.min(image.width,x1+pad+1),y1:Math.min(image.height,y1+pad+1)};
  if((args.textBoxes||[]).some(t=>overlap(box,t)>.42))continue;
  const d=descriptor(image,box);if(d.density<.035||d.density>.72)continue;
  out.push({id:`raster-candidate-${page}-${out.length}`,page,box,centerX:(box.x0+box.x1)/2,centerY:(box.y0+box.y1)/2,width:box.x1-box.x0,height:box.y1-box.y0,density:d.density,aspect:d.aspect,grid:d.grid,confidence:.7});
 }
 return out;
}
function gridDistance(a:number[],b:number[]){
 const n=Math.round(Math.sqrt(a.length));
 const blur=(grid:number[])=>{
  const out=new Array(grid.length).fill(0);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
   let total=0,weight=0;
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=n||yy>=n)continue;
    const w=dx===0&&dy===0?4:(dx===0||dy===0?2:1);total+=(grid[yy*n+xx]||0)*w;weight+=w;
   }
   out[y*n+x]=weight?total/weight:0;
  }
  return out;
 };
 const aa=blur(a),variants=(grid:number[])=>{
  const out:number[][]=[];let cur=grid;
  for(let r=0;r<4;r++){
   out.push(blur(cur));const next=new Array(cur.length).fill(0);
   for(let y=0;y<n;y++)for(let x=0;x<n;x++)next[x*n+(n-1-y)]=cur[y*n+x];
   cur=next;
  }
  return out;
 };
 let best=Infinity;
 for(const v of variants(b))for(let sy=-1;sy<=1;sy++)for(let sx=-1;sx<=1;sx++){
  let total=0;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
   const xx=x+sx,yy=y+sy,target=xx>=0&&yy>=0&&xx<n&&yy<n?v[yy*n+xx]:0;
   total+=Math.abs(aa[y*n+x]-target);
  }
  best=Math.min(best,total/a.length);
 }
 return best;
}
function candidateSimilarity(fp:RasterFingerprint,c:RasterCandidate){
 const grid=1-Math.min(1,gridDistance(fp.grid,c.grid)/.36);
 const aspect=1-Math.min(1,Math.abs(fp.aspect-c.aspect)/.55);
 const density=1-Math.min(1,Math.abs(fp.density-c.density)/.4);
 return .68*grid+.17*aspect+.15*density;
}
export function buildRasterLegendFingerprints(args:{
 page:number;image:RasterImage;entries:RasterLegendEntry[];candidates:RasterCandidate[];
 pixelFromAnchor:(x:number,y:number)=>{x:number;y:number};
}):RasterFingerprint[]{
 const out:RasterFingerprint[]=[];
 for(const entry of args.entries){
  if(!entry.componentClass)continue;const anchor=args.pixelFromAnchor(entry.anchorX,entry.anchorY);
  const hasDirection=Number.isFinite(entry.dirX)&&Number.isFinite(entry.dirY)&&Math.hypot(Number(entry.dirX),Number(entry.dirY))>.1;
  const direction=hasDirection?(()=>{
   const next=args.pixelFromAnchor(entry.anchorX+Number(entry.dirX)*.5,entry.anchorY+Number(entry.dirY)*.5);
   const dx=next.x-anchor.x,dy=next.y-anchor.y,mag=Math.hypot(dx,dy)||1;return{x:dx/mag,y:dy/mag};
  })():null;
  const ranked=args.candidates.map(c=>{
   if(direction){
    const vx=c.centerX-anchor.x,vy=c.centerY-anchor.y,along=vx*direction.x+vy*direction.y,perp=Math.abs(vx*(-direction.y)+vy*direction.x);
    const maxAlong=Math.max(90,args.image.width*.13),maxPerp=Math.max(18,args.image.height*.025);
    return{c,eligible:along>=-maxAlong&&along<=8&&perp<=maxPerp,score:perp*2+Math.abs(along+Math.max(8,args.image.width*.012))};
   }
   const dx=anchor.x-c.centerX,dy=Math.abs(anchor.y-c.centerY),maxAlong=Math.max(90,args.image.width*.13),maxPerp=Math.max(18,args.image.height*.025);
   return{c,eligible:dx>=-8&&dx<=maxAlong&&dy<=maxPerp,score:dy*2+Math.max(0,dx)};
  }).filter(v=>v.eligible).sort((a,b)=>a.score-b.score);
  const best=ranked[0];if(!best)continue;
  if(ranked[1]&&Math.abs(ranked[1].score-best.score)<6)continue;
  out.push({id:`raster-fp-${entry.id}`,legendEntryId:entry.id,componentClass:entry.componentClass,sourcePage:args.page,grid:best.c.grid,aspect:best.c.aspect,density:best.c.density,confidence:Math.min(.82,entry.confidence,best.c.confidence),physicalTruth:false,reviewRequired:true});
 }
 return out;
}
export function matchRasterLegendFingerprints(args:{
 fingerprints:RasterFingerprint[];candidates:RasterCandidate[];minScore?:number;
}):RasterSymbolMatch[]{
 const minScore=args.minScore??.93,out:RasterSymbolMatch[]=[];
 for(const c of args.candidates){
  const ranked=args.fingerprints.map(fp=>({fp,score:candidateSimilarity(fp,c)})).sort((a,b)=>b.score-a.score),best=ranked[0],second=ranked[1];
  if(!best||best.score<minScore)continue;
  if(second&&second.fp.componentClass!==best.fp.componentClass&&best.score-second.score<.07)continue;
  out.push({id:`raster-symbol-${c.page}-${out.length}`,page:c.page,componentClass:best.fp.componentClass,legendEntryId:best.fp.legendEntryId,fingerprintId:best.fp.id,centerX:c.centerX,centerY:c.centerY,box:c.box,confidence:clamp(best.score*best.fp.confidence),physicalTruth:false,reviewRequired:true});
 }
 return out;
}
