import {nominalDimensionsFor,resolveAssetPlacement} from './asset-placement.ts';
import {resolveElectricalComponent} from './electrical-component-library.ts';
import type {ElectricalModelConfig} from './electrical-model-registry.ts';
import {analyzeSldText} from './sld-intelligence.ts';

export type SpatialProjectionEntity={
 id:string;source:string;layer:string;kind:string;name:string;x:number;y:number;z?:number;x2?:number;y2?:number;z2?:number;floor?:string;vertices?:{x:number;y:number}[];scale?:number;confidence:number;meta?:Record<string,unknown>;
};
export type SpatialProjectionLink={id:string;from:string;to:string;type:string;confidence:number;meta?:Record<string,unknown>};
export type SheetIdentityLike={
 sourceSha256:string;page:number;reviewState?:string;
 sheetNumber?:{value?:string|null};sheetTitle?:{value?:string|null};discipline?:{value?:string|null};
};
export type SpatialProjectionGraph={entities:SpatialProjectionEntity[];links?:SpatialProjectionLink[];titleBlocks?:SheetIdentityLike[];[key:string]:unknown};

type CadScale={metersPerX:number;metersPerY:number;minDisplayX:number;minDisplayY:number};
const SLD_PATTERN=/single\s*line|one\s*line|one-line|single-line|\bsld\b|riser|power\s*diagram|electrical\s*diagram/i;
const SOURCE_PATTERN=/utility|service|source|incoming|generator|genset|\bgen[-_ ]?[a-z0-9]+\b|solar|\bpv(?:[-_ ]?[a-z0-9]+)?\b|battery|\bbess\b|\bess\b|\bups\b/i;
const TRANSFORMER_PATTERN=/transformer|\bxfmr\b|\bxfr\b/i;
const MAIN_PATTERN=/switchgear|switchboard|main\s*(?:distribution|board)|\bswgr\b|\bswbd\b|\bmsb\b|\bmdb\b|\bmdp\b/i;
const DISTRIBUTION_PATTERN=/\bats\b|transfer\s*switch|\bmcc\b|\bpdu\b|distribution|busway|bus\s*duct|breaker|\bmccb\b|\bacb\b|\bmcb\b|\bcb[-_ ]?[a-z0-9]+\b/i;
const PANEL_PATTERN=/panelboard|\bpanel\b|load\s*center|\bpnl\b/i;
const LOAD_PATTERN=/disconnect|\bvfd\b|inverter|charger|evse|motor|load|receptacle|outlet|equipment/i;

