'use client';

import {useRouter} from 'next/navigation';
import PlanAnnotations from './PlanAnnotations';
import SheetReview from './SheetReview';
import SpatialPortableRecovery from './SpatialPortableRecovery';
import {inferPdfPageFloor,sameSourceFrame,scopeSourceEntities} from '../lib/compiler-source';
import {classifyElectricalLabel,detectSldPage,isElectricalAssetLabel,isElectricalCircuitLabel} from '../lib/sld-recognition';
import {detectNonSldPlanPage,detectPlanFrames,resolveDrawingPageRecognition,resolvePlanFrameAtPoint} from '../lib/plan-recognition';
import {extractSheetGeometryEvidence,type PositionedSheetText} from '../lib/title-block';
import {validateIndependentScale} from '../lib/scale-validation';
import {buildSldVectorTopology} from '../lib/sld-vector-topology';
import {poweredEquipmentClass} from '../lib/power-intelligence';
import {parseEquipmentScheduleText} from '../lib/equipment-schedule';
import {parseDocxBytes,parseXlsxBytes} from '../lib/office-document-ingest';
import {parseIfcText} from '../lib/ifc-ingest';
import {buildImageOcrEvidence} from '../lib/image-ocr-intelligence';
import {readPrimarySpatialGraph,replaceCurrentSpatialGraph} from '../lib/spatial-browser-recovery';
import {encodeGlbBase64,inspectStandaloneGlb} from '../lib/spatial-glb-import';
import {drawingSourceReprocessReason,findDrawingSourcesNeedingReprocess} from '../lib/spatial-source-reprocess';
import {archiveSourceBytes,archivedSourceToFile,listArchivedSourceMetadata,readArchivedSource} from '../lib/source-browser-archive';
import {enrichCoordinationIntelligence} from '../lib/coordination-intelligence';
import {buildZResolutionIndex,extractZEvidenceFromText,type ZEvidence} from '../lib/z-resolver';
import {buildProjectDatumSurfaces,datumSurfaceMetadata,projectDatumSurfaceForEntity} from '../lib/project-datum';
import {buildElevationTriangles,extractPositionedElevationControls,resolveLocalElevationSurface,type ElevationControlPoint,type ElevationTriangle} from '../lib/elevation-surface';
import {enrichSupportBaseOffsets,extractSupportOffsetEvidence,type SupportOffsetEvidence} from '../lib/support-base-evidence';
import {normalizePdfVectorOpsInWorker,PdfVectorWorkerError} from '../lib/pdf-vector-worker-client';
import {ChangeEvent,DragEvent,useEffect,useMemo,useRef,useState} from 'react';

type Layer='L0'|'L1'|'L2'|'L3'|'L4';
type ParseState='parsed'|'adapter'|'review'|'failed';
type XY={x:number;y:number};
type GraphEntity={id:string;source:string;layer:Layer;kind:string;name:string;x:number;y:number;z?:number;x2?:number;y2?:number;z2?:number;rotation?:number;scale?:number;floor?:string;zone?:string;vertices?:XY[];confidence:number;meta?:Record<string,unknown>};
type SourceFile={name:string;size:number;ext:string;discipline:string;sha256:string;state:ParseState;summary:string;entities:number;floor:string;elevation:number;unitName?:string;unitToMeters?:number;pages?:number;vectors?:number;textItems?:number;sldPages?:number;nonSldPlanPages?:number;planTypes?:string[]};
type GraphLink={id:string;from:string;to:string;type:'SAME_TAG'|'DERIVED_ASSET'|'SOURCE_RELATION';confidence:number};
type CompiledGraph={version:string;createdAt:string;reviewState?:string;sources:SourceFile[];entities:GraphEntity[];links:GraphLink[];stats:Record<Layer,number>};

const NATIVE_ADAPTER=['dwg','rvt'];
const ACCEPTED=new Set(['pdf','dwg','dxf','ifc','rvt','glb','gltf','png','jpg','jpeg','csv','xlsx','xls','docx','txt']);
const PDF_FILE_BUDGET_MS=90_000;
const PDF_PAGE_ASYNC_BUDGET_MS=20_000;
const PDF_VECTOR_BUDGET_MS=18_000;
const PDF_MAX_VECTOR_OPS_PER_PAGE=300_000;
const PDF_MAX_VECTOR_SEGMENTS_PER_PAGE=120_000;
const PDF_MAX_FILE_BYTES=40*1024*1024;
const yieldToBrowser=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
function abortError(){return new DOMException('PDF parsing cancelled by the user.','AbortError')}
async function withParseBudget<T>(promise:Promise<T>,ms:number,label:string,signal?:AbortSignal):Promise<T>{
 if(signal?.aborted)throw abortError();
 return await new Promise<T>((resolve,reject)=>{
  let settled=false;
  const finish=(fn:()=>void)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',onAbort);fn()};
  const onAbort=()=>finish(()=>reject(abortError()));
  const timer=setTimeout(()=>finish(()=>reject(new Error(`${label} exceeded the ${Math.round(ms/1000)} second safety budget. Try the file again, or split/optimize that sheet if the issue repeats.`))),ms);
  signal?.addEventListener('abort',onAbort,{once:true});
  promise.then(value=>finish(()=>resolve(value)),error=>finish(()=>reject(error)));
 });
}
const classify=(name:string)=>{const n=name.toLowerCase();if(/(^|[^a-z])e\d|elect|power|lighting|one.?line|panel/.test(n))return'Electrical';if(/fire|sprinkler|life.?safety/.test(n))return'Fire Protection';if(/controls|\bbms\b|\bbas\b|\bddc\b/.test(n))return'Controls';if(/struct|framing|foundation/.test(n))return'Structural';if(/civil|grading|drainage|site plan/.test(n))return'Civil';if(/arch|floor|plan/.test(n))return'Architectural';if(/mech|hvac/.test(n))return'Mechanical';if(/plumb/.test(n))return'Plumbing';return'Unclassified'};
const inferLevel=(name:string)=>{const n=name.toLowerCase();if(/roof/.test(n))return{floor:'ROOF',elevation:0,elevationKnown:false};if(/penthouse/.test(n))return{floor:'PENTHOUSE',elevation:0,elevationKnown:false};if(/basement|\bb1\b/.test(n))return{floor:'B1',elevation:0,elevationKnown:false};const m=n.match(/(?:level|floor|lvl|fl)[-_ ]?(\d+)/);if(m)return{floor:`L${Number(m[1])}`,elevation:0,elevationKnown:false};if(/ground|\bl1\b|first floor/.test(n))return{floor:'L1',elevation:0,elevationKnown:false};return{floor:'UNRESOLVED',elevation:0,elevationKnown:false}};
const layerFor=(s:string):Layer=>{const n=s.toLowerCase();if(/wall|door|room|floor|ceiling|stair|column|architect|partition|a-wall|a-room/.test(n))return'L1';if(/feeder|circuit|conduit|wire|cable|tray|busway/.test(n)||isElectricalCircuitLabel(s))return'L3';if(isElectricalAssetLabel(s))return'L2';return'L1'};
const roomCandidate=(s:string)=>/room|electrical room|switchgear room|mdf|idf|mechanical room|garage|lobby|corridor|office|lab|data hall|closet|storage/i.test(s);
const sha=async(buf:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buf))).map(b=>b.toString(16).padStart(2,'0')).join('');
const normalize=(v:number,min:number,max:number)=>max===min?0:((v-min)/(max-min)-.5)*20;
const cleanTag=(s:string)=>s.toUpperCase().replace(/[^A-Z0-9-]/g,'').replace(/^(PANEL|PNL|TRANSFORMER|XFMR|SWITCHBOARD|SWBD|SWITCHGEAR|SWGR|GENERATOR|GEN|ATS|UPS|EVSE|MCC|PDU|VFD|MDP|MDB|MSB|CB|MCCB|ACB)/,'');
const pointInPolygon=(p:XY,poly:XY[])=>{let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];const hit=((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/((b.y-a.y)||1e-9)+a.x);if(hit)inside=!inside}return inside};
const centroid=(poly:XY[])=>poly.reduce((a,p)=>({x:a.x+p.x/poly.length,y:a.y+p.y/poly.length}),{x:0,y:0});
const unitInfo=(pairs:{code:number;value:string}[])=>{let code=0;for(let i=0;i<pairs.length-1;i++)if(pairs[i].code===9&&pairs[i].value==='$INSUNITS'){const n=Number(pairs[i+1].value);if(Number.isFinite(n))code=n;break}const map:Record<number,[string,number]>={0:['unitless',1],1:['in',.0254],2:['ft',.3048],4:['mm',.001],5:['cm',.01],6:['m',1],7:['km',1000],10:['yd',.9144]};const [unitName,unitToMeters]=map[code]||['unitless',1];return{unitName,unitToMeters,insunits:code}};

function assignZones(entities:GraphEntity[]){const rooms=entities.filter(e=>e.kind==='room-boundary'&&e.vertices?.length);const labels=entities.filter(e=>e.kind==='room-label');const namedRooms=rooms.map(r=>{const inside=labels.filter(l=>sameSourceFrame(l,r)&&pointInPolygon({x:l.x,y:l.y},r.vertices!));if(!inside.length)return r;inside.sort((a,b)=>b.confidence-a.confidence);return{...r,name:inside[0].name,zone:inside[0].name}});const replacements=new Map(namedRooms.map(r=>[r.id,r]));return entities.map(original=>{const e=replacements.get(original.id)||original;if(e.meta?.nonSpatial===true||e.layer==='L1'||e.zone)return e;const containing=namedRooms.filter(r=>sameSourceFrame(r,e)&&r.vertices&&pointInPolygon({x:e.x,y:e.y},r.vertices));if(containing.length)return{...e,zone:containing[0].name};const sameLabels=labels.filter(r=>sameSourceFrame(r,e));let best:GraphEntity|undefined,dist=Infinity;for(const r of sameLabels){const d=Math.hypot(e.x-r.x,e.y-r.y);if(d<dist){dist=d;best=r}}return best&&dist<3?{...e,zone:best.name}:e})}
function buildLinks(entities:GraphEntity[]){const links:GraphLink[]=[];const seen=new Map<string,GraphEntity[]>();for(const e of entities.filter(x=>x.layer==='L2'||x.layer==='L3')){const key=cleanTag(e.name);if(key.length<2)continue;const arr=seen.get(key)||[];arr.push(e);seen.set(key,arr)}for(const [key,arr] of seen){if(arr.length<2)continue;for(let i=1;i<arr.length;i++)links.push({id:`tag-${key}-${i}`,from:arr[0].id,to:arr[i].id,type:'SAME_TAG',confidence:.82})}for(const e of entities.filter(x=>x.layer==='L4')){const from=String(e.meta?.derivedFrom||'');if(from)links.push({id:`asset-${e.id}`,from,to:e.id,type:'DERIVED_ASSET',confidence:.99})}return links}

