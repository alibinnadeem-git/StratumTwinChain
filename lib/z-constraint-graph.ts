export type ZConstraintNodeKind=
  |'SUPPORT_SURFACE'
  |'ASSET_REFERENCE'
  |'ASSET_BASE'
  |'MAP_REFERENCE';

export type ZConstraintNode={
  id:string;
  kind:ZConstraintNodeKind;
  label:string;
  valueMeters:number|null;
  coordinateFrame:string;
  authority:string;
  confidence:number;
  lineageGroup:string;
  physicalTruth:false;
  reviewRequired:true;
};

export type ZConstraintRelationKind='EQUALS'|'OFFSET'|'FRAME_OFFSET';

export type ZConstraintRelation={
  id:string;
  from:string;
  to:string;
  kind:ZConstraintRelationKind;
  deltaMeters:number;
  authority:string;
  confidence:number;
  lineageGroup:string;
  evidence:string[];
  allowCrossFrame:boolean;
  physicalTruth:false;
  reviewRequired:true;
};

export type ZConstraintConflict={
  nodeId:string;
  existingMeters:number;
  proposedMeters:number;
  deltaMeters:number;
  toleranceMeters:number;
  authorities:string[];
  reason:string;
};

export type ZConstraintFrameGap={
  relationId:string;
  fromFrame:string;
  toFrame:string;
  reason:string;
};

export type ZConstraintGraph={
  entityId:string;
  status:'RESOLVED_BASE_CANDIDATE'|'PARTIAL'|'CONFLICT'|'UNRESOLVED';
  baseNodeId:string;
  baseZMeters:number|null;
  nodes:ZConstraintNode[];
  relations:ZConstraintRelation[];
  conflicts:ZConstraintConflict[];
  frameGaps:ZConstraintFrameGap[];
  toleranceMeters:number;
  explanation:string;
  physicalTruth:false;
  reviewRequired:true;
};

export type ZConstraintEntity={
  id:string;
  name:string;
  source?:string;
  z?:number;
  meta?:Record<string,unknown>;
};

const finite=(value:unknown)=>{const n=Number(value);return Number.isFinite(n)?n:null};
const confidence=(value:unknown,fallback=.7)=>Math.max(0,Math.min(1,Number.isFinite(Number(value))?Number(value):fallback));

function tupleHeight(meta:Record<string,unknown>){
  for(const key of ['assetDimensionsMeters','dimensionsMeters','oemDimensionsMeters','manufacturerDimensionsMeters']){
    const value=meta[key];
    if(Array.isArray(value)&&value.length===3){
      const height=Number(value[1]);if(Number.isFinite(height)&&height>0)return height;
    }
  }
  const height=finite(meta.heightMeters??meta.assetHeightMeters);
  return height!==null&&height>0?height:null;
}

function sourceFrame(entity:ZConstraintEntity){
  const meta=entity.meta||{};
  const explicit=String(meta.zResolutionCoordinateFrame||meta.sourceZCoordinateFrame||'').trim();
  if(explicit)return explicit;
  const sourceType=String(meta.sourceType||'').toUpperCase();
  const source=String(entity.source||meta.sourceSha256||'SOURCE');
  if(sourceType.startsWith('IFC'))return `IFC_LOCAL_ENGINEERING:${source}`;
  if(sourceType==='DXF'||String(meta.zPlacementAuthority||'').includes('DXF'))return `CAD_LOCAL_ENGINEERING:${source}`;
  return 'PROJECT_REVIEW_DATUM';
}

