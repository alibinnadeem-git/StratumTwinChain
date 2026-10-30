// Browser side of OCR: one shared Tesseract engine loaded from this app's own files, a tile renderer for
// pdf.js pages, and an IndexedDB cache of readings. Pure planning and merging live in lib/ocr-regions.ts.
//
// Stability rules:
// - Assets come from /ocr/tesseract (copied by scripts/prepare-pdf-assets.mjs), never from a CDN, so OCR
//   works offline and does not depend on jsDelivr being up.
// - One engine per tab, reused across files. A read that fails or hangs past READ_TIMEOUT_MS terminates the
//   engine; the next read starts a fresh one. After IDLE_DISPOSE_MS without reads the engine is released.
// - Every failure is reported on the diagnostics bus; nothing is swallowed.

import {createTesseractReader,type OcrBox,type OcrLine,type OcrPixels,type OcrReader} from "../ocr-reader";
import type {OcrTileCache} from "../ocr-regions";
import {reportSpatialDiag} from "../spatial-diagnostics";

export const OCR_ASSET_BASE="/ocr/tesseract";
const READ_TIMEOUT_MS=120_000;
const IDLE_DISPOSE_MS=180_000;

let engine:Promise<OcrReader>|null=null,idleTimer:ReturnType<typeof setTimeout>|null=null;

function absolute(path:string){return new URL(path,window.location.origin).href}

async function disposeEngine(reason:string){
  const current=engine;engine=null;
  if(idleTimer){clearTimeout(idleTimer);idleTimer=null}
  if(!current)return;
  try{await (await current).dispose()}catch{/* the engine was already unusable; it is being replaced */}
  reportSpatialDiag({stage:"parse",level:"info",code:"OCR_ENGINE_RELEASED",data:{reason}});
}

function startEngine():Promise<OcrReader>{
  const started=performance.now();
  const pending=createTesseractReader({
    // Absolute URLs: tesseract.js loads its worker through a blob URL, where a relative path cannot resolve.
    workerPath:absolute(`${OCR_ASSET_BASE}/worker.min.js`),
    corePath:absolute(`${OCR_ASSET_BASE}/core`),
    langPath:absolute(`${OCR_ASSET_BASE}/lang`),
  }).then(reader=>{
    reportSpatialDiag({stage:"parse",level:"info",code:"OCR_ENGINE_READY",durationMs:performance.now()-started,data:{reader:reader.id,version:reader.version}});
    return reader;
  },error=>{
    if(engine===pending)engine=null;
    reportSpatialDiag({stage:"parse",level:"error",code:"OCR_ENGINE_FAILED",message:error instanceof Error?error.message:String(error),durationMs:performance.now()-started});
    throw error;
  });
  return pending;
}

// The shared reader. Its read() enforces the timeout and recycles the engine after any failure.
export async function sharedTesseractReader():Promise<OcrReader>{
  engine||=startEngine();
  const reader=await engine;
  return{
    id:reader.id,
    version:reader.version,
    async read(pixels:OcrPixels):Promise<OcrLine[]>{
      if(idleTimer){clearTimeout(idleTimer);idleTimer=null}
      let timer:ReturnType<typeof setTimeout>|null=null;
      try{
        const current=await (engine||=startEngine());
        return await Promise.race([
          current.read(pixels),
          new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error(`OCR read exceeded ${READ_TIMEOUT_MS/1000} s`)),READ_TIMEOUT_MS)}),
        ]);
      }catch(error){
        await disposeEngine(error instanceof Error?error.message:"read failed");
        throw error;
      }finally{
        if(timer)clearTimeout(timer);
        idleTimer=setTimeout(()=>{void disposeEngine("idle")},IDLE_DISPOSE_MS);
      }
    },
    async dispose(){await disposeEngine("requested")},
  };
}

type PdfPageLike={getViewport(input:{scale:number;offsetX?:number;offsetY?:number}):unknown;render(input:{canvasContext:CanvasRenderingContext2D;viewport:unknown}):{promise:Promise<unknown>}};

// Renders one tile of a page (viewport points at scale 1) into a canvas at the given scale, on white, as it
// is printed: rotated images come out upright.
export async function renderPdfTile(page:PdfPageLike,tile:OcrBox,scale:number):Promise<{pixels:HTMLCanvasElement;release():void}>{
  const canvas=document.createElement("canvas"),context=canvas.getContext("2d");
  canvas.width=Math.max(1,Math.ceil((tile.x1-tile.x0)*scale));canvas.height=Math.max(1,Math.ceil((tile.y1-tile.y0)*scale));
  if(!context)throw new Error("Canvas rendering unavailable for OCR");
  context.fillStyle="#fff";context.fillRect(0,0,canvas.width,canvas.height);
  await page.render({canvasContext:context,viewport:page.getViewport({scale,offsetX:-tile.x0*scale,offsetY:-tile.y0*scale})}).promise;
  return{pixels:canvas,release(){canvas.width=0;canvas.height=0}};
}

const CACHE_DB="stratum-ocr-cache-v1",CACHE_STORE="tiles";
let cacheDb:Promise<IDBDatabase>|null=null;

function openCache():Promise<IDBDatabase>{
  cacheDb||=new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open(CACHE_DB,1);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(CACHE_STORE))request.result.createObjectStore(CACHE_STORE,{keyPath:"key"})};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error("OCR cache unavailable"));
  }).catch(error=>{cacheDb=null;throw error});
  return cacheDb;
}

function cacheRequest<T>(mode:IDBTransactionMode,run:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
  return openCache().then(db=>new Promise<T>((resolve,reject)=>{
    const request=run(db.transaction(CACHE_STORE,mode).objectStore(CACHE_STORE));
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error("OCR cache request failed"));
  }));
}

// Readings keyed by source SHA-256, page, tile, scale and reader version (lib/ocr-regions.ts), so a re-parse
// of the same drawing does not read it again. A cache that cannot open or write only costs time: OCR still
// runs, and the failure is reported once per session.
let cacheFailureReported=false;
function reportCacheFailure(error:unknown){
  if(cacheFailureReported)return;cacheFailureReported=true;
  reportSpatialDiag({stage:"parse",level:"warn",code:"OCR_CACHE_UNAVAILABLE",message:error instanceof Error?error.message:String(error)});
}
export function ocrTileCache():OcrTileCache|null{
  if(typeof indexedDB==="undefined")return null;
  return{
    async get(key){
      try{const record=await cacheRequest<{key:string;lines:OcrLine[]}|undefined>("readonly",store=>store.get(key));return Array.isArray(record?.lines)?record.lines:null}
      catch(error){reportCacheFailure(error);return null}
    },
    async put(key,lines){
      try{await cacheRequest("readwrite",store=>store.put({key,lines,savedAt:new Date().toISOString()}))}
      catch(error){reportCacheFailure(error)}
    },
  };
}
