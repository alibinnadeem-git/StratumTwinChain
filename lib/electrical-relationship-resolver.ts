import {resolveRegisteredSpatialAsset,type RegisteredSpatialAsset,type SpatialAssetBinding} from '@/lib/spatial-asset-link';

export type ElectricalRelationshipGraphSource={
 name:string;
 sha256?:string;
 discipline?:string;
};

export type ElectricalRelationshipGraphEntity={
 id:string;
 source:string;
 layer:string;
 kind:string;
 name:string;
 x?:number;
 y?:number;
 confidence:number;
 meta?:Record<string,unknown>;
};

export type ElectricalRelationshipGraphLink={
 id:string;
 from:string;
 to:string;
 type:string;
 confidence:number;
 meta?:Record<string,unknown>;
};

export type ElectricalRelationshipGraph={
 sources?:ElectricalRelationshipGraphSource[];
 entities:ElectricalRelationshipGraphEntity[];
 links?:ElectricalRelationshipGraphLink[];
};

export type ElectricalRelationshipDiscoveryCandidate={
 sourceEntityId:string;
 targetEntityId:string;
 sourceAssetId:string;
 targetAssetId:string;
 relationshipType:'FEEDS';
 confidence:number;
 sourceBinding:{method:SpatialAssetBinding['method'];confidence:number};
 targetBinding:{method:SpatialAssetBinding['method'];confidence:number};
 evidence:{
  sourceSha256?:string;
  sourceFileName:string;
  sheetReference?:string;
  pageNumber?:number;
  extractionMethod:'SLD_VECTOR_CONNECTIVITY'|'SLD_LOGICAL_HIERARCHY';
  confidence:number;
  graphLinkId:string;
  graphLinkInference:string;
 };
};

export type ElectricalRelationshipDiscoveryUnresolved={
 linkId:string;
 fromEntityId:string;
 toEntityId:string;
 reason:
  |'SOURCE_ENTITY_MISSING'
  |'TARGET_ENTITY_MISSING'
  |'SOURCE_ASSET_UNRESOLVED'
  |'TARGET_ASSET_UNRESOLVED'
  |'SAME_REGISTERED_ASSET'
  |'CROSS_SOURCE_SLD_LINK';
};

export type ElectricalRelationshipDiscoveryResult={
 candidates:ElectricalRelationshipDiscoveryCandidate[];
 unresolved:ElectricalRelationshipDiscoveryUnresolved[];
 inspectedSldLinks:number;
 truthBoundary:'SLD_RELATIONSHIPS_ARE_REVIEW_CANDIDATES_NOT_OPERATIONAL_TRUTH_UNTIL_EVIDENCE_BACKED_HUMAN_VERIFIED';
};

const sha256=/^[a-f0-9]{64}$/i;
const finite=(value:unknown)=>{const n=Number(value);return Number.isFinite(n)?n:null};
const text=(value:unknown)=>typeof value==='string'?value.trim():'';

function pageFor(entity:ElectricalRelationshipGraphEntity){
 const page=finite(entity.meta?.page);
 return page!==null&&Number.isInteger(page)&&page>0?page:undefined;
}

function sheetFor(from:ElectricalRelationshipGraphEntity,to:ElectricalRelationshipGraphEntity){
 return text(from.meta?.sheet)||text(to.meta?.sheet)||undefined;
}

function sourceFingerprint(
 graph:ElectricalRelationshipGraph,
 entity:ElectricalRelationshipGraphEntity,
){
 const explicit=text(entity.meta?.sourceSha256).toLowerCase();
 if(sha256.test(explicit))return explicit;
 const source=(graph.sources||[]).find(item=>item.name===entity.source);
 const fallback=text(source?.sha256).toLowerCase();
 return sha256.test(fallback)?fallback:undefined;
}

