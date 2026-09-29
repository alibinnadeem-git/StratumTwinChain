import {resolveElectricalComponent} from './electrical-component-library.ts';
import type {ElectricalModelConfig} from './electrical-model-registry.ts';

export type PlacementEntity={name:string;floor?:string;z?:number;meta?:Record<string,unknown>};
export type DimensionAuthority='SOURCE_SPEC'|'MODEL_REGISTRY'|'WEB_OEM_REFERENCE'|'STRATUM_NOMINAL';
export type ZAuthority='MEASURED_OR_REVIEWED'|'SOURCE_DESIGN_CANDIDATE'|'LOCAL_REVIEW_SURFACE'|'LOCAL_SURFACE_PLUS_SOURCE_OFFSET'|'RELATIVE_TO_REVIEW_PLANE'|'FLOOR_STANDING_PROFILE'|'HISTORICAL_RECOMMENDATION'|'FLOOR_LABEL_ONLY'|'UNRESOLVED';
export type PlacementEvidenceClass='SOURCE_SPEC'|'OEM_INSTALLATION_GUIDANCE'|'CODE_CONSTRAINT'|'ACCESSIBILITY_GUIDANCE'|'DESIGN_GUIDE'|'TYPE_PROFILE'|'VISUALIZATION_HEURISTIC';
export type PlacementRecommendation={kind:string;valueMeters?:number;rangeMeters?:[number,number];constraintMaxMeters?:number;source:string;sourceUrl?:string;evidenceClass:PlacementEvidenceClass;note:string};
export type AssetPlacement={
 dimensions:{width:number;height:number;depth:number;authority:DimensionAuthority;source:string;confidence:number};
 baseZ:number;topZ:number;zAuthority:ZAuthority;zConfidence:number;recommendation?:PlacementRecommendation;physicalTruth:false;
};

const NOMINAL:Record<string,[number,number,number]>={
 transformer:[1.7,1.6,1.25],cabinet:[1.1,1.8,.65],panel:[.85,1.05,.25],breaker:[.42,.55,.2],meter:[.45,.55,.25],
 busduct:[1.2,.32,.32],receptacle:[.09,.12,.05],junction:[.3,.3,.16],conduit:[1,.05,.05],tray:[1,.15,.4],light:[.6,.18,.6],
 motor:[1.1,.8,.65],generator:[2.2,1.35,1.1],battery:[1.6,1.75,.7],ground:[.2,.2,.2],rack:[.8,2,.9],sensor:[.18,.2,.18],evse:[.6,1.45,.42],solar:[1.9,.08,1.1]
};
const FLOOR_KEYS=new Set(['utility-transformer','pad-mount-transformer','utility-switchgear','main-switchboard','lv-switchboard','busduct','dry-transformer','oil-transformer','isolation-transformer','autotransformer','mcc','motor','pump','generator','ups','battery-bank','dc-power','data-cabinet']);
const PANEL_KEYS=new Set(['distribution-panel','panelboard','load-center','lighting-control','fire-alarm','security-panel','access-control','metering-cabinet','power-meter','energy-meter']);
const RECEPTACLE_KEYS=new Set(['duplex-receptacle','gfci','ig-outlet','industrial-receptacle']);
const TESLA_INSTALL_URL='https://energylibrary.tesla.com/docs/Public/Charging/WallConnector/Gen3/Install/UniversalWC/en-us/GUID-B5F08AED-9F7F-4CA7-B95C-E1AF98F536AC.html';
const TESLA_SPEC_URL='https://energylibrary.tesla.com/docs/Public/Charging/WallConnector/Gen3/Install/UniversalWC/en-us/GUID-4A3BDFAA-7DBB-48CB-852C-BF1473EC4945.html';
const CHARGEPOINT_INSTALL_URL='https://docs.chargepoint.com/cpdocs-sec/content/1-home/cph50/ig/04-mount-charging-station.htm';
const CHARGEPOINT_SPEC_URL='https://docs.chargepoint.com/ref-docs-sec/content/pdfs/1-home/flex/flex-ds.pdf';

