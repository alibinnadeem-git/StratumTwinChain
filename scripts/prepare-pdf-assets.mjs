import {cp,mkdir} from 'node:fs/promises';
const target=new URL('../public/pdfjs/wasm/',import.meta.url);
await mkdir(target,{recursive:true});
await cp(new URL('../node_modules/pdfjs-dist/wasm/',import.meta.url),target,{recursive:true});
console.log('PDF image decoders and their license notices prepared.');
