import {resolveLibraryComponentForLabel} from './library-component-resolution.ts';

// Phase 2 component identification pass. Stamps a reviewable library-component identity onto equipment
// entities using the class/tag bridge. It writes ONLY `libraryComponent*` meta — deliberately not
// `componentKey`, so the renderer/placement behavior is unchanged here; consuming this identity for
// size/model/Z is Phase 4. Never overwrites an existing identity or a human-confirmed one.

export type IdentifiableEntity={id:string;name:string;layer:string;kind:string;meta?:Record<string,unknown>};

const NON_EQUIPMENT_KINDS=new Set([
  'line','sld-feeder-candidate','wall-segment','source-raster-underlay','elevation-control-point',
  'elevation-review-surface-triangle','room-boundary','floor-boundary','room-label','plan-frame-candidate',
]);

function isEquipmentCandidate(entity:IdentifiableEntity){
  if(entity.meta?.nonSpatial===true)return false;
  if(entity.layer!=='L2'&&entity.layer!=='L4')return false;
  if(NON_EQUIPMENT_KINDS.has(entity.kind))return false;
  return true;
}

export function identifyLibraryComponents<T extends IdentifiableEntity>(entities:T[]):T[]{
  return entities.map(entity=>{
    if(!isEquipmentCandidate(entity))return entity;
    if(entity.meta?.libraryComponentKey)return entity; // already identified; do not overwrite
    const resolved=resolveLibraryComponentForLabel(entity.name);
    if(!resolved)return entity;
    return{
      ...entity,
      meta:{
        ...(entity.meta||{}),
        libraryComponentKey:resolved.key,
        libraryComponentAuthority:resolved.authority,
        libraryComponentConfidence:resolved.confidence,
        libraryComponentCoarseClass:resolved.coarseClass,
        libraryComponentReviewRequired:true,
        physicalTruth:false,
      },
    };
  });
}
