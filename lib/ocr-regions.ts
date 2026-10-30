// What to OCR on a PDF page, at what resolution, and how readings map back onto the sheet.
//
// Rules (docs/SPATIAL_SOURCE_FIDELITY_PLAN.md, Phase 20a):
// - Read only what has no text layer. On a page with native text, that means the embedded raster images
//   (on the golden fixture: the panel schedules and load tables pasted onto E-2, the scanned unit plans on
//   E-7 to E-9). Pages with almost no text are read whole (the existing scanned-page path).
// - Never send a whole sheet at screen resolution. A 42" sheet rendered 1,800 px wide is about 43 dpi, and
//   no engine read anything from E-2 that way. Regions are rendered at up to 300 dpi (never above the
//   image's own resolution) and split into tiles only when a region is very large.
// - Regions are rendered as printed, so an image stored rotated 90° (all of E-2's schedules) reaches the
//   reader upright with no orientation guessing.
// Everything here is pure: rendering, the reader and the cache are injected, so Node QA runs the same code
// the browser runs.

import type {OcrBox,OcrLine,OcrPixels,OcrReader} from "./ocr-reader.ts";

export type PageSize={width:number;height:number};
export type ImagePlacementKind="IMAGE"|"IMAGE_MASK"|"INLINE_IMAGE";
// box is in page viewport points (scale 1, origin top-left), the same space pdf.js renders in.
export type ImagePlacement={page:number;kind:ImagePlacementKind;pixelWidth:number;pixelHeight:number;box:OcrBox;rotation:0|90|180|270};
export type OcrRegionKind="EMBEDDED_IMAGE"|"FULL_PAGE";
export type OcrRegionPlan={id:string;page:number;kind:OcrRegionKind;box:OcrBox;dpi:number;scale:number;nativePpi:number|null;rotation:0|90|180|270;tiles:OcrBox[];pixels:number};
export type OcrRegionSkip={page:number;box:OcrBox;reason:"FILE_PIXEL_BUDGET"|"REGION_TOO_LARGE"};

export const OCR_REGION_LIMITS={
  // Up to 400 dpi (E-2's schedules are 400 ppi; at 400 the HP1 schedule read 49/49 words, at 300 47/49), but
  // a region that would need tiling at that resolution is read at the highest dpi that fits one tile, down
  // to 300: on E-7 a tiled 400 dpi read took three times as long for no gain.
  maxDpi:400,
  targetDpi:300,
  minDpi:150,
  // Logos, north arrows and stamps are small; a schedule or a scan is several square inches.
  minPlacedAreaPt2:2*72*72,
  minImagePixels:120_000,
  // Under the 16.7 MP canvas limit of Safari, and large enough that E-2's images and the E-7 to E-9 scans
  // are single tiles at 300 dpi.
  maxTileSide:4000,
  maxTilePixels:12_000_000,
  tileOverlapPx:256,
  maxRegionPixels:120_000_000,
  maxFilePixels:250_000_000,
  duplicateIou:.85,
};
export type OcrRegionLimits=typeof OCR_REGION_LIMITS;

type Matrix=[number,number,number,number,number,number];
const multiply=(a:Matrix,b:number[]):Matrix=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
const finite=(value:unknown)=>{const n=Number(value);return Number.isFinite(n)?n:null};

function imagePixels(kind:ImagePlacementKind,args:unknown[]):{width:number;height:number}|null{
  if(kind==="IMAGE"){const width=finite(args[1]),height=finite(args[2]);if(width&&height)return{width,height}}
  const image=args[0] as {width?:unknown;height?:unknown}|null|undefined;
  const width=finite(image?.width),height=finite(image?.height);
  return width&&height?{width,height}:null;
}

