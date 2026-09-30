/**
 * Review-only Z proposal engine.
 *
 * Critical invariant: an offset above a support datum is NOT an absolute Z.
 * The engine therefore carries offset, absolute reference coordinate and
 * render-base coordinate as separate values. Unknown support keeps absolute
 * coordinates null. No proposal mutates entity.z or becomes physical truth.
 */
import {resolveElectricalComponent} from './electrical-component-library.ts';
import {resolveAssetPlacement} from './asset-placement.ts';
import type {ElectricalModelConfig} from './electrical-model-registry.ts';
import {historicalZConfidence,historicalZPrior} from './z-history.ts';

export type ZInferenceMethod='PLACEMENT_ENGINE'|'HISTORICAL_CLASS_PRIOR'|'CLASS_MOUNTING_PRIOR'|'OEM_MOUNTING_REFERENCE';
export type ZInferenceReferencePoint='BASE'|'CENTERLINE'|'MOUNTING_POINT'|'GRADE'|'FLOOR_DATUM'|'UNSPECIFIED';
export type ZInferenceSourceRef={
  url?:string;
  label:string;
  publisher?:string;
  document?:string;
  claimType:'SOURCE_DESIGN'|'OEM_DOCUMENT'|'JURISDICTIONAL_GUIDANCE'|'TRADE_PRACTICE'|'HUMAN_HISTORY'|'STRATUM_TYPE_PRIOR';
  verification:'EXACT_DOCUMENT'|'SECONDARY_REFERENCE'|'INTERNAL_REVIEW_EVIDENCE';
};
export type ZInferenceSupport={
  zMeters:number;
  kind:string;
  authority:string;
  confidence:number;
};
export type ZInference={
  id:string;
  offsetMeters:number|null;
  absoluteReferenceZMeters:number|null;
  renderBaseZMeters:number|null;
  confidence:number;
  method:ZInferenceMethod;
  corroboratingMethods:ZInferenceMethod[];
  referencePoint:ZInferenceReferencePoint;
  support:ZInferenceSupport|null;
  basis:string[];
  sourceRefs:ZInferenceSourceRef[];
  relativeOnly:boolean;
  inferenceClass:'INFERRED';
  physicalTruth:false;
  reviewRequired:true;
};
export type ZInferenceInput={
  name:string;
  floor?:string;
  z?:number;
  meta?:Record<string,unknown>;
  x?:number;
  y?:number;
  projectId?:string;
  registry?:ElectricalModelConfig|null;
};