async function parsePdf(file:File,level:{floor:string;elevation:number},discipline:string,onProgress?:(page:number,total:number,phase?:string)=>void,signal?:AbortSignal):Promise<{entities:GraphEntity[];summary:string;pages:number;vectors:number;textItems:number;sldPages:number;nonSldPlanPages:number;planTypes:string[];disciplines:string[]}>{
 const PromiseWithResolvers=Promise as any;
 if(typeof PromiseWithResolvers.withResolvers!=='function')PromiseWithResolvers.withResolvers=()=>{let resolve:any,reject:any;const promise=new Promise((ok,fail)=>{resolve=ok;reject=fail});return{promise,resolve,reject}};
 if(file.size>PDF_MAX_FILE_BYTES)throw new Error(`PDF is ${(file.size/1024/1024).toFixed(1)} MB; the browser compiler safety limit is ${Math.round(PDF_MAX_FILE_BYTES/1024/1024)} MB. Split or optimize the file before retrying.`);
 if(signal?.aborted)throw abortError();
 const startedAt=performance.now();
 const pdfjs:any=await import('pdfjs-dist/legacy/build/pdf.mjs');try{pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).toString()}catch{}
 const bytes=new Uint8Array(await withParseBudget(file.arrayBuffer(),12_000,'Reading the PDF file',signal));
 const loadingTask=pdfjs.getDocument({data:bytes,wasmUrl:'/pdfjs/wasm/'});
 const doc=await withParseBudget(loadingTask.promise,20_000,'Opening the PDF document',signal);const raw:{key:string;str:string;x:number;y:number;page:number}[]=[];const polygons:{vertices:XY[];page:number;confidence:number}[]=[];const segments:{x:number;y:number;x2:number;y2:number;page:number}[]=[];const pageFloors=new Map<number,string>();const pageVectorOps=new Map<number,number>();const pageGeometryByPage=new Map<number,{width:number;height:number;max:number}>();const ocrTextByPage=new Map<number,string[]>();const rasterPreviewByPage=new Map<number,{dataUrl:string;width:number;height:number;planeWidth:number;planeHeight:number;rasterCandidateCount:number;geometryEvidence?:ReturnType<typeof extractSheetGeometryEvidence>;geometryItems?:PositionedSheetText[]}>();const ocrEntities:GraphEntity[]=[];let vectors=0,ocrPages=0,ocrTextChars=0,ocrWorker:any=null;
 try {
 for(let p=1;p<=doc.numPages;p++){
  if(signal?.aborted)throw abortError();
  if(performance.now()-startedAt>PDF_FILE_BUDGET_MS)throw new Error(`PDF parsing exceeded the ${Math.round(PDF_FILE_BUDGET_MS/1000)} second file budget after page ${Math.max(0,p-1)} of ${doc.numPages}. Retry the file; if this repeats, split the set so the slow sheet can be reviewed separately.`);
  onProgress?.(p,doc.numPages,'text');
  await yieldToBrowser();
  const page=await withParseBudget(doc.getPage(p),PDF_PAGE_ASYNC_BUDGET_MS,`Loading page ${p}`,signal),viewport=page.getViewport({scale:1}),text=await withParseBudget(page.getTextContent(),PDF_PAGE_ASYNC_BUDGET_MS,`Extracting text from page ${p}`,signal);pageGeometryByPage.set(p,{width:viewport.width,height:viewport.height,max:Math.max(viewport.width,viewport.height)});const nativeText=(text.items||[]).map((item:any)=>String(item?.str||'').trim()).filter(Boolean);pageFloors.set(p,inferPdfPageFloor(nativeText));for(const item of text.items||[]){if(!item?.str?.trim())continue;const t=item.transform||[1,0,0,1,0,0],point=viewport.convertToViewportPoint(Number(t[4]||0),Number(t[5]||0));raw.push({key:`text-${p}-${raw.length}`,str:item.str.trim(),x:(point[0]-viewport.width/2)*20/Math.max(viewport.width,viewport.height,1),y:(viewport.height/2-point[1])*20/Math.max(viewport.width,viewport.height,1),page:p})}
 if(nativeText.length<3){try{
   if(!ocrWorker){const mod=await import('tesseract.js');ocrWorker=await mod.createWorker('eng',mod.OEM.LSTM_ONLY)}
   const maxSide=Math.max(viewport.width,viewport.height,1),scale=Math.max(1.25,Math.min(2.4,2400/maxSide)),ocrViewport=page.getViewport({scale}),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
   canvas.width=Math.max(1,Math.round(ocrViewport.width));canvas.height=Math.max(1,Math.round(ocrViewport.height));
   if(!ctx)throw new Error('Canvas rendering unavailable');
   await page.render({canvasContext:ctx,viewport:ocrViewport}).promise;
   const previewMax=1400,previewScale=Math.min(1,previewMax/Math.max(canvas.width,canvas.height,1)),preview=document.createElement('canvas'),previewCtx=preview.getContext('2d');
   preview.width=Math.max(1,Math.round(canvas.width*previewScale));preview.height=Math.max(1,Math.round(canvas.height*previewScale));
   if(previewCtx){previewCtx.drawImage(canvas,0,0,preview.width,preview.height);const landscape=preview.width>=preview.height,planeWidth=landscape?20:20*preview.width/Math.max(preview.height,1),planeHeight=landscape?20*preview.height/Math.max(preview.width,1):20;rasterPreviewByPage.set(p,{dataUrl:preview.toDataURL('image/jpeg',.68),width:preview.width,height:preview.height,planeWidth,planeHeight,rasterCandidateCount:0})}
   const recognized=await ocrWorker.recognize(canvas,{}, {text:true,blocks:true}),ocrText=String(recognized.data?.text||'').trim();
   if(ocrText){
    const lines=ocrText.split(/\r?\n/).map((line:string)=>line.trim()).filter(Boolean);
    ocrTextByPage.set(p,lines);ocrPages++;ocrTextChars+=ocrText.length;
    const floor=inferPdfPageFloor(lines)||pageFloors.get(p)||level.floor;pageFloors.set(p,floor);
    const previewInfo=rasterPreviewByPage.get(p);
    const blockLines=(Array.isArray(recognized.data?.blocks)?recognized.data.blocks:[]).flatMap((block:any)=>Array.isArray(block?.paragraphs)?block.paragraphs:[]).flatMap((paragraph:any)=>Array.isArray(paragraph?.lines)?paragraph.lines:[]);
    const geometryItems=blockLines.flatMap((line:any)=>{const label=String(line?.text||'').replace(/\s+/g,' ').trim(),bbox=line?.bbox;if(!label||!bbox)return[];const x0=Number(bbox.x0),y0=Number(bbox.y0),x1=Number(bbox.x1),y1=Number(bbox.y1);if(![x0,y0,x1,y1].every(Number.isFinite))return[];return[{text:label,x:(x0+x1)/2/Math.max(canvas.width,1),y:(y0+y1)/2/Math.max(canvas.height,1),width:Math.abs(x1-x0)/Math.max(canvas.width,1),height:Math.abs(y1-y0)/Math.max(canvas.height,1)}]});
    const geometryEvidence=extractSheetGeometryEvidence({items:geometryItems,pageWidthPoints:viewport.width,pageHeightPoints:viewport.height});
    let rasterCandidateCount=0;
    for(const line of blockLines){
      const label=String(line?.text||'').replace(/\s+/g,' ').trim(),bbox=line?.bbox;
      if(!label||!bbox||!previewInfo)continue;
      const equipmentClass=classifyElectricalLabel(label),poweredClass=poweredEquipmentClass(label),isRoom=roomCandidate(label);
      if(!equipmentClass&&!poweredClass&&!isRoom)continue;
      const x0=Number(bbox.x0),y0=Number(bbox.y0),x1=Number(bbox.x1),y1=Number(bbox.y1);
      if(![x0,y0,x1,y1].every(Number.isFinite)||x1<=x0||y1<=y0)continue;
      const cx=(x0+x1)/2/Math.max(canvas.width,1),cy=(y0+y1)/2/Math.max(canvas.height,1);
      const x=(cx-.5)*previewInfo.planeWidth,y=(.5-cy)*previewInfo.planeHeight;
      const layer:Layer=isRoom?'L1':poweredClass&&!equipmentClass?'L4':'L2';
      const lineConfidence=Number.isFinite(Number(line?.confidence))?Math.max(0,Math.min(100,Number(line.confidence))):null;
      ocrEntities.push({
        id:`pdf-ocr-position-${p}-${rasterCandidateCount}`,source:file.name,layer,
        kind:isRoom?'room-label':poweredClass&&!equipmentClass?'powered-equipment-candidate':'text-asset-candidate',
        name:label,x,y,z:0,floor,confidence:lineConfidence===null?.58:Math.max(.45,Math.min(.78,lineConfidence/100)),
        meta:{page:p,sourceType:'PDF_RASTER_OCR_POSITIONAL_CANDIDATE',ocrAuthority:'REVIEW_ONLY',geometryAuthority:'SOURCE_IMAGE_BBOX_ONLY',
          coordinateUnits:'image_sheet',spatialPlacementAuthority:'OCR_SOURCE_IMAGE_POSITION_ONLY',zPlacementAuthority:'UNVERIFIED_DRAWING_PLANE',
          elevationKnown:false,physicalElevationKnown:false,physicalTruth:false,reviewRequired:true,registrationState:'CANDIDATE',
          ocrBoundingBoxPixels:[x0,y0,x1,y1],ocrImageWidth:canvas.width,ocrImageHeight:canvas.height,
          ...(equipmentClass?{electricalComponentHint:equipmentClass}:{}),...(poweredClass?{poweredEquipmentClass:poweredClass}:{})}
      } as GraphEntity);
      rasterCandidateCount++;
    }
    if(previewInfo){previewInfo.rasterCandidateCount=rasterCandidateCount;previewInfo.geometryEvidence=geometryEvidence;previewInfo.geometryItems=geometryItems;}
    const normalized=buildImageOcrEvidence({text:ocrText,source:file.name,discipline,floor,width:canvas.width,height:canvas.height,meanConfidence:Number.isFinite(Number(recognized.data?.confidence))?Number(recognized.data.confidence):null});
    ocrEntities.push(...normalized.entities.map((entity,index)=>({...entity,id:`pdf-ocr-${p}-${index}-${entity.id}`,meta:{...entity.meta,page:p,sourceType:'PDF_RASTER_OCR_TEXT',ocrAuthority:'REVIEW_ONLY',geometryAuthority:'NONE',coordinateUnits:'NONE',nonSpatial:true,physicalTruth:false,reviewRequired:true,spatialPlacementAuthority:'OCR_NON_SPATIAL'}})) as GraphEntity[]);
   }
  }catch{}}
 try{
   onProgress?.(p,doc.numPages,'vectors');
   const ops=await withParseBudget(page.getOperatorList(),PDF_PAGE_ASYNC_BUDGET_MS,`Extracting drawing operators from page ${p}`,signal);
   const normalized=await normalizePdfVectorOpsInWorker({
    fnArray:Array.from(ops.fnArray||[]),
    argsArray:Array.from(ops.argsArray||[]) as unknown[][],
    viewport:{width:viewport.width,height:viewport.height,transform:Array.from(viewport.transform||[1,0,0,1,0,0]).map(Number)},
    ops:{
     save:pdfjs.OPS.save,restore:pdfjs.OPS.restore,transform:pdfjs.OPS.transform,
     paintFormXObjectBegin:pdfjs.OPS.paintFormXObjectBegin,paintFormXObjectEnd:pdfjs.OPS.paintFormXObjectEnd,
     constructPath:pdfjs.OPS.constructPath,moveTo:pdfjs.OPS.moveTo,lineTo:pdfjs.OPS.lineTo,
     rectangle:pdfjs.OPS.rectangle,closePath:pdfjs.OPS.closePath
    },
    maxOps:PDF_MAX_VECTOR_OPS_PER_PAGE,
    maxSegments:PDF_MAX_VECTOR_SEGMENTS_PER_PAGE,
    timeoutMs:PDF_VECTOR_BUDGET_MS,
    signal
   });
   vectors+=normalized.pageOps;
   pageVectorOps.set(p,normalized.pageOps);
   segments.push(...normalized.segments.map(segment=>({...segment,page:p})));
   polygons.push(...normalized.polygons.map(polygon=>({...polygon,page:p})));
  }catch(error){
   if(signal?.aborted||(error instanceof DOMException&&error.name==='AbortError')||error instanceof PdfVectorWorkerError||/budget|exceeded|safety/i.test(error instanceof Error?error.message:String(error)))throw error;
   pageVectorOps.set(p,0);
  }finally{page.cleanup()}
 }
 const pageEvidence=new Map<number,ReturnType<typeof detectSldPage>>(),planEvidence=new Map<number,ReturnType<typeof detectNonSldPlanPage>>();
 for(let page=1;page<=doc.numPages;page++){
  const labels=[...raw.filter(item=>item.page===page).map(item=>item.str),...(ocrTextByPage.get(page)||[])],vectorCount=pageVectorOps.get(page)||0,{sld,plan}=resolveDrawingPageRecognition(labels,vectorCount);
  pageEvidence.set(page,sld);planEvidence.set(page,plan);
 }
 const planFramesByPage=new Map<number,ReturnType<typeof detectPlanFrames>>();
 for(let page=1;page<=doc.numPages;page++){
  const positioned=raw.filter(item=>item.page===page).map(item=>({text:item.str,x:item.x,y:item.y}));
  planFramesByPage.set(page,detectPlanFrames(positioned,planEvidence.get(page)));
 }
 const frameAt=(page:number,x:number,y:number)=>resolvePlanFrameAtPoint(planFramesByPage.get(page)||[],x,y);
 const floorAt=(page:number,x:number,y:number)=>frameAt(page,x,y)?.floor||pageFloors.get(page)||'UNRESOLVED';
 for(const [page,frames] of planFramesByPage){
  for(const frame of frames){
   ocrEntities.push({id:`pdf-plan-frame-${page}-${frame.id}`,source:file.name,layer:'L0',kind:'plan-frame-candidate',name:frame.title,x:frame.anchorX,y:frame.anchorY,z:0,floor:frame.floor||'UNRESOLVED',confidence:frame.confidence,meta:{page,nonSpatial:true,sourceType:'PDF_PLAN_FRAME_TITLE',planFrame:frame,physicalTruth:false,reviewRequired:true,geometryAuthority:'TITLE_ANCHOR_ONLY',spatialPlacementAuthority:'SOURCE_SHEET_TITLE_ANCHOR_ONLY',zPlacementAuthority:'UNVERIFIED_DRAWING_PLANE',elevationKnown:false,physicalElevationKnown:false}} as GraphEntity);
  }
 }
 const zEvidence:ZEvidence[]=[];
 for(let page=1;page<=doc.numPages;page++){
  const labels=[...raw.filter(item=>item.page===page).map(item=>item.str),...(ocrTextByPage.get(page)||[])];
  zEvidence.push(...extractZEvidenceFromText(labels.join('\n'),{source:file.name,floor:pageFloors.get(page)||'UNRESOLVED',idPrefix:`pdf-z-${page}`}));
 }
 for(const evidence of zEvidence){
  ocrEntities.push({id:evidence.id,source:file.name,layer:'L0',kind:'z-evidence-candidate',name:evidence.evidence[0]||evidence.type,x:0,y:0,z:0,floor:evidence.floor||'UNRESOLVED',confidence:evidence.confidence,meta:{nonSpatial:true,physicalTruth:false,reviewRequired:true,zEvidence:evidence,zPlacementAuthority:'SOURCE_TEXT_Z_EVIDENCE_ONLY',elevationKnown:false,physicalElevationKnown:false}} as GraphEntity);
 }
 const scaleValidationByPage=new Map<number,ReturnType<typeof validateIndependentScale>>();
 const elevationControlsByPage=new Map<number,ElevationControlPoint[]>();
 const elevationTrianglesByPage=new Map<number,ElevationTriangle[]>();
 const supportOffsetsByPage=new Map<number,SupportOffsetEvidence[]>();
 for(let page=1;page<=doc.numPages;page++){
  const preview=rasterPreviewByPage.get(page),pageGeometry=pageGeometryByPage.get(page);
  const nativeItems=raw.filter(item=>item.page===page).map(item=>({text:item.str,x:item.x/20+.5,y:.5-item.y/20}));
  const items=(preview?.geometryItems?.length?preview.geometryItems:nativeItems) as PositionedSheetText[];
  const geometryEvidence=preview?.geometryEvidence||extractSheetGeometryEvidence({items,pageWidthPoints:pageGeometry?.width,pageHeightPoints:pageGeometry?.height});
  const pageSegments=segments.filter(segment=>segment.page===page).map(segment=>({x:segment.x/20+.5,y:.5-segment.y/20,x2:segment.x2/20+.5,y2:.5-segment.y2/20}));
  const validation=validateIndependentScale({items,segments:pageSegments,declaredScale:geometryEvidence.drawingScale.value,pageMaxDimensionPoints:pageGeometry?.max,normalizedSheetSpan:20,coordinateSpan:1});
  scaleValidationByPage.set(page,validation);
  if(validation.status!=='UNRESOLVED'||validation.declaredMetersPerNormalizedSheetUnit!==null){
   ocrEntities.push({id:`pdf-scale-validation-${page}`,source:file.name,layer:'L0',kind:'scale-validation-candidate',name:`Scale validation · page ${page} · ${validation.status}`,x:0,y:0,z:0,floor:pageFloors.get(page)||'UNRESOLVED',confidence:validation.confidence,meta:{page,nonSpatial:true,physicalTruth:false,reviewRequired:true,scaleValidationEvidence:validation,geometryScaleAuthority:false,autoApply:false,elevationKnown:false,physicalElevationKnown:false}} as GraphEntity);
  }
  const usingRasterGeometry=Boolean(preview?.geometryItems?.length),sourcePlaneWidth=usingRasterGeometry?(preview?.planeWidth||20):20,sourcePlaneHeight=usingRasterGeometry?(preview?.planeHeight||20):20;
  const controls=extractPositionedElevationControls({
   items,source:file.name,page,declaredScale:geometryEvidence.drawingScale.value,scaleValidation:validation,
   planeWidth:sourcePlaneWidth,
   planeHeight:sourcePlaneHeight
  });
  const supportOffsets=extractSupportOffsetEvidence({items,source:file.name,page,planeWidth:sourcePlaneWidth,planeHeight:sourcePlaneHeight});
  supportOffsetsByPage.set(page,supportOffsets);
  for(const support of supportOffsets){
   ocrEntities.push({id:`pdf-support-offset-${page}-${support.id}`,source:file.name,layer:'L0',kind:'support-offset-evidence',name:support.label,x:support.x,y:support.y,z:0,floor:pageFloors.get(page)||'UNRESOLVED',confidence:support.confidence,meta:{page,nonSpatial:true,supportOffsetEvidence:support,sourceType:'PDF_SUPPORT_OFFSET_EVIDENCE',physicalTruth:false,physicalElevationKnown:false,elevationKnown:false,reviewRequired:true}});
  }
  elevationControlsByPage.set(page,controls);
  const triangles=[...buildElevationTriangles(controls,'GRADE'),...buildElevationTriangles(controls,'FINISHED_FLOOR')];
  elevationTrianglesByPage.set(page,triangles);
  for(const control of controls){
   ocrEntities.push({id:`pdf-elevation-control-${page}-${control.id}`,source:file.name,layer:'L0',kind:'elevation-control-point',name:control.label,x:control.x,y:control.y,z:control.zMeters,floor:pageFloors.get(page)||'UNRESOLVED',confidence:control.confidence,meta:{page,elevationControl:control,sourceType:'PDF_ELEVATION_CONTROL',coordinateUnits:'sheet',zPlacementAuthority:'SOURCE_ELEVATION_CONTROL',elevationKnown:false,physicalElevationKnown:false,physicalTruth:false,reviewRequired:true}});
  }
  for(const triangle of triangles){
   const [a,b,c]=triangle.points;
   ocrEntities.push({id:`pdf-elevation-triangle-${page}-${triangle.id}`,source:file.name,layer:'L1',kind:'elevation-review-surface-triangle',name:`${triangle.kind} review surface`,x:(a.x+b.x+c.x)/3,y:(a.y+b.y+c.y)/3,z:(a.zMeters+b.zMeters+c.zMeters)/3,floor:pageFloors.get(page)||'UNRESOLVED',confidence:triangle.confidence,vertices:[{x:a.x,y:a.y},{x:b.x,y:b.y},{x:c.x,y:c.y}],meta:{page,elevationTriangle:{id:triangle.id,kind:triangle.kind,pointIds:triangle.pointIds,zMeters:[a.zMeters,b.zMeters,c.zMeters]},sourceType:'PDF_ELEVATION_TRIANGLE',coordinateUnits:'sheet',zPlacementAuthority:'SOURCE_ELEVATION_TRIANGLE',elevationKnown:false,physicalElevationKnown:false,physicalTruth:false,reviewRequired:true}});
  }
 }
 const sldPages=[...pageEvidence.values()].filter(item=>item.isSld).length,nonSldPlanPages=[...planEvidence.values()].filter(item=>item.isPlan).length;
 const planTypes=[...new Set([...planEvidence.values()].filter(item=>item.isPlan&&item.planType).map(item=>String(item.planType)))];
 const disciplines=[...new Set([...planEvidence.values()].filter(item=>item.isPlan&&item.discipline).map(item=>String(item.discipline)))];if(sldPages)disciplines.push('Electrical');
 const uniqueDisciplines=[...new Set(disciplines)];
 const sldMeta=(page:number)=>{const evidence=pageEvidence.get(page);return evidence?.isSld?{sldCandidate:true,sldRecognition:'CONTENT_TOPOLOGY_V2',sldRecognitionScore:evidence.score,sldEvidence:evidence.reasons,sldEquipmentClasses:evidence.equipmentClasses,sldProjectionReviewRequired:true}:{} as Record<string,unknown>};
 const planMeta=(page:number,x?:number,y?:number)=>{const evidence=planEvidence.get(page);if(!evidence?.isPlan)return{} as Record<string,unknown>;const frames=planFramesByPage.get(page)||[],frame=Number.isFinite(x)&&Number.isFinite(y)?resolvePlanFrameAtPoint(frames,Number(x),Number(y)):null;return{nonSldPlan:true,planType:evidence.planType,planRecognition:'CONTENT_PLAN_V2_FRAMES',planRecognitionScore:evidence.score,planEvidence:evidence.reasons,planTitleEvidence:evidence.titleEvidence,planDiscipline:evidence.discipline,planFrameCount:frames.length,planFrames:frames.map(item=>({id:item.id,title:item.title,planType:item.planType,discipline:item.discipline,floor:item.floor,unitId:item.unitId,unitPlan:item.unitPlan,anchorX:item.anchorX,anchorY:item.anchorY,confidence:item.confidence,reviewRequired:true,physicalTruth:false})),...(frame?{planFrameId:frame.id,planFrameTitle:frame.title,planFrameFloor:frame.floor,planFrameUnitId:frame.unitId,planFrameUnitPlan:frame.unitPlan}:{})} as Record<string,unknown>};
 const vectorTopologyByPage=new Map<number,ReturnType<typeof buildSldVectorTopology>>(),vectorAttachmentByKey=new Map<string,{component:number;distance:number;componentAttachmentCount:number}>();let vectorFeederSegments=0;
 for(let page=1;page<=doc.numPages;page++){if(!pageEvidence.get(page)?.isSld)continue;const labels=raw.filter(item=>item.page===page&&Boolean(classifyElectricalLabel(item.str))).map(item=>({id:item.key,x:item.x,y:item.y})),topology=buildSldVectorTopology(segments.filter(segment=>segment.page===page),labels),usableComponents=new Set(topology.attachments.filter(item=>item.componentAttachmentCount>=2).map(item=>item.component));const usable={segments:topology.segments.filter(item=>usableComponents.has(item.component)),attachments:topology.attachments.filter(item=>usableComponents.has(item.component))};vectorTopologyByPage.set(page,usable);vectorFeederSegments+=usable.segments.length;for(const attachment of usable.attachments)vectorAttachmentByKey.set(attachment.labelId,attachment)}
 const entities:GraphEntity[]=[...ocrEntities];let i=0,rasterPlanUnderlays=0;
 for(const [page,preview] of rasterPreviewByPage){
  const sld=pageEvidence.get(page),plan=planEvidence.get(page),shouldRetain=Boolean(sld?.isSld||plan?.isPlan||preview.rasterCandidateCount>0||doc.numPages<=3);
  if(!shouldRetain||!preview.dataUrl)continue;
  rasterPlanUnderlays++;
  entities.push({id:`pdf-raster-underlay-${page}-${i++}`,source:file.name,layer:'L1',kind:'source-raster-underlay',name:`${plan?.planType||(sld?.isSld?'SLD':'Unclassified raster drawing')} · page ${page}`,x:-preview.planeWidth/2,y:-preview.planeHeight/2,z:0,x2:preview.planeWidth/2,y2:preview.planeHeight/2,z2:0,floor:pageFloors.get(page),confidence:1,meta:{page,sourceType:'PDF_RASTER_UNDERLAY',drawingBasemap:true,embeddedRasterDataUrl:preview.dataUrl,previewWidth:preview.width,previewHeight:preview.height,coordinateUnits:'image_preview',geometryAuthority:'RASTER_PREVIEW_ONLY',spatialPlacementAuthority:'SOURCE_IMAGE_PLANE_ONLY',zPlacementAuthority:'UNVERIFIED_DRAWING_PLANE',elevationKnown:false,physicalElevationKnown:false,physicalTruth:false,reviewRequired:false,previewAuthority:'DERIVED_PREVIEW_ONLY',rasterCandidateCount:preview.rasterCandidateCount,...(preview.geometryEvidence?{drawingScaleEvidence:preview.geometryEvidence.drawingScale,northOrientationEvidence:preview.geometryEvidence.northOrientation,scaleCalibrationEvidence:preview.geometryEvidence.scaleCalibration}:{}),scaleValidationEvidence:scaleValidationByPage.get(page),...(sld?.isSld?sldMeta(page):planMeta(page))}});
 }
 const seenPlanSegments=new Set<string>(),sourcePlanSegmentsByPage=new Map<number,number>();let sourcePlanSegments=0;
 for(const segment of segments){
  if(pageEvidence.get(segment.page)?.isSld||!planEvidence.get(segment.page)?.isPlan)continue;
  if(Math.hypot(segment.x2-segment.x,segment.y2-segment.y)<.015)continue;
  const a=`${segment.x.toFixed(4)},${segment.y.toFixed(4)}`,b=`${segment.x2.toFixed(4)},${segment.y2.toFixed(4)}`,key=`${segment.page}:${[a,b].sort().join('>')}`;
  if(seenPlanSegments.has(key))continue;
  seenPlanSegments.add(key);
  const pageCount=sourcePlanSegmentsByPage.get(segment.page)||0;
  if(pageCount>=4000||sourcePlanSegments>=40000)continue;
  sourcePlanSegmentsByPage.set(segment.page,pageCount+1);sourcePlanSegments++;
  entities.push({id:`pdf-plan-line-${segment.page}-${i++}`,source:file.name,layer:'L1',kind:'line',name:`Source plan line · page ${segment.page}`,x:segment.x,y:segment.y,z:0,x2:segment.x2,y2:segment.y2,z2:0,floor:floorAt(segment.page,(segment.x+segment.x2)/2,(segment.y+segment.y2)/2),confidence:.99,meta:{page:segment.page,floorInference:'plan-frame-or-sheet-title-candidate',coordinateUnits:'sheet',sourceType:'PDF source-plan vector line',drawingBasemap:true,pdfTransformsApplied:true,elevationKnown:false,physicalElevationKnown:false,zPlacementAuthority:'UNVERIFIED_DRAWING_PLANE',spatialPlacementAuthority:'SOURCE_SHEET_POSITION_ONLY',physicalTruth:false,reviewRequired:false,scaleValidationEvidence:scaleValidationByPage.get(segment.page),...planMeta(segment.page,(segment.x+segment.x2)/2,(segment.y+segment.y2)/2)}});
 }
 for(const [page,topology] of vectorTopologyByPage){for(const segment of topology.segments){entities.push({id:`pdf-sld-feeder-${page}-${i++}`,source:file.name,layer:'L3',kind:'sld-feeder-candidate',name:`SLD feeder path · page ${page}`,x:segment.x,y:segment.y,z:0,x2:segment.x2,y2:segment.y2,z2:0,floor:pageFloors.get(page),confidence:.88,meta:{page,floorInference:'sheet-title-candidate',elevationKnown:false,coordinateUnits:'sheet',sourceType:'PDF vector electrical path',sldCandidate:true,sldFeederCandidate:true,sldVectorComponent:segment.component,sldVectorAuthority:'PDF_VECTOR_CONNECTED_COMPONENT',reviewRequired:true,physicalTruth:false}})}}
 for(const p of polygons){if(!pageEvidence.get(p.page)?.isSld&&!planEvidence.get(p.page)?.isPlan)continue;const area=Math.abs(p.vertices.reduce((s,v,j)=>{const n=p.vertices[(j+1)%p.vertices.length];return s+v.x*n.y-n.x*v.y},0))/2;if(area<.08||area>190)continue;const c=centroid(p.vertices);entities.push({id:`pdf-room-${p.page}-${i++}`,source:file.name,layer:'L1',kind:'vector-boundary-candidate',name:`PDF closed path · page ${p.page}`,x:c.x,y:c.y,z:0,vertices:p.vertices,floor:floorAt(p.page,c.x,c.y),confidence:p.confidence,meta:{page:p.page,floorInference:'plan-frame-or-sheet-title-candidate',elevationKnown:false,sourceType:'PDF vector path',reconstruction:'heuristic-closed-path',reviewRequired:true,coordinateUnits:'sheet',pdfTransformsApplied:true,geometryValidated:false,...sldMeta(p.page),...planMeta(p.page,c.x,c.y)}})}for(const t of raw){if(/\bcannot locate\b|\bplease advise\b/i.test(t.str)||(!pageEvidence.get(t.page)?.isSld&&!planEvidence.get(t.page)?.isPlan))continue;const equipmentClass=classifyElectricalLabel(t.str),poweredClass=poweredEquipmentClass(t.str),isAsset=Boolean(equipmentClass),isPoweredNonElectrical=Boolean(poweredClass&&!isAsset),isCircuit=isElectricalCircuitLabel(t.str),isRoom=roomCandidate(t.str),vectorAttachment=vectorAttachmentByKey.get(t.key);if(!isAsset&&!isCircuit&&!isRoom&&!isPoweredNonElectrical)continue;const layer:Layer=isRoom?'L1':isPoweredNonElectrical?'L4':isCircuit&&!isAsset?'L3':'L2';entities.push({id:`pdf-${t.page}-${i++}`,source:file.name,layer,kind:isRoom?'room-label':isPoweredNonElectrical?'powered-equipment-candidate':isAsset?'text-asset-candidate':'logical-tag',name:t.str,x:t.x,y:t.y,z:0,floor:floorAt(t.page,t.x,t.y),confidence:isRoom?.7:isPoweredNonElectrical?.72:isAsset?.86:.74,meta:{page:t.page,floorInference:'sheet-title-candidate',elevationKnown:false,coordinateUnits:'sheet',sourceType:'PDF text object',...(poweredClass?{poweredEquipmentClass:poweredClass,registrationState:'CANDIDATE',spatialPlacementAuthority:'SOURCE_SHEET_POSITION_ONLY',physicalTruth:false,reviewRequired:true}:{}),...(equipmentClass?{electricalComponentHint:equipmentClass}:{}),...(vectorAttachment?{sldVectorComponent:vectorAttachment.component,sldVectorDistance:vectorAttachment.distance,sldVectorAuthority:'PDF_VECTOR_CONNECTED_COMPONENT'}:{}),...sldMeta(t.page),...planMeta(t.page,t.x,t.y)}})}
 for(const entity of entities){
  if(entity.meta?.nonSpatial===true||entity.kind==='elevation-control-point'||entity.kind==='elevation-review-surface-triangle')continue;
  const page=Number(entity.meta?.page||0);if(!page)continue;
  const controls=elevationControlsByPage.get(page)||[],triangles=elevationTrianglesByPage.get(page)||[];
  if(controls.length<3||triangles.length===0)continue;
  const planType=String(entity.meta?.planType||''),discipline=String(entity.meta?.planDiscipline||'');
  const preferredKind=planType.includes('GRADING')||planType.includes('DRAINAGE')||discipline.includes('Civil')?'GRADE':entity.floor&&entity.floor!=='UNRESOLVED'?'FINISHED_FLOOR':undefined;
  const local=resolveLocalElevationSurface({x:entity.x,y:entity.y,points:controls,triangles,kind:preferredKind as any});
  if(local.status!=='RESOLVED_REVIEW_SURFACE'||local.zMeters===null)continue;
  entity.meta={...entity.meta,localReviewSurfaceZ:local.zMeters,localReviewSurfaceKind:local.kind,localReviewSurfaceAuthority:local.authority,localReviewSurfaceConfidence:local.confidence,localReviewSurfaceTriangleId:local.triangleId,localReviewSurfaceControlPointIds:local.controlPointIds,physicalTruth:false,reviewRequired:true};
 }
 const supportEnriched=enrichSupportBaseOffsets(entities,[...supportOffsetsByPage.values()].flat());
 return{entities:supportEnriched,summary:`${doc.numPages} page${doc.numPages===1?'':'s'} · ${raw.length} positioned text objects · ${vectors} PDF drawing operators · ${nonSldPlanPages} non-SLD plan page${nonSldPlanPages===1?'':'s'} recognized${planTypes.length?` (${planTypes.join(', ')})`:''} · ${sourcePlanSegments} retained source-plan vector segment${sourcePlanSegments===1?'':'s'} · ${rasterPlanUnderlays} raster drawing underlay${rasterPlanUnderlays===1?'':'s'} · ${ocrPages} raster OCR fallback page${ocrPages===1?'':'s'} · ${ocrTextChars} OCR text character${ocrTextChars===1?'':'s'} · ${sldPages} SLD page${sldPages===1?'':'s'} recognized from content/topology · ${vectorFeederSegments} source-vector feeder segment${vectorFeederSegments===1?'':'s'} · ${supportEnriched.length} spatial/review candidates`,pages:doc.numPages,vectors,textItems:raw.length,sldPages,nonSldPlanPages,planTypes,disciplines:uniqueDisciplines};
 } finally {if(ocrWorker)await ocrWorker.terminate().catch(()=>{});await doc.destroy()}
}

