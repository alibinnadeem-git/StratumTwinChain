// SLD-to-Spatial dual linked views (A8, PR-SPAT-005) and route reconstruction
// readiness (B4, TRD section 8.1) for FEEDS candidates from the electrical
// relationship resolver.
//
// Merge order note: migration 014 (migrations/014_relationship_graph_foundation.sql)
// is shared byte-identically by PRs 205, 206 and 209 (blob 31db5995). It is already
// conditional and idempotent (CREATE TABLE IF NOT EXISTS, INSERT ON CONFLICT DO
// NOTHING, CREATE OR REPLACE FUNCTION, DROP TRIGGER IF EXISTS), and the migration
// runner records (name, sha256) and throws when an applied migration checksum
// changes, so the file must stay byte-identical: do not edit it to document this.
// Intended merge order is PR 205 first, then PR 206. Whichever of 205, 206 or 209
// lands first applies 014; the others are then skipped by the runner as already
// applied. Only one of 206 and 209 may land.
//
// This module is pure: it derives views and assessments from a graph and from
// resolver candidates, and it writes no FEEDS facts and no positions to any graph.
// It never invents coordinates, Z values, measurements or route geometry.
// A position is VERIFIED only when the entity meta carries positionVerified true
// with finite sheet X and Y. Finite sheet X and Y without that flag are INFERRED,
// never presented as verified. Unknown positions stay null (TR-206). Z is always
// null here: SLD topology never establishes physical elevation, and Z belongs to
// the Z resolver, not to this module. Every derived value carries
// physicalTruth false and reviewRequired true. Units are metres (base spec line
// 17). No scale is auto-applied: sheet coordinates are reported as sheet
// coordinates with no sheet-to-world transform applied here.

import type {
 ElectricalRelationshipDiscoveryCandidate,
 ElectricalRelationshipGraph,
 ElectricalRelationshipGraphEntity,
} from './electrical-relationship-resolver.ts';
import {
 resolveRegisteredSpatialAsset,
 type RegisteredSpatialAsset,
} from './spatial-asset-link.ts';

export type SldPositionLabel = 'VERIFIED' | 'INFERRED' | 'UNKNOWN';

export type SldLogicalViewNode = {
 entityId: string;
 assetId: string;
 name: string;
 kind: string;
 logicalDepth: number | null;
 sourceFileName: string;
 sheetReference?: string;
 pageNumber?: number;
};

export type SldPhysicalViewNode = {
 entityId: string;
 assetId: string;
 name: string;
 x: number | null;
 y: number | null;
 z: null;
 positionLabel: SldPositionLabel;
 coordinateUnits: 'sheet' | 'unknown';
 physicalTruth: false;
 reviewRequired: true;
};

export type SldCrossHighlight = {
 entityId: string;
 assetId: string;
 logicalNodeId: string;
 physicalNodeId: string;
};

export type SldSpatialLinkedViews = {
 logicalView: {view: 'LOGICAL_TOPOLOGY'; nodes: SldLogicalViewNode[]};
 physicalView: {view: 'PHYSICAL_COORDINATES'; nodes: SldPhysicalViewNode[]};
 crossHighlights: SldCrossHighlight[];
 unboundEntityIds: string[];
 truthBoundary: 'SLD_LINKED_VIEWS_ARE_REVIEW_ONLY_LOGICAL_AND_PHYSICAL_VIEWS_OF_THE_SAME_ENTITY_INFERRED_POSITIONS_ARE_NOT_VERIFIED';
};

export const SLD_LINKED_VIEWS_TRUTH_BOUNDARY =
 'SLD_LINKED_VIEWS_ARE_REVIEW_ONLY_LOGICAL_AND_PHYSICAL_VIEWS_OF_THE_SAME_ENTITY_INFERRED_POSITIONS_ARE_NOT_VERIFIED' as const;

const finiteNumber = (value: unknown): number | null => {
 const n = Number(value);
 return Number.isFinite(n) ? n : null;
};

const text = (value: unknown): string =>
 typeof value === 'string' ? value.trim() : '';

function pageFor(entity: ElectricalRelationshipGraphEntity): number | undefined {
 const page = finiteNumber(entity.meta?.page);
 return page !== null && Number.isInteger(page) && page > 0 ? page : undefined;
}

function sheetFor(entity: ElectricalRelationshipGraphEntity): string | undefined {
 const sheet = text(entity.meta?.sheet);
 return sheet ? sheet : undefined;
}

function logicalDepthFor(entity: ElectricalRelationshipGraphEntity): number | null {
 return finiteNumber(entity.meta?.sldLogicalDepth);
}

