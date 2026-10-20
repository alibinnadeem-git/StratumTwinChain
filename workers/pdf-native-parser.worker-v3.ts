import './pdf-native-parser.worker-v2.ts';
import {buildOpenLegendFingerprints,matchOpenLegendFingerprints,type OpenSymbolSegment} from '../lib/electrical-open-symbol-fingerprint';

const baseHandler=(globalThis as any).onmessage;
const MAX_SECOND_PASS_BYTES=32*1024*1024;

async function legendSegments(buffer:ArrayBuffer,pages:Set<number>):Promise<OpenSymbolSegment[]>{
 if(!pages.size)return[];
 const pdfjs:any=await import('pdfjs-dist/legacy/build/pdf.mjs');
 try{pdfjs.GlobalWorkerOptions.workerSrc='/pdfjs/pdf.worker.min.mjs'}catch{}
 const doc=await pdfjs.getDocument({data:new Uint8Array(buffer),wasmUrl:'/pdfjs/wasm/'}).promise;
 const out:OpenSymbolSegment[]=[];
 try{
  for(const pageNumber of [...pages].sort((a,b)=>a-b)){
   if(pageNumber<1||pageNumber>doc.numPages)continue;
   const page=await doc.getPage(pageNumber),viewport=page.getViewport({scale:1}),ops=await page.getOperatorList();
   let matrix=[1,0,0,1,0,0],stack:number[][]=[],current:{x:number;y:number}|null=null;
   const transform=(b:number[])=>{const a=matrix;matrix=[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]]};
   const point=(x:number,y:number)=>{const p=viewport.convertToViewportPoint(matrix[0]*x+matrix[2]*y+matrix[4],matrix[1]*x+matrix[3]*y+matrix[5]);return{x:(p[0]-viewport.width/2)*20/Math.max(viewport.width,viewport.height,1),y:(viewport.height/2-p[1])*20/Math.max(viewport.width,viewport.height,1)}};
   const add=(x:number,y:number,connect=true)=>{const next=point(x,y);if(connect&&current&&Math.hypot(next.x-current.x,next.y-current.y)>.008)out.push({page:pageNumber,x:current.x,y:current.y,x2:next.x,y2:next.y});current=next};
   for(let k=0;k<(ops.fnArray||[]).length;k++){
    const fn=ops.fnArray[k],a=ops.argsArray?.[k]||[];
    if(fn===pdfjs.OPS.save)stack.push([...matrix]);
    else if(fn===pdfjs.OPS.restore)matrix=stack.pop()||[1,0,0,1,0,0];
    else if(fn===pdfjs.OPS.transform)transform(a.map(Number));
    else if(fn===pdfjs.OPS.paintFormXObjectBegin){stack.push([...matrix]);if(a[0])transform(Array.from(a[0] as ArrayLike<number>))}
    else if(fn===pdfjs.OPS.paintFormXObjectEnd)matrix=stack.pop()||[1,0,0,1,0,0];
    else if(fn===pdfjs.OPS.moveTo){current=null;add(Number(a[0]),Number(a[1]),false)}
    else if(fn===pdfjs.OPS.lineTo)add(Number(a[0]),Number(a[1]));
    else if(fn===pdfjs.OPS.rectangle){const [x,y,w,h]=a.map(Number);current=null;add(x,y,false);add(x+w,y);add(x+w,y+h);add(x,y+h);add(x,y)}
    else if(fn===pdfjs.OPS.constructPath){
     for(const command of (a[1]||[])){const c=Array.from(command as ArrayLike<number>).map(Number);for(let j=0;j<c.length;){const code=c[j++];if(code===0){current=null;add(c[j++],c[j++],false)}else if(code===1)add(c[j++],c[j++]);else if(code===2){const x1=c[j++],y1=c[j++],x2=c[j++],y2=c[j++],x=c[j++],y=c[j++];add((x1+x2+x)/3,(y1+y2+y)/3);add(x,y)}else if(code===3){const x1=c[j++],y1=c[j++],x=c[j++],y=c[j++];add((x1+x)/2,(y1+y)/2);add(x,y)}else if(code===4){current=null}else break}}
    }
   }
   page.cleanup();
  }
 }finally{await doc.destroy()}
 return out;
}