function placementDatum(entity:PlacementEntity):{z:number;authority:'LOCAL_REVIEW_SURFACE'|'PROJECT_REVIEW_SURFACE'|'FLOOR_DATUM';confidence:number}|null{
 const meta=entity.meta||{};
 const local=finite(meta.localReviewSurfaceZ);
 if(local!==null)return{z:local,authority:'LOCAL_REVIEW_SURFACE',confidence:Number(meta.localReviewSurfaceConfidence||.7)};
 const project=finite(meta.reviewSurfaceZ);
 if(project!==null)return{z:project,authority:'PROJECT_REVIEW_SURFACE',confidence:Number(meta.reviewSurfaceConfidence||.68)};
 for(const key of ['floorDatumMeters','floorElevationMeters','finishedFloorElevationMeters']){
  const value=finite(meta[key]);if(value!==null)return{z:value,authority:'FLOOR_DATUM',confidence:.72};
 }
 return null;
}
function sourceDesignZCandidate(entity:PlacementEntity):number|null{
 if(entity.meta?.zResolutionStatus!=='RESOLVED_DESIGN_CANDIDATE')return null;
 const value=Number(entity.meta?.zCandidateMeters);
 return Number.isFinite(value)?value:null;
}
function tuple(value:unknown):[number,number,number]|null{
 if(!Array.isArray(value)||value.length!==3)return null;
 const n=value.map(Number);return n.every(item=>Number.isFinite(item)&&item>0)?[n[0],n[1],n[2]]:null;
}
function finite(value:unknown){const n=Number(value);return Number.isFinite(n)?n:null}
function sourceDimensions(entity:PlacementEntity):[number,number,number]|null{
 const meta=entity.meta||{};
 if(meta.assetDimensionAuthority==='SOURCE_SPEC'){
  const explicit=tuple(meta.assetDimensionsMeters);if(explicit)return explicit;
 }
 for(const key of ['dimensionsMeters','oemDimensionsMeters','manufacturerDimensionsMeters']){const found=tuple(meta[key]);if(found)return found;}
 const width=Number(meta.widthMeters??meta.assetWidthMeters),height=Number(meta.heightMeters??meta.assetHeightMeters),depth=Number(meta.depthMeters??meta.assetDepthMeters);
 return [width,height,depth].every(item=>Number.isFinite(item)&&item>0)?[width,height,depth]:null;
}
function reviewedZ(entity:PlacementEntity){return entity.meta?.elevationKnown===true||entity.meta?.physicalElevationKnown===true||entity.meta?.zPlacementAuthority==='MEASURED_OR_REVIEWED'}
function contextText(entity:PlacementEntity){
 const meta=entity.meta||{};
 return [entity.name,meta.manufacturer,meta.oem,meta.brand,meta.model,meta.modelNumber,meta.productName,meta.partNumber,meta.mountingType,meta.installationType,meta.installationEnvironment,meta.locationType].filter(Boolean).join(' ').toLowerCase();
}
function manufacturerText(entity:PlacementEntity){const meta=entity.meta||{};return [meta.manufacturer,meta.oem,meta.brand].filter(Boolean).join(' ').toLowerCase()}
function modelText(entity:PlacementEntity){const meta=entity.meta||{};return [entity.name,meta.model,meta.modelNumber,meta.productName,meta.partNumber].filter(Boolean).join(' ').toLowerCase()}
function explicitMountingType(entity:PlacementEntity){return [entity.meta?.mountingType,entity.meta?.installationType].filter(Boolean).join(' ').toLowerCase()}
function isPedestalMounted(entity:PlacementEntity){const t=`${explicitMountingType(entity)} ${entity.name.toLowerCase()}`;return /\bpedestal\b|\bbollard\b|floor[- ]mounted|post[- ]mounted|pad[- ]mounted/.test(t)}
function isWallMounted(entity:PlacementEntity){const t=`${explicitMountingType(entity)} ${entity.name.toLowerCase()}`;return /wall[- ]mounted|surface[- ]mounted|\bwall connector\b/.test(t)}
function isOutdoor(entity:PlacementEntity){return /\boutdoor\b|\bexterior\b/.test(contextText(entity))}
function isTeslaWallConnector(entity:PlacementEntity){
 const maker=manufacturerText(entity),model=modelText(entity),all=contextText(entity);
 return (maker.includes('tesla')&&/wall connector|1734412|1457768/.test(model))||/tesla.*wall connector|wall connector.*tesla/.test(all);
}
function isCurrentTeslaWallConnector(entity:PlacementEntity){const t=contextText(entity);return isTeslaWallConnector(entity)&&/universal|gen\s*3|gen3|1734412|1457768/.test(t)}
function isChargePointHomeFlex(entity:PlacementEntity){
 const maker=manufacturerText(entity),model=modelText(entity),all=contextText(entity);
 return (maker.includes('chargepoint')&&/home flex|cph50/.test(model))||/chargepoint.*(home flex|cph50)|(home flex|cph50).*chargepoint/.test(all);
}
function webOemDimensions(entity:PlacementEntity):{dims:[number,number,number];source:string;sourceUrl:string;confidence:number}|null{
 if(isCurrentTeslaWallConnector(entity)){
  const universal=/universal|1734412/.test(contextText(entity));
  return{dims:[.155,.345,universal ? .15 : .11],source:`Tesla ${universal?'Universal ':''}Wall Connector official product specifications`,sourceUrl:TESLA_SPEC_URL,confidence:.88};
 }
 if(isChargePointHomeFlex(entity))return{dims:[.1794,.2843,.1321],source:'ChargePoint Home Flex CPH50 official datasheet',sourceUrl:CHARGEPOINT_SPEC_URL,confidence:.9};
 return null;
}
function sourceMountingBaseOffset(entity:PlacementEntity){
 const meta=entity.meta||{};
 for(const key of ['mountingBaseFromFloorMeters','recommendedBaseFromFloorMeters','manufacturerMountingBaseMeters','installationBaseFromFloorMeters']){
  const value=finite(meta[key]);if(value!==null&&value>=0)return value;
 }
 return null;
}
function sourceMountingRecommendation(entity:PlacementEntity,floorZ:number,dimensions:AssetPlacement['dimensions'],floorDatumKnown:boolean):AssetPlacement|null{
 const offset=sourceMountingBaseOffset(entity);if(offset===null)return null;
 const base=floorZ+offset;
 const source=String(entity.meta?.mountingInstructionSource||entity.meta?.installationGuideSource||entity.meta?.oemSpecSource||'Source asset installation metadata');
 const sourceUrl=String(entity.meta?.mountingInstructionSourceUrl||entity.meta?.installationGuideSourceUrl||'').trim()||undefined;
 return{dimensions,baseZ:base,topZ:base+dimensions.height,zAuthority:floorDatumKnown?'HISTORICAL_RECOMMENDATION':'RELATIVE_TO_REVIEW_PLANE',zConfidence:floorDatumKnown?.84:.58,recommendation:{kind:floorDatumKnown?'SOURCE_INSTALLATION_BASE_RECOMMENDATION':'SOURCE_INSTALLATION_BASE_RELATIVE_TO_REVIEW_PLANE',valueMeters:base,source,sourceUrl,evidenceClass:'OEM_INSTALLATION_GUIDANCE',note:floorDatumKnown?'Source/OEM installation guidance is a placement recommendation, not evidence of the installed or measured elevation.':'Source/OEM mounting offset is known, but absolute floor elevation is not. Value is rendered relative to the review plane and is not absolute project Z.'},physicalTruth:false};
}