function dxfPairs(text:string){const lines=text.replace(/\r/g,'').split('\n');const out:{code:number;value:string}[]=[];for(let i=0;i+1<lines.length;i+=2){const code=Number(lines[i].trim());if(Number.isFinite(code))out.push({code,value:lines[i+1].trim()})}return out}
function parseDxf(file:File,text:string,level:{floor:string;elevation:number}){
 const pairs=dxfPairs(text),units=unitInfo(pairs),records:any[]=[];let current:any=null,inEntities=false;for(let i=0;i<pairs.length;i++){const p=pairs[i];if(p.code===0&&p.value==='SECTION'&&pairs[i+1]?.code===2&&pairs[i+1]?.value==='ENTITIES'){inEntities=true;i++;continue}if(p.code===0&&p.value==='ENDSEC'){if(current)records.push(current);current=null;if(inEntities)break}if(!inEntities)continue;if(p.code===0){if(current)records.push(current);current={type:p.value,vals:{}};continue}if(current)(current.vals[p.code]??=[]).push(p.value)}if(current)records.push(current);
 const pts:XY[]=[];for(const r of records){const xs=r.vals[10]||[],ys=r.vals[20]||[];for(let i=0;i<Math.min(xs.length,ys.length);i++)pts.push({x:Number(xs[i]),y:Number(ys[i])})}const xs=pts.map(p=>p.x).filter(Number.isFinite),ys=pts.map(p=>p.y).filter(Number.isFinite),minX=Math.min(...xs,0),maxX=Math.max(...xs,1),minY=Math.min(...ys,0),maxY=Math.max(...ys,1);const nx=(x:number)=>normalize(x,minX,maxX),ny=(y:number)=>-normalize(y,minY,maxY)*.7;const entities:GraphEntity[]=[];let id=0;
 for(const r of records){const v=r.vals,layerName=v[8]?.[0]||'',label=v[2]?.[0]||v[1]?.join(' ')||r.type,layer=layerFor(`${layerName} ${label}`),zRaw=Number(v[30]?.[0]||0),explicitSourceZ=Array.isArray(v[30])&&v[30].length>0&&units.insunits!==0&&Number.isFinite(zRaw),z=explicitSourceZ?zRaw*units.unitToMeters:0,zMeta=explicitSourceZ?{sourceType:'DXF',sourceDesignElevationKnown:true,zPlacementAuthority:'SOURCE_DXF_DESIGN_Z',coordinateUnits:'m_dxf_design',physicalTruth:false,reviewRequired:true}:{sourceType:'DXF',sourceDesignElevationKnown:false,zPlacementAuthority:'UNRESOLVED',physicalElevationKnown:false,elevationKnown:false,physicalTruth:false,reviewRequired:true};
  if(r.type==='LINE'){const x=Number(v[10]?.[0]),y=Number(v[20]?.[0]),x2=Number(v[11]?.[0]),y2=Number(v[21]?.[0]);if([x,y,x2,y2].every(Number.isFinite))entities.push({id:`dxf-${id++}`,source:file.name,layer,kind:'line',name:layerName||'LINE',x:nx(x),y:ny(y),z,x2:nx(x2),y2:ny(y2),z2:z,confidence:.99,floor:level.floor,meta:{cadLayer:layerName,rawX:x,rawY:y,rawX2:x2,rawY2:y2,unitName:units.unitName,unitToMeters:units.unitToMeters,...zMeta}})}
  else if(r.type==='LWPOLYLINE'){const vx=(v[10]||[]).map(Number),vy=(v[20]||[]).map(Number),count=Math.min(vx.length,vy.length),flag=Number(v[70]?.[0]||0),closed=(flag&1)===1||(count>2&&vx[0]===vx[count-1]&&vy[0]===vy[count-1]);const poly=Array.from({length:count},(_,j)=>({x:nx(vx[j]),y:ny(vy[j])}));const arch=layer==='L1';if(closed&&arch&&poly.length>=3){const c=centroid(poly);entities.push({id:`dxf-${id++}`,source:file.name,layer:'L1',kind:/room|space|area/i.test(layerName)?'room-boundary':'floor-boundary',name:layerName||'Architectural boundary',x:c.x,y:c.y,z,vertices:poly,confidence:.97,floor:level.floor,meta:{cadLayer:layerName,entity:'LWPOLYLINE',closed:true,vertexCount:poly.length,unitName:units.unitName,unitToMeters:units.unitToMeters,...zMeta}})}for(let j=0;j<count-(closed?0:1);j++){const k=(j+1)%count;entities.push({id:`dxf-${id++}`,source:file.name,layer,kind:arch?'wall-segment':'line',name:layerName||'POLYLINE',x:poly[j].x,y:poly[j].y,z,x2:poly[k].x,y2:poly[k].y,z2:z,confidence:.99,floor:level.floor,meta:{cadLayer:layerName,entity:'LWPOLYLINE',unitName:units.unitName,unitToMeters:units.unitToMeters,...zMeta}})}}
  else if(r.type==='INSERT'||r.type==='TEXT'||r.type==='MTEXT'){const x=Number(v[10]?.[0]),y=Number(v[20]?.[0]);if(!Number.isFinite(x)||!Number.isFinite(y))continue;const name=label||r.type,isRoom=roomCandidate(name),rotation=Number(v[50]?.[0]||0),sx=Number(v[41]?.[0]||1),sy=Number(v[42]?.[0]||sx||1),scale=Math.max(.05,(Math.abs(sx)+Math.abs(sy))/2),isDoor=/door|opening/i.test(`${layerName} ${name}`);entities.push({id:`dxf-${id++}`,source:file.name,layer:isRoom||isDoor?'L1':isElectricalAssetLabel(name)?'L2':layer,kind:isRoom?'room-label':isDoor?'door-opening':r.type==='INSERT'?'cad-block':'cad-text',name,x:nx(x),y:ny(y),z,rotation:Number.isFinite(rotation)?rotation:0,scale:Number.isFinite(scale)?scale:1,confidence:r.type==='INSERT'?.96:.9,floor:level.floor,meta:{cadLayer:layerName,entity:r.type,rawX:x,rawY:y,rawZ:zRaw,unitName:units.unitName,unitToMeters:units.unitToMeters,...zMeta}})}}
 const rooms=entities.filter(e=>e.kind==='room-boundary').length,walls=entities.filter(e=>e.kind==='wall-segment').length,doors=entities.filter(e=>e.kind==='door-opening').length;return{entities,unitName:units.unitName,unitToMeters:units.unitToMeters,summary:`${records.length} CAD entities · ${rooms} closed room polygons · ${walls} wall segments · ${doors} door/opening markers · units ${units.unitName} · rotation/scale/Z preserved`};
}

