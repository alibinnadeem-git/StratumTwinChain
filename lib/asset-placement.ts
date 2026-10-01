import {resolveElectricalComponent} from './electrical-component-library.ts';
import type {ElectricalModelConfig} from './electrical-model-registry.ts';
import type {ZReferencePoint} from './z-resolver.ts';

export type PlacementEntity={name:string;floor?:string;z?:number;meta?:Record<string,unknown>};
export type DimensionAuthority='SOURCE_SPEC'|'MODEL_REGISTRY'|'WEB_OEM_REFERENCE'|'STRATUM_NOMINAL';
export type ZAuthority='MEASURED_OR_REVIEWED'|'SOURCE_DESIGN_CANDIDATE'|'SOURCE_SUPPORT_SURFACE_CANDIDATE'|'SUPPORT_SURFACE_PLUS_SOURCE_BASE_OFFSET'|'SUPPORT_SURFACE_PLUS_MOUNTING_GUIDANCE'|'RELATIVE_TO_REVIEW_PLANE'|'FLOOR_STANDING_PROFILE'|'HISTORICAL_RECOMMENDATION'|'H2_ACCEPTED_INFERRED_PREVIEW'|'FLOOR_LABEL_ONLY'|'UNRESOLVED';
export type PlacementEvidenceClass='SOURCE_SPEC'|'OEM_INSTALLATION_GUIDANCE'|'CODE_CONSTRAINT'|'ACCESSIBILITY_GUIDANCE'|'DESIGN_GUIDE'|'TYPE_PROFILE'|'VISUALIZATION_HEURISTIC';
export type PlacementRecommendation={kind:string;valueMeters?:number;rangeMeters?:[number,number];constraintMaxMeters?:number;source:string;sourceUrl?:string;evidenceClass:PlacementEvidenceClass;note:string};
export type AssetPlacement={
 dimensions:{width:number;height:number;depth:number;authority:DimensionAuthority;source:string;confidence:number};
 baseZ:number;topZ:number;zAuthority:ZAuthority;zConfidence:number;referenceZ?:number;referencePoint?:ZReferencePoint;recommendation?:PlacementRecommendation;physicalTruth:false;
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

type SupportSurface={z:number;kind:string;authority:string;confidence:number;local:boolean};
function supportSurface(entity:PlacementEntity):SupportSurface|null{
 const meta=entity.meta||{};
 const local=finite(meta.localReviewSurfaceZ);
 if(local!==null)return{z:local,kind:String(meta.localReviewSurfaceKind||'LOCAL_SURFACE'),authority:String(meta.localReviewSurfaceAuthority||'SOURCE_ELEVATION_TRIANGLE'),confidence:Math.max(0,Math.min(1,Number(meta.localReviewSurfaceConfidence||.6))),local:true};
 const crossSheet=finite(meta.crossSheetReviewSurfaceZ);
 if(crossSheet!==null)return{z:crossSheet,kind:String(meta.crossSheetReviewSurfaceKind||'CROSS_SHEET_SURFACE'),authority:String(meta.crossSheetReviewSurfaceAuthority||'HUMAN_CONFIRMED_ALIGNMENT_PLUS_SOURCE_ELEVATION_TRIANGLE'),confidence:Math.max(0,Math.min(1,Number(meta.crossSheetReviewSurfaceConfidence||.6))),local:false};
 for(const key of ['floorDatumMeters','floorElevationMeters','finishedFloorElevationMeters','reviewSurfaceZ']){
  const value=finite(meta[key]);if(value===null)continue;
  return{z:value,kind:String(meta.reviewSurfaceKind||'PROJECT_DATUM'),authority:String(meta.reviewSurfaceAuthority||'SOURCE_PROJECT_DATUM'),confidence:Math.max(0,Math.min(1,Number(meta.reviewSurfaceConfidence||.65))),local:false};
 }
 return null;
}
function sourceDesignZCandidate(entity:PlacementEntity):{z:number;referencePoint:ZReferencePoint}|null{
 if(entity.meta?.zResolutionStatus!=='RESOLVED_DESIGN_CANDIDATE')return null;
 const value=Number(entity.meta?.zCandidateMeters);
 if(!Number.isFinite(value))return null;
 const raw=String(entity.meta?.zCandidateReferencePoint||entity.meta?.sourceZReferencePoint||'SOURCE_ORIGIN') as ZReferencePoint;
 const allowed:ZReferencePoint[]=['BASE','BOTTOM','CENTERLINE','TOP','MOUNTING_POINT','SOURCE_ORIGIN','PROJECT_DATUM','UNSPECIFIED'];
 return{z:value,referencePoint:allowed.includes(raw)?raw:'UNSPECIFIED'};
}
function baseFromReference(candidate:{z:number;referencePoint:ZReferencePoint},dimensions:AssetPlacement['dimensions'],entity:PlacementEntity):number|null{
 const {z,referencePoint}=candidate;
 if(referencePoint==='BASE'||referencePoint==='BOTTOM'||referencePoint==='SOURCE_ORIGIN')return z;
 if(referencePoint==='CENTERLINE')return z-dimensions.height/2;
 if(referencePoint==='TOP')return z-dimensions.height;
 if(referencePoint==='MOUNTING_POINT'){
  const offset=finite(entity.meta?.mountingPointFromBaseMeters??entity.meta?.mountingPointOffsetFromBaseMeters);
  return offset!==null?z-offset:null;
 }
 return null;
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
 for(const key of ['supportBaseOffsetMeters','mountingBaseFromFloorMeters','recommendedBaseFromFloorMeters','manufacturerMountingBaseMeters','installationBaseFromFloorMeters']){
  const value=finite(meta[key]);if(value!==null&&value>=0)return value;
 }
 return null;
}
function sourceMountingRecommendation(entity:PlacementEntity,surface:SupportSurface|null,dimensions:AssetPlacement['dimensions']):AssetPlacement|null{
 const offset=sourceMountingBaseOffset(entity);if(offset===null)return null;
 const meta=entity.meta||{},supportOffset=finite(meta.supportBaseOffsetMeters),isSupportOffset=supportOffset!==null;
 const floorZ=surface?.z??0,base=floorZ+offset;
 const source=isSupportOffset
  ?String(meta.supportOffsetEvidenceLabel||meta.supportOffsetSource||'Source support-base note')
  :String(meta.mountingInstructionSource||meta.installationGuideSource||meta.oemSpecSource||'Source asset installation metadata');
 const sourceUrl=isSupportOffset?undefined:String(meta.mountingInstructionSourceUrl||meta.installationGuideSourceUrl||'').trim()||undefined;
 const supportConfidence=Math.max(0,Math.min(1,Number(meta.supportOffsetConfidence||.7)));
 const zAuthority:ZAuthority=surface?(isSupportOffset?'SUPPORT_SURFACE_PLUS_SOURCE_BASE_OFFSET':'SUPPORT_SURFACE_PLUS_MOUNTING_GUIDANCE'):'RELATIVE_TO_REVIEW_PLANE';
 const zConfidence=surface?Math.min(surface.confidence,isSupportOffset?supportConfidence:.84):Math.min(.58,isSupportOffset?supportConfidence:.58);
 return{dimensions,baseZ:base,topZ:base+dimensions.height,zAuthority,zConfidence,recommendation:{
  kind:isSupportOffset?(surface?'SOURCE_SUPPORT_BASE_OFFSET_ON_REVIEW_SURFACE':'SOURCE_SUPPORT_BASE_OFFSET_RELATIVE_TO_REVIEW_PLANE'):(surface?'SOURCE_INSTALLATION_BASE_ON_REVIEW_SURFACE':'SOURCE_INSTALLATION_BASE_RELATIVE_TO_REVIEW_PLANE'),
  valueMeters:base,source,sourceUrl,evidenceClass:isSupportOffset?'SOURCE_SPEC':'OEM_INSTALLATION_GUIDANCE',
  note:isSupportOffset
   ?(surface?`Explicit ${String(meta.supportOffsetKind||'support base').replaceAll('_',' ').toLowerCase()} height ${offset.toFixed(3)} m is composed with the ${surface.kind.replaceAll('_',' ').toLowerCase()} review surface. This is source-derived design evidence, not measured installed elevation.`:`Explicit support-base height ${offset.toFixed(3)} m is known, but no absolute support surface is resolved. It is shown relative to the review plane only.`)
   :(surface?`Mounting guidance is composed with the ${surface.kind.replaceAll('_',' ').toLowerCase()} review surface from ${surface.authority.replaceAll('_',' ')}. This is a design placement candidate, not measured/installed elevation.`:'Source/OEM mounting offset is known, but no absolute support surface is resolved. Value is rendered relative to the review plane and is not absolute project Z.')
 },physicalTruth:false};
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

 const surface=supportSurface(entity),floorZ=surface?.z??0;
 if(reviewedZ(entity)){
  const base=Number.isFinite(Number(entity.z))?Number(entity.z):floorZ;
  return{dimensions,baseZ:base,topZ:base+dimensions.height,zAuthority:'MEASURED_OR_REVIEWED',zConfidence:.98,physicalTruth:false};
 }
 // H2 accepted inference may move only the visualization transform. The
 // authoritative entity.z remains untouched and the review decision remains
 // explicitly unverified/physicalTruth:false.
 const previewBase=finite(entity.meta?.zPreviewBaseMeters);
 if(previewBase!==null){
  return{dimensions,baseZ:previewBase,topZ:previewBase+dimensions.height,zAuthority:'H2_ACCEPTED_INFERRED_PREVIEW',zConfidence:Math.max(0,Math.min(1,Number(entity.meta?.zPreviewConfidence||.5))),recommendation:{kind:'H2_ACCEPTED_INFERRED_Z_PREVIEW',valueMeters:previewBase,source:String(entity.meta?.zPreviewBasis||'Human-accepted inferred Z preview'),evidenceClass:'VISUALIZATION_HEURISTIC',note:'A human accepted an inferred placement for coordination preview only. This does not change entity.z, does not establish installed elevation, and remains unverified.'},physicalTruth:false};
 }
 const designCandidate=sourceDesignZCandidate(entity);
 if(designCandidate!==null){
  const base=baseFromReference(designCandidate,dimensions,entity);
  if(base!==null)return{dimensions,baseZ:base,topZ:base+dimensions.height,zAuthority:'SOURCE_DESIGN_CANDIDATE',zConfidence:Number(entity.meta?.zResolutionConfidence||0),referenceZ:designCandidate.z,referencePoint:designCandidate.referencePoint,recommendation:{kind:`SOURCE_Z_REFERENCE_${designCandidate.referencePoint}`,valueMeters:designCandidate.z,source:String(entity.meta?.zResolutionAuthority||'Source Z evidence'),evidenceClass:'SOURCE_SPEC',note:designCandidate.referencePoint==='SOURCE_ORIGIN'?'Rendered from the source coordinate origin Z as a review anchor. This does not prove that the source origin equals the physical equipment base.':`Source Z refers to the equipment ${designCandidate.referencePoint.toLowerCase().replaceAll('_',' ')}; STRATUM converts that reference to model base Z using the current equipment height. This remains reviewable design evidence, not field-verified physical elevation.`},physicalTruth:false};
 }
 const sourceMounting=sourceMountingRecommendation(entity,surface,dimensions);if(sourceMounting)return sourceMounting;
 const key=component?.key||'';

 if(component?.twinShape==='evse'){
  if(isPedestalMounted(entity)){
   return surface?{dimensions,baseZ:floorZ,topZ:floorZ+dimensions.height,zAuthority:'SOURCE_SUPPORT_SURFACE_CANDIDATE',zConfidence:Math.min(.78,surface.confidence),recommendation:{kind:'EVSE_PEDESTAL_BASE_ON_SUPPORT_SURFACE',valueMeters:floorZ,source:`${surface.kind.replaceAll('_',' ')} review surface · ${surface.authority.replaceAll('_',' ')}`,evidenceClass:'TYPE_PROFILE',note:'Pedestal/floor-standing profile is based on the source-derived support surface. Confirm footing, curb, pad thickness and field elevation.'},physicalTruth:false}:{dimensions,baseZ:0,topZ:dimensions.height,zAuthority:'RELATIVE_TO_REVIEW_PLANE',zConfidence:.5,recommendation:{kind:'EVSE_PEDESTAL_REVIEW_PLANE',valueMeters:0,source:'Explicit pedestal/bollard/floor-mounted EVSE installation type',evidenceClass:'TYPE_PROFILE',note:'Pedestal base is shown on the review plane because absolute finished-floor/grade elevation is unresolved.'},physicalTruth:false};
  }
  if(isTeslaWallConnector(entity)){
   const minimum=isOutdoor(entity)?.6:.45,base=floorZ+1.15;
   return{dimensions,baseZ:base,topZ:base+dimensions.height,zAuthority:surface?'SUPPORT_SURFACE_PLUS_MOUNTING_GUIDANCE':'RELATIVE_TO_REVIEW_PLANE',zConfidence:surface?Math.min(surface.confidence,isCurrentTeslaWallConnector(entity)?.84:.7):.55,recommendation:{kind:'TESLA_WALL_CONNECTOR_BOTTOM_HEIGHT',valueMeters:base,rangeMeters:[floorZ+minimum,floorZ+1.52],constraintMaxMeters:floorZ+1.52,source:'Tesla Wall Connector installation guidance: measurements are ground-to-bottom; ~1.15 m recommended, 1.52 m maximum, minimum 0.45 m indoor / 0.60 m outdoor',sourceUrl:TESLA_INSTALL_URL,evidenceClass:'OEM_INSTALLATION_GUIDANCE',note:surface?`Tesla mounting guidance is composed with the ${surface.kind.replaceAll('_',' ').toLowerCase()} review surface. This remains a design placement candidate, not evidence of actual installed elevation.`:'OEM mounting height is shown relative to the review plane because absolute finished-floor/grade elevation is unresolved.'},physicalTruth:false};
  }
  if(isChargePointHomeFlex(entity)){
   const topReference=floorZ+1.3,base=Math.max(floorZ,topReference-dimensions.height);
   return{dimensions,baseZ:base,topZ:base+dimensions.height,zAuthority:surface?'SUPPORT_SURFACE_PLUS_MOUNTING_GUIDANCE':'RELATIVE_TO_REVIEW_PLANE',zConfidence:surface?Math.min(surface.confidence,.82):.55,recommendation:{kind:'CHARGEPOINT_HOME_FLEX_MOUNT_REFERENCE',valueMeters:topReference,rangeMeters:[floorZ+1,floorZ+1.1],source:'ChargePoint Home Flex CPH50 installation guide: mounting reference 1.0–1.1 m; station top approximately 1.3 m above floor',sourceUrl:CHARGEPOINT_INSTALL_URL,evidenceClass:'OEM_INSTALLATION_GUIDANCE',note:surface?`ChargePoint mounting guidance is composed with the ${surface.kind.replaceAll('_',' ').toLowerCase()} review surface. The result is a reviewable design placement candidate, not measured as-built elevation.`:'OEM mounting reference is shown relative to the review plane because absolute floor elevation is unresolved.'},physicalTruth:false};
  }
  if(isWallMounted(entity)){
   return{dimensions,baseZ:floorZ,topZ:floorZ+dimensions.height,zAuthority:'UNRESOLVED',zConfidence:.12,recommendation:{kind:'WALL_EVSE_OEM_HEIGHT_REQUIRED',source:'Wall-mounted EVSE type identified, but manufacturer/model-specific mounting height is unresolved',evidenceClass:'TYPE_PROFILE',note:'Do not borrow Tesla, ChargePoint or another OEM height for a generic wall EVSE. Resolve manufacturer/model or project installation evidence before proposing physical Z.'},physicalTruth:false};
  }
  return{dimensions,baseZ:floorZ,topZ:floorZ+dimensions.height,zAuthority:'UNRESOLVED',zConfidence:0,recommendation:{kind:'EVSE_MOUNTING_TYPE_REQUIRED',source:'EVSE may be wall-, pedestal-, bollard- or other mounted',evidenceClass:'TYPE_PROFILE',note:'Mounting type must be established before selecting a Z placement profile. No OEM-specific height is applied to an unidentified EVSE.'},physicalTruth:false};
 }
 if(FLOOR_KEYS.has(key)){
  return surface
   ?{dimensions,baseZ:floorZ,topZ:floorZ+dimensions.height,zAuthority:'SOURCE_SUPPORT_SURFACE_CANDIDATE',zConfidence:Math.min(.72,surface.confidence),recommendation:{kind:'BASE_ON_SOURCE_SUPPORT_SURFACE',valueMeters:floorZ,source:`${surface.kind.replaceAll('_',' ')} review surface · ${surface.authority.replaceAll('_',' ')}`,evidenceClass:'TYPE_PROFILE',note:'Floor/pad-standing placement candidate is anchored to the source-derived support surface; confirm pad/housekeeping curb and actual field elevation.'},physicalTruth:false}
   :{dimensions,baseZ:0,topZ:dimensions.height,zAuthority:'UNRESOLVED',zConfidence:0,recommendation:{kind:'REVIEW_PLANE_ONLY',valueMeters:0,source:'STRATUM review visualization plane',evidenceClass:'VISUALIZATION_HEURISTIC',note:'No source-grounded support surface is known. Z=0 is a review-plane display coordinate only and must never be treated as installed elevation.'},physicalTruth:false};
 }
 if(PANEL_KEYS.has(key)){
  const accessible:[number,number]=[.38,1.22];
  const center=floorZ+1.22;
  const base=Math.max(floorZ,center-dimensions.height/2);
  return{dimensions,baseZ:base,topZ:base+dimensions.height,zAuthority:surface?'SUPPORT_SURFACE_PLUS_MOUNTING_GUIDANCE':'RELATIVE_TO_REVIEW_PLANE',zConfidence:surface?Math.min(.48,surface.confidence):.28,recommendation:{kind:'OPERABLE_PART_REACH_CONTEXT',rangeMeters:[floorZ+accessible[0],floorZ+accessible[1]],constraintMaxMeters:floorZ+2,source:'ADA 2010 Standards §308 + NEC 240.24(A) / Schneider installation guidance',sourceUrl:'https://www.se.com/us/en/faqs/FA296388/',evidenceClass:'CODE_CONSTRAINT',note:surface?'Accessibility/code context is composed with a source support surface. This remains a review candidate, not measured installed elevation.':'Accessibility/code context is relative to the review plane only because no source support surface is resolved; it is not absolute project Z.'},physicalTruth:false};
 }
 if(RECEPTACLE_KEYS.has(key)){
  const center=floorZ+.46;
  return{dimensions,baseZ:center-dimensions.height/2,topZ:center+dimensions.height/2,zAuthority:surface?'SUPPORT_SURFACE_PLUS_MOUNTING_GUIDANCE':'RELATIVE_TO_REVIEW_PLANE',zConfidence:surface?Math.min(.6,surface.confidence):.3,recommendation:{kind:'TYPICAL_RECEPTACLE_CENTER',valueMeters:center,rangeMeters:[floorZ+.38,floorZ+1.22],source:'VA Section 26 27 26 (450 mm / 18 in typical); ADA §308 reach range when accessibility applies',sourceUrl:'https://www.wbdg.org/FFC/VA/VAASC/VA%2026%2027%2026.pdf',evidenceClass:'DESIGN_GUIDE',note:surface?'Design-guide mounting context is composed with a source support surface; project drawings and field conditions govern.':'Design-guide mounting context is relative to the review plane only because no source support surface is resolved.'},physicalTruth:false};
 }
 if(component?.twinShape==='sensor'||component?.twinShape==='light'){
  return{dimensions,baseZ:floorZ+2.5,topZ:floorZ+2.5+dimensions.height,zAuthority:surface?'SUPPORT_SURFACE_PLUS_MOUNTING_GUIDANCE':'RELATIVE_TO_REVIEW_PLANE',zConfidence:surface?Math.min(.3,surface.confidence):.15,recommendation:{kind:'OVERHEAD_DEVICE_CANDIDATE',valueMeters:floorZ+2.5,source:'STRATUM low-confidence visualization profile',evidenceClass:'VISUALIZATION_HEURISTIC',note:surface?'Low-confidence overhead visualization is composed with a source support surface; ceiling/fixture height still requires source or field evidence.':'Low-confidence overhead visualization is relative to the review plane only; no absolute project Z is implied.'},physicalTruth:false};
 }
 return surface?{dimensions,baseZ:floorZ,topZ:floorZ+dimensions.height,zAuthority:'SOURCE_SUPPORT_SURFACE_CANDIDATE',zConfidence:Math.min(.35,surface.confidence),recommendation:{kind:'BASE_ON_SOURCE_SUPPORT_SURFACE',valueMeters:floorZ,source:`${surface.kind.replaceAll('_',' ')} review surface · ${surface.authority.replaceAll('_',' ')}`,evidenceClass:'TYPE_PROFILE',note:'Generic equipment base is shown on the source-derived support surface for review only; installed elevation remains unverified.'},physicalTruth:false}:{dimensions,baseZ:0,topZ:dimensions.height,zAuthority:'UNRESOLVED',zConfidence:0,recommendation:{kind:'REVIEW_PLANE_ONLY',valueMeters:0,source:'STRATUM review visualization plane',evidenceClass:'VISUALIZATION_HEURISTIC',note:'No source-grounded absolute elevation is available. Review-plane Z=0 is display-only.'},physicalTruth:false};
}