type ClassPrior={heightM:number;referencePoint:ZInferenceReferencePoint;confidence:number;basis:string;sourceRef?:ZInferenceSourceRef};
const CLASS_MOUNTING_PRIORS:Record<string,ClassPrior>={
  disconnect:{heightM:1.22,referencePoint:'MOUNTING_POINT',confidence:.48,basis:'STRATUM type prior: safety-switch operating handle is commonly coordinated near 1.22 m AFF. This is trade practice, not project or field evidence.',sourceRef:{label:'Trade-practice mounting prior',claimType:'TRADE_PRACTICE',verification:'SECONDARY_REFERENCE'}},
  'fused-switch':{heightM:1.22,referencePoint:'MOUNTING_POINT',confidence:.48,basis:'STRATUM type prior: fused-switch operating handle is commonly coordinated near 1.22 m AFF. Verify the project documents and applicable code.',sourceRef:{label:'Trade-practice mounting prior',claimType:'TRADE_PRACTICE',verification:'SECONDARY_REFERENCE'}},
  'fire-alarm':{heightM:1.6,referencePoint:'CENTERLINE',confidence:.42,basis:'Jurisdiction-sensitive FACP operable/display height review prior. This does not substitute for project details, OEM instructions or AHJ requirements.',sourceRef:{url:'https://www.nyc.gov/assets/fdny/downloads/pdf/codes/bulleltin-no-08-02-12-mounting-height-for-fire-equipment.pdf',label:'FDNY Bulletin 08-02-12',publisher:'FDNY',document:'Mounting Height for Fire Equipment',claimType:'JURISDICTIONAL_GUIDANCE',verification:'EXACT_DOCUMENT'}},
  'duplex-receptacle':{heightM:.46,referencePoint:'CENTERLINE',confidence:.45,basis:'STRATUM type prior: general wall receptacles are commonly coordinated near 0.46 m AFF to device centerline. Project details govern.',sourceRef:{label:'Common design-practice prior',claimType:'TRADE_PRACTICE',verification:'SECONDARY_REFERENCE'}},
  gfci:{heightM:.46,referencePoint:'CENTERLINE',confidence:.45,basis:'STRATUM type prior: wall receptacles are commonly coordinated near 0.46 m AFF to device centerline. Project details govern.',sourceRef:{label:'Common design-practice prior',claimType:'TRADE_PRACTICE',verification:'SECONDARY_REFERENCE'}},
  'ig-outlet':{heightM:.46,referencePoint:'CENTERLINE',confidence:.45,basis:'STRATUM type prior: wall receptacles are commonly coordinated near 0.46 m AFF to device centerline. Project details govern.',sourceRef:{label:'Common design-practice prior',claimType:'TRADE_PRACTICE',verification:'SECONDARY_REFERENCE'}},
  'industrial-receptacle':{heightM:.46,referencePoint:'CENTERLINE',confidence:.4,basis:'STRATUM type prior for wall receptacle coordination only; special-purpose outlet details govern.',sourceRef:{label:'Common design-practice prior',claimType:'TRADE_PRACTICE',verification:'SECONDARY_REFERENCE'}},
  'exit-sign':{heightM:2.1,referencePoint:'BASE',confidence:.32,basis:'STRATUM visualization prior for conventional wall-mounted exit-sign height. Life-safety drawings and mounting conditions govern.',sourceRef:{label:'STRATUM visualization prior',claimType:'STRATUM_TYPE_PRIOR',verification:'INTERNAL_REVIEW_EVIDENCE'}},
  'emergency-light':{heightM:2.3,referencePoint:'CENTERLINE',confidence:.32,basis:'STRATUM visualization prior for conventional wall-pack emergency lighting. Project elevations govern.',sourceRef:{label:'STRATUM visualization prior',claimType:'STRATUM_TYPE_PRIOR',verification:'INTERNAL_REVIEW_EVIDENCE'}},
  'access-control':{heightM:1.2,referencePoint:'CENTERLINE',confidence:.38,basis:'STRATUM coordination prior for accessible reader/keypad placement. Architectural/security details govern.',sourceRef:{label:'STRATUM coordination prior',claimType:'STRATUM_TYPE_PRIOR',verification:'INTERNAL_REVIEW_EVIDENCE'}},
  'security-panel':{heightM:1.4,referencePoint:'CENTERLINE',confidence:.36,basis:'STRATUM coordination prior for accessible security-panel placement. Project details govern.',sourceRef:{label:'STRATUM coordination prior',claimType:'STRATUM_TYPE_PRIOR',verification:'INTERNAL_REVIEW_EVIDENCE'}},
  intercom:{heightM:1.4,referencePoint:'CENTERLINE',confidence:.34,basis:'STRATUM coordination prior for intercom station placement. Architectural elevations govern.',sourceRef:{label:'STRATUM coordination prior',claimType:'STRATUM_TYPE_PRIOR',verification:'INTERNAL_REVIEW_EVIDENCE'}},
  'pad-mount-transformer':{heightM:.12,referencePoint:'BASE',confidence:.42,basis:'Pad-mounted equipment base is coordinated to pad top; this prior uses 0.12 m as a review midpoint for typical pad projection above grade. Utility/project civil details govern.',sourceRef:{url:'https://www.wbdg.org/FFC/DOD/UFGS/UFGS%2026%2013%2002.pdf',label:'UFGS 26 13 02',publisher:'WBDG / DoD',document:'Underground Electrical Distribution',claimType:'JURISDICTIONAL_GUIDANCE',verification:'EXACT_DOCUMENT'}},
  'utility-transformer':{heightM:.12,referencePoint:'BASE',confidence:.42,basis:'Pad-mounted equipment base is coordinated to pad top; this prior uses 0.12 m as a review midpoint only. Utility/project civil details govern.',sourceRef:{url:'https://www.wbdg.org/FFC/DOD/UFGS/UFGS%2026%2013%2002.pdf',label:'UFGS 26 13 02',publisher:'WBDG / DoD',document:'Underground Electrical Distribution',claimType:'JURISDICTIONAL_GUIDANCE',verification:'EXACT_DOCUMENT'}},
};

