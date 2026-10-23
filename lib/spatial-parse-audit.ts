import {resolveElectricalComponent} from './electrical-component-library.ts';
import {classifyElectricalLabel} from './sld-recognition.ts';
import {resolveSheetScaleCandidate} from './sheet-scale.ts';
import {DEFAULT_ELECTRICAL_MODEL_REGISTRY,type ElectricalModelConfig} from './electrical-model-registry.ts';

// Phase 1 parse/symbol/library audit. Pure, so it can run in the browser (feeding the diagnostics
// bus) and in a Node QA script. It answers: did the parse produce finite metric-capable coordinates,
// did drawing symbols resolve to component-library classes, and do the extracted symbol footprints
// agree with the library dimensions we would use to build the 3D object (incl. its Z extent)?

export type AuditEntity={
  id:string;source:string;layer:string;kind:string;name:string;
  x:number;y:number;x2?:number;y2?:number;floor?:string;
  meta?:Record<string,unknown>;
};
export type AuditSource={name:string;ext?:string;sha256?:string;unitName?:string;unitToMeters?:number;pages?:number;sldPages?:number;nonSldPlanPages?:number};

export type ParseAudit={
  sources:Array<{name:string;ext:string;unitName:string;unitToMeters:number|null;metricScaleKnown:boolean;pages:number;sldPages:number;nonSldPlanPages:number}>;
  coordinates:{total:number;finiteXY:number;nonFiniteXY:number;withRawXY:number;cadMetricXY:number};
  symbolAnchors:{eligible:number;resolved:number;ambiguous:number;unresolved:number;textAbbreviation:number};
  classLinkage:{equipment:number;classResolved:number;classUnresolved:number;libraryDimensioned:number;sourceSpecDims:number;nominalOnly:number;coarseClassified:number;bridgeable:number;unrecognized:number;identified:number;identifiedByAlias:number;identifiedByBridge:number;unidentified:number;identifiedInstances:number};
  footprint:{checked:number;agree:number;disagree:number;scaleUnavailable:number};
  // Capped label samples for Phase 2b triage. Rides along in the PARSE_AUDIT event (dev-only trace).
  samples:{unidentified:string[];bridgedExamples:{name:string;key:string}[];bridgedByKey:Record<string,number>};
  // Candidate-gating diagnostics: is the equipment-candidate set inflated/duplicated?
  candidates:{total:number;byKind:Record<string,number>;derivedDuplicates:number;distinctNames:number;topNames:{name:string;count:number}[];instances:number;labels:number;shadows:number};
  // Per-sheet metric-scale evidence + the consolidated reviewable candidate (Phase 3), plus the count
  // of entities on a human-reviewed manual XY calibration (Phase 3b's sanctioned metric route).
  scale:{sheetsWithEvidence:number;sheetsWithCandidate:number;manualXYCalibratedEntities:number;manualXYCalibrations:number;sheets:{page:number;status:string;declared:number|null;corroborated:number|null;witnesses:number;candidate:{metersPerNormalizedSheetUnit:number;status:string;authority:string}|null}[]};
  // Phase 5 Step 0: Z-placement reality of identified INSTANCEs — SLD/schematic (logical only) vs
  // plan-placed (eligible for a floor/class base-elevation candidate), and whether a support surface exists.
  instanceZ:{instances:number;sld:number;plan:number;withSupportSurface:number;byStatus:Record<string,number>;samples:{name:string;layer:string;kind:string;sld:boolean;floor:string;hasSurface:boolean;status:string}[]};
  // #4 feasibility probe: do designator-looking tags (LP-1, H2…) exist in the graph (e.g. as L3
  // logical-tags), i.e. could a panel LABEL be paired with a nearby designator to form a tagged instance?
  designatorProbe:{designatorTags:number;logicalTags:number;samples:string[]};
  // #4 cross-reference feasibility: do equipment schedules yield authoritative tags (panel names) to
  // cross-reference plan labels/designators against?
  scheduleProbe:{scheduleCandidates:number;byKind:Record<string,number>;tags:string[]};
};

// Geometry/annotation kinds that are not selectable equipment candidates (mirrors the viewer's
// `inventory` exclusion set), so class-linkage is measured against real equipment, not drawing lines.
const NON_EQUIPMENT_KINDS=new Set([
  'line','sld-feeder-candidate','wall-segment','source-raster-underlay','elevation-control-point',
  'elevation-review-surface-triangle','room-boundary','floor-boundary','room-label','plan-frame-candidate',
]);

