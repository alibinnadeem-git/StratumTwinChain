// QA: SLD-to-Spatial dual linked views (A8, PR-SPAT-005) and route
// reconstruction readiness (B4, TRD section 8.1) for PR 206.
//
// Merge order note: migration 014 is shared byte-identically by PRs 205, 206
// and 209 and is already conditional and idempotent, so the intended merge
// order is PR 205 first, then PR 206. The migration file must stay
// byte-identical: the migration runner records (name, sha256) and throws when
// an applied migration checksum changes, so editing its header would break
// the PR 205 first path. This script asserts the SQL stays conditional and
// the merge order stays documented in lib/sld-spatial-linked-views.ts.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import {discoverElectricalRelationshipCandidates} from '../lib/electrical-relationship-resolver.ts';
import {
 assessRouteReconstruction,
 buildSldSpatialLinkedViews,
 highlightLinkedEntity,
 sldPositionLabelFor,
} from '../lib/sld-spatial-linked-views.ts';

const assets = [
 {
  id: '11111111-1111-4111-8111-111111111111', project_id: '33333333-3333-4333-8333-333333333333',
  asset_code: 'MSB-01', asset_type: 'SWITCHBOARD', name: 'Main Switchboard MSB-01', model: null, serial_number: null,
  location_label: null, status: 'REGISTERED', system_name: null, manufacturer_name: null, ledger_network: null, ledger_tx_hash: null, ledger_block_height: null,
 },
 {
  id: '22222222-2222-4222-8222-222222222222', project_id: '33333333-3333-4333-8333-333333333333',
  asset_code: 'MCC-01', asset_type: 'MCC', name: 'MCC-01', model: null, serial_number: null,
  location_label: null, status: 'REGISTERED', system_name: null, manufacturer_name: null, ledger_network: null, ledger_tx_hash: null, ledger_block_height: null,
 },
];

const sha = 'a'.repeat(64);
const graph = {
 sources: [{name: 'E-601 SLD.pdf', sha256: sha, discipline: 'Electrical'}],
 entities: [
  {id: 'msb', source: 'E-601 SLD.pdf', layer: 'L2', kind: 'text-asset-candidate', name: 'MSB-01', x: 0, y: 0, confidence: .96, meta: {registeredAssetId: assets[0].id, sourceSha256: sha, page: 1, sheet: 'E-601', sldLogicalDepth: 2}},
  {id: 'mcc', source: 'E-601 SLD.pdf', layer: 'L2', kind: 'text-asset-candidate', name: 'MCC-01', x: 0, y: 4, confidence: .94, meta: {assetCode: 'MCC-01', sourceSha256: sha, page: 1, sheet: 'E-601', sldLogicalDepth: 4}},
  {id: 'verified-panel', source: 'E-601 SLD.pdf', layer: 'L2', kind: 'text-asset-candidate', name: 'MCC-01', x: 1, y: 1, confidence: .94, meta: {assetCode: 'MCC-01', sourceSha256: sha, page: 1, sheet: 'E-601', sldLogicalDepth: 4, positionVerified: true}},
  {id: 'unplaced', source: 'E-601 SLD.pdf', layer: 'L2', kind: 'text-asset-candidate', name: 'MSB-01', confidence: .8, meta: {registeredAssetId: assets[0].id, sourceSha256: sha, page: 1, sheet: 'E-601', sldLogicalDepth: 2}},
  {id: 'unknown', source: 'E-601 SLD.pdf', layer: 'L2', kind: 'text-asset-candidate', name: 'UNBOUND LOAD', x: 0, y: 8, confidence: .72, meta: {sourceSha256: sha, page: 1, sheet: 'E-601', sldLogicalDepth: 5}},
 ],
 links: [
  {id: 'vector', from: 'msb', to: 'mcc', type: 'SLD_FEEDS', confidence: .9, meta: {inference: 'PDF_VECTOR_CONNECTED_COMPONENT', reviewRequired: true, physicalTruth: false}},
 ],
};