type OemMountingRef={match:string[];componentKeys:string[];offsetM:number;referencePoint:ZInferenceReferencePoint;confidence:number;basis:string;sourceRef:ZInferenceSourceRef};
const OEM_MOUNTING_REFS:OemMountingRef[]=[
  {match:['tesla','supercharger'],componentKeys:['evse-tesla-supercharger-v3'],offsetM:0,referencePoint:'BASE',confidence:.58,basis:'Tesla Supercharger cabinet is floor-standing; the equipment base is reviewed against its support surface. Pad/grade elevation remains a separate civil datum.',sourceRef:{url:'https://caltrans.brightidea.com/ct/getfile.php?a=OD7374&f=8B23F7F3-E63D-11EF-BC3A-0AFFDC36765F',label:'Tesla V3 Supercharger cabinet datasheet mirror',publisher:'Tesla / Caltrans-hosted copy',document:'V3 Supercharger cabinet dimensions',claimType:'OEM_DOCUMENT',verification:'EXACT_DOCUMENT'}},
];

const finite=(value:unknown)=>{const n=Number(value);return Number.isFinite(n)?n:null};
const clamp=(value:number,min=0,max=1)=>Math.max(min,Math.min(max,value));
function supportElevation(meta:Record<string,unknown>|undefined):ZInferenceSupport|null{
  if(!meta)return null;
  const candidates=[
    ['localReviewSurfaceZ','localReviewSurfaceKind','localReviewSurfaceAuthority','localReviewSurfaceConfidence','LOCAL_SURFACE'],
    ['crossSheetReviewSurfaceZ','crossSheetReviewSurfaceKind','crossSheetReviewSurfaceAuthority','crossSheetReviewSurfaceConfidence','CROSS_SHEET_SURFACE'],
    ['finishedFloorElevationMeters',null,null,null,'FINISHED_FLOOR'],
    ['floorElevationMeters',null,null,null,'FLOOR_ELEVATION'],
    ['floorDatumMeters',null,null,null,'FLOOR_DATUM'],
    ['reviewSurfaceZ','reviewSurfaceKind','reviewSurfaceAuthority','reviewSurfaceConfidence','PROJECT_DATUM'],
  ] as const;
  for(const [zKey,kindKey,authorityKey,confidenceKey,fallbackKind] of candidates){
    const z=finite(meta[zKey]);if(z===null)continue;
    return{zMeters:z,kind:String(kindKey?meta[kindKey]||fallbackKind:fallbackKind),authority:String(authorityKey?meta[authorityKey]||'SOURCE_PROJECT_DATUM':'SOURCE_PROJECT_DATUM'),confidence:clamp(Number(confidenceKey?meta[confidenceKey]??.6:.6))};
  }
  return null;
}
function contextText(input:ZInferenceInput){
  const meta=input.meta||{};
  return[input.name,meta.manufacturer,meta.oem,meta.brand,meta.model,meta.modelNumber,meta.productName,meta.partNumber,meta.mountingType,meta.installationType].filter(Boolean).join(' ').toLowerCase();
}
function placementContext(input:ZInferenceInput):'WALL'|'FLOOR'|'GRADE'|'CEILING'|'UNKNOWN'{
  const text=contextText(input);
  if(/\b(wall[\s-]?mount|wall pack|surface mount)\b/.test(text))return'WALL';
  if(/\b(pad[\s-]?mount|padmount|on pad|housekeeping pad|bollard|pole[\s-]?mount|site light|area light)\b/.test(text))return'GRADE';
  if(/\b(roof[\s-]?top|rtu|roof mount|ceiling[\s-]?mount|pendant|suspended)\b/.test(text))return'CEILING';
  if(/\b(floor[\s-]?stand|free[\s-]?stand|pedestal)\b/.test(text))return'FLOOR';
  return'UNKNOWN';
}
function inferenceId(method:ZInferenceMethod,referencePoint:ZInferenceReferencePoint,absolute:number|null,offset:number|null,support:ZInferenceSupport|null){
  const value=absolute===null?`rel-${offset?.toFixed(4)??'null'}`:`abs-${absolute.toFixed(4)}`;
  return[`zinf-v2`,method,referencePoint,support?.kind||'NO_SUPPORT',value].join(':').replace(/[^a-zA-Z0-9_.:-]/g,'_');
}
function dimensionsFor(input:ZInferenceInput){
  try{return resolveAssetPlacement({name:input.name,floor:input.floor,z:input.z,meta:input.meta},input.registry||undefined).dimensions}catch{return null}
}
function referenceToBase(input:ZInferenceInput,referencePoint:ZInferenceReferencePoint,absoluteReferenceZMeters:number|null){
  if(absoluteReferenceZMeters===null)return null;
  const dimensions=dimensionsFor(input);if(!dimensions)return null;
  if(referencePoint==='BASE')return absoluteReferenceZMeters;
  if(referencePoint==='CENTERLINE')return absoluteReferenceZMeters-dimensions.height/2;
  if(referencePoint==='MOUNTING_POINT'){
    const offset=finite(input.meta?.mountingPointFromBaseMeters??input.meta?.mountingPointOffsetFromBaseMeters);
    return offset===null?null:absoluteReferenceZMeters-offset;
  }
  return null;
}
function candidate(input:ZInferenceInput,args:{
  method:ZInferenceMethod;offsetMeters:number|null;absoluteReferenceZMeters:number|null;confidence:number;
  referencePoint:ZInferenceReferencePoint;support:ZInferenceSupport|null;basis:string[];sourceRefs?:ZInferenceSourceRef[];renderBaseZMeters?:number|null;
}):ZInference{
  const render=args.renderBaseZMeters===undefined?referenceToBase(input,args.referencePoint,args.absoluteReferenceZMeters):args.renderBaseZMeters;
  return{id:inferenceId(args.method,args.referencePoint,args.absoluteReferenceZMeters,args.offsetMeters,args.support),offsetMeters:args.offsetMeters,absoluteReferenceZMeters:args.absoluteReferenceZMeters,renderBaseZMeters:render,confidence:clamp(args.confidence),method:args.method,corroboratingMethods:[args.method],referencePoint:args.referencePoint,support:args.support,basis:args.basis.filter(Boolean),sourceRefs:args.sourceRefs||[],relativeOnly:args.absoluteReferenceZMeters===null,inferenceClass:'INFERRED',physicalTruth:false,reviewRequired:true};
}
function placementEngineInference(input:ZInferenceInput,support:ZInferenceSupport|null):ZInference|null{
  try{
    const placement=resolveAssetPlacement({name:input.name,floor:input.floor,z:input.z,meta:input.meta},input.registry||undefined);
    const rec=placement.recommendation;
    if(!rec||placement.zAuthority==='UNRESOLVED'||placement.zAuthority==='RELATIVE_TO_REVIEW_PLANE'||placement.zAuthority==='H2_ACCEPTED_INFERRED_PREVIEW'||!Number.isFinite(placement.baseZ))return null;
    const offset=support?placement.baseZ-support.zMeters:null;
    const claimType:ZInferenceSourceRef['claimType']=rec.evidenceClass==='OEM_INSTALLATION_GUIDANCE'?'OEM_DOCUMENT'
      :rec.evidenceClass==='SOURCE_SPEC'?'SOURCE_DESIGN'
      :rec.evidenceClass==='CODE_CONSTRAINT'?'JURISDICTIONAL_GUIDANCE'
      :rec.evidenceClass==='DESIGN_GUIDE'||rec.evidenceClass==='TYPE_PROFILE'||rec.evidenceClass==='VISUALIZATION_HEURISTIC'?'STRATUM_TYPE_PRIOR'
      :'TRADE_PRACTICE';
    const refs:ZInferenceSourceRef[]=rec.sourceUrl?[{url:rec.sourceUrl,label:rec.source||rec.kind,claimType,verification:claimType==='OEM_DOCUMENT'||claimType==='SOURCE_DESIGN'?'EXACT_DOCUMENT':'SECONDARY_REFERENCE'}]:[{label:rec.source||rec.kind,claimType,verification:'INTERNAL_REVIEW_EVIDENCE'}];
    return candidate(input,{method:'PLACEMENT_ENGINE',offsetMeters:offset,absoluteReferenceZMeters:placement.baseZ,renderBaseZMeters:placement.baseZ,confidence:placement.zConfidence,referencePoint:'BASE',support,basis:[`Placement engine: ${rec.kind.replaceAll('_',' ').toLowerCase()} → base ${placement.baseZ.toFixed(2)} m`,rec.note||''],sourceRefs:refs});
  }catch{return null}
}
function historicalInference(input:ZInferenceInput,componentKey:string,support:ZInferenceSupport|null):ZInference|null{
  if(!support||!input.projectId)return null;
  const prior=historicalZPrior(componentKey,{projectId:input.projectId,supportKind:support.kind});
  if(!prior)return null;
  const absolute=support.zMeters+prior.medianOffsetMeters;
  return candidate(input,{method:'HISTORICAL_CLASS_PRIOR',offsetMeters:prior.medianOffsetMeters,absoluteReferenceZMeters:absolute,confidence:historicalZConfidence(prior.n,prior.stdMeters),referencePoint:prior.referencePoint,support,basis:[`${prior.n} unique reviewed placements in this project for this component/support context; median offset ${prior.medianOffsetMeters.toFixed(2)} m, range ${prior.minOffsetMeters.toFixed(2)}–${prior.maxOffsetMeters.toFixed(2)} m, σ ${prior.stdMeters.toFixed(2)} m`],sourceRefs:[{label:`${prior.n} H2 accepted-inference review events`,claimType:'HUMAN_HISTORY',verification:'INTERNAL_REVIEW_EVIDENCE'}]});
}
function classPriorInference(input:ZInferenceInput,componentKey:string,support:ZInferenceSupport|null,context:ReturnType<typeof placementContext>):ZInference|null{
  const prior=CLASS_MOUNTING_PRIORS[componentKey];if(!prior)return null;
  if(context==='GRADE'&&prior.referencePoint==='MOUNTING_POINT')return null;
  if(context==='CEILING'&&prior.referencePoint!=='BASE')return null;
  const absolute=support?support.zMeters+prior.heightM:null;
  const confidence=support?Math.min(prior.confidence,.35+support.confidence*.45):prior.confidence*.65;
  const basis=[prior.basis,support?`Composed with ${support.kind.replaceAll('_',' ').toLowerCase()} at ${support.zMeters.toFixed(2)} m`:'Support datum unresolved — retained only as a relative mounting offset; no absolute project Z exists.'];
  return candidate(input,{method:'CLASS_MOUNTING_PRIOR',offsetMeters:prior.heightM,absoluteReferenceZMeters:absolute,confidence,referencePoint:prior.referencePoint,support,basis,sourceRefs:prior.sourceRef?[prior.sourceRef]:[]});
}
function oemInference(input:ZInferenceInput,componentKey:string,text:string,support:ZInferenceSupport|null):ZInference|null{
  for(const ref of OEM_MOUNTING_REFS){
    if(!ref.componentKeys.includes(componentKey)||!ref.match.some(match=>text.includes(match)))continue;
    const absolute=support?support.zMeters+ref.offsetM:null;
    return candidate(input,{method:'OEM_MOUNTING_REFERENCE',offsetMeters:ref.offsetM,absoluteReferenceZMeters:absolute,confidence:support?Math.min(ref.confidence,.35+support.confidence*.45):ref.confidence*.65,referencePoint:ref.referencePoint,support,basis:[ref.basis,support?`Composed with ${support.kind.replaceAll('_',' ').toLowerCase()} at ${support.zMeters.toFixed(2)} m`:'Support datum unresolved — OEM mounting relation remains relative only.'],sourceRefs:[ref.sourceRef]});
  }
  return null;
}
function mergeCandidate(high:ZInference,other:ZInference):ZInference{
  const methods=[...new Set([...high.corroboratingMethods,...other.corroboratingMethods])];
  const confidence=Math.min(.9,1-(1-high.confidence)*(1-other.confidence));
  return{...high,confidence,corroboratingMethods:methods,basis:[...new Set([...high.basis,...other.basis])].slice(0,12),sourceRefs:[...high.sourceRefs,...other.sourceRefs].filter((ref,index,all)=>all.findIndex(otherRef=>otherRef.url===ref.url&&otherRef.label===ref.label)===index).slice(0,12)};
}
function comparableDistance(a:ZInference,b:ZInference){
  if(a.referencePoint!==b.referencePoint||a.relativeOnly!==b.relativeOnly)return null;
  if(a.relativeOnly)return a.offsetMeters!==null&&b.offsetMeters!==null?Math.abs(a.offsetMeters-b.offsetMeters):null;
  return a.absoluteReferenceZMeters!==null&&b.absoluteReferenceZMeters!==null?Math.abs(a.absoluteReferenceZMeters-b.absoluteReferenceZMeters):null;
}