/**
 * Position label for one graph entity. VERIFIED requires an explicit
 * positionVerified flag in meta plus finite sheet X and Y. Finite sheet X and
 * Y without that flag are INFERRED. Anything else is UNKNOWN with null
 * coordinates, never a guessed position.
 */
export function sldPositionLabelFor(
 entity: ElectricalRelationshipGraphEntity,
): SldPositionLabel {
 const x = finiteNumber(entity.x);
 const y = finiteNumber(entity.y);
 if (x === null || y === null) return 'UNKNOWN';
 return entity.meta?.positionVerified === true ? 'VERIFIED' : 'INFERRED';
}

/**
 * Build the dual linked views of the same entities: a logical topology view
 * (SLD hierarchy depth, sheet, page) and a physical coordinate view (sheet X
 * and Y, inferred labeling, Z always null). An entity appears in both views or
 * in neither. crossHighlights maps each entity to its node in each view, so
 * selecting an entity in one view highlights the same entity in the other.
 * Entities that do not resolve to a registered asset are excluded from both
 * views and listed in unboundEntityIds.
 */
export function buildSldSpatialLinkedViews(
 graph: ElectricalRelationshipGraph,
 assets: RegisteredSpatialAsset[],
 _candidates: ElectricalRelationshipDiscoveryCandidate[],
): SldSpatialLinkedViews {
 const logicalNodes: SldLogicalViewNode[] = [];
 const physicalNodes: SldPhysicalViewNode[] = [];
 const crossHighlights: SldCrossHighlight[] = [];
 const unboundEntityIds: string[] = [];

 for (const entity of graph.entities) {
  const binding = resolveRegisteredSpatialAsset(entity, assets);
  if (!binding) {
   unboundEntityIds.push(entity.id);
   continue;
  }
  const label = sldPositionLabelFor(entity);
  const x = finiteNumber(entity.x);
  const y = finiteNumber(entity.y);
  logicalNodes.push({
   entityId: entity.id,
   assetId: binding.asset.id,
   name: entity.name,
   kind: entity.kind,
   logicalDepth: logicalDepthFor(entity),
   sourceFileName: entity.source,
   ...(sheetFor(entity) ? {sheetReference: sheetFor(entity)} : {}),
   ...(pageFor(entity) ? {pageNumber: pageFor(entity)} : {}),
  });
  physicalNodes.push({
   entityId: entity.id,
   assetId: binding.asset.id,
   name: entity.name,
   x: label === 'UNKNOWN' ? null : x,
   y: label === 'UNKNOWN' ? null : y,
   z: null,
   positionLabel: label,
   coordinateUnits: label === 'UNKNOWN' ? 'unknown' : 'sheet',
   physicalTruth: false,
   reviewRequired: true,
  });
  crossHighlights.push({
   entityId: entity.id,
   assetId: binding.asset.id,
   logicalNodeId: entity.id,
   physicalNodeId: entity.id,
  });
 }

 return {
  logicalView: {view: 'LOGICAL_TOPOLOGY', nodes: logicalNodes},
  physicalView: {view: 'PHYSICAL_COORDINATES', nodes: physicalNodes},
  crossHighlights,
  unboundEntityIds,
  truthBoundary: SLD_LINKED_VIEWS_TRUTH_BOUNDARY,
 };
}

/**
 * Cross-highlight lookup: given an entity id, return its node in each view.
 * Returns nulls for an entity that is in neither view (for example unbound).
 */
export function highlightLinkedEntity(
 views: SldSpatialLinkedViews,
 entityId: string,
): {
 logical: SldLogicalViewNode | null;
 physical: SldPhysicalViewNode | null;
 assetId: string | null;
} {
 const logical =
  views.logicalView.nodes.find((node) => node.entityId === entityId) || null;
 const physical =
  views.physicalView.nodes.find((node) => node.entityId === entityId) || null;
 return {
  logical,
  physical,
  assetId: logical?.assetId || physical?.assetId || null,
 };
}

export type SldRoutePort = {
 entityId: string;
 portId: string;
 position?: {x: number; y: number; z?: number | null};
};

export type SldRoutePermittedZone = {
 zoneId: string;
 description?: string;
};

export type SldRouteObstacle = {
 obstacleId: string;
 description?: string;
};

export type SldRouteConstraints = {
 ports: SldRoutePort[];
 permittedZones: SldRoutePermittedZone[];
 bendRadiusMinMetres: number;
 clearanceMetres: number;
 obstacles: SldRouteObstacle[];
};

export type SldRouteReconstructionStatus =
 | 'NOT_RECONSTRUCTIBLE'
 | 'CONSTRAINTS_INCOMPLETE'
 | 'CONSTRAINED_READY_FOR_REVIEW';