// Walks a pdf.js operator list with the same matrix bookkeeping as the vector parser and returns where each
// raster image lands on the page. An image fills the unit square of the current transform.
export function collectImagePlacements(input:{
  page:number;
  fnArray:ArrayLike<number>;
  argsArray:ArrayLike<unknown>;
  ops:Record<string,number>;
  toViewport:(x:number,y:number)=>ArrayLike<number>;
}):ImagePlacement[]{
  const {ops}=input,out:ImagePlacement[]=[],stack:Matrix[]=[];
  const kinds=new Map<number,ImagePlacementKind>([[ops.paintImageXObject,"IMAGE"],[ops.paintImageMaskXObject,"IMAGE_MASK"],[ops.paintInlineImageXObject,"INLINE_IMAGE"]]);
  let matrix:Matrix=[1,0,0,1,0,0];
  for(let k=0;k<input.fnArray.length;k++){
    const fn=input.fnArray[k],args=(input.argsArray[k]||[]) as unknown[];
    if(fn===ops.save)stack.push([...matrix] as Matrix);
    else if(fn===ops.restore)matrix=stack.pop()||[1,0,0,1,0,0];
    else if(fn===ops.transform)matrix=multiply(matrix,args.map(Number));
    else if(fn===ops.paintFormXObjectBegin){stack.push([...matrix] as Matrix);if(args[0])matrix=multiply(matrix,Array.from(args[0] as ArrayLike<number>).map(Number))}
    else if(fn===ops.paintFormXObjectEnd)matrix=stack.pop()||[1,0,0,1,0,0];
    else if(kinds.has(fn)){
      const kind=kinds.get(fn)!,size=imagePixels(kind,args);if(!size)continue;
      const corner=(u:number,v:number)=>{const p=input.toViewport(matrix[0]*u+matrix[2]*v+matrix[4],matrix[1]*u+matrix[3]*v+matrix[5]);return{x:Number(p[0]),y:Number(p[1])}};
      const corners=[corner(0,0),corner(1,0),corner(0,1),corner(1,1)];
      if(!corners.every(point=>Number.isFinite(point.x)&&Number.isFinite(point.y)))continue;
      const xs=corners.map(point=>point.x),ys=corners.map(point=>point.y);
      const angle=Math.atan2(corners[1].y-corners[0].y,corners[1].x-corners[0].x)*180/Math.PI;
      const rotation=(((Math.round(angle/90)*90)%360+360)%360) as 0|90|180|270;
      out.push({page:input.page,kind,pixelWidth:size.width,pixelHeight:size.height,box:{x0:Math.min(...xs),y0:Math.min(...ys),x1:Math.max(...xs),y1:Math.max(...ys)},rotation});
    }
  }
  return out;
}

const area=(box:OcrBox)=>Math.max(0,box.x1-box.x0)*Math.max(0,box.y1-box.y0);
function intersection(a:OcrBox,b:OcrBox):OcrBox{return{x0:Math.max(a.x0,b.x0),y0:Math.max(a.y0,b.y0),x1:Math.min(a.x1,b.x1),y1:Math.min(a.y1,b.y1)}}
export function iou(a:OcrBox,b:OcrBox){const shared=area(intersection(a,b));return shared?shared/(area(a)+area(b)-shared):0}

function tileGrid(box:OcrBox,scale:number,limits:OcrRegionLimits):OcrBox[]{
  const width=(box.x1-box.x0)*scale,height=(box.y1-box.y0)*scale;
  if(width<=limits.maxTileSide&&height<=limits.maxTileSide&&width*height<=limits.maxTilePixels)return[box];
  const side=Math.min(limits.maxTileSide,Math.floor(Math.sqrt(limits.maxTilePixels))),step=side-limits.tileOverlapPx;
  const cols=Math.max(1,Math.ceil((width-limits.tileOverlapPx)/step)),rows=Math.max(1,Math.ceil((height-limits.tileOverlapPx)/step));
  const tiles:OcrBox[]=[];
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const x0=Math.min(col*step,Math.max(0,width-side)),y0=Math.min(row*step,Math.max(0,height-side));
    tiles.push({x0:box.x0+x0/scale,y0:box.y0+y0/scale,x1:box.x0+Math.min(width,x0+side)/scale,y1:box.y0+Math.min(height,y0+side)/scale});
  }
  return tiles;
}

