import {applyRelativeStoryDatum} from '../lib/relative-story-datum.ts';
import {resolveAssetPlacement} from '../lib/asset-placement.ts';

// Phase 5 relative story-datum contract. Plan equipment gets a RELATIVE review surface from floor
// labels (so class profiles anchor); SLD symbols and real-evidence entities are untouched; the datum
// is never absolute. Synthetic only.
function ok(label,condition){if(!condition)throw new Error('FAIL: '+label);console.log('✓ '+label)}

const entities=[
  {id:'sw1',layer:'L2',kind:'text-asset-candidate',name:'MS1',floor:'L1',meta:{libraryComponentKey:'main-switchboard'}},
  {id:'sw2',layer:'L2',kind:'text-asset-candidate',name:'MS2',floor:'L2',meta:{libraryComponentKey:'main-switchboard'}},
  // SLD schematic symbol: logical only, must NOT get a floor datum.
  {id:'sld1',layer:'L2',kind:'text-asset-candidate',name:'MS1',floor:'UNRESOLVED',meta:{sldCandidate:true}},
  // Already has real elevation evidence: must NOT be overwritten.
  {id:'ev1',layer:'L2',kind:'text-asset-candidate',name:'XFMR-1',floor:'L1',meta:{floorDatumMeters:12.5}},
  // Source design coordinates are review candidates, including an explicit zero elevation.
  {id:'cad-zero',layer:'L2',kind:'dxf-block-insert',name:'PANELBOARD LP-2',floor:'L2',meta:{zCandidateMeters:0,zResolutionStatus:'RESOLVED_DESIGN_CANDIDATE',zPlacementAuthority:'SOURCE_DXF_DESIGN_Z',physicalElevationKnown:false}},
  {id:'ifc-z',layer:'L2',kind:'ifc-product-placement',name:'TRANSFORMER T-1',floor:'L1',meta:{zCandidateMeters:4.2,zResolutionStatus:'RESOLVED_DESIGN_CANDIDATE',physicalElevationKnown:false}},
  // Geometry is not equipment.
  {id:'ln1',layer:'L1',kind:'line',name:'Drawing line',floor:'L1',meta:{}},
];

const out=applyRelativeStoryDatum(entities);
const byId=Object.fromEntries(out.map(e=>[e.id,e]));

ok('L1 switchboard gets a relative datum at z=0',byId.sw1.meta.relativeReviewSurfaceZ===0);
ok('L1 datum authority is RELATIVE_STORY_LABEL_DATUM',byId.sw1.meta.relativeReviewSurfaceAuthority==='RELATIVE_STORY_LABEL_DATUM');
ok('L2 switchboard stacks above L1 (z=3.5)',byId.sw2.meta.relativeReviewSurfaceZ===3.5);
ok('relative datum is review-only, never physical',byId.sw1.meta.physicalTruth===false&&byId.sw1.meta.reviewRequired===true);
ok('SLD schematic symbol is NOT given a floor datum',byId.sld1.meta.relativeReviewSurfaceZ===undefined);
ok('entity with real elevation evidence is untouched',byId.ev1.meta.relativeReviewSurfaceZ===undefined&&byId.ev1.meta.floorDatumMeters===12.5);
ok('explicit zero-valued CAD design Z is not replaced by a relative datum',byId['cad-zero'].meta.relativeReviewSurfaceZ===undefined&&byId['cad-zero'].meta.zResolutionStatus==='RESOLVED_DESIGN_CANDIDATE'&&byId['cad-zero'].meta.zCandidateMeters===0);
ok('IFC design Z is not replaced by a relative datum',byId['ifc-z'].meta.relativeReviewSurfaceZ===undefined&&byId['ifc-z'].meta.zCandidateMeters===4.2);
ok('geometry line is not touched',byId.ln1.meta.relativeReviewSurfaceZ===undefined);

// Integration: with the relative datum present, the class profile anchors (no longer UNRESOLVED/0-only).
const before=resolveAssetPlacement({name:'MS1',floor:'L1',meta:{libraryComponentKey:'main-switchboard'}});
const after=resolveAssetPlacement({name:'MS1',floor:'L1',meta:byId.sw1.meta});
ok('without a surface the base is the review-plane UNRESOLVED (z=0)',before.zAuthority==='UNRESOLVED');
ok('with the relative datum the switchboard anchors to the review plane',after.zAuthority==='RELATIVE_TO_REVIEW_PLANE');
ok('anchored base is the relative surface (z=0 on L1)',after.baseZ===0);
ok('top uses the library/nominal height (extent > 0)',after.topZ>after.baseZ);
ok('placement never claims physical truth',after.physicalTruth===false);

console.log('\nRelative story-datum contract passed.');
