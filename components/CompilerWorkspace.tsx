'use client';

import Link from 'next/link';
import PlanAnnotations from './PlanAnnotations';
import SheetReview from './SheetReview';
import SpatialPortableRecovery from './SpatialPortableRecovery';
import {inferPdfPageFloor,sameSourceFrame,scopeSourceEntities} from '../lib/compiler-source';
import {classifyElectricalLabel,detectSldPage,isElectricalAssetLabel,isElectricalCircuitLabel} from '../lib/sld-recognition';
import {detectNonSldPlanPage} from '../lib/plan-recognition';
import {buildSldVectorTopology} from '../lib/sld-vector-topology';
import {poweredEquipmentClass} from '../lib/power-intelligence';
import {parseEquipmentScheduleText} from '../lib/equipment-schedule';
import {parseDocxBytes,parseXlsxBytes} from '../lib/office-document-ingest';
import {parseIfcText} from '../lib/ifc-ingest';
import {buildImageOcrEvidence} from '../lib/image-ocr-intelligence';
import {enrichAudiE4SourceReview} from '../lib/audi-e4-source-review';
import {readPrimarySpatialGraph,replaceCurrentSpatialGraph} from '../lib/spatial-browser-recovery';
import {encodeGlbBase64,inspectStandaloneGlb} from '../lib/spatial-glb-import';
import {ChangeEvent,DragEvent,useEffect,useMemo,useState} from 'react';

type Layer='L0'|'L1'|'L2'|'L3'|'L4';
type ParseState='parsed'|'adapter'|'review'|'failed';
type XY={x:number;y:number};
type GraphEntity={id:string;source:string;layer:Layer;kind:string;name:string;x:number;y:number;z?:number;x2?:number;y2?:number;z2?:number;rotation?:number;scale?:number;floor?:string;zone?:string;vertices?:XY[];confidence:number;meta?:Record<string,unknown>};
type SourceFile={name:string;size:number;ext:string;discipline:string;sha256:string;state:ParseState;summary:string;entities:number;floor:string;elevation:number;unitName?:string;unitToMeters?:number;pages?:number;vectors?:number;textItems?:number;sldPages?:number;nonSldPlanPages?:number;planTypes?:string[]};
type GraphLink={id:string;from:string;to:string;type:'SAME_TAG'|'DERIVED_ASSET'|'SOURCE_RELATION';confidence:number};
type CompiledGraph={version:string;createdAt:string;reviewState?:string;sources:{name:string;ext:string;sha256:string;discipline:string;floor:string;elevation:number;unitName?:string;unitToMeters?:number}[];entities:GraphEntity[];links:GraphLink[];stats:Record<Layer,number>};

const NATIVE_ADAPTER=['dwg','rvt'];
const ACCEPTED=new Set(['pdf','dwg','dxf','ifc','rvt','glb','gltf','png','jpg','jpeg','csv','xlsx','xls','docx','txt']);
const classify=(name:string)=>{const n=name.toLowerCase();if(/(^|[^a-z])e\d|elect|power|lighting|one.?line|panel/.test(n))return'Electrical';if(/fire|sprinkler|life.?safety/.test(n))return'Fire Protection';if(/controls|\bbms\b|\bbas\b|\bddc\b/.test(n))return'Controls';if(/struct|framing|foundation/.test(n))return'Structural';if(/civil|grading|drainage|site plan/.test(n))return'Civil';if(/arch|floor|plan/.test(n))return'Architectural';if(/mech|hvac/.test(n))return'Mechanical';if(/plumb/.test(n))return'Plumbing';return'Unclassified'};
const inferLevel=(name:string)=>{const n=name.toLowerCase();if(/roof|penthouse/.test(n))return{floor:'ROOF',elevation:12};if(/basement|\bb1\b|parking/.test(n))return{floor:'B1',elevation:-4};const m=n.match(/(?:level|floor|lvl|fl)[-_ ]?(\d+)/);if(m){const f=Number(m[1]);return{floor:`L${f}`,elevation:(f-1)*4}}if(/ground|\bl1\b|first floor/.test(n))return{floor:'L1',elevation:0};return{floor:'L1',elevation:0}};
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