// Resolution for a region: up to maxDpi but never above the image's own resolution (upsampling adds no
// detail); lowered toward targetDpi when that avoids tiling; never below minDpi; lowered to fit the
// per-region pixel budget.
function regionPlan(input:{id:string;page:number;kind:OcrRegionKind;box:OcrBox;nativePpi:number|null;rotation:0|90|180|270},limits:OcrRegionLimits):OcrRegionPlan|null{
  const width=input.box.x1-input.box.x0,height=input.box.y1-input.box.y0;
  const pixelsAt=(value:number)=>width*height*(value/72)**2;
  const dpiForPixels=(pixels:number)=>Math.sqrt(pixels/(width*height))*72;
  let dpi=Math.max(limits.minDpi,Math.min(input.kind==="FULL_PAGE"?limits.targetDpi:limits.maxDpi,input.nativePpi??limits.targetDpi));
  // .999 keeps rounding from tipping a region that fits one tile into a second tile.
  const singleTileDpi=Math.min(dpiForPixels(limits.maxTilePixels),limits.maxTileSide/(Math.max(width,height)/72))*.999;
  if(dpi>singleTileDpi)dpi=Math.max(singleTileDpi,Math.min(dpi,limits.targetDpi));
  if(pixelsAt(dpi)>limits.maxRegionPixels)dpi=dpiForPixels(limits.maxRegionPixels);
  if(dpi<limits.minDpi)return null;
  const scale=dpi/72;
  return{...input,dpi:Math.round(dpi),scale,tiles:tileGrid(input.box,scale,limits),pixels:Math.round(pixelsAt(dpi))};
}

function withinFileBudget(regions:OcrRegionPlan[],limits:OcrRegionLimits){
  const kept:OcrRegionPlan[]=[],skipped:OcrRegionSkip[]=[];let total=0;
  for(const region of regions){
    if(total+region.pixels>limits.maxFilePixels){skipped.push({page:region.page,box:region.box,reason:"FILE_PIXEL_BUDGET"});continue}
    total+=region.pixels;kept.push(region);
  }
  return{regions:kept,skipped};
}

export function planImageOcrRegions(placements:ImagePlacement[],pageSizes:ReadonlyMap<number,PageSize>,options:{skipPages?:ReadonlySet<number>;limits?:Partial<OcrRegionLimits>}={}){
  const limits={...OCR_REGION_LIMITS,...options.limits};
  const candidates:Array<ImagePlacement&{clipped:OcrBox}>=[];
  for(const placement of placements){
    const page=pageSizes.get(placement.page);if(!page||options.skipPages?.has(placement.page))continue;
    const clipped=intersection(placement.box,{x0:0,y0:0,x1:page.width,y1:page.height});
    if(area(clipped)<limits.minPlacedAreaPt2||placement.pixelWidth*placement.pixelHeight<limits.minImagePixels)continue;
    // The same picture painted twice (an image and its mask, or a repeated stamp) is read once.
    const duplicate=candidates.findIndex(other=>other.page===placement.page&&iou(other.clipped,clipped)>limits.duplicateIou);
    if(duplicate>=0){if(placement.pixelWidth*placement.pixelHeight>candidates[duplicate].pixelWidth*candidates[duplicate].pixelHeight)candidates[duplicate]={...placement,clipped};continue}
    candidates.push({...placement,clipped});
  }
  candidates.sort((a,b)=>a.page-b.page||a.clipped.y0-b.clipped.y0||a.clipped.x0-b.clipped.x0);
  const plans:OcrRegionPlan[]=[],skipped:OcrRegionSkip[]=[];const perPage=new Map<number,number>();
  for(const candidate of candidates){
    const index=(perPage.get(candidate.page)||0)+1;perPage.set(candidate.page,index);
    const box=candidate.clipped,placedLongSideInches=Math.max(box.x1-box.x0,box.y1-box.y0)/72;
    const nativePpi=Math.max(candidate.pixelWidth,candidate.pixelHeight)/Math.max(placedLongSideInches,1e-6);
    const plan=regionPlan({id:`p${candidate.page}-image-${index}`,page:candidate.page,kind:"EMBEDDED_IMAGE",box,nativePpi,rotation:candidate.rotation},limits);
    if(plan)plans.push(plan);else skipped.push({page:candidate.page,box,reason:"REGION_TOO_LARGE"});
  }
  const budget=withinFileBudget(plans,limits);
  return{regions:budget.regions,skipped:[...skipped,...budget.skipped]};
}