function withAssetCandidates(parsed:GraphEntity[]){return [...parsed,...parsed.filter(e=>e.layer==='L2'&&e.kind!=='line').map((e,i):GraphEntity=>({id:`asset-candidate-${e.id}-${i}`,source:e.source,layer:'L4',kind:'asset-candidate',name:e.name,x:e.x,y:e.y,z:e.z,rotation:e.rotation,scale:e.scale,floor:e.floor,zone:e.zone,confidence:Math.max(.5,e.confidence-.08),meta:{...e.meta,derivedFrom:e.id,registrationState:'CANDIDATE'}}))]}

function enrichZCandidates(parsed:GraphEntity[]){
 const evidence=parsed.flatMap(entity=>entity.meta?.zEvidence?[entity.meta.zEvidence as ZEvidence]:[]);
 const surfaces=buildProjectDatumSurfaces(evidence);
 const index=buildZResolutionIndex(parsed,evidence);
 return parsed.map(entity=>{
  const resolution=index.get(entity.id);
  const surface=projectDatumSurfaceForEntity(entity,surfaces);
  const surfaceMeta=datumSurfaceMetadata(surface);
  const xyzGuide=Number.isFinite(Number(entity.meta?.unitToMeters))&&String(entity.meta?.unitName||'')!=='unitless'
   ?{zScaleGuideMetersPerSourceUnit:Number(entity.meta?.unitToMeters),zScaleGuideAuthority:'XY_AND_Z_SHARE_SOURCE_UNITS'}
   :{};
  if(!resolution||resolution.status==='UNRESOLVED')return {...entity,meta:{...entity.meta,...surfaceMeta,...xyzGuide,zResolutionStatus:'UNRESOLVED',physicalElevationKnown:false,elevationKnown:false}};
  if(resolution.status==='RESOLVED_DESIGN_CANDIDATE'&&resolution.zMeters!==null){
   return {...entity,meta:{...entity.meta,...surfaceMeta,...xyzGuide,zCandidateMeters:resolution.zMeters,zCandidateReferencePoint:resolution.referencePoint,zResolutionStatus:resolution.status,zResolutionConfidence:resolution.confidence,zResolutionAuthority:resolution.authority,zResolutionEvidence:resolution.evidence,physicalElevationKnown:false,elevationKnown:false,reviewRequired:true}};
  }
  return {...entity,meta:{...entity.meta,...surfaceMeta,...xyzGuide,zCandidateReferencePoint:resolution.referencePoint,zResolutionStatus:resolution.status,zResolutionConfidence:resolution.confidence,zResolutionAuthority:resolution.authority,zResolutionEvidence:resolution.evidence,physicalElevationKnown:false,elevationKnown:false,reviewRequired:true}};
 });
}