export function inferEquipmentZ(input:ZInferenceInput):ZInference[]{
  const component=resolveElectricalComponent(input.name),componentKey=component?.key||'',support=supportElevation(input.meta),text=contextText(input),context=placementContext(input);
  const candidates:ZInference[]=[];
  const placement=placementEngineInference(input,support);if(placement)candidates.push(placement);
  if(componentKey){
    const historical=historicalInference(input,componentKey,support);if(historical)candidates.push(historical);
    const prior=classPriorInference(input,componentKey,support,context);if(prior)candidates.push(prior);
    const oem=oemInference(input,componentKey,text,support);if(oem)candidates.push(oem);
  }
  const clustered:ZInference[]=[];
  for(const current of candidates.sort((a,b)=>b.confidence-a.confidence||Number(a.relativeOnly)-Number(b.relativeOnly))){
    const index=clustered.findIndex(existing=>{const distance=comparableDistance(existing,current);return distance!==null&&distance<.05});
    if(index===-1)clustered.push(current);else clustered[index]=mergeCandidate(clustered[index],current);
  }
  return clustered.sort((a,b)=>b.confidence-a.confidence||Number(a.relativeOnly)-Number(b.relativeOnly)).slice(0,3);
}
export function inferenceMethodLabel(method:ZInferenceMethod){
  return{PLACEMENT_ENGINE:'Placement engine (source / surface / OEM)',HISTORICAL_CLASS_PRIOR:'Reviewed placements in this project',CLASS_MOUNTING_PRIOR:'Industry / STRATUM mounting prior',OEM_MOUNTING_REFERENCE:'Exact OEM mounting reference'}[method];
}
