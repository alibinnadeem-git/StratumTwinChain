/** PDF.js decoder requests also run in a nested worker, which requires an absolute asset URL. */
export function pdfWasmAssetUrl(baseUrl=globalThis.location?.href){
 return baseUrl?new URL('/pdfjs/wasm/',baseUrl).href:'/pdfjs/wasm/';
}
