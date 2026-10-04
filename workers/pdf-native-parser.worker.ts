import {inferPdfPageFloor} from '../lib/compiler-source';
import {classifyElectricalLabel,isElectricalAssetLabel,isElectricalCircuitLabel} from '../lib/sld-recognition';
import {detectPlanFrames,resolveDrawingPageRecognition,resolvePlanFrameAtPoint} from '../lib/plan-recognition';
import {extractSheetGeometryEvidence,type PositionedSheetText} from '../lib/title-block';
import {validateIndependentScale} from '../lib/scale-validation';
import {buildSldVectorTopology} from '../lib/sld-vector-topology';
import {poweredEquipmentClass} from '../lib/power-intelligence';
import {extractZEvidenceFromText,type ZEvidence} from '../lib/z-resolver';
import {buildElevationTriangles,extractPositionedElevationControls,resolveLocalElevationSurface,type ElevationControlPoint,type ElevationTriangle} from '../lib/elevation-surface';
import {enrichSupportBaseOffsets,extractSupportOffsetEvidence,type SupportOffsetEvidence} from '../lib/support-base-evidence';

type Layer='L0'|'L1'|'L2'|'L3'|'L4';
type XY={x:number;y:number};
type GraphEntity={id:string;source:string;layer:Layer;kind:string;name:string;x:number;y:number;z?:number;x2?:number;y2?:number;z2?:number;rotation?:number;scale?:number;floor?:string;zone?:string;vertices?:XY[];confidence:number;meta?:Record<string,unknown>};
type RawText={key:string;str:string;x:number;y:number;page:number};
type Segment={x:number;y:number;x2:number;y2:number;page:number};
type Polygon={vertices:XY[];page:number;confidence:number};
type Level={floor:string;elevation:number};
type ParseResult={entities:GraphEntity[];summary:string;pages:number;vectors:number;textItems:number;sldPages:number;nonSldPlanPages:number;planTypes:string[];disciplines:string[]};

const MAX_FILE_BYTES=64*1024*1024;
const MAX_PAGES=120;
const MAX_TEXT_ITEMS=120000;
const MAX_OPERATORS_PER_PAGE=600000;
const MAX_TOTAL_OPERATORS=2500000;
const MAX_ANALYSIS_SEGMENTS_PER_PAGE=30000;
const MAX_ANALYSIS_SEGMENTS_TOTAL=180000;
const MAX_POLYGONS_PER_PAGE=6000;
const MAX_ACTIVE_PATH_POINTS=25000;

function fail(code:string,message:string,page?:number):never{
 const error=new Error(message) as Error&{code?:string;page?:number};
 error.code=code;if(page)error.page=page;throw error;
}
function post(message:Record<string,unknown>){(globalThis as any).postMessage(message)}
function roomCandidate(s:string){return /room|electrical room|switchgear room|mdf|idf|mechanical room|garage|lobby|corridor|office|lab|data hall|closet|storage/i.test(s)}
function centroid(poly:XY[]){return poly.reduce((a,p)=>({x:a.x+p.x/poly.length,y:a.y+p.y/poly.length}),{x:0,y:0})}

