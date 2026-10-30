import {cp,mkdir} from 'node:fs/promises';
const wasmTarget=new URL('../public/pdfjs/wasm/',import.meta.url);
const workerTarget=new URL('../public/pdfjs/',import.meta.url);
await mkdir(wasmTarget,{recursive:true});
await mkdir(workerTarget,{recursive:true});
await cp(new URL('../node_modules/pdfjs-dist/wasm/',import.meta.url),wasmTarget,{recursive:true});
await cp(new URL('../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs',import.meta.url),new URL('../public/pdfjs/pdf.worker.min.mjs',import.meta.url));
console.log('PDF image decoders, parser worker, and their license notices prepared.');

// OCR runs from this app's own files (lib/client/ocr-runtime.ts), never from a CDN: the tesseract.js worker,
// the LSTM-only engine builds (the reader uses LSTM only; the loader picks relaxed-SIMD, SIMD or plain by
// browser support) and the pinned English language data.
const ocr=new URL('../public/ocr/tesseract/',import.meta.url);
await mkdir(new URL('core/',ocr),{recursive:true});
await mkdir(new URL('lang/',ocr),{recursive:true});
await cp(new URL('../node_modules/tesseract.js/dist/worker.min.js',import.meta.url),new URL('worker.min.js',ocr));
await cp(new URL('../node_modules/tesseract.js/LICENSE.md',import.meta.url),new URL('LICENSE-tesseract.js.md',ocr));
for(const core of ['tesseract-core-relaxedsimd-lstm.wasm.js','tesseract-core-simd-lstm.wasm.js','tesseract-core-lstm.wasm.js'])
 await cp(new URL(`../node_modules/tesseract.js-core/${core}`,import.meta.url),new URL(`core/${core}`,ocr));
await cp(new URL('../node_modules/tesseract.js-core/LICENSE',import.meta.url),new URL('core/LICENSE',ocr));
await cp(new URL('../node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',import.meta.url),new URL('lang/eng.traineddata.gz',ocr));
console.log('OCR worker, engine and English language data prepared.');
