// One contract for every OCR reader. A reader gets the pixels of one tile and returns text lines with
// boxes in that tile's pixels; region planning, rendering, caching and sheet coordinates live outside it
// (lib/ocr-regions.ts), so a second reader (PaddleOCR) or an AI vision reader can be added later
// without touching anything downstream.
//
// The Tesseract settings below were measured on the golden fixture (docs/SPATIAL_SOURCE_FIDELITY_PLAN.md,
// Phase 20a): sparse-text page segmentation (PSM 11) with the English dictionaries off read the HP1
// schedule 49/49 words and 19/19 values, and the Service MS1 table 20/23 values, where Tesseract's
// automatic layout with dictionaries read 18/49 and 0/23. Drawing text is tags and numbers, not prose,
// so a dictionary only "corrects" HP1 into words.

export type OcrBox={x0:number;y0:number;x1:number;y1:number};
export type OcrLine={text:string;confidence:number|null;box:OcrBox};
export type OcrPixels=unknown;

export type OcrReader={
  readonly id:string;
  readonly version:string;
  read(pixels:OcrPixels):Promise<OcrLine[]>;
  dispose():Promise<void>;
};

export const TESSERACT_INIT_CONFIG={load_system_dawg:"0",load_freq_dawg:"0"} as const;
export const TESSERACT_PARAMETERS={tessedit_pageseg_mode:"11",preserve_interword_spaces:"1"} as const;
// Bump the suffix whenever the settings or the language data change: cached readings are keyed by it.
export const TESSERACT_READER_VERSION="tesseract.js-7/eng-4.0.0_best_int/psm11-nodict-1";

// Sparse mode also reports specks of line art ("|", "—", "=="). A line must hold a letter or digit, and a
// one-character line must be confident, since single characters are mostly symbol interiors and ticks.
const MIN_SINGLE_CHARACTER_CONFIDENCE=60;

type TesseractLine={text?:unknown;confidence?:unknown;bbox?:{x0?:unknown;y0?:unknown;x1?:unknown;y1?:unknown}};
type TesseractData={blocks?:Array<{paragraphs?:Array<{lines?:TesseractLine[]}>}>|null};

export function linesFromTesseractData(data:TesseractData|null|undefined):OcrLine[]{
  const out:OcrLine[]=[];
  for(const block of data?.blocks||[])for(const paragraph of block?.paragraphs||[])for(const line of paragraph?.lines||[]){
    const text=String(line?.text??"").replace(/\s+/g," ").trim();
    if(!/[A-Za-z0-9]/.test(text))continue;
    const box={x0:Number(line?.bbox?.x0),y0:Number(line?.bbox?.y0),x1:Number(line?.bbox?.x1),y1:Number(line?.bbox?.y1)};
    if(![box.x0,box.y0,box.x1,box.y1].every(Number.isFinite)||box.x1<=box.x0||box.y1<=box.y0)continue;
    const raw=Number(line?.confidence),confidence=Number.isFinite(raw)?Math.max(0,Math.min(100,raw)):null;
    if(text.replace(/[^A-Za-z0-9]/g,"").length<2&&(confidence??0)<MIN_SINGLE_CHARACTER_CONFIDENCE)continue;
    out.push({text,confidence,box});
  }
  return out;
}

// The scanned-page and image-file parsers were written against tesseract.js's result shape
// (data.text, data.confidence, data.blocks[].paragraphs[].lines[] with bbox). This rebuilds that shape from
// reader lines, scaled into the caller's pixel space, so those parsers keep working with any reader.
export function asTesseractResult(lines:OcrLine[],scale=1){
  const confidences=lines.map(line=>line.confidence).filter((value):value is number=>value!==null);
  return{data:{
    text:lines.map(line=>line.text).join("\n"),
    confidence:confidences.length?confidences.reduce((sum,value)=>sum+value,0)/confidences.length:null,
    blocks:[{paragraphs:[{lines:lines.map(line=>({text:line.text,confidence:line.confidence,
      bbox:{x0:line.box.x0*scale,y0:line.box.y0*scale,x1:line.box.x1*scale,y1:line.box.y1*scale}}))}]}],
  }};
}

type TesseractModule={
  createWorker(langs:string,oem:number,options:Record<string,unknown>,config:Record<string,string>):Promise<{
    setParameters(params:Record<string,string>):Promise<unknown>;
    recognize(image:unknown,options:Record<string,unknown>,output:Record<string,boolean>):Promise<{data:TesseractData}>;
    terminate():Promise<unknown>;
  }>;
  OEM:{LSTM_ONLY:number};
};

// Asset paths are injected: the browser passes self-hosted absolute URLs (lib/client/ocr-runtime.ts), Node
// QA passes the local language-data directory with cacheMethod "none" so nothing is written to the repo.
export async function createTesseractReader(options:{workerPath?:string;corePath?:string;langPath?:string;cacheMethod?:string;load?:()=>Promise<TesseractModule>}={}):Promise<OcrReader>{
  const mod=options.load?await options.load():(await import("tesseract.js")) as unknown as TesseractModule;
  const assets=Object.fromEntries(Object.entries({workerPath:options.workerPath,corePath:options.corePath,langPath:options.langPath,cacheMethod:options.cacheMethod}).filter(([,value])=>Boolean(value)));
  const worker=await mod.createWorker("eng",mod.OEM.LSTM_ONLY,assets,{...TESSERACT_INIT_CONFIG});
  await worker.setParameters({...TESSERACT_PARAMETERS});
  return{
    id:"tesseract",
    version:TESSERACT_READER_VERSION,
    async read(pixels){return linesFromTesseractData((await worker.recognize(pixels,{},{blocks:true,text:false})).data)},
    async dispose(){await worker.terminate()},
  };
}