const discovery = discoverElectricalRelationshipCandidates(graph, assets);
assert.equal(discovery.candidates.length, 1, 'one FEEDS candidate from the vector-connected SLD link');
const candidate = discovery.candidates[0];
assert.equal(candidate.physicalTruth, false, 'a resolver candidate is never physical truth');
assert.equal(candidate.reviewRequired, true, 'a resolver candidate always requires review');

// Position labeling: inferred by default, verified only with an explicit flag, unknown stays null.
assert.equal(sldPositionLabelFor(graph.entities[0]), 'INFERRED', 'finite sheet XY without a verified flag is INFERRED, never verified');
assert.equal(sldPositionLabelFor(graph.entities[2]), 'VERIFIED', 'finite sheet XY with positionVerified true is VERIFIED');
assert.equal(sldPositionLabelFor(graph.entities[3]), 'UNKNOWN', 'no XY means UNKNOWN, never a guessed position');

// Dual linked views: same entities in both views, cross-highlighted by entity id.
const views = buildSldSpatialLinkedViews(graph, assets, discovery.candidates);
assert.equal(views.logicalView.view, 'LOGICAL_TOPOLOGY');
assert.equal(views.physicalView.view, 'PHYSICAL_COORDINATES');
assert.equal(views.logicalView.nodes.length, 4, 'four bound entities appear in the logical view');
assert.equal(views.physicalView.nodes.length, 4, 'the same four entities appear in the physical view');
assert.deepEqual(
 views.logicalView.nodes.map((node) => node.entityId).sort(),
 views.physicalView.nodes.map((node) => node.entityId).sort(),
 'logical and physical views cover exactly the same entities',
);
assert.equal(views.crossHighlights.length, 4);
assert.deepEqual(views.unboundEntityIds, ['unknown'], 'the unbound entity is excluded from both views and listed as unbound');
const msbLogical = views.logicalView.nodes.find((node) => node.entityId === 'msb');
assert.equal(msbLogical?.assetId, assets[0].id);
assert.equal(msbLogical?.logicalDepth, 2);
assert.equal(msbLogical?.sheetReference, 'E-601');
assert.equal(msbLogical?.pageNumber, 1);
const msbPhysical = views.physicalView.nodes.find((node) => node.entityId === 'msb');
assert.equal(msbPhysical?.positionLabel, 'INFERRED');
assert.equal(msbPhysical?.x, 0);
assert.equal(msbPhysical?.y, 0);
assert.equal(msbPhysical?.z, null, 'Z is never derived from SLD topology');
assert.equal(msbPhysical?.physicalTruth, false);
assert.equal(msbPhysical?.reviewRequired, true);
assert.equal(msbPhysical?.coordinateUnits, 'sheet');
const unplacedPhysical = views.physicalView.nodes.find((node) => node.entityId === 'unplaced');
assert.equal(unplacedPhysical?.positionLabel, 'UNKNOWN');
assert.equal(unplacedPhysical?.x, null, 'unknown positions stay null, never zero or guessed');
assert.equal(unplacedPhysical?.y, null);
assert.equal(unplacedPhysical?.coordinateUnits, 'unknown');
const verifiedPhysical = views.physicalView.nodes.find((node) => node.entityId === 'verified-panel');
assert.equal(verifiedPhysical?.positionLabel, 'VERIFIED');
assert.match(views.truthBoundary, /INFERRED_POSITIONS_ARE_NOT_VERIFIED/);

// Cross-highlighting: selecting an entity in one view finds it in the other.
const highlight = highlightLinkedEntity(views, 'mcc');
assert.equal(highlight.logical?.entityId, 'mcc');
assert.equal(highlight.physical?.entityId, 'mcc');
assert.equal(highlight.assetId, assets[1].id);
const missingHighlight = highlightLinkedEntity(views, 'unknown');
assert.equal(missingHighlight.logical, null);
assert.equal(missingHighlight.physical, null);
assert.equal(missingHighlight.assetId, null);