export function planFullPageOcr(pages:Array<{page:number;size:PageSize}>,options:{limits?:Partial<OcrRegionLimits>}={}){
  const limits={...OCR_REGION_LIMITS,...options.limits};
  const plans:OcrRegionPlan[]=[],skipped:OcrRegionSkip[]=[];
  for(const {page,size} of pages){
    const box={x0:0,y0:0,x1:size.width,y1:size.height};
    const plan=regionPlan({id:`p${page}-page`,page,kind:"FULL_PAGE",box,nativePpi:null,rotation:0},limits);
    if(plan)plans.push(plan);else skipped.push({page,box,reason:"REGION_TOO_LARGE"});
  }
  const budget=withinFileBudget(plans,limits);
  return{regions:budget.regions,skipped:[...skipped,...budget.skipped]};
}

// An uploaded image is read at its own pixels (box and tiles in image pixels, scale 1).
export function planRasterOcr(size:{width:number;height:number},options:{limits?:Partial<OcrRegionLimits>}={}):OcrRegionPlan{
  const limits={...OCR_REGION_LIMITS,...options.limits},box={x0:0,y0:0,x1:size.width,y1:size.height};
  return{id:"image",page:1,kind:"FULL_PAGE",box,dpi:72,scale:1,nativePpi:null,rotation:0,tiles:tileGrid(box,1,limits),pixels:Math.round(size.width*size.height)};
}

// A tile's core ends halfway through each overlap with its neighbour (the last row and column are shifted
// back to fit, so an overlap can be much wider than tileOverlapPx); the cores of a region's tiles cover it
// exactly once. A line belongs to the tile whose core holds its centre, so overlap text is read once.
function axisCores(spans:Array<[number,number]>){
  const unique=[...new Map(spans.map(span=>[span[0].toFixed(6),span])).values()].sort((a,b)=>a[0]-b[0]);
  return new Map(unique.map((span,index)=>[span[0].toFixed(6),[
    index===0?span[0]:(span[0]+unique[index-1][1])/2,
    index===unique.length-1?span[1]:(unique[index+1][0]+span[1])/2,
  ] as [number,number]]));
}
function tileCores(tiles:OcrBox[]):OcrBox[]{
  const xs=axisCores(tiles.map(tile=>[tile.x0,tile.x1])),ys=axisCores(tiles.map(tile=>[tile.y0,tile.y1]));
  return tiles.map(tile=>{const [x0,x1]=xs.get(tile.x0.toFixed(6))!,[y0,y1]=ys.get(tile.y0.toFixed(6))!;return{x0,y0,x1,y1}});
}

export function tileLinesToPage(lines:OcrLine[],tile:OcrBox,scale:number):OcrLine[]{
  return lines.map(line=>({...line,box:{x0:tile.x0+line.box.x0/scale,y0:tile.y0+line.box.y0/scale,x1:tile.x0+line.box.x1/scale,y1:tile.y0+line.box.y1/scale}}));
}

export function mergeTileLines(region:OcrRegionPlan,perTile:Array<{tile:OcrBox;lines:OcrLine[]}>):OcrLine[]{
  const coreList=tileCores(region.tiles),cores=new Map(region.tiles.map((tile,index)=>[tile,coreList[index]]));
  // Half-open cores: a centre exactly on a split belongs to the later tile; the region's far edges are closed.
  const within=(value:number,low:number,high:number,edge:number)=>value>=low&&(value<high||(value===high&&Math.abs(high-edge)<1e-6));
  const kept:OcrLine[]=[];
  for(const {tile,lines} of perTile){
    const core=region.tiles.length>1?cores.get(tile)||tile:tile;
    for(const line of lines){
      const cx=(line.box.x0+line.box.x1)/2,cy=(line.box.y0+line.box.y1)/2;
      if(!within(cx,core.x0,core.x1,region.box.x1)||!within(cy,core.y0,core.y1,region.box.y1))continue;
      kept.push(line);
    }
  }
  return sortReadingOrder(kept);
}

