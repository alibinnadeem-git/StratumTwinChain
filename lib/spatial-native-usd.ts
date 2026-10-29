/** Native OpenUSD rendering (no GLB intermediary).
 * USDLoader is shipped with three >=0.183. The renderer creates display geometry;
 * it does not prove installation placement, component identity or USD physics support.
 * Standalone files and self-contained USDZ are supported; complex referenced layers
 * should be packaged with their dependencies instead of silently losing textures.
 */
import type { Object3D } from 'three';

export const NATIVE_USD_EXTENSIONS=['usd','usda','usdc','usdz'] as const;
const SUPPORTED=new Set<string>(['GLB','GLTF','USD','USDA','USDC','USDZ']);
const USD_FORMATS=new Set<string>(['USD','USDA','USDC','USDZ']);
export function isRenderable3DFormat(value:string):boolean{return SUPPORTED.has(value.toUpperCase());}
export function isNativeUsdFormat(value:string):boolean{return USD_FORMATS.has(value.toUpperCase());}

/** Parse original bytes directly. r183 USDLoader.parse takes one argument and returns a Group. */
export async function parseNativeUsd(bytes:ArrayBuffer,format:string):Promise<Object3D>{
 if(!isNativeUsdFormat(format))throw new Error('Not a native USD asset.');
 if(bytes.byteLength===0)throw new Error('USD source is empty.');
 const {USDLoader}=await import('three/examples/jsm/loaders/USDLoader.js');
 return new USDLoader().parse(bytes);
}

/** Registered library models can remain original .usd/.usda/.usdc/.usdz URLs. */
export async function load3DModelFromUrl(
 url:string,format:string,gltfLoader?:{loadAsync:(url:string)=>Promise<{scene:Object3D}>}
):Promise<Object3D>{
 if(isNativeUsdFormat(format)){
  const {USDLoader}=await import('three/examples/jsm/loaders/USDLoader.js');
  return await new USDLoader().loadAsync(url);
 }
 if(format==='GLB'||format==='GLTF'){
  if(gltfLoader)return (await gltfLoader.loadAsync(url)).scene;
  const {GLTFLoader}=await import('three/examples/jsm/loaders/GLTFLoader.js');
  return (await new GLTFLoader().loadAsync(url)).scene;
 }
 throw new Error('Unsupported 3D model format: '+format);
}