async function enrichResult(message:any,buffer:ArrayBuffer|null){
 if(!buffer||message?.type!=='result'||!Array.isArray(message?.result?.entities))return message;
 const entities:any[]=message.result.entities;
 const legendEntries=entities.filter(e=>e.kind==='electrical-legend-entry').map(e=>e.meta?.legendEntry).filter(Boolean);
 if(!legendEntries.length)return message;
 const pages=new Set<number>(legendEntries.map((e:any)=>Number(e.page)).filter(Boolean));
 const sourceSegments=await legendSegments(buffer,pages);
 const planLines=entities.filter(e=>e.kind==='line'&&Number.isFinite(e.x2)&&Number.isFinite(e.y2)).map(e=>({page:Number(e.meta?.page||0),x:e.x,y:e.y,x2:e.x2,y2:e.y2,id:e.id})).filter(e=>e.page>0);
 const fingerprints=buildOpenLegendFingerprints({entries:legendEntries,segments:sourceSegments});
 const matches=matchOpenLegendFingerprints({fingerprints,segments:planLines,legendPages:pages});
 const source=String(entities[0]?.source||'PDF');
 for(const fp of fingerprints)entities.push({id:`pdf-${fp.id}`,source,layer:'L0',kind:'electrical-legend-open-symbol-fingerprint',name:`${fp.componentClass} · legend open-symbol fingerprint`,x:0,y:0,z:0,floor:'UNRESOLVED',confidence:fp.confidence,meta:{page:fp.sourcePage,nonSpatial:true,sourceType:'ELECTRICAL_LEGEND_OPEN_STROKE_FINGERPRINT',legendOpenSymbolFingerprint:fp,physicalTruth:false,reviewRequired:true,spatialPlacementAuthority:'NON_SPATIAL_LEGEND_OPEN_STROKE_FINGERPRINT'}});
 for(const match of matches){
  const nearby=entities.filter(e=>e.kind==='line'&&Number(e.meta?.page||0)===match.page).sort((a,b)=>Math.hypot((a.x+a.x2)/2-match.x,(a.y+a.y2)/2-match.y)-Math.hypot((b.x+b.x2)/2-match.x,(b.y+b.y2)/2-match.y))[0];
  entities.push({id:`pdf-${match.id}`,source,layer:'L2',kind:'legend-open-symbol-match-candidate',name:`${match.componentClass} · project legend open-symbol match`,x:match.x,y:match.y,z:0,floor:nearby?.floor||'UNRESOLVED',confidence:match.confidence,meta:{page:match.page,nonSldPlan:true,planType:nearby?.meta?.planType||'PLAN_VIEW_UNCLASSIFIED',planDiscipline:nearby?.meta?.planDiscipline||'Electrical',planFrameId:nearby?.meta?.planFrameId||null,planFrameFloor:nearby?.meta?.planFrameFloor||null,electricalComponentHint:match.componentClass,legendOpenSymbolMatch:match,legendBacked:true,symbolAnchorStatus:'RESOLVED_REVIEW_CANDIDATE',symbolAnchorAuthority:'PROJECT_LEGEND_OPEN_STROKE_FINGERPRINT',spatialPlacementAuthority:'PROJECT_LEGEND_OPEN_STROKE_MATCH',physicalTruth:false,reviewRequired:true,elevationKnown:false,physicalElevationKnown:false,registrationState:'CANDIDATE'}});
 }
 message.result.summary+=` · ${fingerprints.length} open legend fingerprint(s) · ${matches.length} open symbol match candidate(s)`;
 return message;
}

(globalThis as any).onmessage=async(event:any)=>{
 const originalPost=(globalThis as any).postMessage.bind(globalThis);
 const sourceBuffer=event?.data?.buffer instanceof ArrayBuffer&&event.data.buffer.byteLength<=MAX_SECOND_PASS_BYTES?event.data.buffer.slice(0):null;
 let pending:Promise<void>|null=null;
 (globalThis as any).postMessage=(message:any)=>{
  if(message?.type==='result'&&sourceBuffer){
   pending=enrichResult(message,sourceBuffer).then(originalPost).catch(()=>originalPost(message));
  }else originalPost(message);
 };
 try{await baseHandler(event);if(pending)await pending}finally{(globalThis as any).postMessage=originalPost}
};