// Top-to-bottom rows, left-to-right within a row; two lines share a row when their vertical centres are
// within half the shorter line's height.
export function sortReadingOrder(lines:OcrLine[]):OcrLine[]{
  const sorted=[...lines].sort((a,b)=>a.box.y0-b.box.y0);
  const rows:OcrLine[][]=[];
  for(const line of sorted){
    const cy=(line.box.y0+line.box.y1)/2,height=line.box.y1-line.box.y0;
    const row=rows.find(candidate=>{const last=candidate[candidate.length-1],lastCy=(last.box.y0+last.box.y1)/2;return Math.abs(lastCy-cy)<=Math.min(height,last.box.y1-last.box.y0)/2});
    if(row)row.push(line);else rows.push([line]);
  }
  return rows.flatMap(row=>row.sort((a,b)=>a.box.x0-b.box.x0));
}

// The parser's sheet plane: long edge = 20 units, origin at the page centre, y up (as for native PDF text).
export function viewportToSheet(x:number,y:number,page:PageSize){
  const unit=20/Math.max(page.width,page.height,1);
  return{x:(x-page.width/2)*unit,y:(page.height/2-y)*unit};
}

export type OcrTileRender=(input:{page:number;tile:OcrBox;scale:number})=>Promise<{pixels:OcrPixels;release():void}>;
export type OcrTileCache={get(key:string):Promise<OcrLine[]|null>;put(key:string,lines:OcrLine[]):Promise<void>};
export type OcrRegionReading={region:OcrRegionPlan;lines:OcrLine[];failedTiles:number;cachedTiles:number;ms:number;error?:string};

export function ocrTileCacheKey(sourceSha256:string,region:OcrRegionPlan,tile:OcrBox,readerVersion:string){
  const r=(value:number)=>value.toFixed(1);
  return[sourceSha256,`p${region.page}`,[tile.x0,tile.y0,tile.x1,tile.y1].map(r).join(","),`s${region.scale.toFixed(4)}`,readerVersion].join("|");
}

const isAbort=(error:unknown)=>(error as {name?:string})?.name==="AbortError"||(error as {code?:string})?.code==="PDF_PARSE_CANCELLED";

// Reads every tile of every region in order with one reader. A failed tile is counted and reported, never
// silently dropped; cancellation stops at once.
export async function readOcrRegions(input:{
  regions:OcrRegionPlan[];
  reader:OcrReader;
  render:OcrTileRender;
  sourceSha256:string;
  cache?:OcrTileCache|null;
  signal?:AbortSignal;
  onProgress?:(done:number,total:number,region:OcrRegionPlan)=>void;
  onTileError?:(region:OcrRegionPlan,tile:OcrBox,error:unknown)=>void;
}):Promise<OcrRegionReading[]>{
  const total=input.regions.reduce((sum,region)=>sum+region.tiles.length,0);
  const readings:OcrRegionReading[]=[];let done=0;
  for(const region of input.regions){
    const started=Date.now(),perTile:Array<{tile:OcrBox;lines:OcrLine[]}>=[];let failedTiles=0,cachedTiles=0,lastError:string|undefined;
    for(const tile of region.tiles){
      if(input.signal?.aborted)throw Object.assign(new Error("OCR cancelled"),{name:"AbortError"});
      const key=ocrTileCacheKey(input.sourceSha256,region,tile,input.reader.version);
      try{
        let lines=input.cache?await input.cache.get(key).catch(()=>null):null;
        if(lines)cachedTiles++;
        else{
          const rendered=await input.render({page:region.page,tile,scale:region.scale});
          try{lines=await input.reader.read(rendered.pixels)}finally{rendered.release()}
          await input.cache?.put(key,lines).catch(()=>{});
        }
        perTile.push({tile,lines:tileLinesToPage(lines,tile,region.scale)});
      }catch(error){
        if(isAbort(error)||input.signal?.aborted)throw error;
        failedTiles++;lastError=error instanceof Error?error.message:String(error);
        input.onTileError?.(region,tile,error);
      }
      input.onProgress?.(++done,total,region);
    }
    readings.push({region,lines:mergeTileLines(region,perTile),failedTiles,cachedTiles,ms:Date.now()-started,...(lastError?{error:lastError}:{})});
  }
  return readings;
}