async function parsePdf(file:File,level:{floor:string;elevation:number},discipline:string,onProgress?:(page:number,total:number)=>void):Promise<{entities:GraphEntity[];summary:string;pages:number;vectors:number;textItems:number;sldPages:number}>{
 const PromiseWithResolvers=Promise as any;
 if(typeof PromiseWithResolvers.withResolvers!=='function')PromiseWithResolvers.withResolvers=()=>{let resolve:any,reject:any;const promise=new Promise((ok,fail)=>{resolve=ok;reject=fail});return{promise,resolve,reject}};
 const pdfjs:any=await import('pdfjs-dist/legacy/build/pdf.mjs');try{pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).toString()}catch{}
 const doc=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),wasmUrl:'/pdfjs/wasm/'}).promise;const raw:{key:string;str:string;x:number;y:number;page:number}[]=[];const polygons:{vertices:XY[];page:number;confidence:number}[]=[];const segments:{x:number;y:number;x2:number;y2:number;page:number}[]=[];const pageFloors=new Map<number,string>();const pageVectorOps=new Map<number,number>();const ocrTextByPage=new Map<number,string[]>();const ocrEntities:GraphEntity[]=[];let vectors=0,ocrPages=0,ocrTextChars=0,ocrWorker:any=null;
 try {
 for(let p=1;p<=doc.numPages;p++){onProgress?.(p,doc.numPages);const page=await doc.getPage(p),viewport=page.getViewport({scale:1}),text=await page.getTextContent();const nativeText=(text.items||[]).map((item:any)=>String(item?.str||'').trim()).filter(Boolean);pageFloors.set(p,inferPdfPageFloor(nativeText));for(const item of text.items||[]){if(!item?.str?.trim())continue;const t=item.transform||[1,0,0,1,0,0],point=viewport.convertToViewportPoint(Number(t[4]||0),Number(t[5]||0));raw.push({key:`text-${p}-${raw.length}`,str:item.str.trim(),x:(point[0]-viewport.width/2)*20/Math.max(viewport.width,viewport.height,1),y:(viewport.height/2-point[1])*20/Math.max(viewport.width,viewport.height,1),page:p})}
 if(nativeText.length<3){try{
   if(!ocrWorker){const mod=await import('tesseract.js');ocrWorker=await mod.createWorker('eng',mod.OEM.LSTM_ONLY)}
   const maxSide=Math.max(viewport.width,viewport.height,1),scale=Math.max(1.25,Math.min(2.4,2400/maxSide)),ocrViewport=page.getViewport({scale}),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
   canvas.width=Math.max(1,Math.round(ocrViewport.width));canvas.height=Math.max(1,Math.round(ocrViewport.height));
   if(!ctx)throw new Error('Canvas rendering unavailable');
   await page.render({canvasContext:ctx,viewport:ocrViewport}).promise;
   const recognized=await ocrWorker.recognize(canvas),ocrText=String(recognized.data?.text||'').trim();
   if(ocrText){
    const lines=ocrText.split(/\r?\n/).map((line:string)=>line.trim()).filter(Boolean);
    ocrTextByPage.set(p,lines);ocrPages++;ocrTextChars+=ocrText.length;
    const floor=inferPdfPageFloor(lines)||pageFloors.get(p)||level.floor;pageFloors.set(p,floor);
    const normalized=buildImageOcrEvidence({text:ocrText,source:file.name,discipline,floor,width:canvas.width,height:canvas.height,meanConfidence:Number.isFinite(Number(recognized.data?.confidence))?Number(recognized.data.confidence):null});
    ocrEntities.push(...normalized.entities.map((entity,index)=>({...entity,id:`pdf-ocr-${p}-${index}-${entity.id}`,meta:{...entity.meta,page:p,sourceType:'PDF_RASTER_OCR_TEXT',ocrAuthority:'REVIEW_ONLY',geometryAuthority:'NONE',coordinateUnits:'NONE',nonSpatial:true,physicalTruth:false,reviewRequired:true,spatialPlacementAuthority:'OCR_NON_SPATIAL'}})) as GraphEntity[]);
   }
  }catch{}}
 try{const ops=await page.getOperatorList();const pageOps=ops.fnArray?.length||0;vectors+=pageOps;pageVectorOps.set(p,pageOps);const active:XY[]=[];let matrix=[1,0,0,1,0,0];const stack:number[][]=[];const transform=(b:number[])=>{const a=matrix;matrix=[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]]};const add=(x:number,y:number,connect=true)=>{const point=viewport.convertToViewportPoint(matrix[0]*x+matrix[2]*y+matrix[4],matrix[1]*x+matrix[3]*y+matrix[5]),next={x:(point[0]-viewport.width/2)*20/Math.max(viewport.width,viewport.height,1),y:(viewport.height/2-point[1])*20/Math.max(viewport.width,viewport.height,1)};if(connect&&active.length){const prev=active[active.length-1];if(Math.hypot(next.x-prev.x,next.y-prev.y)>.015)segments.push({x:prev.x,y:prev.y,x2:next.x,y2:next.y,page:p})}active.push(next)};const finish=()=>{if(active.length>=3){const first=active[0],last=active[active.length-1];if(Math.hypot(first.x-last.x,first.y-last.y)<.08)polygons.push({vertices:[...active],page:p,confidence:.74});}active.length=0};const close=()=>{if(active.length>=2){const first=active[0],last=active[active.length-1];if(Math.hypot(first.x-last.x,first.y-last.y)>.015)segments.push({x:last.x,y:last.y,x2:first.x,y2:first.y,page:p});active.push(first)}finish()};for(let k=0;k<(ops.fnArray||[]).length;k++){const fn=ops.fnArray[k],a=ops.argsArray?.[k]||[];if(fn===pdfjs.OPS.save){stack.push([...matrix])}else if(fn===pdfjs.OPS.restore){matrix=stack.pop()||[1,0,0,1,0,0]}else if(fn===pdfjs.OPS.transform){transform(a.map(Number))}else if(fn===pdfjs.OPS.paintFormXObjectBegin){stack.push([...matrix]);if(a[0])transform(Array.from(a[0] as ArrayLike<number>))}else if(fn===pdfjs.OPS.paintFormXObjectEnd){matrix=stack.pop()||[1,0,0,1,0,0]}else if(fn===pdfjs.OPS.constructPath){for(const command of (a[1]||[])){const c=Array.from(command as ArrayLike<number>).map(Number);for(let j=0;j<c.length;){const code=c[j++];if(code===0){finish();add(c[j++],c[j++],false)}else if(code===1){add(c[j++],c[j++])}else if(code===2){j+=6;active.length=0}else if(code===3){j+=4;active.length=0}else if(code===4){close()}else{active.length=0;break}}}finish()}else if(fn===pdfjs.OPS.moveTo){finish();add(Number(a[0]),Number(a[1]),false)}else if(fn===pdfjs.OPS.lineTo){add(Number(a[0]),Number(a[1]))}else if(fn===pdfjs.OPS.rectangle){finish();const [x,y,w,h]=a.map(Number);add(x,y,false);add(x+w,y);add(x+w,y+h);add(x,y+h);close()}else if(fn===pdfjs.OPS.closePath){close()}}}catch{}finally{page.cleanup()}}
 const pageEvidence=new Map<number,ReturnType<typeof detectSldPage>>();for(let page=1;page<=doc.numPages;page++){pageEvidence.set(page,detectSldPage([...raw.filter(item=>item.page===page).map(item=>item.str),...(ocrTextByPage.get(page)||[])],pageVectorOps.get(page)||0))}const sldPages=[...pageEvidence.values()].filter(item=>item.isSld).length;
 const sldMeta=(page:number)=>{const evidence=pageEvidence.get(page);return evidence?.isSld?{sldCandidate:true,sldRecognition:'CONTENT_TOPOLOGY_V2',sldRecognitionScore:evidence.score,sldEvidence:evidence.reasons,sldEquipmentClasses:evidence.equipmentClasses,sldProjectionReviewRequired:true}:{} as Record<string,unknown>};
 const vectorTopologyByPage=new Map<number,ReturnType<typeof buildSldVectorTopology>>(),vectorAttachmentByKey=new Map<string,{component:number;distance:number;componentAttachmentCount:number}>();let vectorFeederSegments=0;
 for(let page=1;page<=doc.numPages;page++){if(!pageEvidence.get(page)?.isSld)continue;const labels=raw.filter(item=>item.page===page&&Boolean(classifyElectricalLabel(item.str))).map(item=>({id:item.key,x:item.x,y:item.y})),topology=buildSldVectorTopology(segments.filter(segment=>segment.page===page),labels),usableComponents=new Set(topology.attachments.filter(item=>item.componentAttachmentCount>=2).map(item=>item.component));const usable={segments:topology.segments.filter(item=>usableComponents.has(item.component)),attachments:topology.attachments.filter(item=>usableComponents.has(item.component))};vectorTopologyByPage.set(page,usable);vectorFeederSegments+=usable.segments.length;for(const attachment of usable.attachments)vectorAttachmentByKey.set(attachment.labelId,attachment)}
 const entities:GraphEntity[]=[...ocrEntities];let i=0;
 const seenPlanSegments=new Set<string>();let sourcePlanSegments=0;
 for(const segment of segments){
  if(pageEvidence.get(segment.page)?.isSld)continue;
  if(Math.hypot(segment.x2-segment.x,segment.y2-segment.y)<.015)continue;
  const a=`${segment.x.toFixed(4)},${segment.y.toFixed(4)}`,b=`${segment.x2.toFixed(4)},${segment.y2.toFixed(4)}`,key=`${segment.page}:${[a,b].sort().join('>')}`;
  if(seenPlanSegments.has(key))continue;
  seenPlanSegments.add(key);
  if(sourcePlanSegments>=12000)continue;
  sourcePlanSegments++;
  entities.push({id:`pdf-plan-line-${segment.page}-${i++}`,source:file.name,layer:'L1',kind:'line',name:`Source plan line · page ${segment.page}`,x:segment.x,y:segment.y,z:0,x2:segment.x2,y2:segment.y2,z2:0,floor:pageFloors.get(segment.page),confidence:.99,meta:{page:segment.page,floorInference:'sheet-title-candidate',coordinateUnits:'sheet',sourceType:'PDF source-plan vector line',drawingBasemap:true,pdfTransformsApplied:true,elevationKnown:false,physicalElevationKnown:false,zPlacementAuthority:'UNVERIFIED_DRAWING_PLANE',spatialPlacementAuthority:'SOURCE_SHEET_POSITION_ONLY',physicalTruth:false,reviewRequired:false}});
 }
 for(const [page,topology] of vectorTopologyByPage){for(const segment of topology.segments){entities.push({id:`pdf-sld-feeder-${page}-${i++}`,source:file.name,layer:'L3',kind:'sld-feeder-candidate',name:`SLD feeder path · page ${page}`,x:segment.x,y:segment.y,z:0,x2:segment.x2,y2:segment.y2,z2:0,floor:pageFloors.get(page),confidence:.88,meta:{page,floorInference:'sheet-title-candidate',elevationKnown:false,coordinateUnits:'sheet',sourceType:'PDF vector electrical path',sldCandidate:true,sldFeederCandidate:true,sldVectorComponent:segment.component,sldVectorAuthority:'PDF_VECTOR_CONNECTED_COMPONENT',reviewRequired:true,physicalTruth:false}})}}
 for(const p of polygons){const area=Math.abs(p.vertices.reduce((s,v,j)=>{const n=p.vertices[(j+1)%p.vertices.length];return s+v.x*n.y-n.x*v.y},0))/2;if(area<.08||area>190)continue;const c=centroid(p.vertices);entities.push({id:`pdf-room-${p.page}-${i++}`,source:file.name,layer:'L1',kind:'vector-boundary-candidate',name:`PDF closed path · page ${p.page}`,x:c.x,y:c.y,z:0,vertices:p.vertices,floor:pageFloors.get(p.page),confidence:p.confidence,meta:{page:p.page,floorInference:'sheet-title-candidate',elevationKnown:false,sourceType:'PDF vector path',reconstruction:'heuristic-closed-path',reviewRequired:true,coordinateUnits:'sheet',pdfTransformsApplied:true,geometryValidated:false,...sldMeta(p.page)}})}for(const t of raw){if(/\bcannot locate\b|\bplease advise\b/i.test(t.str))continue;const equipmentClass=classifyElectricalLabel(t.str),poweredClass=poweredEquipmentClass(t.str),isAsset=Boolean(equipmentClass),isPoweredNonElectrical=Boolean(poweredClass&&!isAsset),isCircuit=isElectricalCircuitLabel(t.str),isRoom=roomCandidate(t.str),vectorAttachment=vectorAttachmentByKey.get(t.key);if(!isAsset&&!isCircuit&&!isRoom&&!isPoweredNonElectrical)continue;const layer:Layer=isRoom?'L1':isPoweredNonElectrical?'L4':isCircuit&&!isAsset?'L3':'L2';entities.push({id:`pdf-${t.page}-${i++}`,source:file.name,layer,kind:isRoom?'room-label':isPoweredNonElectrical?'powered-equipment-candidate':isAsset?'text-asset-candidate':'logical-tag',name:t.str,x:t.x,y:t.y,z:0,floor:pageFloors.get(t.page),confidence:isRoom?.7:isPoweredNonElectrical?.72:isAsset?.86:.74,meta:{page:t.page,floorInference:'sheet-title-candidate',elevationKnown:false,coordinateUnits:'sheet',sourceType:'PDF text object',...(poweredClass?{poweredEquipmentClass:poweredClass,registrationState:'CANDIDATE',spatialPlacementAuthority:'SOURCE_SHEET_POSITION_ONLY',physicalTruth:false,reviewRequired:true}:{}),...(equipmentClass?{electricalComponentHint:equipmentClass}:{}),...(vectorAttachment?{sldVectorComponent:vectorAttachment.component,sldVectorDistance:vectorAttachment.distance,sldVectorAuthority:'PDF_VECTOR_CONNECTED_COMPONENT'}:{}),...sldMeta(t.page)}})}
 return{entities,summary:`${doc.numPages} page${doc.numPages===1?'':'s'} · ${raw.length} positioned text objects · ${vectors} PDF drawing operators · ${sourcePlanSegments} retained source-plan vector segment${sourcePlanSegments===1?'':'s'} · ${polygons.length} closed vector paths · ${ocrPages} raster OCR fallback page${ocrPages===1?'':'s'} · ${ocrTextChars} OCR text character${ocrTextChars===1?'':'s'} · ${sldPages} SLD page${sldPages===1?'':'s'} recognized from content/topology · ${vectorFeederSegments} source-vector feeder segment${vectorFeederSegments===1?'':'s'} · ${entities.length} spatial/review candidates`,pages:doc.numPages,vectors,textItems:raw.length,sldPages};
 } finally {if(ocrWorker)await ocrWorker.terminate().catch(()=>{});await doc.destroy()}
}

