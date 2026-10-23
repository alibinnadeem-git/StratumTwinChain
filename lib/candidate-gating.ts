// Phase 2c candidate gating. A pure post-pass that reclassifies equipment candidates by role so
// counts, identification, and (Phase 4) rendering reflect real unique instances instead of duplicated
// label noise. It only stamps `meta.candidateRole` — nothing is deleted; review can promote a LABEL.
//
//   REGISTRATION_SHADOW — a derived L4 asset-candidate copy (meta.derivedFrom); the L2 source is canonical.
//   INSTANCE            — a placed/tagged piece of equipment.
//   LABEL               — a bare class word / annotation (no tag, no resolved symbol, no cluster).

export type CandidateRole='INSTANCE'|'LABEL'|'REGISTRATION_SHADOW';
export type GatableEntity={id:string;name:string;layer:string;kind:string;meta?:Record<string,unknown>};

const NON_EQUIPMENT_KINDS=new Set([
  'line','sld-feeder-candidate','wall-segment','source-raster-underlay','elevation-control-point',
  'elevation-review-surface-triangle','room-boundary','floor-boundary','room-label','plan-frame-candidate',
]);
// Kinds that are already a placed/marked symbol, not loose text.
const PLACED_SYMBOL_KINDS=new Set(['legend-symbol-match-candidate','annotated-asset-candidate']);

function isEquipmentCandidate(entity:GatableEntity){
  if(entity.meta?.nonSpatial===true)return false;
  if(entity.layer!=='L2'&&entity.layer!=='L4')return false;
  if(NON_EQUIPMENT_KINDS.has(entity.kind))return false;
  return true;
}

// A spatial instance has a placed symbol, a resolved vector-symbol anchor, or a numeric designator
// (MS1, LP-3, XFMR-2). A bare class word ("PANEL", "CO", a title phrase) has none of these. A
// numeric designator is required because letter-only tags are indistinguishable from plain words
// ("P" would otherwise match "PANEL"); letter-only tags are rare and a reviewer can promote them.
function isInstance(entity:GatableEntity){
  if(PLACED_SYMBOL_KINDS.has(entity.kind))return true;
  if(entity.meta?.symbolAnchorStatus==='RESOLVED_REVIEW_CANDIDATE')return true;
  return /\d/.test(String(entity.name||''));
}

export function gateEquipmentCandidates<T extends GatableEntity>(entities:T[]):T[]{
  return entities.map(entity=>{
    if(!isEquipmentCandidate(entity))return entity;
    const role:CandidateRole=entity.meta?.derivedFrom?'REGISTRATION_SHADOW':isInstance(entity)?'INSTANCE':'LABEL';
    return{...entity,meta:{...(entity.meta||{}),candidateRole:role}};
  });
}
