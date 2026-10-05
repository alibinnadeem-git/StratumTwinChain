import type {SpatialModelResolution} from './spatial-model-resolution.ts';

export type SpatialEvidenceEntity={
  id:string;
  name:string;
  source?:string;
  x:number;
  y:number;
  z?:number;
  meta?:Record<string,unknown>;
};

export type EvidenceState='RESOLVED_CANDIDATE'|'PARTIAL'|'CONFLICT'|'UNRESOLVED';
export type CoordinationReadiness='DESIGN_3D_COORDINATION_CANDIDATE'|'DESIGN_2D_COORDINATION_CANDIDATE'|'REVIEW_BLOCKED'|'SOURCE_ONLY';

export type HorizontalEvidenceEnvelope={
  state:EvidenceState;
  metricCoordinateKnown:boolean;
  coordinateFrame:string;
  placementAuthority:string;
  symbolAnchorStatus:string;
  sourceLineages:string[];
  scaleWitnessCount:number;
  scaleRelativeDeviationMax:number|null;
  scaleContributionMeters:number|null;
  sourceProvidedUncertaintyMeters:number|null;
  totalUncertaintyBoundMeters:null|number;
  notes:string[];
};

export type VerticalEvidenceEnvelope={
  state:EvidenceState;
  coordinateFrame:string;
  baseCandidateMeters:number|null;
  constraintStatus:string;
  lineageGroups:string[];
  lineageGroupCount:number;
  conflictCount:number;
  frameGapCount:number;
  observedConflictSpreadMaxMeters:number|null;
  sourceProvidedUncertaintyMeters:number|null;
  totalUncertaintyBoundMeters:null|number;
  notes:string[];
};

export type GeometryEvidenceEnvelope={
  state:'EXACT_VERIFIED_OEM_CAD'|'EXACT_PRODUCT_VISUALIZATION'|'FAMILY_MODEL'|'PROCEDURAL_FALLBACK'|'UNRESOLVED'|'NOT_EVALUATED';
  exactProductIdentity:boolean;
  componentKey:string|null;
  authority:string;
  confidence:number|null;
  notes:string[];
};

export type SpatialEvidenceEnvelope={
  entityId:string;
  readiness:CoordinationReadiness;
  horizontal:HorizontalEvidenceEnvelope;
  vertical:VerticalEvidenceEnvelope;
  geometry:GeometryEvidenceEnvelope;
  blockingReasons:string[];
  distinctEvidenceLineages:number;
  physicalTruth:false;
  physicalClashAuthority:false;
  asBuiltAuthority:false;
  reviewRequired:true;
  explanation:string;
};

const finite=(value:unknown)=>{
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);return Number.isFinite(n)?n:null;
};
const text=(value:unknown)=>String(value??'').trim();

function firstFinite(meta:Record<string,unknown>,keys:string[]){
  for(const key of keys){const n=finite(meta[key]);if(n!==null&&n>=0)return n}
  return null;
}

function sourceKey(entity:SpatialEvidenceEntity){
  const meta=entity.meta||{};
  return text(meta.sourceSha256)||text(entity.source)||entity.id;
}

function horizontalFrame(entity:SpatialEvidenceEntity){
  const meta=entity.meta||{};
  const project=text(meta.projectXYFrameId);
  if(project)return project;
  const explicit=text(meta.xyCoordinateFrame);
  if(explicit)return explicit;
  const units=text(meta.coordinateUnits).toLowerCase();
  if(units==='m_reviewed_pdf')return 'PDF_REVIEW_METRIC:'+sourceKey(entity)+':'+String(meta.page||'?');
  const sourceType=text(meta.sourceType).toUpperCase();
  if(units==='m_dxf_design'||sourceType==='DXF')return 'CAD_LOCAL_ENGINEERING:'+sourceKey(entity);
  if(sourceType.startsWith('IFC')||text(meta.ifcCoordinateFrame)==='LOCAL_ENGINEERING')return 'IFC_LOCAL_ENGINEERING:'+sourceKey(entity);
  if(units==='m'||units.startsWith('m_'))return 'METRIC_SOURCE_FRAME:'+sourceKey(entity);
  return 'UNRESOLVED';
}