const FOOTPRINT_TOLERANCE=.35; // fraction; extracted footprint vs library plan dimensions

function finite(value:unknown):number|null{const n=Number(value);return Number.isFinite(n)?n:null}

function registryDimensions(registry:ElectricalModelConfig[],componentKey:string|undefined){
  if(!componentKey)return null;
  const entry=registry.find(item=>item.componentKey===componentKey);
  const dims=entry?.dimensionsMeters;
  return Array.isArray(dims)&&dims.length===3&&dims.every(v=>Number.isFinite(v)&&v>0)?dims as [number,number,number]:null;
}

function isEquipmentCandidate(entity:AuditEntity){
  if(entity.meta?.nonSpatial===true)return false;
  if(entity.layer!=='L2'&&entity.layer!=='L4')return false;
  if(NON_EQUIPMENT_KINDS.has(entity.kind))return false;
  return true;
}

export function auditParsedGraph(
  entities:AuditEntity[],
  sources:AuditSource[]=[],
  registry:ElectricalModelConfig[]=DEFAULT_ELECTRICAL_MODEL_REGISTRY,
):ParseAudit{
  const sourceScale=new Map<string,boolean>();
  const auditedSources=sources.map(source=>{
    const unitName=String(source.unitName||'');
    const unitToMeters=finite(source.unitToMeters);
    const metricScaleKnown=unitToMeters!==null&&unitToMeters>0&&unitName!=='unitless';
    if(source.sha256)sourceScale.set(source.sha256,metricScaleKnown);
    sourceScale.set(source.name,metricScaleKnown);
    return{name:source.name,ext:String(source.ext||'').toLowerCase(),unitName,unitToMeters,metricScaleKnown,pages:Number(source.pages||0),sldPages:Number(source.sldPages||0),nonSldPlanPages:Number(source.nonSldPlanPages||0)};
  });

  const coordinates={total:0,finiteXY:0,nonFiniteXY:0,withRawXY:0,cadMetricXY:0};
  const symbolAnchors={eligible:0,resolved:0,ambiguous:0,unresolved:0,textAbbreviation:0};
  const classLinkage={equipment:0,classResolved:0,classUnresolved:0,libraryDimensioned:0,sourceSpecDims:0,nominalOnly:0,coarseClassified:0,bridgeable:0,unrecognized:0,identified:0,identifiedByAlias:0,identifiedByBridge:0,unidentified:0,identifiedInstances:0};
  let instances=0,labels=0,shadows=0;
  const footprint={checked:0,agree:0,disagree:0,scaleUnavailable:0};
  const SAMPLE_CAP=80;
  const samples={unidentified:[] as string[],bridgedExamples:[] as {name:string;key:string}[],bridgedByKey:{} as Record<string,number>};
  const candidateByKind:Record<string,number>={};
  const nameCounts=new Map<string,number>();
  let derivedDuplicates=0;
  const SURFACE_KEYS=['localReviewSurfaceZ','crossSheetReviewSurfaceZ','floorDatumMeters','floorElevationMeters','finishedFloorElevationMeters','reviewSurfaceZ','inferredProjectDatumZ','relativeReviewSurfaceZ'];
  const instanceZ={instances:0,sld:0,plan:0,withSupportSurface:0,byStatus:{} as Record<string,number>,samples:[] as {name:string;layer:string;kind:string;sld:boolean;floor:string;hasSurface:boolean;status:string}[]};

  for(const entity of entities){
    if(entity.meta?.nonSpatial===true)continue;
    coordinates.total++;
    if(finite(entity.x)!==null&&finite(entity.y)!==null)coordinates.finiteXY++;else coordinates.nonFiniteXY++;
    if(finite(entity.meta?.rawX)!==null&&finite(entity.meta?.rawY)!==null)coordinates.withRawXY++;
    if(entity.meta?.cadMetricXY===true)coordinates.cadMetricXY++;

    const status=String(entity.meta?.symbolAnchorStatus||'');
    if(status){
      symbolAnchors.eligible++;
      if(status==='RESOLVED_REVIEW_CANDIDATE')symbolAnchors.resolved++;
      else if(status==='AMBIGUOUS')symbolAnchors.ambiguous++;
      else if(status==='UNRESOLVED')symbolAnchors.unresolved++;
      else if(status==='TEXT_ABBREVIATION_REVIEW_CANDIDATE')symbolAnchors.textAbbreviation++;
    }

    if(!isEquipmentCandidate(entity))continue;
    classLinkage.equipment++;
    candidateByKind[entity.kind]=(candidateByKind[entity.kind]||0)+1;
    if(entity.meta?.derivedFrom)derivedDuplicates++;
    const nameKey=String(entity.name||'').trim();
    nameCounts.set(nameKey,(nameCounts.get(nameKey)||0)+1);
    const role=entity.meta?.candidateRole;
    if(role==='INSTANCE')instances++;else if(role==='LABEL')labels++;else if(role==='REGISTRATION_SHADOW')shadows++;
    if(role==='INSTANCE'&&entity.meta?.libraryComponentKey)classLinkage.identifiedInstances++;
    if(role==='INSTANCE'){
      const meta=entity.meta||{};
      const sld=Boolean(meta.sldSpatialProjection||meta.sldLogicalDepth!==undefined||meta.sldCandidate);
      const hasSurface=SURFACE_KEYS.some(key=>finite(meta[key])!==null);
      const status=String(meta.zResolutionStatus||'UNRESOLVED');
      instanceZ.instances++;
      if(sld)instanceZ.sld++;else instanceZ.plan++;
      if(hasSurface)instanceZ.withSupportSurface++;
      instanceZ.byStatus[status]=(instanceZ.byStatus[status]||0)+1;
      if(instanceZ.samples.length<40)instanceZ.samples.push({name:String(entity.name).slice(0,40),layer:entity.layer,kind:entity.kind,sld,floor:String(entity.floor||'UNRESOLVED'),hasSurface,status});
    }

    // Pipeline identification outcome (stamped by identifyLibraryComponents). This is the real
    // before/after: raw classResolved below is exact-alias only; `identified` includes the bridge.
    if(entity.meta?.libraryComponentKey){
      classLinkage.identified++;
      if(entity.meta?.libraryComponentAuthority==='COARSE_CLASS_BRIDGE'){
        classLinkage.identifiedByBridge++;
        const key=String(entity.meta.libraryComponentKey);
        samples.bridgedByKey[key]=(samples.bridgedByKey[key]||0)+1;
        if(samples.bridgedExamples.length<SAMPLE_CAP)samples.bridgedExamples.push({name:entity.name,key});
      }else classLinkage.identifiedByAlias++;
    }else{
      classLinkage.unidentified++;
      if(samples.unidentified.length<SAMPLE_CAP)samples.unidentified.push(entity.name);
    }

    const component=resolveElectricalComponent(entity.name);
    // Coarse recognition (classifyElectricalLabel) handles drawing tags/abbreviations the library's
    // alias matcher misses. "bridgeable" = library-unresolved but coarsely recognized: the Phase 2
    // target set that a class/tag -> library-key bridge would convert.
    const coarse=classifyElectricalLabel(entity.name)!==null;
    if(coarse)classLinkage.coarseClassified++;
    if(!component){
      classLinkage.classUnresolved++;
      if(coarse)classLinkage.bridgeable++;else classLinkage.unrecognized++;
      continue;
    }
    classLinkage.classResolved++;

    const sourceSpec=entity.meta?.assetDimensionAuthority==='SOURCE_SPEC';
    const libDims=registryDimensions(registry,component.key);
    if(sourceSpec)classLinkage.sourceSpecDims++;
    if(libDims||sourceSpec)classLinkage.libraryDimensioned++;else classLinkage.nominalOnly++;

    // Footprint cross-check: extracted symbol plan size (width/height) vs library plan size (w,d).
    const sw=finite(entity.meta?.symbolAnchorWidth),sh=finite(entity.meta?.symbolAnchorHeight);
    if(sw===null||sh===null||!libDims)continue;
    footprint.checked++;
    const scaleKnown=sourceScale.get(String(entity.meta?.sourceSha256||entity.source))??sourceScale.get(entity.source)??false;
    if(!scaleKnown){footprint.scaleUnavailable++;continue}
    // Library plan footprint is [width, depth]; compare the larger/smaller pair order-independently.
    const extent=[Math.max(sw,sh),Math.min(sw,sh)];
    const libPlan=[Math.max(libDims[0],libDims[2]),Math.min(libDims[0],libDims[2])];
    const within=extent.every((value,index)=>libPlan[index]>0&&Math.abs(value-libPlan[index])/libPlan[index]<=FOOTPRINT_TOLERANCE);
    if(within)footprint.agree++;else footprint.disagree++;
  }

  const topNames=[...nameCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,20).map(([name,count])=>({name,count}));
  const candidates={total:classLinkage.equipment,byKind:candidateByKind,derivedDuplicates,distinctNames:nameCounts.size,topNames,instances,labels,shadows};

  // Per-sheet scale: evidence lives on L0 `scale-validation-candidate` entities (meta.nonSpatial, so
  // they are skipped by the equipment loop above). Read them here and consolidate one candidate each.
  const scaleSheets:ParseAudit['scale']['sheets']=[];
  for(const entity of entities){
    const evidence=entity.meta?.scaleValidationEvidence as (Record<string,unknown>|undefined);
    if(!evidence||typeof evidence!=='object')continue;
    const candidate=resolveSheetScaleCandidate(evidence as never);
    scaleSheets.push({
      page:Number(entity.meta?.page||0),
      status:String((evidence as {status?:unknown}).status||'UNRESOLVED'),
      declared:finite((evidence as {declaredMetersPerNormalizedSheetUnit?:unknown}).declaredMetersPerNormalizedSheetUnit),
      corroborated:finite((evidence as {corroboratedMetersPerNormalizedSheetUnit?:unknown}).corroboratedMetersPerNormalizedSheetUnit),
      witnesses:Number((evidence as {independentWitnessCount?:unknown}).independentWitnessCount||0),
      candidate:candidate?{metersPerNormalizedSheetUnit:candidate.metersPerNormalizedSheetUnit,status:candidate.status,authority:candidate.authority}:null,
    });
  }
  // Manual XY calibration (ManualSheetXYCalibrationReview → applySheetXYTransform) is the trustworthy
  // metric route: a human-confirmed transform stamps sheetXYCalibrationId. Surface it so an established
  // metric XY frame is observable (distinct from the review-only auto scale candidates above).
  const calibrationIds=new Set<string>();
  let manualXYCalibratedEntities=0;
  for(const entity of entities){
    const id=entity.meta?.sheetXYCalibrationId;
    if(typeof id==='string'&&id){manualXYCalibratedEntities++;calibrationIds.add(id)}
  }
  const scale={sheetsWithEvidence:scaleSheets.length,sheetsWithCandidate:scaleSheets.filter(sheet=>sheet.candidate).length,manualXYCalibratedEntities,manualXYCalibrations:calibrationIds.size,sheets:scaleSheets};

  // #4 feasibility: designator-looking tags (letters + a numeric designator, e.g. LP-1, H2, MDP-3).
  const DESIGNATOR=/^[A-Z]{1,5}[-_ ]?\d{1,3}(?:[-.][A-Z0-9]{1,3})?$/i;
  const designatorSamples=new Set<string>();
  let designatorTags=0,logicalTags=0;
  for(const entity of entities){
    if(entity.meta?.nonSpatial===true)continue;
    if(entity.kind==='logical-tag')logicalTags++;
    const name=String(entity.name||'').trim();
    if(DESIGNATOR.test(name)){designatorTags++;if(designatorSamples.size<40)designatorSamples.add(name)}
  }
  const designatorProbe={designatorTags,logicalTags,samples:[...designatorSamples]};

  // Schedule candidates (nonSpatial, skipped above) carry authoritative equipment tags. Surface their
  // kinds + a sample of tags to judge whether a panel-schedule cross-reference can recover plan panels.
  const scheduleByKind:Record<string,number>={};
  const scheduleTags=new Set<string>();
  let scheduleCandidates=0;
  for(const entity of entities){
    if(!String(entity.kind).includes('schedule'))continue;
    scheduleCandidates++;
    scheduleByKind[entity.kind]=(scheduleByKind[entity.kind]||0)+1;
    const tag=entity.meta?.assetTag||entity.meta?.fixtureMark;
    if(typeof tag==='string'&&tag.trim()&&scheduleTags.size<60)scheduleTags.add(tag.trim());
  }
  const scheduleProbe={scheduleCandidates,byKind:scheduleByKind,tags:[...scheduleTags]};

  return{sources:auditedSources,coordinates,symbolAnchors,classLinkage,footprint,samples,candidates,scale,instanceZ,designatorProbe,scheduleProbe};
}