function supportSurface(meta:Record<string,unknown>){
  const candidates=[
    {key:'localReviewSurfaceZ',kind:String(meta.localReviewSurfaceKind||'LOCAL_SURFACE'),authority:String(meta.localReviewSurfaceAuthority||'SOURCE_ELEVATION_TRIANGLE'),confidence:confidence(meta.localReviewSurfaceConfidence,.65),frame:String(meta.localReviewSurfaceCoordinateFrame||meta.reviewSurfaceCoordinateFrame||'PROJECT_REVIEW_DATUM')},
    {key:'crossSheetReviewSurfaceZ',kind:String(meta.crossSheetReviewSurfaceKind||'CROSS_SHEET_SURFACE'),authority:String(meta.crossSheetReviewSurfaceAuthority||'HUMAN_CONFIRMED_ALIGNMENT_PLUS_SOURCE_ELEVATION_TRIANGLE'),confidence:confidence(meta.crossSheetReviewSurfaceConfidence,.65),frame:String(meta.crossSheetReviewSurfaceCoordinateFrame||meta.reviewSurfaceCoordinateFrame||'PROJECT_REVIEW_DATUM')},
    {key:'floorDatumMeters',kind:String(meta.reviewSurfaceKind||'FINISHED_FLOOR'),authority:String(meta.reviewSurfaceAuthority||'SOURCE_PROJECT_DATUM'),confidence:confidence(meta.reviewSurfaceConfidence,.7),frame:String(meta.reviewSurfaceCoordinateFrame||meta.projectDatumCoordinateFrame||'PROJECT_REVIEW_DATUM')},
    {key:'reviewSurfaceZ',kind:String(meta.reviewSurfaceKind||'PROJECT_DATUM'),authority:String(meta.reviewSurfaceAuthority||'SOURCE_PROJECT_DATUM'),confidence:confidence(meta.reviewSurfaceConfidence,.65),frame:String(meta.reviewSurfaceCoordinateFrame||meta.projectDatumCoordinateFrame||'PROJECT_REVIEW_DATUM')}
  ];
  for(const candidate of candidates){
    const z=finite(meta[candidate.key]);if(z!==null)return{...candidate,z};
  }
  return null;
}

function sourceReferenceToBaseOffset(meta:Record<string,unknown>){
  const reference=String(meta.zCandidateReferencePoint||meta.sourceZReferencePoint||'UNSPECIFIED').toUpperCase();
  if(reference==='BASE'||reference==='BOTTOM')return{offset:0,reference,reason:'Explicit source reference is the equipment base/bottom.'};
  const height=tupleHeight(meta);
  if(reference==='CENTERLINE'&&height!==null)return{offset:-height/2,reference,reason:'Centerline reference converted to base using source/OEM equipment height.'};
  if(reference==='TOP'&&height!==null)return{offset:-height,reference,reason:'Top reference converted to base using source/OEM equipment height.'};
  if(reference==='MOUNTING_POINT'){
    const mounting=finite(meta.mountingPointFromBaseMeters??meta.mountingPointOffsetFromBaseMeters);
    if(mounting!==null)return{offset:-mounting,reference,reason:'Mounting-point reference converted to base using explicit mounting-point offset.'};
  }
  if(reference==='SOURCE_ORIGIN'){
    const explicit=finite(meta.sourceOriginToBaseMeters);
    if(explicit!==null)return{offset:explicit,reference,reason:'Source origin converted to equipment base using explicit source-origin-to-base transform.'};
  }
  return null;
}