export function inferredFloorElevation(floor?:string|null):number|null{
 const normalized=String(floor||'').trim().toUpperCase();
 if(!normalized||normalized==='UNRESOLVED')return null;
 const basement=normalized.match(/^B(\d+)$/);if(basement)return-4*Number(basement[1]);
 const level=normalized.match(/^L(\d+)$/);if(level)return(Math.max(1,Number(level[1]))-1)*4;
 if(normalized==='GROUND'||normalized==='GROUND FLOOR')return 0;
 if(normalized==='ROOF')return 12;
 if(normalized==='PENTHOUSE')return 16;
 return null;
}
function sourceFrame(entity:SpatialProjectionEntity){return `${String(entity.meta?.sourceSha256||entity.source)}:${String(entity.meta?.page||1)}`}
function sourceDocument(entity:SpatialProjectionEntity){return String(entity.meta?.sourceSha256||entity.source)}
function titleFor(entity:SpatialProjectionEntity,titleBlocks:SheetIdentityLike[]){
 const sha=String(entity.meta?.sourceSha256||'');const page=Number(entity.meta?.page||1);
 const reviewed=titleBlocks.find(item=>item.sourceSha256===sha&&item.page===page&&item.reviewState==='CONFIRMED')||titleBlocks.find(item=>item.sourceSha256===sha&&item.page===page);
 return `${reviewed?.sheetNumber?.value||''} ${reviewed?.sheetTitle?.value||''} ${reviewed?.discipline?.value||''} ${String(entity.meta?.sheetTitle||'')} ${entity.source}`.trim();
}
function sldDepth(name:string){
 if(SOURCE_PATTERN.test(name))return 0;
 if(TRANSFORMER_PATTERN.test(name))return 1;
 if(MAIN_PATTERN.test(name))return 2;
 if(DISTRIBUTION_PATTERN.test(name))return 3;
 if(PANEL_PATTERN.test(name))return 4;
 if(LOAD_PATTERN.test(name))return 5;
 return 3;
}
function finite(value:unknown){const n=Number(value);return Number.isFinite(n)?n:null}
function hasExplicitCadZ(entity:SpatialProjectionEntity){
 const rawZ=finite(entity.meta?.rawZ),unit=finite(entity.meta?.unitToMeters);
 return rawZ!==null&&unit!==null&&unit>0&&Math.abs(rawZ)>1e-9;
}
function canUsePhysicalZ(entity:SpatialProjectionEntity){
 return entity.meta?.elevationKnown===true||entity.meta?.physicalElevationKnown===true||entity.meta?.sourceDesignElevationKnown===true||entity.meta?.alignmentVerified===true||entity.meta?.zPlacementAuthority==='MEASURED_OR_REVIEWED'||entity.meta?.zPlacementAuthority==='SOURCE_CAD_Z'||entity.meta?.zPlacementAuthority==='SOURCE_IFC_DESIGN_PLACEMENT'||hasExplicitCadZ(entity);
}
function buildCadScales(entities:SpatialProjectionEntity[]){
 const result=new Map<string,CadScale>();
 const docs=[...new Set(entities.map(sourceDocument))];
 for(const doc of docs){
  const sourceEntities=entities.filter(entity=>sourceDocument(entity)===doc);
  const unitName=String(sourceEntities.find(entity=>entity.meta?.unitName)?.meta?.unitName||'');
  const unitToMeters=finite(sourceEntities.find(entity=>entity.meta?.unitToMeters)?.meta?.unitToMeters);
  if(!unitToMeters||unitToMeters<=0||unitName==='unitless')continue;
  const rawDisplayX:{raw:number;display:number}[]=[],rawDisplayY:{raw:number;display:number}[]=[];
  const allX:number[]=[],allY:number[]=[];
  for(const entity of sourceEntities){
   allX.push(entity.x);allY.push(entity.y);if(Number.isFinite(entity.x2))allX.push(Number(entity.x2));if(Number.isFinite(entity.y2))allY.push(Number(entity.y2));
   for(const point of entity.vertices||[]){allX.push(point.x);allY.push(point.y)}
   const rx=finite(entity.meta?.rawX),ry=finite(entity.meta?.rawY),rx2=finite(entity.meta?.rawX2),ry2=finite(entity.meta?.rawY2);
   if(rx!==null)rawDisplayX.push({raw:rx,display:entity.x});if(ry!==null)rawDisplayY.push({raw:ry,display:entity.y});
   if(rx2!==null&&Number.isFinite(entity.x2))rawDisplayX.push({raw:rx2,display:Number(entity.x2)});if(ry2!==null&&Number.isFinite(entity.y2))rawDisplayY.push({raw:ry2,display:Number(entity.y2)});
  }
  const scale=(items:{raw:number;display:number}[])=>{
   if(items.length<2)return null;const min=items.reduce((a,b)=>a.raw<b.raw?a:b),max=items.reduce((a,b)=>a.raw>b.raw?a:b);
   const displaySpan=Math.abs(max.display-min.display),rawSpan=Math.abs(max.raw-min.raw)*unitToMeters;return displaySpan>1e-9&&rawSpan>1e-9?rawSpan/displaySpan:null;
  };
  const metersPerX=scale(rawDisplayX),metersPerY=scale(rawDisplayY);
  if(!metersPerX&&!metersPerY)continue;
  const fallback=metersPerX||metersPerY||1;
  result.set(doc,{metersPerX:metersPerX||fallback,metersPerY:metersPerY||fallback,minDisplayX:Math.min(...allX),minDisplayY:Math.min(...allY)});
 }
 return result;
}