async function parseImage(file:File,level:{floor:string;elevation:number},discipline:string,onProgress?:(message:string)=>void):Promise<{entities:GraphEntity[];summary:string;ocrSucceeded:boolean;planType:string|null;planDiscipline:string|null}> {
 const url=URL.createObjectURL(file);
 try {
  const image=await new Promise<HTMLImageElement>((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=url});
  const maxPreviewSide=1800,previewScale=Math.min(1,maxPreviewSide/Math.max(image.naturalWidth,image.naturalHeight,1));
  const preview=document.createElement('canvas'),previewCtx=preview.getContext('2d');
  preview.width=Math.max(1,Math.round(image.naturalWidth*previewScale));preview.height=Math.max(1,Math.round(image.naturalHeight*previewScale));
  if(previewCtx)previewCtx.drawImage(image,0,0,preview.width,preview.height);
  const embeddedRasterDataUrl=previewCtx?preview.toDataURL('image/jpeg',.76):'';
  const landscape=image.naturalWidth>=image.naturalHeight;
  const planeWidth=landscape?20:20*image.naturalWidth/Math.max(image.naturalHeight,1);
  const planeHeight=landscape?20*image.naturalHeight/Math.max(image.naturalWidth,1):20;
  const underlay:GraphEntity={id:'image-raster-underlay',source:file.name,layer:'L1',kind:'source-raster-underlay',name:`${file.name} · raster source plane`,x:-planeWidth/2,y:-planeHeight/2,z:0,x2:planeWidth/2,y2:planeHeight/2,z2:0,floor:level.floor,confidence:1,meta:{sourceType:'IMAGE_RASTER_UNDERLAY',drawingBasemap:true,imageWidth:image.naturalWidth,imageHeight:image.naturalHeight,previewWidth:preview.width,previewHeight:preview.height,embeddedRasterDataUrl,coordinateUnits:'image_preview',geometryAuthority:'RASTER_PREVIEW_ONLY',spatialPlacementAuthority:'SOURCE_IMAGE_PLANE_ONLY',zPlacementAuthority:'UNVERIFIED_DRAWING_PLANE',elevationKnown:false,physicalElevationKnown:false,physicalTruth:false,reviewRequired:false,previewAuthority:'DERIVED_PREVIEW_ONLY'}};
  try{
   onProgress?.('loading OCR engine');
   const mod=await import('tesseract.js');
   const worker=await mod.createWorker('eng',mod.OEM.LSTM_ONLY,{logger:(entry:any)=>{if(entry?.status&&Number.isFinite(Number(entry.progress)))onProgress?.(`${entry.status} · ${Math.round(Number(entry.progress)*100)}%`)}});
   try{
    const result=await worker.recognize(url,{}, {text:true,blocks:true});
    const normalized=buildImageOcrEvidence({
     text:String(result.data?.text||''),
     source:file.name,
     discipline,
     floor:level.floor,
     width:image.naturalWidth,
     height:image.naturalHeight,
     meanConfidence:Number.isFinite(Number(result.data?.confidence))?Number(result.data.confidence):null
    });
    const ocrLines=String(result.data?.text||'').split(/\r?\n/).map((line:string)=>line.trim()).filter(Boolean),plan=detectNonSldPlanPage(ocrLines,0);
    const imageBlockLines=(Array.isArray(result.data?.blocks)?result.data.blocks:[]).flatMap((block:any)=>Array.isArray(block?.paragraphs)?block.paragraphs:[]).flatMap((paragraph:any)=>Array.isArray(paragraph?.lines)?paragraph.lines:[]);
    const imageGeometryItems=imageBlockLines.flatMap((line:any)=>{const label=String(line?.text||'').replace(/\s+/g,' ').trim(),bbox=line?.bbox;if(!label||!bbox)return[];const x0=Number(bbox.x0),y0=Number(bbox.y0),x1=Number(bbox.x1),y1=Number(bbox.y1);if(![x0,y0,x1,y1].every(Number.isFinite))return[];return[{text:label,x:(x0+x1)/2/Math.max(image.naturalWidth,1),y:(y0+y1)/2/Math.max(image.naturalHeight,1),width:Math.abs(x1-x0)/Math.max(image.naturalWidth,1),height:Math.abs(y1-y0)/Math.max(image.naturalHeight,1)}]});
    const imageGeometryEvidence=extractSheetGeometryEvidence({items:imageGeometryItems});
    const classifiedUnderlay={...underlay,meta:{...underlay.meta,drawingScaleEvidence:imageGeometryEvidence.drawingScale,northOrientationEvidence:imageGeometryEvidence.northOrientation,scaleCalibrationEvidence:imageGeometryEvidence.scaleCalibration,...(plan.isPlan?{nonSldPlan:true,planType:plan.planType,planRecognition:'OCR_CONTENT_PLAN_V1',planRecognitionScore:plan.score,planEvidence:plan.reasons,planTitleEvidence:plan.titleEvidence,planDiscipline:plan.discipline}:{})}};
    return{entities:[classifiedUnderlay,...normalized.entities as GraphEntity[]],summary:`${normalized.summary} · raster drawing underlay retained for source-plane review${plan.isPlan?` · recognized ${plan.planType}`:''} · physical scale/alignment/Z unverified`,ocrSucceeded:true,planType:plan.planType,planDiscipline:plan.discipline};
   }finally{await worker.terminate().catch(()=>{})}
  }catch(error){
   return{entities:[underlay],summary:`${image.naturalWidth}×${image.naturalHeight} image preserved · raster drawing underlay retained for source-plane review · OCR unavailable (${error instanceof Error?error.message:'recognition failed'}) · physical scale/alignment/Z unverified`,ocrSucceeded:false,planType:null,planDiscipline:null};
  }
 } finally {URL.revokeObjectURL(url)}
}