type OcrGraphEntity={id:string;source:string;layer:"L0";kind:string;name:string;x:number;y:number;z:number;floor:string;confidence:number;meta:Record<string,unknown>};

// Embedded-image readings become non-spatial source records: positioned on the sheet for later table and
// label work (Phase 20), never drawn, never equipment, always review-only. They are also referenceOnly, so
// Expected Power, coordination findings and UI counts do not interpret raw OCR lines ("WATER HEATER 1" in a
// panel schedule is a circuit already served, not a missing supply); Phase 20 turns them into schedule records.
export function ocrRegionEntities(input:{fileName:string;readings:OcrRegionReading[];pageSizes:ReadonlyMap<number,PageSize>;readerId:string;readerVersion:string}):OcrGraphEntity[]{
  const out:OcrGraphEntity[]=[];
  for(const reading of input.readings){
    const {region}=reading,page=input.pageSizes.get(region.page);if(!page)continue;
    const sheetBox=(box:OcrBox)=>{const a=viewportToSheet(box.x0,box.y0,page),b=viewportToSheet(box.x1,box.y1,page);return[Math.min(a.x,b.x),Math.min(a.y,b.y),Math.max(a.x,b.x),Math.max(a.y,b.y)]};
    const confidences=reading.lines.map(line=>line.confidence).filter((value):value is number=>value!==null);
    const meanConfidence=confidences.length?Math.round(confidences.reduce((sum,value)=>sum+value,0)/confidences.length*10)/10:null;
    const common={page:region.page,nonSpatial:true,ocrAuthority:"REVIEW_ONLY",ocrReader:input.readerId,ocrReaderVersion:input.readerVersion,
      ocrRegionId:region.id,ocrRegionKind:region.kind,ocrRenderDpi:region.dpi,ocrNativePpi:region.nativePpi===null?null:Math.round(region.nativePpi),
      ocrPlacementRotation:region.rotation,coordinateUnits:"sheet",physicalTruth:false,reviewRequired:true,referenceOnly:true,spatialPlacementAuthority:"OCR_NON_SPATIAL",
      elevationKnown:false,physicalElevationKnown:false};
    const centre=viewportToSheet((region.box.x0+region.box.x1)/2,(region.box.y0+region.box.y1)/2,page);
    out.push({id:`pdf-ocr-region-${region.id}`,source:input.fileName,layer:"L0",kind:"ocr-region",name:`OCR region · page ${region.page} · ${reading.lines.length} line${reading.lines.length===1?"":"s"}`,
      x:centre.x,y:centre.y,z:0,floor:"UNRESOLVED",confidence:meanConfidence===null?0:meanConfidence/100,
      meta:{...common,sourceType:"PDF_EMBEDDED_IMAGE_OCR_REGION",ocrBoxSheet:sheetBox(region.box),ocrLineCount:reading.lines.length,ocrMeanConfidence:meanConfidence,
        ocrTiles:region.tiles.length,ocrFailedTiles:reading.failedTiles,ocrCachedTiles:reading.cachedTiles,ocrMs:reading.ms,...(reading.error?{ocrError:reading.error}:{})}});
    reading.lines.forEach((line,index)=>{
      const point=viewportToSheet((line.box.x0+line.box.x1)/2,(line.box.y0+line.box.y1)/2,page);
      out.push({id:`pdf-ocr-line-${region.id}-${index}`,source:input.fileName,layer:"L0",kind:"ocr-text-line",name:line.text,x:point.x,y:point.y,z:0,floor:"UNRESOLVED",
        confidence:line.confidence===null?.5:Math.min(.95,line.confidence/100),
        meta:{...common,sourceType:"PDF_EMBEDDED_IMAGE_OCR_TEXT",ocrConfidence:line.confidence,ocrBoxSheet:sheetBox(line.box)}});
    });
  }
  return out;
}