function dxfPairs(text:string){const lines=text.replace(/\r/g,'').split('\n');const out:{code:number;value:string}[]=[];for(let i=0;i+1<lines.length;i+=2){const code=Number(lines[i].trim());if(Number.isFinite(code))out.push({code,value:lines[i+1].trim()})}return out}
function parseDxf(file:File,text:string,level:{floor:string;elevation:number}){
 const pairs=dxfPairs(text),units=unitInfo(pairs),records:any[]=[];let current:any=null,inEntities=false;for(let i=0;i<pairs.length;i++){const p=pairs[i];if(p.code===0&&p.value==='SECTION'&&pairs[i+1]?.code===2&&pairs[i+1]?.value==='ENTITIES'){inEntities=true;i++;continue}if(p.code===0&&p.value==='ENDSEC'){if(current)records.push(current);current=null;if(inEntities)break}if(!inEntities)continue;if(p.code===0){if(current)records.push(current);current={type:p.value,vals:{}};continue}if(current)(current.vals[p.code]??=[]).push(p.value)}if(current)records.push(current);
 const pts:XY[]=[];for(const r of records){const xs=r.vals[10]||[],ys=r.vals[20]||[];for(let i=0;i<Math.min(xs.length,ys.length);i++)pts.push({x:Number(xs[i]),y:Number(ys[i])})}const xs=pts.map(p=>p.x).filter(Number.isFinite),ys=pts.map(p=>p.y).filter(Number.isFinite),minX=Math.min(...xs,0),maxX=Math.max(...xs,1),minY=Math.min(...ys,0),maxY=Math.max(...ys,1);const nx=(x:number)=>normalize(x,minX,maxX),ny=(y:number)=>-normalize(y,minY,maxY)*.7;const entities:GraphEntity[]=[];let id=0;
 for(const r of records){const v=r.vals,layerName=v[8]?.[0]||'',label=v[2]?.[0]||v[1]?.join(' ')||r.type,layer=layerFor(`${layerName} ${label}`),zRaw=Number(v[30]?.[0]||0),z=level.elevation+(Number.isFinite(zRaw)?zRaw*units.unitToMeters:0);
  if(r.type==='LINE'){const x=Number(v[10]?.[0]),y=Number(v[20]?.[0]),x2=Number(v[11]?.[0]),y2=Number(v[21]?.[0]);if([x,y,x2,y2].every(Number.isFinite))entities.push({id:`dxf-${id++}`,source:file.name,layer,kind:'line',name:layerName||'LINE',x:nx(x),y:ny(y),z,x2:nx(x2),y2:ny(y2),z2:z,confidence:.99,floor:level.floor,meta:{cadLayer:layerName,rawX:x,rawY:y,rawX2:x2,rawY2:y2,unitName:units.unitName,unitToMeters:units.unitToMeters}})}
  else if(r.type==='LWPOLYLINE'){const vx=(v[10]||[]).map(Number),vy=(v[20]||[]).map(Number),count=Math.min(vx.length,vy.length),flag=Number(v[70]?.[0]||0),closed=(flag&1)===1||(count>2&&vx[0]===vx[count-1]&&vy[0]===vy[count-1]);const poly=Array.from({length:count},(_,j)=>({x:nx(vx[j]),y:ny(vy[j])}));const arch=layer==='L1';if(closed&&arch&&poly.length>=3){const c=centroid(poly);entities.push({id:`dxf-${id++}`,source:file.name,layer:'L1',kind:/room|space|area/i.test(layerName)?'room-boundary':'floor-boundary',name:layerName||'Architectural boundary',x:c.x,y:c.y,z,vertices:poly,confidence:.97,floor:level.floor,meta:{cadLayer:layerName,entity:'LWPOLYLINE',closed:true,vertexCount:poly.length,unitName:units.unitName,unitToMeters:units.unitToMeters}})}for(let j=0;j<count-(closed?0:1);j++){const k=(j+1)%count;entities.push({id:`dxf-${id++}`,source:file.name,layer,kind:arch?'wall-segment':'line',name:layerName||'POLYLINE',x:poly[j].x,y:poly[j].y,z,x2:poly[k].x,y2:poly[k].y,z2:z,confidence:.99,floor:level.floor,meta:{cadLayer:layerName,entity:'LWPOLYLINE',unitName:units.unitName,unitToMeters:units.unitToMeters}})}}
  else if(r.type==='INSERT'||r.type==='TEXT'||r.type==='MTEXT'){const x=Number(v[10]?.[0]),y=Number(v[20]?.[0]);if(!Number.isFinite(x)||!Number.isFinite(y))continue;const name=label||r.type,isRoom=roomCandidate(name),rotation=Number(v[50]?.[0]||0),sx=Number(v[41]?.[0]||1),sy=Number(v[42]?.[0]||sx||1),scale=Math.max(.05,(Math.abs(sx)+Math.abs(sy))/2),isDoor=/door|opening/i.test(`${layerName} ${name}`);entities.push({id:`dxf-${id++}`,source:file.name,layer:isRoom||isDoor?'L1':isElectricalAssetLabel(name)?'L2':layer,kind:isRoom?'room-label':isDoor?'door-opening':r.type==='INSERT'?'cad-block':'cad-text',name,x:nx(x),y:ny(y),z,rotation:Number.isFinite(rotation)?rotation:0,scale:Number.isFinite(scale)?scale:1,confidence:r.type==='INSERT'?.96:.9,floor:level.floor,meta:{cadLayer:layerName,entity:r.type,rawX:x,rawY:y,rawZ:zRaw,unitName:units.unitName,unitToMeters:units.unitToMeters}})}}
 const rooms=entities.filter(e=>e.kind==='room-boundary').length,walls=entities.filter(e=>e.kind==='wall-segment').length,doors=entities.filter(e=>e.kind==='door-opening').length;return{entities,unitName:units.unitName,unitToMeters:units.unitToMeters,summary:`${records.length} CAD entities · ${rooms} closed room polygons · ${walls} wall segments · ${doors} door/opening markers · units ${units.unitName} · rotation/scale/Z preserved`};
}