function metricHorizontalKnown(entity:SpatialEvidenceEntity){
  const meta=entity.meta||{},units=text(meta.coordinateUnits).toLowerCase();
  if(meta.projectXYFrameMetric===true)return true;
  if(units==='m_reviewed_pdf'||units==='m_dxf_design'||units==='m'||units.startsWith('m_'))return true;
  if(text(meta.ifcCoordinateFrame)==='LOCAL_ENGINEERING'&&finite(meta.unitToMeters)!==null)return true;
  return false;
}

function scaleDiagnostics(entity:SpatialEvidenceEntity){
  const meta=entity.meta||{};
  const selected=finite(meta.metricFrameMetersPerSheetUnit);
  const validation=meta.scaleValidationEvidence&&typeof meta.scaleValidationEvidence==='object'
    ?meta.scaleValidationEvidence as Record<string,unknown>:null;
  const witnesses=validation&&Array.isArray(validation.witnesses)?validation.witnesses as Array<Record<string,unknown>>:[];
  const usable=witnesses.filter(w=>finite(w.confidence)!==null&&Number(w.confidence)>=.6&&finite(w.metersPerNormalizedSheetUnit)!==null);
  let maxDeviation:null|number=null;
  if(selected!==null&&selected>0&&usable.length){
    maxDeviation=Math.max(...usable.map(w=>Math.abs(Number(w.metersPerNormalizedSheetUnit)-selected)/selected));
  }
  const contribution=maxDeviation!==null&&text(meta.coordinateUnits).toLowerCase()==='m_reviewed_pdf'
    ?Math.hypot(entity.x,entity.y)*maxDeviation:null;
  return{witnessCount:usable.length,maxDeviation,contribution};
}

function horizontalEnvelope(entity:SpatialEvidenceEntity):HorizontalEvidenceEnvelope{
  const meta=entity.meta||{};
  const metric=metricHorizontalKnown(entity);
  const frame=horizontalFrame(entity);
  const anchor=text(meta.symbolAnchorStatus)||'UNSPECIFIED';
  const placement=text(meta.spatialPlacementAuthority)||text(meta.xyPlacementAuthority)||'UNRESOLVED';
  const projectFrame=text(meta.projectXYFrameId);
  const registrationIds=Array.isArray(meta.projectXYRegistrationIds)?meta.projectXYRegistrationIds.map(value=>String(value)).filter(Boolean):[];
  const notes:string[]=[];
  let state:EvidenceState='UNRESOLVED';

  if(anchor==='AMBIGUOUS'){
    state='CONFLICT';
    notes.push('Multiple source-vector symbols remain plausible for this equipment label.');
  }else if(metric){
    const authoredNative=placement==='SOURCE_DXF_INSUNITS'||text(meta.sourceType).toUpperCase().startsWith('IFC');
    const anchored=anchor==='RESOLVED_REVIEW_CANDIDATE'||placement==='SOURCE_VECTOR_SYMBOL_ANCHOR';
    state=authoredNative||anchored?'RESOLVED_CANDIDATE':'PARTIAL';
    if(projectFrame)notes.push('The entity is registered in shared project frame '+projectFrame+'; project-frame registration does not by itself prove the equipment symbol anchor.');
    if(state==='PARTIAL')notes.push('Metric coordinates exist, but the equipment position is not independently anchored to native/source symbol geometry.');
  }else{
    if(placement&&placement!=='UNRESOLVED')notes.push('Source position is retained, but no reviewed metric X/Y frame is established.');
  }

  const scale=scaleDiagnostics(entity);
  if(scale.witnessCount===1)notes.push('Only one usable scale witness contributes to the reviewed PDF metric frame.');
  if(scale.witnessCount>1)notes.push(String(scale.witnessCount)+' usable scale witnesses are preserved; scale spread is reported separately from total position uncertainty.');
  if(scale.contribution!==null)notes.push('Scale contribution is derived from witness deviation and distance from the reviewed PDF frame origin; it is not a complete XY uncertainty bound.');

  const explicit=firstFinite(meta,['xyUncertaintyMeters','horizontalUncertaintyMeters','horizontalAccuracyMeters']);
  const total=explicit;
  if(explicit===null)notes.push('No source-provided total horizontal uncertainty/accuracy bound is available; STRATUM does not invent one.');

  return{
    state,
    metricCoordinateKnown:metric,
    coordinateFrame:frame,
    placementAuthority:placement,
    symbolAnchorStatus:anchor,
    sourceLineages:[sourceKey(entity),...registrationIds.map(id=>'ALIGNMENT:'+id)],
    scaleWitnessCount:scale.witnessCount,
    scaleRelativeDeviationMax:scale.maxDeviation,
    scaleContributionMeters:scale.contribution,
    sourceProvidedUncertaintyMeters:explicit,
    totalUncertaintyBoundMeters:total,
    notes
  };
}

