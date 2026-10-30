/** Native OpenUSD rendering (no GLB intermediary).
 * USDLoader is shipped with three >=0.183. The renderer creates display geometry;
 * it does not prove installation placement, component identity or USD physics support.
 * Standalone files and self-contained USDZ are supported; complex referenced layers
 * should be packaged with their dependencies instead of silently losing textures.
 */
import type { Object3D,Mesh } from 'three';
import {unzipSync} from 'fflate';
import {recoverUnbalancedUSDA} from './spatial-usda-recovery.ts';

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
 const proto=USDAParser.prototype as {_preprocess:(text:string)=>string;_findAssignmentOperator:(text:string)=>number;parseText:(text:string)=>Record<string,unknown>};
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

/** The public Three.js composer does not currently implement all SimReady
 * variants and external composition arcs. Never treat an empty scene as a
 * successful import. Preserve every upstream layer in the browser archive.
 */
function meshCount(group:Object3D):number{
 let count=0;
 group.traverse(node=>{const mesh=node as Mesh;if(mesh.isMesh&&mesh.geometry?.getAttribute('position')?.count)count++;});
 return count;
}
async function parseUSDScene(bytes:ArrayBuffer):Promise<Object3D>{
 const {USDLoader}=await import('three/examples/jsm/loaders/USDLoader.js');
 return await new Promise<Object3D>((resolve,reject)=>{
  try{new USDLoader().parse(bytes,'',model=>resolve(model),error=>reject(error instanceof Error?error:new Error(String(error))));}
  catch(error){reject(error);}
 });
}
/** Native USDZ fallback: extract a single source-authored geometry payload for
 * REVIEW VISUALIZATION ONLY, with an explicit incomplete composition status.
 * No coordinates or materials are invented and no source bytes are rewritten.
 */
async function parseOriginalGeometryPayload(bytes:ArrayBuffer):Promise<Object3D>{
 const files=unzipSync(new Uint8Array(bytes));
 const paths=Object.keys(files).filter(name=>/\/(?:payloads)\/geometries\.(?:usd|usdc)$/i.test(name));
 if(paths.length!==1)throw new Error('Layered USDZ has no unique geometry payload; complete OpenUSD composition is required.');
 const payload=files[paths[0]];
 if(!payload||payload.byteLength===0)throw new Error('Referenced OpenUSD geometry payload is empty.');
 const model=await parseUSDScene(Uint8Array.from(payload).buffer);
 if(meshCount(model)===0)throw new Error('Original USD geometry payload produced no renderable meshes.');
 model.userData.stratumOpenUSD={
  status:'PARTIAL_GEOMETRY_ONLY',reviewRequired:true,physicalTruth:false,
  originalSourceRetained:true,layerPath:paths[0],
  missing:'MATERIAL_BINDINGS_VARIANTS_STAGE_TRANSFORMS_AND_PHYSICS_UNVERIFIED'
 };
 return model;
}

/** Try complete native composition first; if it produces no geometry, expose a
 * clearly marked original-geometry-only preview for layered USDZ sources.
 */
export async function parseNativeUsd(bytes:ArrayBuffer,format:string):Promise<Object3D>{
 if(!isNativeUsdFormat(format))throw new Error('Not a native USD asset.');
 if(bytes.byteLength===0)throw new Error('USD source is empty.');
 await installUSDMetadataCompatibility();
 let model:Object3D|null=null;
 let parseError:unknown=null;
 try{model=await parseUSDScene(bytes);}catch(error){parseError=error;}
 if(model&&meshCount(model)>0){
  model.userData.stratumOpenUSD={status:'SCENE_COMPOSED',reviewRequired:true,physicalTruth:false,originalSourceRetained:true};
  return model;
 }
 const header=new Uint8Array(bytes,0,Math.min(4,bytes.byteLength));
 const zip=header[0]===0x50&&header[1]===0x4b;
 if(format.toUpperCase()!=='USDZ'||!zip){
  throw parseError instanceof Error?parseError:new Error('Native USD source contains no renderable scene geometry.');
 }
 return await parseOriginalGeometryPayload(bytes);
}

/** Registered library models can remain original .usd/.usda/.usdc/.usdz URLs. */
export async function load3DModelFromUrl(
 url:string,format:string,gltfLoader?:{loadAsync:(url:string)=>Promise<{scene:Object3D}>}
):Promise<Object3D>{
 if(isNativeUsdFormat(format)){
  const response=await fetch(url);
  if(!response.ok)throw new Error('Unable to retrieve original OpenUSD source ('+response.status+').');
  return parseNativeUsd(await response.arrayBuffer(),format);
 }
 if(format==='GLB'||format==='GLTF'){
  if(gltfLoader)return (await gltfLoader.loadAsync(url)).scene;
  const {GLTFLoader}=await import('three/examples/jsm/loaders/GLTFLoader.js');
  return (await new GLTFLoader().loadAsync(url)).scene;
 }
 throw new Error('Unsupported 3D model format: '+format);
}