export type SldRouteReconstructionAssessment = {
 sourceEntityId: string;
 targetEntityId: string;
 sourceAssetId: string;
 targetAssetId: string;
 relationshipType: 'FEEDS';
 confidence: number;
 status: SldRouteReconstructionStatus;
 missingInputs: string[];
 routePath: null;
 routePathNote: string;
 physicalTruth: false;
 reviewRequired: true;
 truthBoundary: 'SLD_ROUTE_RECONSTRUCTION_IS_CONSTRAINED_REVIEW_ONLY_NO_UNCONSTRAINED_GUESSING';
};

/**
 * B4 (TRD section 8.1) route reconstruction readiness for one FEEDS candidate.
 * A route is reconstructible only from declared ports, permitted zones, a
 * minimum bend radius, clearances and a declared obstacle list. When any of
 * those is missing the assessment refuses to guess: status is
 * NOT_RECONSTRUCTIBLE (no constraints supplied at all) or
 * CONSTRAINTS_INCOMPLETE, missingInputs names every gap, and routePath is
 * null. When every input is present the status is CONSTRAINED_READY_FOR_REVIEW,
 * but routePath is still null: computing the geometric path is a routing
 * engine step, out of scope for this resolver, and any computed path stays
 * review-only until human verified. No bend radius, clearance, zone or
 * obstacle is ever defaulted or invented here.
 */
export function assessRouteReconstruction(
 candidate: ElectricalRelationshipDiscoveryCandidate,
 views: SldSpatialLinkedViews,
 constraints?: SldRouteConstraints,
): SldRouteReconstructionAssessment {
 const missingInputs: string[] = [];

 const sourcePhysical = views.physicalView.nodes.find(
  (node) => node.entityId === candidate.sourceEntityId,
 );
 const targetPhysical = views.physicalView.nodes.find(
  (node) => node.entityId === candidate.targetEntityId,
 );
 if (!sourcePhysical || sourcePhysical.x === null || sourcePhysical.y === null) {
  missingInputs.push(`PHYSICAL_POSITION:${candidate.sourceEntityId}`);
 }
 if (!targetPhysical || targetPhysical.x === null || targetPhysical.y === null) {
  missingInputs.push(`PHYSICAL_POSITION:${candidate.targetEntityId}`);
 }

 if (!constraints) {
  missingInputs.push(
   `PORT:${candidate.sourceEntityId}`,
   `PORT:${candidate.targetEntityId}`,
   'PERMITTED_ZONES',
   'BEND_RADIUS_MIN_METRES',
   'CLEARANCE_METRES',
   'OBSTACLES',
  );
 } else {
  for (const entityId of [candidate.sourceEntityId, candidate.targetEntityId]) {
   const port = constraints.ports.find((item) => item.entityId === entityId);
   if (!port) {
    missingInputs.push(`PORT:${entityId}`);
   } else if (
    !port.position ||
    !Number.isFinite(port.position.x) ||
    !Number.isFinite(port.position.y)
   ) {
    missingInputs.push(`PORT_POSITION:${entityId}`);
   }
  }
  if (!Array.isArray(constraints.permittedZones) || constraints.permittedZones.length === 0) {
   missingInputs.push('PERMITTED_ZONES');
  }
  if (
   !Number.isFinite(constraints.bendRadiusMinMetres) ||
   constraints.bendRadiusMinMetres <= 0
  ) {
   missingInputs.push('BEND_RADIUS_MIN_METRES');
  }
  if (
   !Number.isFinite(constraints.clearanceMetres) ||
   constraints.clearanceMetres <= 0
  ) {
   missingInputs.push('CLEARANCE_METRES');
  }
  if (!Array.isArray(constraints.obstacles)) {
   missingInputs.push('OBSTACLES');
  }
 }

 const status: SldRouteReconstructionStatus =
  missingInputs.length === 0
   ? 'CONSTRAINED_READY_FOR_REVIEW'
   : constraints === undefined
     ? 'NOT_RECONSTRUCTIBLE'
     : 'CONSTRAINTS_INCOMPLETE';

 return {
  sourceEntityId: candidate.sourceEntityId,
  targetEntityId: candidate.targetEntityId,
  sourceAssetId: candidate.sourceAssetId,
  targetAssetId: candidate.targetAssetId,
  relationshipType: 'FEEDS',
  confidence: candidate.confidence,
  status,
  missingInputs,
  routePath: null,
  routePathNote:
   'No geometric route path is computed here. A routing engine must compute the path from the declared ports, permitted zones, bend radius, clearances and obstacles, and the result stays review-only until human verified.',
  physicalTruth: false,
  reviewRequired: true,
  truthBoundary:
   'SLD_ROUTE_RECONSTRUCTION_IS_CONSTRAINED_REVIEW_ONLY_NO_UNCONSTRAINED_GUESSING',
 };
}
