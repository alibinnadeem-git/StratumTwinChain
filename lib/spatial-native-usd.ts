/** Native OpenUSD rendering (no GLB intermediary).
 * USDLoader is shipped with three >=0.183. The renderer creates display geometry;
 * it does not prove installation placement, component identity or USD physics support.
 * Standalone files and self-contained USDZ are supported; complex referenced layers
 * should be packaged with their dependencies instead of silently losing textures.
 */
import type { Object3D } from 'three';
import {recoverUnbalancedUSDA} from './spatial-usda-recovery';

export const NATIVE_USD_EXTENSIONS=['usd','usda','usdc','usdz'] as const;
const SUPPORTED=new Set<string>(['GLB','GLTF','USD','USDA','USDC','USDZ']);
const USD_FORMATS=new Set<string>(['USD','USDA','USDC','USDZ']);
export function isRenderable3DFormat(value:string):boolean{return SUPPORTED.has(value.toUpperCase());}
export function isNativeUsdFormat(value:string):boolean{return USD_FORMATS.has(value.toUpperCase());}

/** Three's USDA parser (through r186) can treat a standard prim metadata terminator
 * ') {' as a standalone brace, corrupting its parse stack for later custom attributes.
 * Normalize that *in the parser's working text only*, not the archived OpenUSD source.
 * Keep the patch intentionally narrow; unfamiliar layer structures still fail closed.
 */
let patchedUSDMetadata=false;
async function installUSDMetadataCompatibility():Promise<void>{
 if(patchedUSDMetadata)return;
 // @ts-expect-error Three.js publishes the runtime USDAParser as an internal addon.
 const {USDAParser}=await import('three/examples/jsm/loaders/usd/USDAParser.js');
 const proto=USDAParser.prototype as {_preprocess:(text:string)=>string;parseText:(text:string)=>Record<string,unknown>};
 const original=proto._preprocess;
 proto._preprocess=function(text:string){
  const normalized=text.replace(/^\s*\)\s*\{\s*$/gm,')\n{');
  return original.call(this,normalized);
 };
 const parseText=proto.parseText;
 proto.parseText=function(text:string){
  try{return parseText.call(this,text);}
  catch(error){
   if(!(error instanceof TypeError)||!error.message.includes('Cannot set properties of undefined'))throw error;
   return recoverUnbalancedUSDA(text,this);
  }
 };
 patchedUSDMetadata=true;
}

/** Parse source bytes directly and await full texture loading before ready. */
export async function parseNativeUsd(bytes:ArrayBuffer,format:string):Promise<Object3D>{
 if(!isNativeUsdFormat(format))throw new Error('Not a native USD asset.');
 if(bytes.byteLength===0)throw new Error('USD source is empty.');
 await installUSDMetadataCompatibility();
 const {USDLoader}=await import('three/examples/jsm/loaders/USDLoader.js');
 return await new Promise<Object3D>((resolve,reject)=>{
  try{
   new USDLoader().parse(bytes,'',group=>resolve(group),error=>reject(error instanceof Error?error:new Error(String(error))));
  }catch(error){reject(error);}
 });
}

/** Registered library models can remain original .usd/.usda/.usdc/.usdz URLs. */
export async function load3DModelFromUrl(
 url:string,format:string,gltfLoader?:{loadAsync:(url:string)=>Promise<{scene:Object3D}>}
):Promise<Object3D>{
 if(isNativeUsdFormat(format)){
  await installUSDMetadataCompatibility();
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