export function solveZConstraintGraph(input:{
  entityId:string;
  baseNodeId:string;
  nodes:ZConstraintNode[];
  relations:ZConstraintRelation[];
  toleranceMeters?:number;
}):ZConstraintGraph{
  const tolerance=input.toleranceMeters??.15;
  const nodes=input.nodes.map(node=>({...node}));
  const byId=new Map(nodes.map(node=>[node.id,node]));
  const conflicts:ZConstraintConflict[]=[];
  const frameGaps:ZConstraintFrameGap[]=[];
  const seenFrameGaps=new Set<string>();

  const propose=(node:ZConstraintNode,value:number,authority:string)=>{
    if(node.valueMeters===null){node.valueMeters=value;return true}
    const delta=Math.abs(node.valueMeters-value);
    if(delta>tolerance&&!conflicts.some(item=>item.nodeId===node.id&&Math.abs(item.proposedMeters-value)<1e-9)){
      conflicts.push({
        nodeId:node.id,existingMeters:node.valueMeters,proposedMeters:value,deltaMeters:delta,toleranceMeters:tolerance,
        authorities:[node.authority,authority],
        reason:`Independent constraint paths propose ${node.valueMeters.toFixed(3)} m and ${value.toFixed(3)} m for ${node.label} (Δ ${delta.toFixed(3)} m > ${tolerance.toFixed(3)} m).`
      });
    }
    return false;
  };

  for(let pass=0;pass<Math.max(2,input.relations.length+1);pass++){
    let changed=false;
    for(const relation of input.relations){
      const from=byId.get(relation.from),to=byId.get(relation.to);if(!from||!to)continue;
      if(from.coordinateFrame!==to.coordinateFrame&&!relation.allowCrossFrame){
        if(!seenFrameGaps.has(relation.id)){
          seenFrameGaps.add(relation.id);
          frameGaps.push({
            relationId:relation.id,fromFrame:from.coordinateFrame,toFrame:to.coordinateFrame,
            reason:'Constraint endpoints belong to different vertical coordinate frames and no source-grounded frame transform authorizes arithmetic.'
          });
        }
        continue;
      }
      if(from.valueMeters!==null&&to.valueMeters===null)changed=propose(to,from.valueMeters+relation.deltaMeters,relation.authority)||changed;
      else if(from.valueMeters===null&&to.valueMeters!==null)changed=propose(from,to.valueMeters-relation.deltaMeters,relation.authority)||changed;
      else if(from.valueMeters!==null&&to.valueMeters!==null){
        propose(to,from.valueMeters+relation.deltaMeters,relation.authority);
      }
    }
    if(!changed)break;
  }

  const base=byId.get(input.baseNodeId)||null;
  const baseResolved=base!==null&&base.valueMeters!==null;
  const status:ZConstraintGraph['status']=conflicts.length?'CONFLICT':baseResolved?'RESOLVED_BASE_CANDIDATE':nodes.some(node=>node.valueMeters!==null)||input.relations.length?'PARTIAL':'UNRESOLVED';
  const explanation=conflicts.length
    ?'One or more source/review constraint paths disagree beyond the review tolerance; no single base-Z candidate is authoritative.'
    :baseResolved
      ?`Asset base Z is derivable as a review candidate from explicit constraints in ${base!.coordinateFrame}.`
      :frameGaps.length
        ?'Z evidence exists, but at least one required relationship crosses an unregistered vertical coordinate frame.'
        :'Z evidence/relationships are preserved, but they do not yet establish an absolute asset base.';
  return{
    entityId:input.entityId,status,baseNodeId:input.baseNodeId,baseZMeters:base?.valueMeters??null,
    nodes,relations:input.relations,conflicts,frameGaps,toleranceMeters:tolerance,explanation,
    physicalTruth:false,reviewRequired:true
  };
}

