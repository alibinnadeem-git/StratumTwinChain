import type {SpatialGraphLike} from './spatial-browser-recovery';

// Human-inspected callouts on the user-supplied E4.0 power plan. Coordinates
// are PDF points on page 1, not surveyed building coordinates.
export const AUDI_E4_SHA256='c6b4c02f0b97d6eef947ff57f6863eddd16a6f769c13777af42e113905ded35c';
const PAGE_WIDTH=3024,PAGE_HEIGHT=2160;
const CALLOUTS=[
 {tag:'L5',x:1144,y:546},
 {tag:'L5A',x:1108,y:556},
 {tag:'L2A',x:1108,y:576},
 {tag:'L2',x:1108,y:595},
 {tag:'H2',x:1146,y:598},
] as const;

export function enrichAudiE4SourceReview<T extends SpatialGraphLike>(graph:T):T{
 const source=graph.sources.find(item=>item&&typeof item==='object'&&(item as {sha256?:string}).sha256===AUDI_E4_SHA256) as {name:string;sha256:string}|undefined;
 if(!source)return graph;
 const existing=new Set(graph.entities.map(item=>(item as {id?:string})?.id));
 const added=CALLOUTS.filter(item=>!existing.has(`${AUDI_E4_SHA256}:callout:${item.tag}`)).map(item=>({
  id:`${AUDI_E4_SHA256}:callout:${item.tag}`,source:source.name,layer:'L2',kind:'sheet-callout-candidate',name:`(E) ${item.tag}`,
  x:(item.x-PAGE_WIDTH/2)*20/PAGE_WIDTH,y:(PAGE_HEIGHT/2-item.y)*20/PAGE_WIDTH,z:0,floor:'L1',zone:'ELEC 108',confidence:.8,
  meta:{sourceSha256:AUDI_E4_SHA256,page:1,sheet:'E4.0',sourceType:'PDF_VISUAL_REVIEW',
   sheetX:item.x,sheetY:item.y,coordinateUnits:'sheet',geometryAuthority:'SHEET_CALLOUT_ONLY',
   equipmentType:'UNRESOLVED',existingDesignation:true,registrationState:'CANDIDATE',referenceOnly:true,
   physicalTruth:false,elevationKnown:false,reviewRequired:true,
   description:'Visible (E) electrical callout near ELEC 108. Symbol class, physical identity, dimensions and actual installation require drawing legend or field review.'}
 }));
 if(!added.length)return graph;
 const entities=[...graph.entities,...added];
 return{...graph,entities,reviewState:'REVIEW_REQUIRED',
  stats:{...graph.stats,L2:entities.filter(item=>(item as {layer?:string}).layer==='L2').length}} as T;
}


/**
 * Removes the five historical hard-coded Audi E4 review markers that older
 * browser workspaces could receive automatically. These IDs were created by
 * STRATUM itself, not by a user's manual review, so removing them is a safe
 * UI/data hygiene migration and does not touch source geometry or evidence.
 */
export function stripLegacyAudiE4SourceReview<T extends SpatialGraphLike>(graph:T):T{
 const legacyIds=new Set(CALLOUTS.map(item=>`${AUDI_E4_SHA256}:callout:${item.tag}`));
 const entities=graph.entities.filter(item=>!legacyIds.has(String((item as {id?:string})?.id||'')));
 if(entities.length===graph.entities.length)return graph;
 return{...graph,entities,stats:{...graph.stats,L2:entities.filter(item=>(item as {layer?:string}).layer==='L2').length}} as T;
}
