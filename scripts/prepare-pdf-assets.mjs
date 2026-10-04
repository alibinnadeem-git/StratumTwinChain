import {cp,mkdir} from 'node:fs/promises';
const wasmTarget=new URL('../public/pdfjs/wasm/',import.meta.url);
const workerTarget=new URL('../public/pdfjs/',import.meta.url);
await mkdir(wasmTarget,{recursive:true});
await mkdir(workerTarget,{recursive:true});
await cp(new URL('../node_modules/pdfjs-dist/wasm/',import.meta.url),wasmTarget,{recursive:true});
await cp(new URL('../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs',import.meta.url),new URL('../public/pdfjs/pdf.worker.min.mjs',import.meta.url));
console.log('PDF image decoders, parser worker, and their license notices prepared.');
