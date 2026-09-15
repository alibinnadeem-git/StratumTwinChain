import {ELECTRICAL_COMPONENTS} from './electrical-component-library';

export type ElectricalModelFormat='GLB'|'GLTF'|'USD'|'USDZ';
export type ElectricalModelConfig={
  componentKey:string;
  format:ElectricalModelFormat;
  modelUrl:string;
  scale:number;
  rotation:[number,number,number];
  offset:[number,number,number];
  /** Physical width, height and depth in meters when backed by an OEM/spec source. */
  dimensionsMeters?:[number,number,number];
  dimensionsSource?:string;
  dimensionsConfidence?:number;
  lod?:'LOW'|'MEDIUM'|'HIGH';
  source?:string;
  notes?:string;
};

export const ELECTRICAL_MODEL_REGISTRY_STORAGE_KEY='stratum:electrical-model-registry:v1';

export const DEFAULT_ELECTRICAL_MODEL_REGISTRY:ElectricalModelConfig[]=ELECTRICAL_COMPONENTS.map(component=>({
  componentKey:component.key,
  format:'GLB',
  modelUrl:'',
  scale:1,
  rotation:[0,0,0],
  offset:[0,0,0],
  lod:'MEDIUM',
  source:'STRATUM procedural fallback',
  notes:''
}));

export function normalizeElectricalModelRegistry(input:unknown):ElectricalModelConfig[]{
  if(!Array.isArray(input))return DEFAULT_ELECTRICAL_MODEL_REGISTRY;
  const byKey=new Map(input.filter(Boolean).map((item:any)=>[item.componentKey,item]));
  return DEFAULT_ELECTRICAL_MODEL_REGISTRY.map(base=>{
    const value:any=byKey.get(base.componentKey)||{};
    const tuple=(x:any):[number,number,number]=>Array.isArray(x)&&x.length===3?[
      Number(x[0])||0,Number(x[1])||0,Number(x[2])||0
    ]:[0,0,0];
    const dimensions=Array.isArray(value.dimensionsMeters)&&value.dimensionsMeters.length===3&&value.dimensionsMeters.every((item:any)=>Number(item)>0)
      ?[Number(value.dimensionsMeters[0]),Number(value.dimensionsMeters[1]),Number(value.dimensionsMeters[2])] as [number,number,number]
      :undefined;
    return {
      ...base,
      format:['GLB','GLTF','USD','USDZ'].includes(value.format)?value.format:base.format,
      modelUrl:typeof value.modelUrl==='string'?value.modelUrl:'',
      scale:Number(value.scale)>0?Number(value.scale):1,
      rotation:tuple(value.rotation),
      offset:tuple(value.offset),
      dimensionsMeters:dimensions,
      dimensionsSource:typeof value.dimensionsSource==='string'?value.dimensionsSource:undefined,
      dimensionsConfidence:Number.isFinite(Number(value.dimensionsConfidence))?Math.max(0,Math.min(1,Number(value.dimensionsConfidence))):undefined,
      lod:['LOW','MEDIUM','HIGH'].includes(value.lod)?value.lod:'MEDIUM',
      source:typeof value.source==='string'?value.source:base.source,
      notes:typeof value.notes==='string'?value.notes:''
    };
  });
}

export function getElectricalModelConfig(componentKey:string,registry:ElectricalModelConfig[]){
  return registry.find(item=>item.componentKey===componentKey)||null;
}
