// Phase 5: establish a RELATIVE / nominal per-floor review datum so plan-placed equipment has a
// surface for asset-placement's class profiles to anchor to (lifting it off bare Z=0 as a review
// candidate). This is NOT absolute project Z — Brynhurst floors are labels with no elevation evidence,
// so the datum is a story-stack derived from floor labels only, marked RELATIVE_TO_REVIEW_PLANE and
// low confidence. SLD/schematic symbols and anything with real elevation/surface evidence are left
// untouched. Pure; runs before enrichZCandidates so the Z resolver sees the surface.

export type StoryDatumEntity={id:string;layer:string;kind:string;floor?:string;meta?:Record<string,unknown>};

const NON_EQUIPMENT_KINDS=new Set([
  'line','sld-feeder-candidate','wall-segment','source-raster-underlay','elevation-control-point',
  'elevation-review-surface-triangle','room-boundary','floor-boundary','room-label','plan-frame-candidate',
]);
// Existing surface/elevation evidence that must never be overwritten by a nominal relative datum.
const EXISTING_SURFACE_KEYS=['localReviewSurfaceZ','crossSheetReviewSurfaceZ','floorDatumMeters','floorElevationMeters','finishedFloorElevationMeters','reviewSurfaceZ','inferredProjectDatumZ','relativeReviewSurfaceZ'];
const STORY_HEIGHT_M=3.5;

const finite=(value:unknown)=>{const n=Number(value);return Number.isFinite(n)?n:null};

function isPlanEquipment(entity:StoryDatumEntity){
  const meta=entity.meta||{};
  if(meta.nonSpatial===true)return false;
  if(entity.layer!=='L2'&&entity.layer!=='L4')return false;
  if(NON_EQUIPMENT_KINDS.has(entity.kind))return false;
  if(meta.sldCandidate===true)return false; // schematic symbol: logical Z only, no physical floor
  return true;
}
function hasElevationEvidence(meta:Record<string,unknown>){
  if(meta.elevationKnown===true||meta.physicalElevationKnown===true)return true;
  return EXISTING_SURFACE_KEYS.some(key=>finite(meta[key])!==null);
}

// Order floor labels by any embedded number (L1<L2<LEVEL 10); roof/penthouse float high; else alpha.
function floorRank(floor:string){
  const upper=floor.toUpperCase();
  if(/\bROOF\b|\bPH\b|PENTHOUSE/.test(upper))return 1e6;
  const match=upper.match(/-?\d+/);
  if(match)return Number(match[0]);
  if(/\bGROUND\b|\bGRADE\b|\bG\b/.test(upper))return 0;
  return null; // unranked -> handled after numeric floors
}

export function applyRelativeStoryDatum<T extends StoryDatumEntity>(entities:T[]):T[]{
  const floors=new Set<string>();
  for(const entity of entities){
    if(!isPlanEquipment(entity))continue;
    const floor=String(entity.floor||'UNRESOLVED');
    if(floor!=='UNRESOLVED')floors.add(floor);
  }
  const ranked=[...floors].map(floor=>({floor,rank:floorRank(floor)}));
  const numeric=ranked.filter(f=>f.rank!==null).sort((a,b)=>(a.rank as number)-(b.rank as number));
  const alpha=ranked.filter(f=>f.rank===null).sort((a,b)=>a.floor.localeCompare(b.floor));
  const indexByFloor=new Map<string,number>([...numeric,...alpha].map((f,index)=>[f.floor,index]));

  return entities.map(entity=>{
    if(!isPlanEquipment(entity))return entity;
    const meta=entity.meta||{};
    if(hasElevationEvidence(meta))return entity; // never override real evidence or an existing datum
    const floor=String(entity.floor||'UNRESOLVED');
    const index=floor==='UNRESOLVED'?0:(indexByFloor.get(floor)??0);
    const z=index*STORY_HEIGHT_M;
    return{
      ...entity,
      meta:{
        ...meta,
        relativeReviewSurfaceZ:z,
        relativeReviewSurfaceFloor:floor,
        relativeReviewSurfaceAuthority:'RELATIVE_STORY_LABEL_DATUM',
        relativeReviewSurfaceConfidence:.2,
        relativeReviewSurfaceEvidence:[`Relative story datum from floor label "${floor}"; no source elevation — review only, not absolute project Z`],
        // Runs AFTER enrichZCandidates/z-recovery (which strips heuristic stacks for floored entities),
        // so set the resolution status here too, keeping render (asset-placement) and audit consistent.
        zResolutionStatus:'RELATIVE_VISUALIZATION_ONLY',
        zResolutionAuthority:'RELATIVE_STORY_LABEL_DATUM',
        zResolutionConfidence:.2,
        elevationKnown:false,
        physicalElevationKnown:false,
        physicalTruth:false,
        reviewRequired:true,
      },
    };
  });
}