export function enrichSpatialProjection<T extends SpatialProjectionGraph>(graph:T,modelRegistry:ElectricalModelConfig[]=[]):T{
 const titleBlocks=Array.isArray(graph.titleBlocks)?graph.titleBlocks:[];
 const originalById=new Map(graph.entities.map(entity=>[entity.id,entity]));
 const cadScales=buildCadScales(graph.entities);
 const metricEntities=graph.entities.map(entity=>{
  if(entity.meta?.nonSpatial===true)return entity;
  const cadScale=cadScales.get(sourceDocument(entity));if(!cadScale||entity.meta?.cadMetricXY===true)return entity;
  const tx=(x:number)=>(x-cadScale.minDisplayX)*cadScale.metersPerX,ty=(y:number)=>(y-cadScale.minDisplayY)*cadScale.metersPerY;
  const explicitCadZ=hasExplicitCadZ(entity);
  return {...entity,x:tx(entity.x),y:ty(entity.y),...(Number.isFinite(entity.x2)?{x2:tx(Number(entity.x2))}:{}),...(Number.isFinite(entity.y2)?{y2:ty(Number(entity.y2))}:{}),vertices:entity.vertices?.map(point=>({x:tx(point.x),y:ty(point.y)})),meta:{...(entity.meta||{}),cadMetricXY:true,coordinateUnits:'m',planScaleMethod:'DXF_RAW_XY_AND_INSUNITS',metersPerDisplayUnitX:cadScale.metersPerX,metersPerDisplayUnitY:cadScale.metersPerY,...(explicitCadZ?{zPlacementAuthority:'SOURCE_CAD_Z',physicalElevationKnown:true}:{})}};
 });
 const sldFrames=new Set<string>();
 const frameEntities=new Map<string,SpatialProjectionEntity[]>();
 for(const entity of metricEntities){
  if(entity.layer!=='L2'&&entity.layer!=='L3')continue;
  const frame=sourceFrame(entity),items=frameEntities.get(frame)||[];
  items.push(entity);
  frameEntities.set(frame,items);
 }
 for(const [frame,items] of frameEntities){
  const titleMatch=items.some(entity=>SLD_PATTERN.test(titleFor(entity,titleBlocks)));
  const parserHint=items.some(entity=>entity.meta?.sldCandidate===true||entity.meta?.sldFeederCandidate===true);
  const contentHint=analyzeSldText(items.filter(entity=>entity.layer==='L2').map(entity=>entity.name)).isSld;
  if(titleMatch||parserHint||contentHint)sldFrames.add(frame);
 }

 const entities=metricEntities.map(entity=>{
  if(entity.meta?.nonSpatial===true)return entity;
  const meta={...(entity.meta||{})};
  const frame=sourceFrame(entity),isSld=entity.layer==='L2'&&sldFrames.has(frame);
  let z=Number.isFinite(Number(entity.z))?Number(entity.z):0;
  let scale=entity.scale;

  if(entity.layer==='L2'&&entity.kind!=='imported-3d-model'&&entity.kind!=='sheet-callout-candidate'&&entity.kind!=='annotated-asset-candidate'){
   const component=resolveElectricalComponent(entity.name);
   const registry=component?modelRegistry.find(item=>item.componentKey===component.key):undefined;
   const placement=resolveAssetPlacement({...entity,meta},registry);
   meta.assetDimensionsMeters=[placement.dimensions.width,placement.dimensions.height,placement.dimensions.depth];
   meta.assetDimensionAuthority=placement.dimensions.authority;
   meta.assetDimensionSource=placement.dimensions.source;
   meta.assetDimensionConfidence=placement.dimensions.confidence;
   meta.assetRecommendedBaseZ=placement.baseZ;
   meta.assetRecommendedTopZ=placement.topZ;
   meta.assetZRecommendationAuthority=placement.zAuthority;
   meta.assetZRecommendationConfidence=placement.zConfidence;
   if(placement.recommendation)meta.assetPlacementRecommendation=placement.recommendation;

   if(!canUsePhysicalZ({...entity,meta})&&!isSld){
    z=placement.baseZ;
    meta.elevationKnown=false;
    meta.physicalElevationKnown=false;
    meta.zPlacementAuthority=placement.zAuthority;
    meta.inferredZCandidate=placement.baseZ;
    meta.zReviewRequired=true;
    if(meta.cadMetricXY===true){meta.planCoordinateUnits='m';meta.coordinateUnits='m_xy';}
   }
   if((entity.kind==='text-asset-candidate'||isSld)&&placement.dimensions.authority!=='STRATUM_NOMINAL'){
    const nominal=nominalDimensionsFor(entity.name);
    scale=Math.max(.1,Math.min(8,placement.dimensions.height/Math.max(nominal[1],.05)));
    meta.assetScaleAuthority=placement.dimensions.authority;
   }
  }else if(!isSld&&!canUsePhysicalZ({...entity,meta})){
   const candidate=inferredFloorElevation(entity.floor);
   if(candidate!==null&&Math.abs(z)<1e-9){z=candidate;meta.elevationKnown=false;meta.physicalElevationKnown=false;meta.zPlacementAuthority='INFERRED_FLOOR_LABEL';meta.inferredZCandidate=candidate;meta.zReviewRequired=true;}
  }

  if(isSld){meta.sldSpatialProjection=true;meta.sldLogicalDepth=sldDepth(entity.name);meta.sldProjectionMethod=finite(meta.sldVectorComponent)!==null?'PDF_VECTOR_COMPONENT_PLUS_LOGICAL_DEPTH_V2':'DETERMINISTIC_ELECTRICAL_HIERARCHY_V1';meta.sldProjectionReviewRequired=true;meta.sldPhysicalElevationKnown=canUsePhysicalZ({...entity,meta});meta.sldTruthBoundary='LOGICAL_Z_NEVER_ESTABLISHES_PHYSICAL_ELEVATION';}
  return {...entity,z,scale,meta};
 });

 const retained=(graph.links||[]).filter(link=>link.type!=='SLD_FEEDS');
 const generated:SpatialProjectionLink[]=[];
 for(const frame of sldFrames){
  const nodes=entities.filter(entity=>entity.layer==='L2'&&sourceFrame(entity)===frame&&entity.meta?.sldSpatialProjection===true);
  const ordered=[...nodes].sort((a,b)=>Number(a.meta?.sldLogicalDepth||0)-Number(b.meta?.sldLogicalDepth||0)||a.x-b.x||a.y-b.y||a.id.localeCompare(b.id));
  for(const target of ordered){
   const targetDepth=Number(target.meta?.sldLogicalDepth||0),upstream=ordered.filter(candidate=>Number(candidate.meta?.sldLogicalDepth||0)<targetDepth);if(!upstream.length)continue;
   const targetComponent=finite(target.meta?.sldVectorComponent),vectorUpstream=targetComponent===null?[]:upstream.filter(candidate=>finite(candidate.meta?.sldVectorComponent)===targetComponent),candidates=vectorUpstream.length?vectorUpstream:upstream;
   candidates.sort((a,b)=>{const ad=targetDepth-Number(a.meta?.sldLogicalDepth||0),bd=targetDepth-Number(b.meta?.sldLogicalDepth||0);if(ad!==bd)return ad-bd;return Math.hypot(target.x-a.x,target.y-a.y)-Math.hypot(target.x-b.x,target.y-b.y)||a.id.localeCompare(b.id)});
   const from=candidates[0],vectorGrounded=vectorUpstream.length>0;generated.push({id:`sld-feeds:${from.id}:${target.id}`,from:from.id,to:target.id,type:'SLD_FEEDS',confidence:vectorGrounded?.9:.72,meta:{inference:vectorGrounded?'PDF_VECTOR_CONNECTED_COMPONENT':'DETERMINISTIC_HIERARCHY_NEAREST_UPSTREAM',reviewRequired:true,physicalTruth:false,...(vectorGrounded?{sourceVectorComponent:targetComponent}: {})}});
  }
 }

 const deduped=[...new Map([...retained,...generated].map(link=>[`${link.type}:${link.from}:${link.to}`,link])).values()];
 const changed=entities.some(entity=>JSON.stringify(originalById.get(entity.id))!==JSON.stringify(entity))||JSON.stringify(graph.links||[])!==JSON.stringify(deduped);
 if(!changed)return graph;
 return {...graph,entities,links:deduped,spatialProjection:{version:'7',generatedAt:new Date().toISOString(),cadMetricFrames:cadScales.size,sldFrames:sldFrames.size,sldLinks:generated.length,sldVectorLinks:generated.filter(link=>link.meta?.inference==='PDF_VECTOR_CONNECTED_COMPONENT').length,dimensionRegistryEntries:modelRegistry.filter(item=>item.dimensionsMeters).length,truthBoundary:'METRIC_XY_SOURCE_VECTOR_SLD_TOPOLOGY_LOGICAL_Z_AND_RECOMMENDED_PLACEMENT_NEVER_ESTABLISH_PHYSICAL_TRUTH'}} as T;
}

export function projectionSummary(graph:SpatialProjectionGraph){
 const sld=graph.entities.filter(entity=>entity.meta?.sldSpatialProjection===true).length,inferredZ=graph.entities.filter(entity=>entity.meta?.zReviewRequired===true).length,links=(graph.links||[]).filter(link=>link.type==='SLD_FEEDS').length,metricCad=graph.entities.filter(entity=>entity.meta?.cadMetricXY===true).length;
 return{sldObjects:sld,inferredZCandidates:inferredZ,sldLinks:links,metricCadObjects:metricCad};
}
