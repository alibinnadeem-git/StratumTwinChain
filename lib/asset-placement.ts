import {resolveElectricalComponent} from './electrical-component-library';
import type {ElectricalModelConfig} from './electrical-model-registry';

export type PlacementEntity={name:string;floor?:string;z?:number;meta?:Record<string,unknown>};
export type DimensionAuthority='SOURCE_SPEC'|'MODEL_REGISTRY'|'STRATUM_NOMINAL';
export type ZAuthority='MEASURED_OR_REVIEWED'|'FLOOR_STANDING_PROFILE'|'HISTORICAL_RECOMMENDATION'|'FLOOR_LABEL_ONLY'|'UNRESOLVED';
export type AssetPlacement={
 dimensions:{width:number;height:number;depth:number;authority:DimensionAuthority;source:string;confidence:number};
 baseZ:number;
 topZ:number;
 zAuthority:ZAuthority;
 zConfidence:number;
 recommendation?:{kind:string;valueMeters?:number;rangeMeters?:[number,number];constraintMaxMeters?:number;source:string;note:string};
 physicalTruth:false;
};

const NOMINAL:Record<string,[number,number,number]>={
 transformer:[1.7,1.6,1.25],cabinet:[1.1,1.8,.65],panel:[.85,1.05,.25],breaker:[.42,.55,.2],meter:[.45,.55,.25],
 busduct:[1.2,.32,.32],receptacle:[.09,.12,.05],junction:[.3,.3,.16],conduit:[1,.05,.05],tray:[1,.15,.4],light:[.6,.18,.6],
 motor:[1.1,.8,.65],generator:[2.2,1.35,1.1],battery:[1.6,1.75,.7],ground:[.2,.2,.2],rack:[.8,2,.9],sensor:[.18,.2,.18],evse:[.6,1.45,.42],solar:[1.9,.08,1.1]
};
const FLOOR_KEYS=new Set(['utility-transformer','pad-mount-transformer','utility-switchgear','main-switchboard','lv-switchboard','busduct','dry-transformer','oil-transformer','isolation-transformer','autotransformer','mcc','motor','pump','generator','ups','battery-bank','dc-power','data-cabinet','evse']);
const PANEL_KEYS=new Set(['distribution-panel','panelboard','load-center','lighting-control','fire-alarm','security-panel','access-control','metering-cabinet','power-meter','energy-meter']);
const RECEPTACLE_KEYS=new Set(['duplex-receptacle','gfci','ig-outlet','industrial-receptacle']);

function floorElevation(floor?:string|null){
 const normalized=String(floor||'').trim().toUpperCase();
 const basement=normalized.match(/^B(\d+)$/);if(basement)return-4*Number(basement[1]);
 const level=normalized.match(/^L(\d+)$/);if(level)return(Math.max(1,Number(level[1]))-1)*4;
 if(normalized==='GROUND'||normalized==='GROUND FLOOR')return 0;
 if(normalized==='ROOF')return 12;
 if(normalized==='PENTHOUSE')return 16;
 return 0;
}
function tuple(value:unknown):[number,number,number]|null{
 if(!Array.isArray(value)||value.length!==3)return null;
 const n=value.map(Number);return n.every(item=>Number.isFinite(item)&&item>0)?[n[0],n[1],n[2]]:null;
}
function sourceDimensions(entity:PlacementEntity):[number,number,number]|null{
 const meta=entity.meta||{};
 for(const key of ['assetDimensionsMeters','dimensionsMeters','oemDimensionsMeters','manufacturerDimensionsMeters']){const found=tuple(meta[key]);if(found)return found;}
 const width=Number(meta.widthMeters??meta.assetWidthMeters),height=Number(meta.heightMeters??meta.assetHeightMeters),depth=Number(meta.depthMeters??meta.assetDepthMeters);
 return [width,height,depth].every(item=>Number.isFinite(item)&&item>0)?[width,height,depth]:null;
}
function reviewedZ(entity:PlacementEntity){return entity.meta?.elevationKnown===true||entity.meta?.physicalElevationKnown===true||entity.meta?.zPlacementAuthority==='MEASURED_OR_REVIEWED'}

export function nominalDimensionsFor(name:string):[number,number,number]{
 const component=resolveElectricalComponent(name);return NOMINAL[component?.twinShape||'cabinet']||NOMINAL.cabinet;
}

