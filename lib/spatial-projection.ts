import {nominalDimensionsFor,resolveAssetPlacement} from './asset-placement';

export type SpatialProjectionEntity={
 id:string;source:string;layer:string;kind:string;name:string;x:number;y:number;z?:number;x2?:number;y2?:number;z2?:number;floor?:string;scale?:number;confidence:number;meta?:Record<string,unknown>;
};
export type SpatialProjectionLink={id:string;from:string;to:string;type:string;confidence:number;meta?:Record<string,unknown>};
export type SheetIdentityLike={
 sourceSha256:string;page:number;reviewState?:string;
 sheetNumber?:{value?:string|null};sheetTitle?:{value?:string|null};discipline?:{value?:string|null};
};
export type SpatialProjectionGraph={entities:SpatialProjectionEntity[];links?:SpatialProjectionLink[];titleBlocks?:SheetIdentityLike[];[key:string]:unknown};

const SLD_PATTERN=/single\s*line|one\s*line|one-line|single-line|\bsld\b|riser|power\s*diagram|electrical\s*diagram/i;
const SOURCE_PATTERN=/utility|service|source|incoming|generator|genset|solar|\bpv\b|battery|\bups\b/i;
const TRANSFORMER_PATTERN=/transformer|\bxfmr\b/i;
const MAIN_PATTERN=/switchgear|switchboard|main\s*(?:distribution|board)|\bmsb\b|\bmdb\b/i;
const DISTRIBUTION_PATTERN=/\bats\b|transfer\s*switch|\bmcc\b|\bpdu\b|distribution|busway|bus\s*duct|breaker/i;
const PANEL_PATTERN=/panelboard|\bpanel\b|load\s*center/i;
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
function canUsePhysicalZ(entity:SpatialProjectionEntity){
 return entity.meta?.elevationKnown===true||entity.meta?.physicalElevationKnown===true||entity.meta?.alignmentVerified===true||entity.meta?.zPlacementAuthority==='MEASURED_OR_REVIEWED'||entity.meta?.sourceType==='DXF';
}