function zGraph(meta:Record<string,unknown>){
  const raw=meta.zConstraintGraph;
  return raw&&typeof raw==='object'?raw as Record<string,unknown>:null;
}

function verticalEnvelope(entity:SpatialEvidenceEntity):VerticalEvidenceEnvelope{
  const meta=entity.meta||{},graph=zGraph(meta),notes:string[]=[];
  if(!graph){
    notes.push('No explicit Z constraint graph is available for this entity.');
    return{
      state:'UNRESOLVED',coordinateFrame:'UNRESOLVED',baseCandidateMeters:null,constraintStatus:'UNRESOLVED',
      lineageGroups:[],lineageGroupCount:0,conflictCount:0,frameGapCount:0,observedConflictSpreadMaxMeters:null,
      sourceProvidedUncertaintyMeters:firstFinite(meta,['zUncertaintyMeters','verticalUncertaintyMeters','verticalAccuracyMeters']),
      totalUncertaintyBoundMeters:firstFinite(meta,['zUncertaintyMeters','verticalUncertaintyMeters','verticalAccuracyMeters']),
      notes
    };
  }
  const status=text(graph.status)||'UNRESOLVED';
  const base=finite(graph.baseZMeters);
  const conflicts=Array.isArray(graph.conflicts)?graph.conflicts as Array<Record<string,unknown>>:[];
  const gaps=Array.isArray(graph.frameGaps)?graph.frameGaps as Array<Record<string,unknown>>:[];
  const nodes=Array.isArray(graph.nodes)?graph.nodes as Array<Record<string,unknown>>:[];
  const relations=Array.isArray(graph.relations)?graph.relations as Array<Record<string,unknown>>:[];
  const lineages=[...new Set([...nodes,...relations].map(item=>text(item.lineageGroup)).filter(value=>value&&!value.startsWith('ENTITY:')))];
  const frames=[...new Set(nodes.map(node=>text(node.coordinateFrame)).filter(Boolean))];
  let state:EvidenceState='UNRESOLVED';
  if(conflicts.length||status==='CONFLICT')state='CONFLICT';
  else if(base!==null&&gaps.length===0)state='RESOLVED_CANDIDATE';
  else if(base!==null||gaps.length||nodes.some(node=>finite(node.valueMeters)!==null))state='PARTIAL';

  const spread=conflicts.length
    ?Math.max(...conflicts.map(item=>finite(item.deltaMeters)??0))
    :null;
  if(gaps.length)notes.push(String(gaps.length)+' vertical frame relationship(s) remain unregistered; values are preserved but not compared across those frames.');
  if(lineages.length<2&&base!==null)notes.push('Base Z is solvable from one lineage group only; this is resolution, not independent corroboration.');
  if(lineages.length>=2)notes.push(String(lineages.length)+' distinct Z evidence lineage groups are preserved in the constraint graph.');
  if(spread!==null&&spread>0)notes.push('Observed disagreement is reported as conflict spread, not converted into a statistical uncertainty estimate.');

  const explicit=firstFinite(meta,['zUncertaintyMeters','verticalUncertaintyMeters','verticalAccuracyMeters']);
  if(explicit===null)notes.push('No source-provided total vertical uncertainty/accuracy bound is available; STRATUM does not invent one.');

  return{
    state,
    coordinateFrame:frames.length===1?frames[0]:frames.length>1?'MULTIPLE_FRAMES':'UNRESOLVED',
    baseCandidateMeters:base,
    constraintStatus:status,
    lineageGroups:lineages,
    lineageGroupCount:lineages.length,
    conflictCount:conflicts.length,
    frameGapCount:gaps.length,
    observedConflictSpreadMaxMeters:spread,
    sourceProvidedUncertaintyMeters:explicit,
    totalUncertaintyBoundMeters:explicit,
    notes
  };
}