function withAssetCandidates(parsed:GraphEntity[]){return [...parsed,...parsed.filter(e=>e.layer==='L2'&&e.kind!=='line').map((e,i):GraphEntity=>({id:`asset-candidate-${e.id}-${i}`,source:e.source,layer:'L4',kind:'asset-candidate',name:e.name,x:e.x,y:e.y,z:e.z,rotation:e.rotation,scale:e.scale,floor:e.floor,zone:e.zone,confidence:Math.max(.5,e.confidence-.08),meta:{...e.meta,derivedFrom:e.id,registrationState:'CANDIDATE'}}))]}

async function parseImage(file:File,level:{floor:string;elevation:number},discipline:string,onProgress?:(message:string)=>void):Promise<{entities:GraphEntity[];summary:string;ocrSucceeded:boolean}> {
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
    const result=await worker.recognize(url);
    const normalized=buildImageOcrEvidence({
     text:String(result.data?.text||''),
     source:file.name,
     discipline,
     floor:level.floor,
     width:image.naturalWidth,
     height:image.naturalHeight,
     meanConfidence:Number.isFinite(Number(result.data?.confidence))?Number(result.data.confidence):null
    });
    return{entities:[underlay,...normalized.entities as GraphEntity[]],summary:`${normalized.summary} · raster drawing underlay retained for source-plane review · physical scale/alignment/Z unverified`,ocrSucceeded:true};
   }finally{await worker.terminate().catch(()=>{})}
  }catch(error){
   return{entities:[underlay],summary:`${image.naturalWidth}×${image.naturalHeight} image preserved · raster drawing underlay retained for source-plane review · OCR unavailable (${error instanceof Error?error.message:'recognition failed'}) · physical scale/alignment/Z unverified`,ocrSucceeded:false};
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
 useEffect(()=>{let active=true;const restore=async()=>{try{const graph=await readPrimarySpatialGraph();if(!active||!graph)return;if(!Array.isArray(graph.sources)||!Array.isArray(graph.entities))throw new Error();setEntities(graph.entities as GraphEntity[]);const restored=(graph.sources as CompiledGraph['sources']).map((source:CompiledGraph['sources'][number]&Partial<SourceFile>)=>({...source,size:source.size||0,state:(source.state||'review') as ParseState,summary:source.summary||'Restored saved source; extraction and alignment remain subject to review.',entities:Number.isFinite(Number(source.entities))?Number(source.entities):(graph.entities as GraphEntity[]).filter((e:GraphEntity)=>e.meta?.sourceSha256===source.sha256||e.source===source.name).length,floor:source.floor||'UNRESOLVED',elevation:source.elevation||0}));setFiles(current=>{const existing=new Map(current.map(item=>[item.sha256,item]));return restored.map((item:SourceFile)=>{const prior=existing.get(item.sha256);return prior?{...item,...prior}:item})});}catch{if(active)setMessage('Saved graph could not be read. Existing data has been preserved.');}};const refresh=()=>{void restore()};void restore();window.addEventListener('stratum:graph-updated',refresh);return()=>{active=false;window.removeEventListener('stratum:graph-updated',refresh)};},[]);
 const totals=useMemo(()=>({files:files.length,parsed:files.filter(f=>f.state==='parsed').length,entities:entities.length,assets:entities.filter(e=>e.layer==='L4').length,levels:new Set(entities.map(e=>e.floor).filter(f=>f&&f!=='UNRESOLVED')).size,rooms:entities.filter(e=>e.kind==='room-boundary').length}),[files,entities]);
 const layerStats=useMemo(()=>['L0','L1','L2','L3','L4'].reduce((a,l)=>({...a,[l]:entities.filter(e=>e.layer===l).length}),{} as Record<string,number>),[entities]);
 async function saveGraph(nextFiles:SourceFile[],rawEntities:GraphEntity[]){
  const saved=(await readPrimarySpatialGraph()||{}) as Partial<CompiledGraph>;
  if(saved.entities&&!Array.isArray(saved.entities))throw new Error('Saved graph is invalid; import was not written.');
  const current:GraphEntity[]=(saved.entities as GraphEntity[]||[]);
  const merged=[...new Map([...current,...rawEntities.filter(e=>e.meta?.sourceType!=='MANUAL_IMAGE_ANNOTATION')].map(e=>[e.id,e])).values()];
  const zoned=assignZones(merged),links=buildLinks(zoned);
  const sources=[...new Map([...(saved.sources||[]),...nextFiles].map(f=>[f.sha256,f])).values()];
  const graph=enrichAudiE4SourceReview({...saved,reviewState:zoned.some(e=>e.layer==='L2'||e.layer==='L4')?'REVIEW_REQUIRED':saved.reviewState,version:'1.1',createdAt:new Date().toISOString(),sources,entities:zoned,links,stats:{L0:sources.length,L1:zoned.filter(e=>e.layer==='L1').length,L2:zoned.filter(e=>e.layer==='L2').length,L3:zoned.filter(e=>e.layer==='L3').length,L4:zoned.filter(e=>e.layer==='L4').length}}) as CompiledGraph;
  await replaceCurrentSpatialGraph(graph);
  setEntities(graph.entities as GraphEntity[]);
 }
 async function processFiles(incoming:File[]){if(busy||!incoming.length)return;setBusy(true);let nextFiles=[...files],nextEntities=[...entities];for(const file of incoming){const ext=(file.name.split('.').pop()||'').toLowerCase();if(!ACCEPTED.has(ext)){setMessage(`${file.name} skipped: unsupported source format.`);continue}let buf:ArrayBuffer;try{buf=await file.arrayBuffer()}catch{setMessage(`${file.name} could not be read.`);continue}let digest:string;try{digest=await sha(buf)}catch{setMessage(`${file.name}: fingerprint failed; retry the import.`);continue}const discipline=classify(file.name),level=inferLevel(file.name);if(nextFiles.some(f=>f.sha256===digest&&f.state!=='failed'))continue;let sf:SourceFile={name:file.name,size:file.size,ext,discipline,sha256:digest,state:'review',summary:'Format requires review',entities:0,floor:level.floor,elevation:level.elevation};try{if(ext==='pdf'){const parsed=await parsePdf(file,level,discipline,(page,total)=>setMessage(`${file.name}: parsing page ${page} of ${total}`)),graph=withAssetCandidates(scopeSourceEntities(parsed.entities,digest));nextEntities=[...nextEntities,...graph];sf={...sf,discipline:parsed.sldPages>0?'Electrical':discipline,state:'parsed',floor:[...new Set(graph.map(e=>e.floor))].join(', ')||'UNRESOLVED',summary:`${parsed.summary} · elevations and cross-sheet alignment unverified · ${graph.filter(x=>x.layer==='L4').length} L4 candidates`,entities:graph.length,pages:parsed.pages,vectors:parsed.vectors,textItems:parsed.textItems,sldPages:parsed.sldPages}}else if(ext==='dxf'){const parsed=parseDxf(file,await file.text(),level),graph=withAssetCandidates(scopeSourceEntities(parsed.entities,digest));nextEntities=[...nextEntities,...graph];sf={...sf,state:'parsed',summary:`${parsed.summary} · ${level.floor} @ ${level.elevation}m · ${graph.filter(x=>x.layer==='L4').length} L4 candidates`,entities:graph.length,unitName:parsed.unitName,unitToMeters:parsed.unitToMeters}}else if(['png','jpg','jpeg'].includes(ext)){const parsed=await parseImage(file,level,discipline,message=>setMessage(`${file.name}: ${message}`)),graph=scopeSourceEntities(parsed.entities,digest) as GraphEntity[];nextEntities=[...nextEntities,...graph];sf={...sf,state:parsed.ocrSucceeded?'parsed':'review',summary:parsed.summary,entities:graph.length}}else if(['csv','txt'].includes(ext)){const parsed=parseEquipmentScheduleText(await file.text(),file.name,discipline,level.floor),graph=scopeSourceEntities(parsed.entities,digest) as GraphEntity[];nextEntities=[...nextEntities,...graph];sf={...sf,state:'parsed',summary:parsed.summary,entities:graph.length}}else if(ext==='xlsx'){const parsed=parseXlsxBytes(new Uint8Array(buf),file.name,discipline,level.floor),graph=scopeSourceEntities(parsed.entities,digest) as GraphEntity[];nextEntities=[...nextEntities,...graph];sf={...sf,state:'parsed',summary:parsed.summary,entities:graph.length}}else if(ext==='docx'){const parsed=parseDocxBytes(new Uint8Array(buf),file.name,discipline,level.floor),graph=scopeSourceEntities(parsed.entities,digest) as GraphEntity[];nextEntities=[...nextEntities,...graph];sf={...sf,state:'parsed',summary:parsed.summary,entities:graph.length}}else if(ext==='ifc'){const parsed=parseIfcText(await file.text(),file.name,discipline),graph=withAssetCandidates(scopeSourceEntities(parsed.entities,digest) as GraphEntity[]);nextEntities=[...nextEntities,...graph];sf={...sf,state:'parsed',discipline:discipline==='Unclassified'?'BIM / Multi-discipline':discipline,summary:parsed.summary,entities:graph.length,unitName:parsed.unitName,unitToMeters:parsed.unitToMeters||undefined}}else if(ext==='glb'){const model=await parseGlb(file,buf,digest,level);const existing=nextEntities.filter(e=>e.meta?.nonSpatial!==true);if(existing.length){const xs=existing.flatMap(e=>[e.x,...(Number.isFinite(e.x2)?[e.x2!]:[])]);model.x=Math.max(...xs)+3;model.y=existing.reduce((sum,e)=>sum+e.y,0)/existing.length;}nextEntities=[...nextEntities,model];sf={...sf,state:'parsed',summary:'Renderable 3D geometry imported · placement unverified · no registered asset inferred',entities:1,unitName:'m',unitToMeters:1}}else if(ext==='gltf')sf={...sf,state:'adapter',summary:'Use a self-contained .glb export. Standalone .gltf may reference external textures or buffers and cannot be safely restored as one file.'};else if(ext==='xls')sf={...sf,state:'adapter',summary:'Legacy XLS fingerprinted. Binary BIFF adapter or conversion to XLSX is required; no structured engineering fields were invented.'};else if(NATIVE_ADAPTER.includes(ext))sf={...sf,state:'adapter',summary:`${ext.toUpperCase()} fingerprinted. Native adapter required before spatial claims.`};else sf={...sf,state:'review',summary:'Source preserved; format-specific extraction required.'}}catch(err){sf={...sf,state:'failed',summary:err instanceof Error?err.message:'Parser failed'}}nextFiles=[...nextFiles,sf];setFiles(nextFiles);try{await saveGraph(nextFiles,nextEntities)}catch{setEntities(nextEntities);setBusy(false);setDragging(false);setMessage('Import could not be saved. Existing saved work is unchanged; imported objects remain in this session. Browser storage may be full or unavailable.');return}}setBusy(false);setDragging(false);const zoned=assignZones(nextEntities),links=buildLinks(zoned);setMessage(`Source compilation updated: ${nextFiles.filter(f=>f.state==='parsed').length}/${nextFiles.length} sources · ${new Set(zoned.map(e=>e.floor).filter(f=>f&&f!=='UNRESOLVED')).size} identified floor label(s) · ${zoned.filter(e=>e.kind==='room-boundary').length} reconstructed rooms · ${zoned.length} entities · ${links.length} relationships.`)}
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
    <div><div className="source-drop-icon">⌁</div><b>{busy?'Parsing engineering sources…':dragging?'Release to import':'Drag files here or choose files'}</b><p className="muted">PDF · DXF/DWG · IFC/RVT · self-contained GLB · images · schedules/spec files</p></div>
    <input hidden multiple disabled={busy} type="file" accept=".pdf,.dwg,.dxf,.ifc,.rvt,.glb,.gltf,.png,.jpg,.jpeg,.csv,.xlsx,.xls,.docx,.txt" onChange={addFiles}/>
   </label>
   <div className="button-row" style={{marginTop:12}}><button className="ghost" type="button" onClick={()=>void addTeslaReference()} disabled={busy}>Add Tesla 3D reference to this project</button></div>
   <p className="muted">The bundled Tesla model is a licensed community visualization. Adding it creates a selectable, unregistered reference with unverified placement; it does not identify equipment on your drawings.</p>

   {message&&<div className="notice" role="status"><strong>{busy?'PARSING':'IMPORT'}</strong><span>{message}</span></div>}

   {files.length>0&&<div className="import-results">
    {files.map((f,i)=><div className="file-row" key={`${f.name}-${i}`}><div className="file-icon">{f.ext.toUpperCase()}</div><div><strong>{f.name}</strong><small>{f.discipline} · {f.floor} @ {f.elevation}m{f.unitName?` · units ${f.unitName}`:''}</small><small>{f.summary}</small></div><span className={f.state==='parsed'?'proof':'pending'}>{f.state.toUpperCase()}</span></div>)}
   </div>}

   <div className="import-summary">
    <div><span>Sources</span><strong>{totals.files}</strong></div>
    <div><span>Rooms</span><strong>{totals.rooms}</strong></div>
    <div><span>Equipment candidates</span><strong>{totals.assets}</strong></div>
    <div><span>Levels</span><strong>{totals.levels}</strong></div>
   </div>

   <div className="button-row">{totals.entities>0?<Link className="action" href="/spatial">Render Spatial Environment</Link>:<button className="action" type="button" disabled>Render Spatial Environment</button>}</div>
   <p className="muted" style={{marginBottom:0}}>{totals.entities>0?'Render compiles the current source-derived graph into the Spatial environment and keeps unresolved geometry/inference reviewable.':'A renderable source object is required first; fingerprint-only files do not unlock a false or demonstration model.'}</p>
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