async function parseGlb(file:File,buf:ArrayBuffer,digest:string,level:{floor:string;elevation:number}):Promise<GraphEntity>{
 const {bytes}=inspectStandaloneGlb(buf);
 const [{GLTFLoader},{Box3,Vector3}]=await Promise.all([import('three/examples/jsm/loaders/GLTFLoader.js'),import('three')]);
 const gltf=await new Promise<any>((resolve,reject)=>new GLTFLoader().parse(buf,'',resolve,reject));
 const bounds=new Box3().setFromObject(gltf.scene);
 if(bounds.isEmpty())throw new Error('The GLB contains no renderable scene geometry.');
 const size=bounds.getSize(new Vector3());
 if(![size.x,size.y,size.z].every(value=>Number.isFinite(value)&&value>0))throw new Error('The GLB has no measurable 3D bounds.');
 const name=file.name.replace(/\.glb$/i,'').replace(/[_-]+/g,' ').trim();
 return{id:`imported-glb-${digest}`,source:file.name,layer:'L2',kind:'imported-3d-model',name,
   x:0,y:0,z:level.elevation,floor:level.floor,confidence:1,
   meta:{sourceSha256:digest,sourceType:'GLB',embeddedGlb:encodeGlbBase64(bytes),modelBoundsMeters:[size.x,size.y,size.z],
     geometryAuthority:'IMPORTED_3D_FILE',registrationState:'UNREGISTERED',placementAuthority:'UNRESOLVED',
     reviewRequired:true,physicalTruth:false,referenceOnly:true}};
}