function geometryEnvelope(model?:SpatialModelResolution|null):GeometryEvidenceEnvelope{
  if(!model)return{
    state:'NOT_EVALUATED',exactProductIdentity:false,componentKey:null,authority:'NOT_EVALUATED',confidence:null,
    notes:['3D component geometry has not been evaluated in this context.']
  };
  const notes:string[]=[];
  if(model.tier==='FAMILY_MODEL')notes.push('Family geometry is suitable for review visualization but does not establish exact product geometry.');
  if(model.tier==='PROCEDURAL_FALLBACK')notes.push('Procedural geometry is a review envelope only.');
  if(model.tier==='EXACT_PRODUCT_VISUALIZATION'&&!model.exactProductIdentity)notes.push('Exact product geometry requires source-supported product identity.');
  if(model.tier==='EXACT_VERIFIED_OEM_CAD')notes.push('Catalog/OEM geometry matches the source product identity; installed physical identity remains separate.');
  return{
    state:model.tier,
    exactProductIdentity:model.exactProductIdentity,
    componentKey:model.componentKey,
    authority:model.geometryAuthority,
    confidence:model.confidence,
    notes
  };
}

export function deriveSpatialEvidenceEnvelope(entity:SpatialEvidenceEntity,model?:SpatialModelResolution|null):SpatialEvidenceEnvelope{
  const horizontal=horizontalEnvelope(entity),vertical=verticalEnvelope(entity),geometry=geometryEnvelope(model);
  const blockingReasons:string[]=[];
  if(horizontal.state==='CONFLICT')blockingReasons.push('Horizontal source-symbol association is ambiguous.');
  if(vertical.state==='CONFLICT')blockingReasons.push('Z evidence contains an unresolved same-frame conflict.');
  if(vertical.frameGapCount>0)blockingReasons.push('Vertical coordinate frames require registration before cross-frame comparison.');
  if(geometry.state==='UNRESOLVED')blockingReasons.push('No source-grounded component geometry is resolved.');

  let readiness:CoordinationReadiness='SOURCE_ONLY';
  if(blockingReasons.length)readiness='REVIEW_BLOCKED';
  else if(horizontal.metricCoordinateKnown&&horizontal.state!=='UNRESOLVED'){
    const usableGeometry=geometry.state==='EXACT_VERIFIED_OEM_CAD'||geometry.state==='EXACT_PRODUCT_VISUALIZATION'||geometry.state==='FAMILY_MODEL';
    if(vertical.state==='RESOLVED_CANDIDATE'&&usableGeometry)readiness='DESIGN_3D_COORDINATION_CANDIDATE';
    else readiness='DESIGN_2D_COORDINATION_CANDIDATE';
  }

  const distinct=new Set<string>([...horizontal.sourceLineages,...vertical.lineageGroups]);
  const explanation=readiness==='DESIGN_3D_COORDINATION_CANDIDATE'
    ?'Metric X/Y, a review-resolved base Z candidate and usable component geometry are present for design coordination. This does not establish as-built or physical clash truth.'
    :readiness==='DESIGN_2D_COORDINATION_CANDIDATE'
      ?'Metric X/Y is available, but the full 3D evidence chain is incomplete. Keep coordination limited to design/review use.'
      :readiness==='REVIEW_BLOCKED'
        ?'One or more evidence conflicts or frame gaps block authoritative 3D coordination until reviewed.'
        :'Source evidence is retained, but a reviewed metric spatial frame is not yet established.';

  return{
    entityId:entity.id,
    readiness,
    horizontal,
    vertical,
    geometry,
    blockingReasons,
    distinctEvidenceLineages:distinct.size,
    physicalTruth:false,
    physicalClashAuthority:false,
    asBuiltAuthority:false,
    reviewRequired:true,
    explanation
  };
}