function confidence(link:ElectricalRelationshipGraphLink,from:SpatialAssetBinding,to:SpatialAssetBinding){
 return Number(Math.max(0,Math.min(1,Math.min(link.confidence,from.confidence,to.confidence))).toFixed(3));
}

export function discoverElectricalRelationshipCandidates(
 graph:ElectricalRelationshipGraph,
 assets:RegisteredSpatialAsset[],
):ElectricalRelationshipDiscoveryResult{
 const entityById=new Map(graph.entities.map(entity=>[entity.id,entity]));
 const candidates:ElectricalRelationshipDiscoveryCandidate[]=[];
 const unresolved:ElectricalRelationshipDiscoveryUnresolved[]=[];
 const sldLinks=(graph.links||[]).filter(link=>link.type==='SLD_FEEDS');

 for(const link of sldLinks){
  const from=entityById.get(link.from);
  const to=entityById.get(link.to);
  if(!from){
   unresolved.push({linkId:link.id,fromEntityId:link.from,toEntityId:link.to,reason:'SOURCE_ENTITY_MISSING'});
   continue;
  }
  if(!to){
   unresolved.push({linkId:link.id,fromEntityId:link.from,toEntityId:link.to,reason:'TARGET_ENTITY_MISSING'});
   continue;
  }
  if(from.source!==to.source){
   unresolved.push({linkId:link.id,fromEntityId:from.id,toEntityId:to.id,reason:'CROSS_SOURCE_SLD_LINK'});
   continue;
  }

  const sourceBinding=resolveRegisteredSpatialAsset(from,assets);
  if(!sourceBinding){
   unresolved.push({linkId:link.id,fromEntityId:from.id,toEntityId:to.id,reason:'SOURCE_ASSET_UNRESOLVED'});
   continue;
  }
  const targetBinding=resolveRegisteredSpatialAsset(to,assets);
  if(!targetBinding){
   unresolved.push({linkId:link.id,fromEntityId:from.id,toEntityId:to.id,reason:'TARGET_ASSET_UNRESOLVED'});
   continue;
  }
  if(sourceBinding.asset.id===targetBinding.asset.id){
   unresolved.push({linkId:link.id,fromEntityId:from.id,toEntityId:to.id,reason:'SAME_REGISTERED_ASSET'});
   continue;
  }

  const inference=text(link.meta?.inference);
  const extractionMethod=inference==='PDF_VECTOR_CONNECTED_COMPONENT'
   ?'SLD_VECTOR_CONNECTIVITY'
   :'SLD_LOGICAL_HIERARCHY';
  const evidenceConfidence=confidence(link,sourceBinding,targetBinding);
  candidates.push({
   sourceEntityId:from.id,
   targetEntityId:to.id,
   sourceAssetId:sourceBinding.asset.id,
   targetAssetId:targetBinding.asset.id,
   relationshipType:'FEEDS',
   confidence:evidenceConfidence,
   sourceBinding:{method:sourceBinding.method,confidence:sourceBinding.confidence},
   targetBinding:{method:targetBinding.method,confidence:targetBinding.confidence},
   evidence:{
    ...(sourceFingerprint(graph,from)?{sourceSha256:sourceFingerprint(graph,from)}:{}),
    sourceFileName:from.source,
    ...(sheetFor(from,to)?{sheetReference:sheetFor(from,to)}:{}),
    ...(pageFor(from)?{pageNumber:pageFor(from)}:{}),
    extractionMethod,
    confidence:evidenceConfidence,
    graphLinkId:link.id,
    graphLinkInference:inference||'UNSPECIFIED_SLD_FEEDS_INFERENCE',
   },
  });
 }

 return{
  candidates,
  unresolved,
  inspectedSldLinks:sldLinks.length,
  truthBoundary:'SLD_RELATIONSHIPS_ARE_REVIEW_CANDIDATES_NOT_OPERATIONAL_TRUTH_UNTIL_EVIDENCE_BACKED_HUMAN_VERIFIED',
 };
}
