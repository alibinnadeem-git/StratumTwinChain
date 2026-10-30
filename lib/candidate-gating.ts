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
// A circuit reference is a numbered designator plus a circuit number ("MS1 #1", "HP1-1", "HP1-1,3"): a
// homerun callout naming where a run comes from, not a piece of equipment, so it stays a LABEL.
// Phase 20 (lib/equipment-roster.ts): a name from the project's own roster, or a panel class phrase ("ELEC.
// PANEL"), labelling a drawn symbol is an INSTANCE even without a digit (HL). A section of a switchboard
// lineup (DIST, P/S beside MS1) is drawn as part of that switchboard, so it stays a LABEL.
const CIRCUIT_REFERENCE=/^[A-Z]+-?\d+[A-Z]?\s*(?:#\s*\d+|-\s*\d+(?:\s*,\s*\d+)*)$/i;
// An enlarged typical-unit plan (a frame naming a unit and no floor: E-7 to E-9 on the golden fixture) shows
// the devices of every unit of that type. A symbol there is a detail, not one placed piece of equipment, and
// it has no floor to stand on; the floor plans place each unit's equipment (lib/equipment-roster.ts skips
// these frames for the same reason).
function onTypicalUnitDetail(entity:GatableEntity){
  const meta=entity.meta||{};
  return Boolean(meta.planFrameUnitId||meta.planFrameUnitPlan)&&!meta.planFrameFloor;
}
function isInstance(entity:GatableEntity){
  if(onTypicalUnitDetail(entity))return false;
  if(PLACED_SYMBOL_KINDS.has(entity.kind))return true;
  // Already drawn as part of another instance: a word of an assembled "ELEC. PANEL", or a lineup section.
  // Checked before the nearest-shape anchor (lib/pdf-equipment-symbol-anchor.ts), which would otherwise
  // make the bare word a second piece of equipment beside the load centre it belongs to.
  if(entity.meta?.assembledInto||entity.meta?.lineupSectionOf)return false;
  if(entity.meta?.symbolAnchorStatus==='RESOLVED_REVIEW_CANDIDATE')return true;
  if(entity.meta?.drawnFootprint&&(entity.meta?.rosterBacked===true||entity.meta?.footprintClassPhrase===true))return true;
  const name=String(entity.name||'').trim();
  if(CIRCUIT_REFERENCE.test(name))return false;
  return /\d/.test(name);
}

export function gateEquipmentCandidates<T extends GatableEntity>(entities:T[]):T[]{
  return entities.map(entity=>{
    if(!isEquipmentCandidate(entity))return entity;
    const role:CandidateRole=entity.meta?.derivedFrom?'REGISTRATION_SHADOW':isInstance(entity)?'INSTANCE':'LABEL';
    return{...entity,meta:{...(entity.meta||{}),candidateRole:role,...(role==='LABEL'&&onTypicalUnitDetail(entity)?{candidateRoleReason:'TYPICAL_UNIT_DETAIL'}:{})}};
  });
}