export function nominalDimensionsFor(name:string):[number,number,number]{
 const component=resolveElectricalComponent(name);return NOMINAL[component?.twinShape||'cabinet']||NOMINAL.cabinet;
}

export function resolveAssetPlacement(entity:PlacementEntity,registry?:ElectricalModelConfig|null):AssetPlacement{
 const component=resolveElectricalComponent(entity.name);
 const source=sourceDimensions(entity);
 const registryDimensions=tuple(registry?.dimensionsMeters);
 const webReference=webOemDimensions(entity);
 const nominal=nominalDimensionsFor(entity.name);
 const dims=source||registryDimensions||webReference?.dims||nominal;
 const dimensions=source
  ?{width:dims[0],height:dims[1],depth:dims[2],authority:'SOURCE_SPEC' as const,source:String(entity.meta?.dimensionsSource||entity.meta?.oemSpecSource||entity.meta?.assetDimensionSource||'Source/OEM asset metadata'),confidence:.95}
  :registryDimensions
   ?{width:dims[0],height:dims[1],depth:dims[2],authority:'MODEL_REGISTRY' as const,source:registry?.dimensionsSource||registry?.source||'3D model registry',confidence:registry?.dimensionsConfidence??.85}
   :webReference
    ?{width:dims[0],height:dims[1],depth:dims[2],authority:'WEB_OEM_REFERENCE' as const,source:`${webReference.source} · ${webReference.sourceUrl}`,confidence:webReference.confidence}
    :{width:dims[0],height:dims[1],depth:dims[2],authority:'STRATUM_NOMINAL' as const,source:'STRATUM nominal visualization profile; replace with OEM dimensions',confidence:.35};

 const datum=placementDatum(entity),floorZ=datum?.z??0;
 if(reviewedZ(entity)){
  const base=Number.isFinite(Number(entity.z))?Number(entity.z):floorZ;
  return{dimensions,baseZ:base,topZ:base+dimensions.height,zAuthority:'MEASURED_OR_REVIEWED',zConfidence:.98,physicalTruth:false};
 }
 const designCandidate=sourceDesignZCandidate(entity);if(designCandidate!==null)return{dimensions,baseZ:designCandidate,topZ:designCandidate+dimensions.height,zAuthority:'SOURCE_DESIGN_CANDIDATE',zConfidence:Number(entity.meta?.zResolutionConfidence||0),recommendation:{kind:'SOURCE_DESIGN_Z_CANDIDATE',valueMeters:designCandidate,source:String(entity.meta?.zResolutionAuthority||'Source Z evidence'),evidenceClass:'SOURCE_SPEC',note:'Rendered from a source-design Z candidate. This is reviewable design evidence, not field-verified physical elevation.'},physicalTruth:false};
 const sourceMounting=sourceMountingRecommendation(entity,floorZ,dimensions,datum!==null);if(sourceMounting){if(datum?.authority==='LOCAL_REVIEW_SURFACE')return{...sourceMounting,zAuthority:'LOCAL_SURFACE_PLUS_SOURCE_OFFSET',zConfidence:Math.min(sourceMounting.zConfidence,datum.confidence)};return sourceMounting;}
 const key=component?.key||'';

 if(key==='evse'){
  if(isPedestalMounted(entity)){
   return datum!==null?{dimensions,baseZ:floorZ,topZ:floorZ+dimensions.height,zAuthority:datum.authority==='LOCAL_REVIEW_SURFACE'?'LOCAL_REVIEW_SURFACE':'FLOOR_STANDING_PROFILE',zConfidence:Math.min(.78,datum.confidence),recommendation:{kind:datum.authority==='LOCAL_REVIEW_SURFACE'?'EVSE_PEDESTAL_ON_LOCAL_REVIEW_SURFACE':'EVSE_PEDESTAL_BASE_ON_FINISHED_FLOOR',valueMeters:floorZ,source:datum.authority==='LOCAL_REVIEW_SURFACE'?'Source-derived local elevation surface':'Explicit pedestal/bollard/floor-mounted EVSE installation type',evidenceClass:'TYPE_PROFILE',note:datum.authority==='LOCAL_REVIEW_SURFACE'?'Pedestal base is rendered on the local source-derived review surface. This is not field-verified installed elevation.':'Pedestal/floor-standing profile anchored to a source floor datum. Confirm footing, curb, bollard base, finished grade and field elevation.'},physicalTruth:false}:{dimensions,baseZ:0,topZ:dimensions.height,zAuthority:'RELATIVE_TO_REVIEW_PLANE',zConfidence:.5,recommendation:{kind:'EVSE_PEDESTAL_REVIEW_PLANE',valueMeters:0,source:'Explicit pedestal/bollard/floor-mounted EVSE installation type',evidenceClass:'TYPE_PROFILE',note:'Pedestal base is shown on the review plane because absolute finished-floor/grade elevation is unresolved.'},physicalTruth:false};
  }
  if(isTeslaWallConnector(entity)){
   const minimum=isOutdoor(entity)?.6:.45,base=floorZ+1.15;
   return{dimensions,baseZ:base,topZ:base+dimensions.height,zAuthority:datum!==null?(datum.authority==='LOCAL_REVIEW_SURFACE'?'LOCAL_SURFACE_PLUS_SOURCE_OFFSET':'HISTORICAL_RECOMMENDATION'):'RELATIVE_TO_REVIEW_PLANE',zConfidence:datum!==null?Math.min(datum.confidence,isCurrentTeslaWallConnector(entity)?.84:.7):.55,recommendation:{kind:'TESLA_WALL_CONNECTOR_BOTTOM_HEIGHT',valueMeters:base,rangeMeters:[floorZ+minimum,floorZ+1.52],constraintMaxMeters:floorZ+1.52,source:'Tesla Wall Connector installation guidance: measurements are ground-to-bottom; ~1.15 m recommended, 1.52 m maximum, minimum 0.45 m indoor / 0.60 m outdoor',sourceUrl:TESLA_INSTALL_URL,evidenceClass:'OEM_INSTALLATION_GUIDANCE',note:datum!==null?'Applies only because Tesla Wall Connector identity is present. This remains an OEM installation recommendation, not evidence of actual installed elevation.':'OEM mounting height is shown relative to the review plane because absolute finished-floor/grade elevation is unresolved.'},physicalTruth:false};
  }
  if(isChargePointHomeFlex(entity)){
   const topReference=floorZ+1.3,base=Math.max(floorZ,topReference-dimensions.height);
   return{dimensions,baseZ:base,topZ:base+dimensions.height,zAuthority:datum!==null?(datum.authority==='LOCAL_REVIEW_SURFACE'?'LOCAL_SURFACE_PLUS_SOURCE_OFFSET':'HISTORICAL_RECOMMENDATION'):'RELATIVE_TO_REVIEW_PLANE',zConfidence:datum!==null?Math.min(datum.confidence,.82):.55,recommendation:{kind:'CHARGEPOINT_HOME_FLEX_MOUNT_REFERENCE',valueMeters:topReference,rangeMeters:[floorZ+1,floorZ+1.1],source:'ChargePoint Home Flex CPH50 installation guide: mounting reference 1.0–1.1 m; station top approximately 1.3 m above floor',sourceUrl:CHARGEPOINT_INSTALL_URL,evidenceClass:'OEM_INSTALLATION_GUIDANCE',note:datum!==null?'Rendered base is derived from the approximately 1.3 m top reference and the best available equipment height. The 1.0–1.1 m range is ChargePoint’s mounting reference, not a generic EVSE rule or measured as-built elevation.':'OEM mounting reference is shown relative to the review plane because absolute floor elevation is unresolved.'},physicalTruth:false};
  }
  if(isWallMounted(entity)){
   return{dimensions,baseZ:floorZ,topZ:floorZ+dimensions.height,zAuthority:'UNRESOLVED',zConfidence:.12,recommendation:{kind:'WALL_EVSE_OEM_HEIGHT_REQUIRED',source:'Wall-mounted EVSE type identified, but manufacturer/model-specific mounting height is unresolved',evidenceClass:'TYPE_PROFILE',note:'Do not borrow Tesla, ChargePoint or another OEM height for a generic wall EVSE. Resolve manufacturer/model or project installation evidence before proposing physical Z.'},physicalTruth:false};
  }
  return{dimensions,baseZ:floorZ,topZ:floorZ+dimensions.height,zAuthority:'UNRESOLVED',zConfidence:0,recommendation:{kind:'EVSE_MOUNTING_TYPE_REQUIRED',source:'EVSE may be wall-, pedestal-, bollard- or other mounted',evidenceClass:'TYPE_PROFILE',note:'Mounting type must be established before selecting a Z placement profile. No OEM-specific height is applied to an unidentified EVSE.'},physicalTruth:false};
 }
 if(FLOOR_KEYS.has(key)){
  return datum!==null
   ?{dimensions,baseZ:floorZ,topZ:floorZ+dimensions.height,zAuthority:datum.authority==='LOCAL_REVIEW_SURFACE'?'LOCAL_REVIEW_SURFACE':'FLOOR_STANDING_PROFILE',zConfidence:Math.min(.72,datum.confidence),recommendation:{kind:datum.authority==='LOCAL_REVIEW_SURFACE'?'BASE_ON_LOCAL_REVIEW_SURFACE':'BASE_ON_FINISHED_FLOOR',valueMeters:floorZ,source:datum.authority==='LOCAL_REVIEW_SURFACE'?'Source-derived local elevation surface':'Equipment-type installation profile + source floor datum',evidenceClass:'TYPE_PROFILE',note:datum.authority==='LOCAL_REVIEW_SURFACE'?'Floor/pad-standing equipment is rendered on the local source-derived review surface; confirm pad/curb and field elevation.':'Floor/pad-standing placement candidate anchored to a source floor datum; confirm pad, housekeeping curb and actual field elevation.'},physicalTruth:false}
   :{dimensions,baseZ:0,topZ:dimensions.height,zAuthority:'UNRESOLVED',zConfidence:0,recommendation:{kind:'REVIEW_PLANE_ONLY',valueMeters:0,source:'STRATUM review visualization plane',evidenceClass:'VISUALIZATION_HEURISTIC',note:'No physical floor datum is known. Z=0 is a review-plane display coordinate only and must never be treated as installed elevation.'},physicalTruth:false};
 }
 if(PANEL_KEYS.has(key)){
  const accessible:[number,number]=[.38,1.22];
  const center=floorZ+1.22;
  const base=Math.max(floorZ,center-dimensions.height/2);
  return{dimensions,baseZ:base,topZ:base+dimensions.height,zAuthority:'HISTORICAL_RECOMMENDATION',zConfidence:.48,recommendation:{kind:'OPERABLE_PART_REACH_CONTEXT',rangeMeters:[floorZ+accessible[0],floorZ+accessible[1]],constraintMaxMeters:floorZ+2,source:'ADA 2010 Standards §308 + NEC 240.24(A) / Schneider installation guidance',sourceUrl:'https://www.se.com/us/en/faqs/FA296388/',evidenceClass:'CODE_CONSTRAINT',note:'Accessibility range applies where required. Breaker handle highest position is limited to 2.0 m by NEC 240.24(A); this is not an exact installed base elevation.'},physicalTruth:false};
 }
 if(RECEPTACLE_KEYS.has(key)){
  const center=floorZ+.46;
  return{dimensions,baseZ:center-dimensions.height/2,topZ:center+dimensions.height/2,zAuthority:'HISTORICAL_RECOMMENDATION',zConfidence:.6,recommendation:{kind:'TYPICAL_RECEPTACLE_CENTER',valueMeters:center,rangeMeters:[floorZ+.38,floorZ+1.22],source:'VA Section 26 27 26 (450 mm / 18 in typical); ADA §308 reach range when accessibility applies',sourceUrl:'https://www.wbdg.org/FFC/VA/VAASC/VA%2026%2027%2026.pdf',evidenceClass:'DESIGN_GUIDE',note:'Historical/design-guide placement candidate only. Project drawings and field conditions govern.'},physicalTruth:false};
 }
 if(component?.twinShape==='sensor'||component?.twinShape==='light'){
  return{dimensions,baseZ:floorZ+2.5,topZ:floorZ+2.5+dimensions.height,zAuthority:'HISTORICAL_RECOMMENDATION',zConfidence:.3,recommendation:{kind:'OVERHEAD_DEVICE_CANDIDATE',valueMeters:floorZ+2.5,source:'STRATUM low-confidence visualization profile',evidenceClass:'VISUALIZATION_HEURISTIC',note:'Ceiling/fixture height must come from reflected ceiling plans, OEM data or field evidence.'},physicalTruth:false};
 }
 return datum!==null?{dimensions,baseZ:floorZ,topZ:floorZ+dimensions.height,zAuthority:datum.authority==='LOCAL_REVIEW_SURFACE'?'LOCAL_REVIEW_SURFACE':'FLOOR_LABEL_ONLY',zConfidence:datum.authority==='LOCAL_REVIEW_SURFACE'?Math.min(.5,datum.confidence):.35,physicalTruth:false}:{dimensions,baseZ:0,topZ:dimensions.height,zAuthority:'UNRESOLVED',zConfidence:0,recommendation:{kind:'REVIEW_PLANE_ONLY',valueMeters:0,source:'STRATUM review visualization plane',evidenceClass:'VISUALIZATION_HEURISTIC',note:'No source-grounded absolute elevation is available. Review-plane Z=0 is display-only.'},physicalTruth:false};
}