export function buildEntityZConstraintGraph(entity:ZConstraintEntity,toleranceMeters=.15):ZConstraintGraph{
  const meta=entity.meta||{},nodes:ZConstraintNode[]=[],relations:ZConstraintRelation[]=[];
  const baseId=`${entity.id}:base`;
  const support=supportSurface(meta);
  const sFrame=sourceFrame(entity);
  const baseFrame=support?.frame||sFrame;

  nodes.push({
    id:baseId,kind:'ASSET_BASE',label:`${entity.name} base`,valueMeters:null,coordinateFrame:baseFrame,
    authority:'DERIVED_ONLY_WHEN_CONSTRAINED',confidence:0,lineageGroup:`ENTITY:${entity.id}`,
    physicalTruth:false,reviewRequired:true
  });

  if(support){
    const supportId=`${entity.id}:support`;
    nodes.push({
      id:supportId,kind:'SUPPORT_SURFACE',label:`${support.kind} support surface`,valueMeters:support.z,
      coordinateFrame:support.frame,authority:support.authority,confidence:support.confidence,
      lineageGroup:`SUPPORT:${String(meta.localReviewSurfaceTriangleId||meta.crossSheetReviewSurfaceTriangleId||meta.reviewSurfaceSource||entity.source||entity.id)}`,
      physicalTruth:false,reviewRequired:true
    });
    const offset=finite(meta.supportBaseOffsetMeters);
    if(offset!==null){
      relations.push({
        id:`${entity.id}:support-to-base`,from:supportId,to:baseId,kind:'OFFSET',deltaMeters:offset,
        authority:String(meta.supportOffsetAuthority||'SOURCE_SUPPORT_BASE_OFFSET'),
        confidence:Math.min(support.confidence,confidence(meta.supportOffsetConfidence,.7)),
        lineageGroup:`SUPPORT_OFFSET:${String(meta.supportOffsetEvidenceId||entity.id)}`,
        evidence:[String(meta.supportOffsetEvidenceLabel||'Explicit support-base offset')],
        allowCrossFrame:false,physicalTruth:false,reviewRequired:true
      });
    }
  }

  const sourceZ=finite(meta.zCandidateMeters);
  if(sourceZ!==null){
    const refId=`${entity.id}:source-reference`;
    nodes.push({
      id:refId,kind:'ASSET_REFERENCE',label:`${entity.name} ${String(meta.zCandidateReferencePoint||'source reference').toLowerCase().replaceAll('_',' ')}`,
      valueMeters:sourceZ,coordinateFrame:sFrame,authority:String(meta.zResolutionAuthority||meta.zPlacementAuthority||'SOURCE_Z_EVIDENCE'),
      confidence:confidence(meta.zResolutionConfidence,.75),
      lineageGroup:`SOURCE_Z:${String(meta.sourceSha256||entity.source||entity.id)}`,
      physicalTruth:false,reviewRequired:true
    });
    const conversion=sourceReferenceToBaseOffset(meta);
    if(conversion){
      relations.push({
        id:`${entity.id}:reference-to-base`,from:refId,to:baseId,kind:conversion.offset===0?'EQUALS':'OFFSET',deltaMeters:conversion.offset,
        authority:`SOURCE_REFERENCE_TO_BASE:${conversion.reference}`,confidence:confidence(meta.zResolutionConfidence,.75),
        lineageGroup:`SOURCE_Z:${String(meta.sourceSha256||entity.source||entity.id)}`,
        evidence:[conversion.reason],allowCrossFrame:false,physicalTruth:false,reviewRequired:true
      });
    }

    const mapZ=finite(meta.ifcMapZCandidateMeters);
    if(mapZ!==null){
      const mapId=`${entity.id}:map-reference`;
      const mapFrame=`MAP_CRS:${String(meta.ifcMapCrsName||'UNRESOLVED_CRS')}|VERTICAL:${String(meta.ifcMapVerticalDatum||'UNRESOLVED_VERTICAL_DATUM')}`;
      nodes.push({
        id:mapId,kind:'MAP_REFERENCE',label:`${entity.name} mapped reference`,valueMeters:mapZ,coordinateFrame:mapFrame,
        authority:String(meta.ifcMapZAuthority||'SOURCE_IFC_MAP_CONVERSION'),confidence:confidence(meta.zResolutionConfidence,.9),
        lineageGroup:`SOURCE_Z:${String(meta.sourceSha256||entity.source||entity.id)}`,
        physicalTruth:false,reviewRequired:true
      });
      relations.push({
        id:`${entity.id}:ifc-map-transform`,from:refId,to:mapId,kind:'FRAME_OFFSET',deltaMeters:mapZ-sourceZ,
        authority:String(meta.ifcMapConversionAuthority||'IFC_MAP_CONVERSION'),confidence:.96,
        lineageGroup:`SOURCE_Z:${String(meta.sourceSha256||entity.source||entity.id)}`,
        evidence:['Mapped Z is derived from the same IFC local coordinate through the IFC map conversion; it is correlated source evidence, not independent corroboration.'],
        allowCrossFrame:true,physicalTruth:false,reviewRequired:true
      });
    }
  }

  return solveZConstraintGraph({entityId:entity.id,baseNodeId:baseId,nodes,relations,toleranceMeters});
}