async function parseNativePdf(input:{requestId:string;fileName:string;buffer:ArrayBuffer;level:Level;discipline:string}):Promise<ParseResult>{
 const {requestId,fileName,buffer,level,discipline}=input;
 if(buffer.byteLength>MAX_FILE_BYTES)fail('PDF_FILE_BUDGET',`PDF is ${Math.round(buffer.byteLength/1024/1024)} MB; the browser parser limit is ${MAX_FILE_BYTES/1024/1024} MB. Split the set or use a smaller source.`);
 const PromiseWithResolvers=Promise as any;
 if(typeof PromiseWithResolvers.withResolvers!=='function')PromiseWithResolvers.withResolvers=()=>{let resolve:any,reject:any;const promise=new Promise((ok,fail)=>{resolve=ok;reject=fail});return{promise,resolve,reject}};
 const pdfjs:any=await import('pdfjs-dist/legacy/build/pdf.mjs');
 try{pdfjs.GlobalWorkerOptions.workerSrc='/pdfjs/pdf.worker.min.mjs'}catch{}
 const task=pdfjs.getDocument({data:new Uint8Array(buffer),wasmUrl:'/pdfjs/wasm/'});
 const doc=await task.promise;
 if(doc.numPages>MAX_PAGES){await doc.destroy();fail('PDF_PAGE_BUDGET',`PDF has ${doc.numPages} pages; this browser parse is capped at ${MAX_PAGES}. Split the set and retry.`)}

 const raw:RawText[]=[];
 const polygons:Polygon[]=[];
 const segments:Segment[]=[];
 const pageFloors=new Map<number,string>();
 const pageVectorOps=new Map<number,number>();
 const pageGeometryByPage=new Map<number,{width:number;height:number;max:number}>();
 const pageEvidence=new Map<number,ReturnType<typeof resolveDrawingPageRecognition>['sld']>();
 const planEvidence=new Map<number,ReturnType<typeof resolveDrawingPageRecognition>['plan']>();
 let vectors=0,totalOps=0;

 try{
  for(let p=1;p<=doc.numPages;p++){
   const pageStart=performance.now();
   post({type:'progress',requestId,page:p,total:doc.numPages,phase:'text'});
   const page=await doc.getPage(p);
   const viewport=page.getViewport({scale:1});
   const text=await page.getTextContent();
   pageGeometryByPage.set(p,{width:viewport.width,height:viewport.height,max:Math.max(viewport.width,viewport.height)});
   const items=Array.isArray(text.items)?text.items:[];
   const nativeText=items.map((item:any)=>String(item?.str||'').trim()).filter(Boolean);
   if(nativeText.length<3){
    page.cleanup();
    fail('OCR_FALLBACK_REQUIRED',`Page ${p} has too little native text for the off-thread vector parser. STRATUM will use the scanned/OCR review path instead.`,p);
   }
   pageFloors.set(p,inferPdfPageFloor(nativeText));
   for(const item of items){
    if(!item?.str?.trim())continue;
    if(raw.length>=MAX_TEXT_ITEMS){page.cleanup();fail('PDF_TEXT_BUDGET',`PDF exceeds the ${MAX_TEXT_ITEMS.toLocaleString()} positioned-text budget. Split the drawing set and retry.`,p)}
    const t=item.transform||[1,0,0,1,0,0],point=viewport.convertToViewportPoint(Number(t[4]||0),Number(t[5]||0));
    raw.push({key:`text-${p}-${raw.length}`,str:item.str.trim(),x:(point[0]-viewport.width/2)*20/Math.max(viewport.width,viewport.height,1),y:(viewport.height/2-point[1])*20/Math.max(viewport.width,viewport.height,1),page:p});
   }

   post({type:'progress',requestId,page:p,total:doc.numPages,phase:'vector operators'});
   const ops=await page.getOperatorList();
   const pageOps=ops.fnArray?.length||0;
   if(pageOps>MAX_OPERATORS_PER_PAGE){page.cleanup();fail('PDF_OPERATOR_BUDGET',`Page ${p} contains ${pageOps.toLocaleString()} drawing operators, above the ${MAX_OPERATORS_PER_PAGE.toLocaleString()} per-page safety budget. Split/flatten this sheet or export a lighter PDF.`,p)}
   totalOps+=pageOps;
   if(totalOps>MAX_TOTAL_OPERATORS){page.cleanup();fail('PDF_OPERATOR_BUDGET',`PDF contains more than ${MAX_TOTAL_OPERATORS.toLocaleString()} drawing operators. Split the set and retry.`,p)}
   vectors+=pageOps;pageVectorOps.set(p,pageOps);
   const recognition=resolveDrawingPageRecognition(nativeText,pageOps);
   pageEvidence.set(p,recognition.sld);planEvidence.set(p,recognition.plan);

   if(recognition.sld.isSld||recognition.plan.isPlan){
    post({type:'progress',requestId,page:p,total:doc.numPages,phase:'vector geometry'});
    const active:XY[]=[];let matrix=[1,0,0,1,0,0];const stack:number[][]=[];
    let pageSegments=0,pagePolygons=0;
    const transform=(b:number[])=>{const a=matrix;matrix=[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]]};
    const pushSegment=(prev:XY,next:XY)=>{
     if(pageSegments>=MAX_ANALYSIS_SEGMENTS_PER_PAGE||segments.length>=MAX_ANALYSIS_SEGMENTS_TOTAL)return;
     if(Math.hypot(next.x-prev.x,next.y-prev.y)>.015){segments.push({x:prev.x,y:prev.y,x2:next.x,y2:next.y,page:p});pageSegments++}
    };
    const add=(x:number,y:number,connect=true)=>{
     const point=viewport.convertToViewportPoint(matrix[0]*x+matrix[2]*y+matrix[4],matrix[1]*x+matrix[3]*y+matrix[5]),next={x:(point[0]-viewport.width/2)*20/Math.max(viewport.width,viewport.height,1),y:(viewport.height/2-point[1])*20/Math.max(viewport.width,viewport.height,1)};
     if(connect&&active.length)pushSegment(active[active.length-1],next);
     if(active.length<MAX_ACTIVE_PATH_POINTS)active.push(next);
    };
    const finish=()=>{if(active.length>=3&&pagePolygons<MAX_POLYGONS_PER_PAGE){const first=active[0],last=active[active.length-1];if(Math.hypot(first.x-last.x,first.y-last.y)<.08){polygons.push({vertices:[...active],page:p,confidence:.74});pagePolygons++}}active.length=0};
    const close=()=>{if(active.length>=2){const first=active[0],last=active[active.length-1];pushSegment(last,first);if(active.length<MAX_ACTIVE_PATH_POINTS)active.push(first)}finish()};
    for(let k=0;k<pageOps;k++){
     const fn=ops.fnArray[k],a=ops.argsArray?.[k]||[];
     if(fn===pdfjs.OPS.save){stack.push([...matrix])}
     else if(fn===pdfjs.OPS.restore){matrix=stack.pop()||[1,0,0,1,0,0]}
     else if(fn===pdfjs.OPS.transform){transform(a.map(Number))}
     else if(fn===pdfjs.OPS.paintFormXObjectBegin){stack.push([...matrix]);if(a[0])transform(Array.from(a[0] as ArrayLike<number>))}
     else if(fn===pdfjs.OPS.paintFormXObjectEnd){matrix=stack.pop()||[1,0,0,1,0,0]}
     else if(fn===pdfjs.OPS.constructPath){for(const command of (a[1]||[])){const c=Array.from(command as ArrayLike<number>).map(Number);for(let j=0;j<c.length;){const code=c[j++];if(code===0){finish();add(c[j++],c[j++],false)}else if(code===1){add(c[j++],c[j++])}else if(code===2){j+=6;active.length=0}else if(code===3){j+=4;active.length=0}else if(code===4){close()}else{active.length=0;break}}}finish()}
     else if(fn===pdfjs.OPS.moveTo){finish();add(Number(a[0]),Number(a[1]),false)}
     else if(fn===pdfjs.OPS.lineTo){add(Number(a[0]),Number(a[1]))}
     else if(fn===pdfjs.OPS.rectangle){finish();const [x,y,w,h]=a.map(Number);add(x,y,false);add(x+w,y);add(x+w,y+h);add(x,y+h);close()}
     else if(fn===pdfjs.OPS.closePath){close()}
    }
   }
   page.cleanup();
   post({type:'progress',requestId,page:p,total:doc.numPages,phase:'page complete',elapsedMs:Math.round(performance.now()-pageStart)});
  }

  post({type:'progress',requestId,page:doc.numPages,total:doc.numPages,phase:'spatial semantics'});
  const planFramesByPage=new Map<number,ReturnType<typeof detectPlanFrames>>();
  for(let page=1;page<=doc.numPages;page++){
   const positioned=raw.filter(item=>item.page===page).map(item=>({text:item.str,x:item.x,y:item.y}));
   planFramesByPage.set(page,detectPlanFrames(positioned,planEvidence.get(page)));
  }
  const frameAt=(page:number,x:number,y:number)=>resolvePlanFrameAtPoint(planFramesByPage.get(page)||[],x,y);
  const floorAt=(page:number,x:number,y:number)=>frameAt(page,x,y)?.floor||pageFloors.get(page)||'UNRESOLVED';
  const reviewEntities:GraphEntity[]=[];
  for(const [page,frames] of planFramesByPage)for(const frame of frames)reviewEntities.push({id:`pdf-plan-frame-${page}-${frame.id}`,source:fileName,layer:'L0',kind:'plan-frame-candidate',name:frame.title,x:frame.anchorX,y:frame.anchorY,z:0,floor:frame.floor||'UNRESOLVED',confidence:frame.confidence,meta:{page,nonSpatial:true,sourceType:'PDF_PLAN_FRAME_TITLE',planFrame:frame,physicalTruth:false,reviewRequired:true,geometryAuthority:'TITLE_ANCHOR_ONLY',spatialPlacementAuthority:'SOURCE_SHEET_TITLE_ANCHOR_ONLY',zPlacementAuthority:'UNVERIFIED_DRAWING_PLANE',elevationKnown:false,physicalElevationKnown:false}});

  const zEvidence:ZEvidence[]=[];
  for(let page=1;page<=doc.numPages;page++){
   const labels=raw.filter(item=>item.page===page).map(item=>item.str);
   zEvidence.push(...extractZEvidenceFromText(labels.join('\n'),{source:fileName,floor:pageFloors.get(page)||'UNRESOLVED',idPrefix:`pdf-z-${page}`}));
  }
  for(const evidence of zEvidence)reviewEntities.push({id:evidence.id,source:fileName,layer:'L0',kind:'z-evidence-candidate',name:evidence.evidence[0]||evidence.type,x:0,y:0,z:0,floor:evidence.floor||'UNRESOLVED',confidence:evidence.confidence,meta:{nonSpatial:true,physicalTruth:false,reviewRequired:true,zEvidence:evidence,zPlacementAuthority:'SOURCE_TEXT_Z_EVIDENCE_ONLY',elevationKnown:false,physicalElevationKnown:false}});

  const scaleValidationByPage=new Map<number,ReturnType<typeof validateIndependentScale>>();
  const elevationControlsByPage=new Map<number,ElevationControlPoint[]>();
  const elevationTrianglesByPage=new Map<number,ElevationTriangle[]>();
  const supportOffsetsByPage=new Map<number,SupportOffsetEvidence[]>();
  for(let page=1;page<=doc.numPages;page++){
   const pageGeometry=pageGeometryByPage.get(page);
   const items=raw.filter(item=>item.page===page).map(item=>({text:item.str,x:item.x/20+.5,y:.5-item.y/20})) as PositionedSheetText[];
   const geometryEvidence=extractSheetGeometryEvidence({items,pageWidthPoints:pageGeometry?.width,pageHeightPoints:pageGeometry?.height});
   const pageSegments=segments.filter(segment=>segment.page===page).map(segment=>({x:segment.x/20+.5,y:.5-segment.y/20,x2:segment.x2/20+.5,y2:.5-segment.y2/20}));
   const validation=validateIndependentScale({items,segments:pageSegments,declaredScale:geometryEvidence.drawingScale.value,pageMaxDimensionPoints:pageGeometry?.max,normalizedSheetSpan:20,coordinateSpan:1});
   scaleValidationByPage.set(page,validation);
   if(validation.status!=='UNRESOLVED'||validation.declaredMetersPerNormalizedSheetUnit!==null)reviewEntities.push({id:`pdf-scale-validation-${page}`,source:fileName,layer:'L0',kind:'scale-validation-candidate',name:`Scale validation · page ${page} · ${validation.status}`,x:0,y:0,z:0,floor:pageFloors.get(page)||'UNRESOLVED',confidence:validation.confidence,meta:{page,nonSpatial:true,physicalTruth:false,reviewRequired:true,scaleValidationEvidence:validation,geometryScaleAuthority:false,autoApply:false,elevationKnown:false,physicalElevationKnown:false}});
   const controls=extractPositionedElevationControls({items,source:fileName,page,declaredScale:geometryEvidence.drawingScale.value,scaleValidation:validation,planeWidth:20,planeHeight:20});
   const supportOffsets=extractSupportOffsetEvidence({items,source:fileName,page,planeWidth:20,planeHeight:20});
   supportOffsetsByPage.set(page,supportOffsets);
   for(const support of supportOffsets)reviewEntities.push({id:`pdf-support-offset-${page}-${support.id}`,source:fileName,layer:'L0',kind:'support-offset-evidence',name:support.label,x:support.x,y:support.y,z:0,floor:pageFloors.get(page)||'UNRESOLVED',confidence:support.confidence,meta:{page,nonSpatial:true,supportOffsetEvidence:support,sourceType:'PDF_SUPPORT_OFFSET_EVIDENCE',physicalTruth:false,physicalElevationKnown:false,elevationKnown:false,reviewRequired:true}});
   elevationControlsByPage.set(page,controls);
   const triangles=[...buildElevationTriangles(controls,'GRADE'),...buildElevationTriangles(controls,'FINISHED_FLOOR')];
   elevationTrianglesByPage.set(page,triangles);
   for(const control of controls)reviewEntities.push({id:`pdf-elevation-control-${page}-${control.id}`,source:fileName,layer:'L0',kind:'elevation-control-point',name:control.label,x:control.x,y:control.y,z:control.zMeters,floor:pageFloors.get(page)||'UNRESOLVED',confidence:control.confidence,meta:{page,elevationControl:control,sourceType:'PDF_ELEVATION_CONTROL',coordinateUnits:'sheet',zPlacementAuthority:'SOURCE_ELEVATION_CONTROL',elevationKnown:false,physicalElevationKnown:false,physicalTruth:false,reviewRequired:true}});
   for(const triangle of triangles){const [a,b,c]=triangle.points;reviewEntities.push({id:`pdf-elevation-triangle-${page}-${triangle.id}`,source:fileName,layer:'L1',kind:'elevation-review-surface-triangle',name:`${triangle.kind} review surface`,x:(a.x+b.x+c.x)/3,y:(a.y+b.y+c.y)/3,z:(a.zMeters+b.zMeters+c.zMeters)/3,floor:pageFloors.get(page)||'UNRESOLVED',confidence:triangle.confidence,vertices:[{x:a.x,y:a.y},{x:b.x,y:b.y},{x:c.x,y:c.y}],meta:{page,elevationTriangle:{id:triangle.id,kind:triangle.kind,pointIds:triangle.pointIds,zMeters:[a.zMeters,b.zMeters,c.zMeters]},sourceType:'PDF_ELEVATION_TRIANGLE',coordinateUnits:'sheet',zPlacementAuthority:'SOURCE_ELEVATION_TRIANGLE',elevationKnown:false,physicalElevationKnown:false,physicalTruth:false,reviewRequired:true}})}
  }

  const sldPages=[...pageEvidence.values()].filter(item=>item.isSld).length,nonSldPlanPages=[...planEvidence.values()].filter(item=>item.isPlan).length;
  const planTypes=[...new Set([...planEvidence.values()].filter(item=>item.isPlan&&item.planType).map(item=>String(item.planType)))];
  const disciplines=[...new Set([...planEvidence.values()].filter(item=>item.isPlan&&item.discipline).map(item=>String(item.discipline)))];if(sldPages)disciplines.push('Electrical');
  const uniqueDisciplines=[...new Set(disciplines)];
  const sldMeta=(page:number)=>{const evidence=pageEvidence.get(page);return evidence?.isSld?{sldCandidate:true,sldRecognition:'CONTENT_TOPOLOGY_V2',sldRecognitionScore:evidence.score,sldEvidence:evidence.reasons,sldEquipmentClasses:evidence.equipmentClasses,sldProjectionReviewRequired:true}:{} as Record<string,unknown>};
  const planMeta=(page:number,x?:number,y?:number)=>{const evidence=planEvidence.get(page);if(!evidence?.isPlan)return{} as Record<string,unknown>;const frames=planFramesByPage.get(page)||[],frame=Number.isFinite(x)&&Number.isFinite(y)?resolvePlanFrameAtPoint(frames,Number(x),Number(y)):null;return{nonSldPlan:true,planType:evidence.planType,planRecognition:'CONTENT_PLAN_V2_FRAMES',planRecognitionScore:evidence.score,planEvidence:evidence.reasons,planTitleEvidence:evidence.titleEvidence,planDiscipline:evidence.discipline,planFrameCount:frames.length,planFrames:frames.map(item=>({id:item.id,title:item.title,planType:item.planType,discipline:item.discipline,floor:item.floor,unitId:item.unitId,unitPlan:item.unitPlan,anchorX:item.anchorX,anchorY:item.anchorY,confidence:item.confidence,reviewRequired:true,physicalTruth:false})),...(frame?{planFrameId:frame.id,planFrameTitle:frame.title,planFrameFloor:frame.floor,planFrameUnitId:frame.unitId,planFrameUnitPlan:frame.unitPlan}:{})} as Record<string,unknown>};

  const vectorTopologyByPage=new Map<number,ReturnType<typeof buildSldVectorTopology>>(),vectorAttachmentByKey=new Map<string,{component:number;distance:number;componentAttachmentCount:number}>();let vectorFeederSegments=0;
  for(let page=1;page<=doc.numPages;page++){if(!pageEvidence.get(page)?.isSld)continue;const labels=raw.filter(item=>item.page===page&&Boolean(classifyElectricalLabel(item.str))).map(item=>({id:item.key,x:item.x,y:item.y})),topology=buildSldVectorTopology(segments.filter(segment=>segment.page===page),labels),usableComponents=new Set(topology.attachments.filter(item=>item.componentAttachmentCount>=2).map(item=>item.component));const usable={segments:topology.segments.filter(item=>usableComponents.has(item.component)),attachments:topology.attachments.filter(item=>usableComponents.has(item.component))};vectorTopologyByPage.set(page,usable);vectorFeederSegments+=usable.segments.length;for(const attachment of usable.attachments)vectorAttachmentByKey.set(attachment.labelId,attachment)}

  const entities:GraphEntity[]=[...reviewEntities];let i=0;
  const seenPlanSegments=new Set<string>(),sourcePlanSegmentsByPage=new Map<number,number>();let sourcePlanSegments=0;
  for(const segment of segments){
   if(pageEvidence.get(segment.page)?.isSld||!planEvidence.get(segment.page)?.isPlan)continue;
   if(Math.hypot(segment.x2-segment.x,segment.y2-segment.y)<.015)continue;
   const a=`${segment.x.toFixed(4)},${segment.y.toFixed(4)}`,b=`${segment.x2.toFixed(4)},${segment.y2.toFixed(4)}`,key=`${segment.page}:${[a,b].sort().join('>')}`;
   if(seenPlanSegments.has(key))continue;seenPlanSegments.add(key);
   const pageCount=sourcePlanSegmentsByPage.get(segment.page)||0;if(pageCount>=4000||sourcePlanSegments>=40000)continue;
   sourcePlanSegmentsByPage.set(segment.page,pageCount+1);sourcePlanSegments++;
   entities.push({id:`pdf-plan-line-${segment.page}-${i++}`,source:fileName,layer:'L1',kind:'line',name:`Source plan line · page ${segment.page}`,x:segment.x,y:segment.y,z:0,x2:segment.x2,y2:segment.y2,z2:0,floor:floorAt(segment.page,(segment.x+segment.x2)/2,(segment.y+segment.y2)/2),confidence:.99,meta:{page:segment.page,floorInference:'plan-frame-or-sheet-title-candidate',coordinateUnits:'sheet',sourceType:'PDF source-plan vector line',drawingBasemap:true,pdfTransformsApplied:true,elevationKnown:false,physicalElevationKnown:false,zPlacementAuthority:'UNVERIFIED_DRAWING_PLANE',spatialPlacementAuthority:'SOURCE_SHEET_POSITION_ONLY',physicalTruth:false,reviewRequired:false,scaleValidationEvidence:scaleValidationByPage.get(segment.page),...planMeta(segment.page,(segment.x+segment.x2)/2,(segment.y+segment.y2)/2)}});
  }
  for(const [page,topology] of vectorTopologyByPage)for(const segment of topology.segments)entities.push({id:`pdf-sld-feeder-${page}-${i++}`,source:fileName,layer:'L3',kind:'sld-feeder-candidate',name:`SLD feeder path · page ${page}`,x:segment.x,y:segment.y,z:0,x2:segment.x2,y2:segment.y2,z2:0,floor:pageFloors.get(page),confidence:.88,meta:{page,floorInference:'sheet-title-candidate',elevationKnown:false,coordinateUnits:'sheet',sourceType:'PDF vector electrical path',sldCandidate:true,sldFeederCandidate:true,sldVectorComponent:segment.component,sldVectorAuthority:'PDF_VECTOR_CONNECTED_COMPONENT',reviewRequired:true,physicalTruth:false}});
  for(const p of polygons){if(!pageEvidence.get(p.page)?.isSld&&!planEvidence.get(p.page)?.isPlan)continue;const area=Math.abs(p.vertices.reduce((s,v,j)=>{const n=p.vertices[(j+1)%p.vertices.length];return s+v.x*n.y-n.x*v.y},0))/2;if(area<.08||area>190)continue;const c=centroid(p.vertices);entities.push({id:`pdf-room-${p.page}-${i++}`,source:fileName,layer:'L1',kind:'vector-boundary-candidate',name:`PDF closed path · page ${p.page}`,x:c.x,y:c.y,z:0,vertices:p.vertices,floor:floorAt(p.page,c.x,c.y),confidence:p.confidence,meta:{page:p.page,floorInference:'plan-frame-or-sheet-title-candidate',elevationKnown:false,sourceType:'PDF vector path',reconstruction:'heuristic-closed-path',reviewRequired:true,coordinateUnits:'sheet',pdfTransformsApplied:true,geometryValidated:false,...sldMeta(p.page),...planMeta(p.page,c.x,c.y)}})}
  for(const t of raw){if(/\bcannot locate\b|\bplease advise\b/i.test(t.str)||(!pageEvidence.get(t.page)?.isSld&&!planEvidence.get(t.page)?.isPlan))continue;const equipmentClass=classifyElectricalLabel(t.str),poweredClass=poweredEquipmentClass(t.str),isAsset=Boolean(equipmentClass),isPoweredNonElectrical=Boolean(poweredClass&&!isAsset),isCircuit=isElectricalCircuitLabel(t.str),isRoom=roomCandidate(t.str),vectorAttachment=vectorAttachmentByKey.get(t.key);if(!isAsset&&!isCircuit&&!isRoom&&!isPoweredNonElectrical)continue;const layer:Layer=isRoom?'L1':isPoweredNonElectrical?'L4':isCircuit&&!isAsset?'L3':'L2';entities.push({id:`pdf-${t.page}-${i++}`,source:fileName,layer,kind:isRoom?'room-label':isPoweredNonElectrical?'powered-equipment-candidate':isAsset?'text-asset-candidate':'logical-tag',name:t.str,x:t.x,y:t.y,z:0,floor:floorAt(t.page,t.x,t.y),confidence:isRoom?.7:isPoweredNonElectrical?.72:isAsset?.86:.74,meta:{page:t.page,floorInference:'sheet-title-candidate',elevationKnown:false,coordinateUnits:'sheet',sourceType:'PDF text object',...(poweredClass?{poweredEquipmentClass:poweredClass,registrationState:'CANDIDATE',spatialPlacementAuthority:'SOURCE_SHEET_POSITION_ONLY',physicalTruth:false,reviewRequired:true}:{}),...(equipmentClass?{electricalComponentHint:equipmentClass}:{}),...(vectorAttachment?{sldVectorComponent:vectorAttachment.component,sldVectorDistance:vectorAttachment.distance,sldVectorAuthority:'PDF_VECTOR_CONNECTED_COMPONENT'}:{}),...sldMeta(t.page),...planMeta(t.page,t.x,t.y)}})}

  for(const entity of entities){
   if(entity.meta?.nonSpatial===true||entity.kind==='elevation-control-point'||entity.kind==='elevation-review-surface-triangle')continue;
   const page=Number(entity.meta?.page||0);if(!page)continue;
   const controls=elevationControlsByPage.get(page)||[],triangles=elevationTrianglesByPage.get(page)||[];
   if(controls.length<3||triangles.length===0)continue;
   const planType=String(entity.meta?.planType||''),planDiscipline=String(entity.meta?.planDiscipline||'');
   const preferredKind=planType.includes('GRADING')||planType.includes('DRAINAGE')||planDiscipline.includes('Civil')?'GRADE':entity.floor&&entity.floor!=='UNRESOLVED'?'FINISHED_FLOOR':undefined;
   const local=resolveLocalElevationSurface({x:entity.x,y:entity.y,points:controls,triangles,kind:preferredKind as any});
   if(local.status!=='RESOLVED_REVIEW_SURFACE'||local.zMeters===null)continue;
   entity.meta={...entity.meta,localReviewSurfaceZ:local.zMeters,localReviewSurfaceKind:local.kind,localReviewSurfaceAuthority:local.authority,localReviewSurfaceConfidence:local.confidence,localReviewSurfaceTriangleId:local.triangleId,localReviewSurfaceControlPointIds:local.controlPointIds,physicalTruth:false,reviewRequired:true};
  }
  const supportEnriched=enrichSupportBaseOffsets(entities,[...supportOffsetsByPage.values()].flat());
  return{entities:supportEnriched,summary:`${doc.numPages} page${doc.numPages===1?'':'s'} · ${raw.length} positioned text objects · ${vectors} PDF drawing operators · ${nonSldPlanPages} non-SLD plan page${nonSldPlanPages===1?'':'s'} recognized${planTypes.length?` (${planTypes.join(', ')})`:''} · ${sourcePlanSegments} retained source-plan vector segment${sourcePlanSegments===1?'':'s'} · 0 raster OCR fallback pages · ${sldPages} SLD page${sldPages===1?'':'s'} recognized from content/topology · ${vectorFeederSegments} source-vector feeder segment${vectorFeederSegments===1?'':'s'} · ${supportEnriched.length} spatial/review candidates · parsed off the UI thread`,pages:doc.numPages,vectors,textItems:raw.length,sldPages,nonSldPlanPages,planTypes,disciplines:uniqueDisciplines};
 }finally{await doc.destroy()}
}

(globalThis as any).onmessage=async(event:any)=>{
 const message=event?.data||{};
 if(message.type!=='parse'||!message.requestId)return;
 try{
  const result=await parseNativePdf(message);
  post({type:'result',requestId:message.requestId,result});
 }catch(error){
  post({type:'error',requestId:message.requestId,code:(error as any)?.code||'PDF_PARSE_FAILED',page:(error as any)?.page||null,message:error instanceof Error?error.message:'PDF parsing failed.'});
 }
};