export function enrichSpatialProjection<T extends SpatialProjectionGraph>(graph:T):T{
 const titleBlocks=Array.isArray(graph.titleBlocks)?graph.titleBlocks:[];
 const originalById=new Map(graph.entities.map(entity=>[entity.id,entity]));
 const sldFrames=new Set<string>();
 for(const entity of graph.entities){if(entity.layer==='L2'&&SLD_PATTERN.test(titleFor(entity,titleBlocks)))sldFrames.add(sourceFrame(entity))}

 const entities=graph.entities.map(entity=>{
  const meta={...(entity.meta||{})};
  const frame=sourceFrame(entity),isSld=entity.layer==='L2'&&sldFrames.has(frame);
  let z=Number.isFinite(Number(entity.z))?Number(entity.z):0;
  let scale=entity.scale;

  if(entity.layer==='L2'){
   const placement=resolveAssetPlacement({...entity,meta});
   meta.assetDimensionsMeters=[placement.dimensions.width,placement.dimensions.height,placement.dimensions.depth];
   meta.assetDimensionAuthority=placement.dimensions.authority;
   meta.assetDimensionSource=placement.dimensions.source;
   meta.assetDimensionConfidence=placement.dimensions.confidence;
   meta.assetRecommendedBaseZ=placement.baseZ;
   meta.assetRecommendedTopZ=placement.topZ;
   meta.assetZRecommendationAuthority=placement.zAuthority;
   meta.assetZRecommendationConfidence=placement.zConfidence;
   if(placement.recommendation)meta.assetPlacementRecommendation=placement.recommendation;

   if(!canUsePhysicalZ(entity)&&!isSld){
    z=placement.baseZ;
    meta.elevationKnown=false;
    meta.physicalElevationKnown=false;
    meta.zPlacementAuthority=placement.zAuthority;
    meta.inferredZCandidate=placement.baseZ;
    meta.zReviewRequired=true;
   }
   if((entity.kind==='text-asset-candidate'||isSld)&&placement.dimensions.authority!=='STRATUM_NOMINAL'){
    const nominal=nominalDimensionsFor(entity.name);
    scale=Math.max(.1,Math.min(8,placement.dimensions.height/Math.max(nominal[1],.05)));
    meta.assetScaleAuthority=placement.dimensions.authority;
   }
  }else if(!isSld&&!canUsePhysicalZ(entity)){
   const candidate=inferredFloorElevation(entity.floor);
   if(candidate!==null&&Math.abs(z)<1e-9){
    z=candidate;
    meta.elevationKnown=false;
    meta.physicalElevationKnown=false;
    meta.zPlacementAuthority='INFERRED_FLOOR_LABEL';
    meta.inferredZCandidate=candidate;
    meta.zReviewRequired=true;
   }
  }

  if(isSld){
   meta.sldSpatialProjection=true;
   meta.sldLogicalDepth=sldDepth(entity.name);
   meta.sldProjectionMethod='DETERMINISTIC_ELECTRICAL_HIERARCHY_V1';
   meta.sldProjectionReviewRequired=true;
   meta.sldPhysicalElevationKnown=canUsePhysicalZ(entity);
   meta.sldTruthBoundary='LOGICAL_Z_NEVER_ESTABLISHES_PHYSICAL_ELEVATION';
  }
  return {...entity,z,scale,meta};
 });

 const retained=(graph.links||[]).filter(link=>link.type!=='SLD_FEEDS');
 const generated:SpatialProjectionLink[]=[];
 for(const frame of sldFrames){
  const nodes=entities.filter(entity=>entity.layer==='L2'&&sourceFrame(entity)===frame&&entity.meta?.sldSpatialProjection===true);
  const ordered=[...nodes].sort((a,b)=>Number(a.meta?.sldLogicalDepth||0)-Number(b.meta?.sldLogicalDepth||0)||a.x-b.x||a.y-b.y||a.id.localeCompare(b.id));
  for(const target of ordered){
   const targetDepth=Number(target.meta?.sldLogicalDepth||0);
   const upstream=ordered.filter(candidate=>Number(candidate.meta?.sldLogicalDepth||0)<targetDepth);
   if(!upstream.length)continue;
   upstream.sort((a,b)=>{
    const ad=targetDepth-Number(a.meta?.sldLogicalDepth||0),bd=targetDepth-Number(b.meta?.sldLogicalDepth||0);
    if(ad!==bd)return ad-bd;
    const ax=Math.hypot(target.x-a.x,target.y-a.y),bx=Math.hypot(target.x-b.x,target.y-b.y);return ax-bx||a.id.localeCompare(b.id);
   });
   const from=upstream[0];
   generated.push({id:`sld-feeds:${from.id}:${target.id}`,from:from.id,to:target.id,type:'SLD_FEEDS',confidence:.72,meta:{inference:'DETERMINISTIC_HIERARCHY_NEAREST_UPSTREAM',reviewRequired:true,physicalTruth:false}});
  }
 }

 const deduped=[...new Map([...retained,...generated].map(link=>[`${link.type}:${link.from}:${link.to}`,link])).values()];
 const changed=entities.some(entity=>{
  const prior=originalById.get(entity.id);return JSON.stringify(prior)!==JSON.stringify(entity);
 })||JSON.stringify(graph.links||[])!==JSON.stringify(deduped);
 if(!changed)return graph;
 return {...graph,entities,links:deduped,spatialProjection:{version:'2',generatedAt:new Date().toISOString(),sldFrames:sldFrames.size,sldLinks:generated.length,truthBoundary:'LOGICAL_SLD_Z_AND_RECOMMENDED_PLACEMENT_NEVER_ESTABLISH_PHYSICAL_TRUTH'}} as T;
}

export function projectionSummary(graph:SpatialProjectionGraph){
 const sld=graph.entities.filter(entity=>entity.meta?.sldSpatialProjection===true).length;
 const inferredZ=graph.entities.filter(entity=>entity.meta?.zReviewRequired===true).length;
 const links=(graph.links||[]).filter(link=>link.type==='SLD_FEEDS').length;
 return{sldObjects:sld,inferredZCandidates:inferredZ,sldLinks:links};
}