// Route reconstruction (B4): no constraints means refusal, never an unconstrained guess.
const noConstraints = assessRouteReconstruction(candidate, views);
assert.equal(noConstraints.status, 'NOT_RECONSTRUCTIBLE');
assert.equal(noConstraints.routePath, null);
assert.deepEqual(
 noConstraints.missingInputs,
 ['PORT:msb', 'PORT:mcc', 'PERMITTED_ZONES', 'BEND_RADIUS_MIN_METRES', 'CLEARANCE_METRES', 'OBSTACLES'],
 'every missing route input is named',
);
assert.equal(noConstraints.physicalTruth, false);
assert.equal(noConstraints.reviewRequired, true);

// Partial constraints name the remaining gaps and still produce no path.
const partial = assessRouteReconstruction(candidate, views, {
 ports: [{entityId: 'msb', portId: 'MSB-01-OUT', position: {x: 0, y: 0}}],
 permittedZones: [],
 bendRadiusMinMetres: 0,
 clearanceMetres: 0.3,
 obstacles: [],
});
assert.equal(partial.status, 'CONSTRAINTS_INCOMPLETE');
assert.equal(partial.routePath, null);
assert.ok(partial.missingInputs.includes('PORT:mcc'));
assert.ok(partial.missingInputs.includes('PERMITTED_ZONES'));
assert.ok(partial.missingInputs.includes('BEND_RADIUS_MIN_METRES'));

// Full constraints make the candidate ready for review, but the geometric path
// is still not computed here: that is a routing engine step.
const ready = assessRouteReconstruction(candidate, views, {
 ports: [
  {entityId: 'msb', portId: 'MSB-01-OUT', position: {x: 0, y: 0}},
  {entityId: 'mcc', portId: 'MCC-01-IN', position: {x: 0, y: 4}},
 ],
 permittedZones: [{zoneId: 'ELEC-RISER-A'}],
 bendRadiusMinMetres: 0.3,
 clearanceMetres: 0.3,
 obstacles: [],
});
assert.equal(ready.status, 'CONSTRAINED_READY_FOR_REVIEW');
assert.equal(ready.routePath, null, 'even a fully constrained candidate gets no invented route geometry here');
assert.deepEqual(ready.missingInputs, []);
assert.equal(ready.physicalTruth, false);
assert.equal(ready.reviewRequired, true);

// Migration 014 stays conditional and idempotent, and the merge order stays documented.
const migration = fs.readFileSync('migrations/014_relationship_graph_foundation.sql', 'utf8');
assert.match(migration, /CREATE TABLE IF NOT EXISTS relationship_types/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS asset_relationships/);
assert.match(migration, /ON CONFLICT \(code\) DO NOTHING/);
assert.match(migration, /CREATE OR REPLACE FUNCTION stratum_validate_asset_relationship_context/);
assert.match(migration, /DROP TRIGGER IF EXISTS asset_relationship_context_guard/);
const linkedViewsSource = fs.readFileSync('lib/sld-spatial-linked-views.ts', 'utf8');
assert.match(linkedViewsSource, /Intended merge order is PR 205 first, then PR 206/);
assert.doesNotMatch(linkedViewsSource, /\u2014/, 'no em dash in the new module');
const qaSource = fs.readFileSync('scripts/qa-sld-spatial-linked-views.mjs', 'utf8');
assert.doesNotMatch(qaSource, /\u2014/, 'no em dash in the new QA script');

// The discover route returns the dual linked views with the candidates.
const route = fs.readFileSync('app/api/relationships/discover/electrical/route.ts', 'utf8');
assert.match(route, /buildSldSpatialLinkedViews/);
assert.match(route, /linkedViews/);
assert.doesNotMatch(route, /assessRouteReconstruction/, 'route assessment needs caller-supplied constraints, so it is not run from the discover route');

console.log('SLD-to-Spatial dual linked views and constrained route reconstruction readiness passed: logical and physical views cross-highlight the same entities, inferred positions stay labeled inferred, unknown positions stay null, and route reconstruction refuses unconstrained guessing.');