export function resolveAssetPlacement(entity:PlacementEntity,registry?:ElectricalModelConfig|null):AssetPlacement{
 const component=resolveElectricalComponent(entity.name);
 const source=sourceDimensions(entity);
 const registryDimensions=tuple(registry?.dimensionsMeters);
 const nominal=nominalDimensionsFor(entity.name);
 const dims=source||registryDimensions||nominal;
 const dimensions=source
  ?{width:dims[0],height:dims[1],depth:dims[2],authority:'SOURCE_SPEC' as const,source:String(entity.meta?.dimensionsSource||entity.meta?.oemSpecSource||'Source/OEM asset metadata'),confidence:.95}
  :registryDimensions
   ?{width:dims[0],height:dims[1],depth:dims[2],authority:'MODEL_REGISTRY' as const,source:registry?.dimensionsSource||registry?.source||'3D model registry',confidence:registry?.dimensionsConfidence??.85}
   :{width:dims[0],height:dims[1],depth:dims[2],authority:'STRATUM_NOMINAL' as const,source:'STRATUM nominal visualization profile; replace with OEM dimensions',confidence:.35};

 const floorZ=floorElevation(entity.floor);
 if(reviewedZ(entity)){
  const base=Number.isFinite(Number(entity.z))?Number(entity.z):floorZ;
  return{dimensions,baseZ:base,topZ:base+dimensions.height,zAuthority:'MEASURED_OR_REVIEWED',zConfidence:.98,physicalTruth:false};
 }
 const key=component?.key||'';
 if(FLOOR_KEYS.has(key)){
  return{dimensions,baseZ:floorZ,topZ:floorZ+dimensions.height,zAuthority:'FLOOR_STANDING_PROFILE',zConfidence:.72,recommendation:{kind:'BASE_ON_FINISHED_FLOOR',valueMeters:floorZ,source:'Equipment-type installation profile',note:'Floor/pad-standing placement recommendation only; confirm pad, housekeeping curb and actual field elevation.'},physicalTruth:false};
 }
 if(PANEL_KEYS.has(key)){
  const accessible:[number,number]=[.38,1.22];
  const center=floorZ+1.22;
  const base=Math.max(floorZ,center-dimensions.height/2);
  return{dimensions,baseZ:base,topZ:base+dimensions.height,zAuthority:'HISTORICAL_RECOMMENDATION',zConfidence:.48,recommendation:{kind:'OPERABLE_PART_REACH_CONTEXT',rangeMeters:[floorZ+accessible[0],floorZ+accessible[1]],constraintMaxMeters:floorZ+2,source:'ADA 2010 Standards §308; NEC 240.24(A) / Schneider installation guidance',note:'Accessibility range applies where required. Breaker handle highest position is limited to 2.0 m by NEC 240.24(A); this is not an exact installed base elevation.'},physicalTruth:false};
 }
 if(RECEPTACLE_KEYS.has(key)){
  const center=floorZ+.46;
  return{dimensions,baseZ:center-dimensions.height/2,topZ:center+dimensions.height/2,zAuthority:'HISTORICAL_RECOMMENDATION',zConfidence:.6,recommendation:{kind:'TYPICAL_RECEPTACLE_CENTER',valueMeters:center,rangeMeters:[floorZ+.38,floorZ+1.22],source:'VA Section 26 27 26 (450 mm / 18 in typical); ADA §308 reach range when accessibility applies',note:'Historical/design-guide placement candidate only. Project drawings and field conditions govern.'},physicalTruth:false};
 }
 if(component?.twinShape==='sensor'||component?.twinShape==='light'){
  return{dimensions,baseZ:floorZ+2.5,topZ:floorZ+2.5+dimensions.height,zAuthority:'HISTORICAL_RECOMMENDATION',zConfidence:.3,recommendation:{kind:'OVERHEAD_DEVICE_CANDIDATE',valueMeters:floorZ+2.5,source:'STRATUM low-confidence visualization profile',note:'Ceiling/fixture height must come from reflected ceiling plans, OEM data or field evidence.'},physicalTruth:false};
 }
 return{dimensions,baseZ:floorZ,topZ:floorZ+dimensions.height,zAuthority:entity.floor&&entity.floor!=='UNRESOLVED'?'FLOOR_LABEL_ONLY':'UNRESOLVED',zConfidence:entity.floor&&entity.floor!=='UNRESOLVED'?.35:0,physicalTruth:false};
}