export default function CompilerWorkspace(){
 const [files,setFiles]=useState<SourceFile[]>([]),[entities,setEntities]=useState<GraphEntity[]>([]),[busy,setBusy]=useState(false),[dragging,setDragging]=useState(false),[message,setMessage]=useState('');
 const router=useRouter();
 const parseAbortRef=useRef<AbortController|null>(null);
 const [archivedShas,setArchivedShas]=useState<Set<string>>(new Set()),[archiveNote,setArchiveNote]=useState('');
 useEffect(()=>{let active=true;const restore=async()=>{try{const graph=await readPrimarySpatialGraph();if(!active||!graph)return;if(!Array.isArray(graph.sources)||!Array.isArray(graph.entities))throw new Error();setEntities(graph.entities as GraphEntity[]);const restored=(graph.sources as CompiledGraph['sources']).map((source:CompiledGraph['sources'][number]&Partial<SourceFile>)=>({...source,size:source.size||0,state:(source.state||'review') as ParseState,summary:source.summary||'Restored saved source; extraction and alignment remain subject to review.',entities:Number.isFinite(Number(source.entities))?Number(source.entities):(graph.entities as GraphEntity[]).filter((e:GraphEntity)=>e.meta?.sourceSha256===source.sha256||e.source===source.name).length,floor:source.floor||'UNRESOLVED',elevation:source.elevation||0}));setFiles(current=>{const existing=new Map(current.map(item=>[item.sha256,item]));return restored.map((item:SourceFile)=>{const prior=existing.get(item.sha256);return prior?{...item,...prior}:item})});}catch{if(active)setMessage('Saved graph could not be read. Existing data has been preserved.');}};const refresh=()=>{void restore()};void restore();window.addEventListener('stratum:graph-updated',refresh);return()=>{active=false;window.removeEventListener('stratum:graph-updated',refresh)};},[]);
 useEffect(()=>{let active=true;void listArchivedSourceMetadata().then(records=>{if(active)setArchivedShas(new Set(records.map(record=>record.sha256)))});return()=>{active=false}},[]);
 const staleDrawingSources=useMemo(()=>findDrawingSourcesNeedingReprocess(files,entities),[files,entities]);
 const staleBySha=useMemo(()=>new Map(staleDrawingSources.map(item=>[item.source.sha256,item.reason])),[staleDrawingSources]);
 const archivedStaleSources=useMemo(()=>staleDrawingSources.filter(item=>archivedShas.has(String(item.source.sha256||''))),[staleDrawingSources,archivedShas]);
 const totals=useMemo(()=>({files:files.length,parsed:files.filter(f=>f.state==='parsed').length,entities:entities.length,assets:entities.filter(e=>e.layer==='L4').length,levels:new Set(entities.map(e=>e.floor).filter(f=>f&&f!=='UNRESOLVED')).size,rooms:entities.filter(e=>e.kind==='room-boundary').length,nonSldPlanPages:files.reduce((sum,file)=>sum+(file.nonSldPlanPages||0),0),reprocess:staleDrawingSources.length}),[files,entities,staleDrawingSources.length]);
 const layerStats=useMemo(()=>['L0','L1','L2','L3','L4'].reduce((a,l)=>({...a,[l]:entities.filter(e=>e.layer===l).length}),{} as Record<string,number>),[entities]);
 async function saveGraph(nextFiles:SourceFile[],rawEntities:GraphEntity[],replaceSources:{sha256:string;name:string}[]=[]){
  const saved=(await readPrimarySpatialGraph()||{}) as Partial<CompiledGraph>;
  if(saved.entities&&!Array.isArray(saved.entities))throw new Error('Saved graph is invalid; import was not written.');
  const replaceShas=new Set(replaceSources.map(item=>item.sha256)),replaceNames=new Set(replaceSources.map(item=>item.name));
  const current:GraphEntity[]=(saved.entities as GraphEntity[]||[]).filter(entity=>!replaceShas.has(String(entity.meta?.sourceSha256||''))&&!replaceNames.has(entity.source));
  const merged=[...new Map([...current,...rawEntities.filter(e=>e.meta?.sourceType!=='MANUAL_IMAGE_ANNOTATION')].map(e=>[e.id,e])).values()];
  const zoned=assignZones(merged),links=buildLinks(zoned);
  const priorSources=(saved.sources||[]).filter(source=>!replaceShas.has(source.sha256)&&!replaceNames.has(source.name));
  const sources=[...new Map([...priorSources,...nextFiles].map(f=>[f.sha256,f])).values()];
  const base={...saved,coordinationIntelligence:undefined,reviewState:zoned.some(e=>e.layer==='L2'||e.layer==='L4')?'REVIEW_REQUIRED':saved.reviewState,version:'1.2',createdAt:new Date().toISOString(),sources,entities:zoned,links,stats:{L0:sources.length,L1:zoned.filter(e=>e.layer==='L1').length,L2:zoned.filter(e=>e.layer==='L2').length,L3:zoned.filter(e=>e.layer==='L3').length,L4:zoned.filter(e=>e.layer==='L4').length}};
  const graph=enrichCoordinationIntelligence(base as any) as CompiledGraph;
  await replaceCurrentSpatialGraph(graph);
  setEntities(graph.entities as GraphEntity[]);
 }
 async function processFiles(incoming:File[]){if(busy||!incoming.length)return;const controller=new AbortController();parseAbortRef.current=controller;setBusy(true);let nextFiles=[...files],nextEntities=[...entities];for(const file of incoming){const ext=(file.name.split('.').pop()||'').toLowerCase();if(!ACCEPTED.has(ext)){setMessage(`${file.name} skipped: unsupported source format.`);continue}let buf:ArrayBuffer;try{buf=await file.arrayBuffer()}catch{setMessage(`${file.name} could not be read.`);continue}let digest:string;try{digest=await sha(buf)}catch{setMessage(`${file.name}: fingerprint failed; retry the import.`);continue}const archiveResult=await archiveSourceBytes({sha256:digest,name:file.name,mimeType:file.type,size:file.size,ext,bytes:buf});if(archiveResult.archived)setArchivedShas(current=>{const next=new Set(current);next.add(digest);return next});else setArchiveNote(`${file.name} was parsed without a protected browser-local source copy: ${archiveResult.reason}`);const discipline=classify(file.name),level=inferLevel(file.name);let replacementSource:{sha256:string;name:string}|null=null,replacementBackup:{source:SourceFile;entities:GraphEntity[]}|null=null;const existing=nextFiles.find(source=>source.sha256===digest&&source.state!=='failed');if(existing){const reason=drawingSourceReprocessReason(existing,nextEntities);if(!reason)continue;replacementSource={sha256:digest,name:existing.name};replacementBackup={source:existing,entities:nextEntities.filter(entity=>String(entity.meta?.sourceSha256||'')===digest||entity.source===existing.name)};nextFiles=nextFiles.filter(source=>source.sha256!==digest);nextEntities=nextEntities.filter(entity=>String(entity.meta?.sourceSha256||'')!==digest&&entity.source!==existing.name);setMessage(`${file.name}: reprocessing saved drawing with the current basemap/non-SLD pipeline…`)}let sf:SourceFile={name:file.name,size:file.size,ext,discipline,sha256:digest,state:'review',summary:'Format requires review',entities:0,floor:level.floor,elevation:level.elevation};try{if(ext==='pdf'){const parsed=await parsePdf(file,level,discipline,(page,total,phase)=>setMessage(`${file.name}: page ${page} of ${total} · ${phase==='vectors'?'normalizing vectors in worker':'extracting text'}`),controller.signal),graph=withAssetCandidates(scopeSourceEntities(parsed.entities,digest));const zGraph=enrichZCandidates(graph);nextEntities=[...nextEntities,...zGraph];sf={...sf,discipline:parsed.disciplines.length>1?'Multi-discipline':parsed.disciplines[0]||discipline,state:'parsed',floor:[...new Set(graph.map(e=>e.floor))].join(', ')||'UNRESOLVED',summary:`${parsed.summary} · elevations and cross-sheet alignment unverified · ${graph.filter(x=>x.layer==='L4').length} L4 candidates`,entities:zGraph.length,pages:parsed.pages,vectors:parsed.vectors,textItems:parsed.textItems,sldPages:parsed.sldPages,nonSldPlanPages:parsed.nonSldPlanPages,planTypes:parsed.planTypes}}else if(ext==='dxf'){const parsed=parseDxf(file,await file.text(),level),graph=withAssetCandidates(scopeSourceEntities(parsed.entities,digest));nextEntities=[...nextEntities,...graph];sf={...sf,state:'parsed',summary:`${parsed.summary} · floor label ${level.floor}; Z remains source-driven/reviewed · ${graph.filter(x=>x.layer==='L4').length} L4 candidates`,entities:graph.length,unitName:parsed.unitName,unitToMeters:parsed.unitToMeters}}else if(['png','jpg','jpeg'].includes(ext)){const parsed=await parseImage(file,level,discipline,message=>setMessage(`${file.name}: ${message}`)),graph=scopeSourceEntities(parsed.entities,digest) as GraphEntity[];nextEntities=[...nextEntities,...graph];sf={...sf,discipline:parsed.planDiscipline||discipline,state:parsed.ocrSucceeded?'parsed':'review',summary:parsed.summary,entities:graph.length,nonSldPlanPages:parsed.planType?1:0,planTypes:parsed.planType?[parsed.planType]:[]}}else if(['csv','txt'].includes(ext)){const parsed=parseEquipmentScheduleText(await file.text(),file.name,discipline,level.floor),graph=scopeSourceEntities(parsed.entities,digest) as GraphEntity[];nextEntities=[...nextEntities,...graph];sf={...sf,state:'parsed',summary:parsed.summary,entities:graph.length}}else if(ext==='xlsx'){const parsed=parseXlsxBytes(new Uint8Array(buf),file.name,discipline,level.floor),graph=scopeSourceEntities(parsed.entities,digest) as GraphEntity[];nextEntities=[...nextEntities,...graph];sf={...sf,state:'parsed',summary:parsed.summary,entities:graph.length}}else if(ext==='docx'){const parsed=parseDocxBytes(new Uint8Array(buf),file.name,discipline,level.floor),graph=scopeSourceEntities(parsed.entities,digest) as GraphEntity[];nextEntities=[...nextEntities,...graph];sf={...sf,state:'parsed',summary:parsed.summary,entities:graph.length}}else if(ext==='ifc'){const parsed=parseIfcText(await file.text(),file.name,discipline),graph=withAssetCandidates(scopeSourceEntities(parsed.entities,digest) as GraphEntity[]);nextEntities=[...nextEntities,...graph];sf={...sf,state:'parsed',discipline:discipline==='Unclassified'?'BIM / Multi-discipline':discipline,summary:parsed.summary,entities:graph.length,unitName:parsed.unitName,unitToMeters:parsed.unitToMeters||undefined}}else if(ext==='glb'){const model=await parseGlb(file,buf,digest,level);const existing=nextEntities.filter(e=>e.meta?.nonSpatial!==true);if(existing.length){const xs=existing.flatMap(e=>[e.x,...(Number.isFinite(e.x2)?[e.x2!]:[])]);model.x=Math.max(...xs)+3;model.y=existing.reduce((sum,e)=>sum+e.y,0)/existing.length;}nextEntities=[...nextEntities,model];sf={...sf,state:'parsed',summary:'Renderable 3D geometry imported · placement unverified · no registered asset inferred',entities:1,unitName:'m',unitToMeters:1}}else if(ext==='gltf')sf={...sf,state:'adapter',summary:'Use a self-contained .glb export. Standalone .gltf may reference external textures or buffers and cannot be safely restored as one file.'};else if(ext==='xls')sf={...sf,state:'adapter',summary:'Legacy XLS fingerprinted. Binary BIFF adapter or conversion to XLSX is required; no structured engineering fields were invented.'};else if(NATIVE_ADAPTER.includes(ext))sf={...sf,state:'adapter',summary:`${ext.toUpperCase()} fingerprinted. Native adapter required before spatial claims.`};else sf={...sf,state:'review',summary:'Source preserved; format-specific extraction required.'}}catch(err){
 const cancelled=err instanceof DOMException&&err.name==='AbortError';
 const reason=err instanceof Error?err.message:'Parser failed';
 if(replacementBackup){
  nextEntities=nextEntities.filter(entity=>String(entity.meta?.sourceSha256||'')!==digest&&entity.source!==replacementBackup!.source.name);
  nextEntities=[...nextEntities,...replacementBackup.entities];sf=replacementBackup.source;replacementSource=null;
  setMessage(cancelled?`${file.name}: reprocess cancelled; the previous saved compilation was preserved.`:`${file.name}: reprocess stopped safely — ${reason} The previous saved compilation was preserved.`);
 }else{
  sf={...sf,state:'review',summary:cancelled?'Parsing cancelled. The source was preserved; retry import when ready.':`Parser stopped safely: ${reason}`};
  setMessage(cancelled?`${file.name}: parsing cancelled. You can retry immediately without reloading.`:`${file.name}: parser stopped safely. ${reason}`);
 }
}nextFiles=[...nextFiles,sf];nextEntities=enrichZCandidates(nextEntities);setFiles(nextFiles);try{await saveGraph(nextFiles,nextEntities,replacementSource?[replacementSource]:[])}catch{setEntities(nextEntities);parseAbortRef.current=null;setBusy(false);setDragging(false);setMessage('Import could not be saved. Existing saved work is unchanged; imported objects remain in this session. Browser storage may be full or unavailable.');return}if(controller.signal.aborted)break}parseAbortRef.current=null;setBusy(false);setDragging(false);const zoned=assignZones(nextEntities),links=buildLinks(zoned);if(!controller.signal.aborted)setMessage(`Source compilation updated: ${nextFiles.filter(f=>f.state==='parsed').length}/${nextFiles.length} sources · ${new Set(zoned.map(e=>e.floor).filter(f=>f&&f!=='UNRESOLVED')).size} identified floor label(s) · ${zoned.filter(e=>e.kind==='room-boundary').length} reconstructed rooms · ${zoned.length} entities · ${links.length} relationships.`)}
 function cancelParsing(){parseAbortRef.current?.abort();setMessage('Cancelling parser safely… current saved work will be preserved.');}
 async function renderSpatial(){
  if(busy||!entities.length)return;
  setMessage('Preparing the latest compiled graph for Spatial…');
  try{
   let persisted=await readPrimarySpatialGraph();
   const expectedShas=new Set(files.map(file=>file.sha256).filter(Boolean));
   const persistedShas=new Set((Array.isArray(persisted?.sources)?persisted.sources:[]).map((source:any)=>String(source?.sha256||'')).filter(Boolean));
   const hasCurrentSources=[...expectedShas].every(value=>persistedShas.has(value));
   const persistedIds=new Set((Array.isArray(persisted?.entities)?persisted.entities:[]).map((entity:any)=>String(entity?.id||'')));
   const hasCurrentEntities=entities.every(entity=>persistedIds.has(entity.id));
   if(!persisted||!hasCurrentSources||!hasCurrentEntities){
    await saveGraph(files,entities);
    persisted=await readPrimarySpatialGraph();
   }
   if(!persisted||!Array.isArray(persisted.entities)||persisted.entities.length===0)throw new Error('The compiled graph was not available after persistence.');
   const handoff={createdAt:String(persisted.createdAt||''),entities:persisted.entities.length,sources:Array.isArray(persisted.sources)?persisted.sources.length:0,at:new Date().toISOString()};
   sessionStorage.setItem('stratum_spatial_render_handoff',JSON.stringify(handoff));
   setMessage(`Spatial handoff verified: ${handoff.sources} source${handoff.sources===1?'':'s'} · ${handoff.entities} stored entities. Opening Spatial…`);
   router.push('/spatial');
   router.refresh();
  }catch(error){
   setMessage(error instanceof Error?`Spatial render handoff failed: ${error.message}`:'Spatial render handoff failed. The parsed model remains in this browser.');
  }
 }
  async function reprocessArchivedDrawings(){
  if(busy||!archivedStaleSources.length)return;
  const recovered:File[]=[];
  for(const item of archivedStaleSources){
   const record=await readArchivedSource(String(item.source.sha256||''));
   if(record)recovered.push(archivedSourceToFile(record));
  }
  if(!recovered.length){setArchiveNote('The expected local source archive is unavailable on this browser. Re-upload the original drawing file instead.');return}
  setArchiveNote(`Reprocessing ${recovered.length} protected browser-local source${recovered.length===1?'':'s'} with the current parser…`);
  await processFiles(recovered);
 }
 async function addFiles(e:ChangeEvent<HTMLInputElement>){await processFiles(Array.from(e.target.files||[]));e.target.value=''}async function drop(e:DragEvent<HTMLLabelElement>){e.preventDefault();setDragging(false);await processFiles(Array.from(e.dataTransfer.files||[]))}
 async function addTeslaReference(){
  try{
   const response=await fetch('/models/oem/tesla-supercharger-v3-community.glb');
   if(!response.ok)throw new Error('Tesla reference geometry is unavailable on this deployment.');
   const file=new File([await response.blob()],'Tesla Supercharger V3 reference.glb',{type:'model/gltf-binary'});
   await processFiles([file]);
  }catch(error){setMessage(error instanceof Error?error.message:'Tesla reference import failed.');}
 }
 return <div style={{marginTop:14}}>
  <section className="card import-primary">
   <div className="eyebrow">Engineering sources</div>
   <h2>Drop the project set</h2>
   <label className={`source-drop ${dragging?'dragging':''}`} onDragEnter={e=>{e.preventDefault();setDragging(true)}} onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={drop}>
    <div><div className="source-drop-icon">⌁</div><b>{busy?'Parsing engineering sources… page remains interactive':dragging?'Release to import':'Drag files here or choose files'}</b><p className="muted">PDF · DXF/DWG · IFC/RVT · self-contained GLB · images · schedules/spec files</p></div>
    <input hidden multiple disabled={busy} type="file" accept=".pdf,.dwg,.dxf,.ifc,.rvt,.glb,.gltf,.png,.jpg,.jpeg,.csv,.xlsx,.xls,.docx,.txt" onChange={addFiles}/>
   </label>
   <div className="button-row" style={{marginTop:12}}><button className="ghost" type="button" onClick={()=>void addTeslaReference()} disabled={busy}>Add Tesla 3D reference to this project</button></div>
   <p className="muted">The bundled Tesla model is a licensed community visualization. Adding it creates a selectable, unregistered reference with unverified placement; it does not identify equipment on your drawings.</p>

   {message&&<div className="notice" role="status"><strong>{busy?'PARSING':'IMPORT'}</strong><span>{message}</span>{busy&&<button className="ghost" type="button" onClick={cancelParsing}>Cancel parsing</button>}</div>}

   {staleDrawingSources.length>0&&<div className="notice" role="alert"><strong>REPROCESS SAVED DRAWING</strong><span>{staleDrawingSources.length} saved drawing source{staleDrawingSources.length===1?' needs':'s need'} the current basemap/non-SLD parser. {archivedStaleSources.length>0?`${archivedStaleSources.length} source${archivedStaleSources.length===1?' is':'s are'} available in this browser's protected local archive.`:"Older sources without a protected local copy still require the original file to be selected again."}</span>{archivedStaleSources.length>0&&<button className="ghost" type="button" disabled={busy} onClick={()=>void reprocessArchivedDrawings()}>Reprocess archived drawing{archivedStaleSources.length===1?'':'s'}</button>}</div>}
   {archiveNote&&<div className="notice" role="status"><strong>LOCAL SOURCE ARCHIVE</strong><span>{archiveNote}</span></div>}

   {files.length>0&&<div className="import-results">
    {files.map((f,i)=>{const staleReason=staleBySha.get(f.sha256);const summary=staleReason&&f.summary.includes(staleReason)?f.summary.replace(staleReason,'').replace(/^[ ·—-]+|[ ·—-]+$/g,''):f.summary;return <div className="file-row" key={`${f.name}-${i}`}><div className="file-icon">{f.ext.toUpperCase()}</div><div><strong>{f.name}</strong><small>{f.discipline} · {f.floor} @ {f.elevation}m{f.unitName?` · units ${f.unitName}`:''}</small>{Boolean(f.planTypes?.length)&&<small><b>Recognized non-SLD plans:</b> {f.planTypes!.map(value=>value.replaceAll('_',' ')).join(' · ')}</small>}{staleReason&&<small><b>Reprocess required:</b> {staleReason}</small>}{summary&&<small>{summary}</small>}</div><span className={staleReason?'pending':f.state==='parsed'?'proof':'pending'}>{staleReason?'REPROCESS':f.state.toUpperCase()}</span></div>})}
   </div>}

   <div className="import-summary">
    <div><span>Sources</span><strong>{totals.files}</strong></div>
    <div><span>Reprocess required</span><strong>{totals.reprocess}</strong></div>
    <div><span>Sources archived locally</span><strong>{files.filter(file=>archivedShas.has(file.sha256)).length}</strong></div>
    <div><span>Non-SLD plan pages</span><strong>{totals.nonSldPlanPages}</strong></div>
    <div><span>Rooms</span><strong>{totals.rooms}</strong></div>
    <div><span>Equipment candidates</span><strong>{totals.assets}</strong></div>
    <div><span>Levels</span><strong>{totals.levels}</strong></div>
   </div>

   <div className="button-row">{totals.entities>0?<button className="action" type="button" disabled={busy} onClick={()=>void renderSpatial()}>{busy?'Parsing…':'Render Spatial Environment'}</button>:<button className="action" type="button" disabled>Render Spatial Environment</button>}</div>
   <p className="muted" style={{marginBottom:0}}>{totals.entities>0?'Render verifies the persisted source-derived graph before navigation, then opens exactly that revision in Spatial. Unresolved geometry and inference stay reviewable.':'A renderable source object is required first; fingerprint-only files do not unlock a false or demonstration model.'}</p>
  </section>

  <details className="secondary-details card">
   <summary>Advanced compiler details</summary>
   <p className="muted">Use these only for manual annotation, drawing geometry review, source alignment or debugging the source-grounded compilation.</p>
   <PlanAnnotations/>
   <SheetReview/>
   <SpatialPortableRecovery/>
   <div className="workflow-steps" style={{marginTop:14}}>{[['1','Source fingerprint','Original file identity'],['2','Native extraction','PDF/DXF entities'],['3','Architecture','Rooms, walls, openings'],['4','Spatial semantics','Floor, Z, rotation, scale'],['5','Asset candidates','Reviewable L4 candidates']].map(([n,t,d],i)=><div className={`workflow-step ${((i===0&&totals.files>0)||(i===1&&totals.parsed>0))?'done':''}`} key={n}><i>{n}</i><div><strong>{t}</strong><span>{d}</span></div></div>)}</div>
   <div className="provenance-map" style={{marginTop:14}}>{(['L0','L1','L2','L3','L4'] as const).map((l,i)=><span key={l} style={{display:'contents'}}><div className="prov-step active"><i>{l}</i><b>{['Source','Architectural','Electrical Physical','Electrical Logical','STRATUM Assets'][i]}</b><span>{l==='L0'?files.length:layerStats[l]||0} records</span></div>{i<4&&<em>→</em>}</span>)}</div>
  </details>
 </div>;
}
