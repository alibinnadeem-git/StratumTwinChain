// Asset extraction candidates (PR-SPAT-004, A10, extraction half).
// Turns drawing and schedule evidence into reviewable equipment candidates.
// Review-only: a candidate is never equipment, never placed, and never LIVE.
// A candidate carries source evidence and six independent per-dimension
// confidences (A5); duplicates resolve in review with an audit trail.
//
// Z doctrine (TR-206, matrix B2): Z is null when location is unknown.
// A finite Z requires a governed source (source elevation or the B2
// elevation-surface path) and stays physicalTruth:false, reviewRequired:true.
// Scale is never auto-applied; a missing or unconfirmed scale stays
// unresolved with a reason code, never a guess.
//
// Registry binding: modelId is set only when classId maps to a registered
// stlib model ID. On main today the class bindings carry legacy modelUrl
// paths, so generic3dModelForClass returns null for every class. That is
// honest, not a bug: the v1 registry (PR #223) has not landed on main yet.
// When the bindings are renamed to stlib paths, the same function resolves
// without a code change. The 8 unregistered T1 models stay null by design.

import type {PlacementEvidenceClass} from './asset-placement.ts';
import {electricalClassModelBinding} from './spatial-electrical-class-model-bindings.ts';

export type PerDimensionConfidence={
  x:number;y:number;z:number;geometry:number;topology:number;identity:number;
};

export type CandidateEvidence={
  evidenceClass:PlacementEvidenceClass;
  source:string;
  sourceUrl?:string;
  note?:string;
};

export type CandidateSourceRef={
  sourceId:string;
  sheet?:string;
  page?:number;
  region?:string;
  symbolKey?:string;
  textEvidence?:string;
};

export type ModelIdReason='MAPPED'|'UNRESOLVED_NEVER_GUESS'|'OEM_URL_NO_STLIB_ID'|'UNREGISTERED_T1';

export type ModelIdBinding={modelId:string|null;reason:ModelIdReason};

export type GovernedZSource='SOURCE_ELEVATION'|'GOVERNED_B2_SURFACE';

export type AssetExtractionCandidate={
  candidateId:string;
  sourceRef:CandidateSourceRef;
  componentKey:string;
  classId:string|null;
  modelId:string|null;
  modelIdReason:ModelIdReason;
  confidences:PerDimensionConfidence;
  evidence:CandidateEvidence[];
  physicalTruth:false;
  reviewRequired:true;
  status:'CANDIDATE';
  duplicateGroupId:string|null;
  feedsCandidateId:string|null;
  zMeters:number|null;
  zReason:string;
  scaleReason:string|null;
  planPosition:{x:number;y:number}|null;
};

export type CreateCandidateInput={
  sourceRef:CandidateSourceRef;
  componentKey:string;
  classId:string|null;
  confidences:PerDimensionConfidence;
  evidence:CandidateEvidence[];
  feedsCandidateId?:string|null;
  zMeters?:number|null;
  zSource?:GovernedZSource|null;
  scaleConfirmed?:boolean;
  planPosition?:{x:number;y:number}|null;
};

// Proximity bucket size in plan metres. Only groups candidates that already
// share sheet, symbol key, and class; it never creates a position.
export const PROXIMITY_BUCKET_METERS=1;

// Normalize a symbol key the same way every time, so the same drawn symbol
// extracted twice yields the same key (and the same candidateId).
export function normalizeSymbolKey(raw:string):string{
  return String(raw||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
}

// Small synchronous deterministic hash (cyrb53). No crypto dependency, so
// the id is identical in the browser and in node for the same input.
function hash53(input:string):string{
  let h1=0xdeadbeef^0,h2=0x41c6ce57^0;
  for(let i=0;i<input.length;i++){
    const ch=input.charCodeAt(i);
    h1=Math.imul(h1^ch,2654435761);
    h2=Math.imul(h2^ch,1597334677);
  }
  h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);
  h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
  return (h2>>>0).toString(16).padStart(8,'0')+(h1>>>0).toString(16).padStart(8,'0');
}

// Deterministic candidate id: source id plus normalized symbol key. The same
// source extracted twice yields the same id; different sources never collide
// by construction of the hash input.
export function deriveCandidateId(sourceId:string,symbolKey:string):string{
  return `aec-${hash53(`${sourceId}::${normalizeSymbolKey(symbolKey)}`)}`;
}

// A registered stlib model id has the form stlib-ele-<name>-v<n> and lives
// under /models/equipment/. T1 files (stlib-ele-<name>-t1-v<n>) are
// unregistered by design until Ali decides on registration, so they bind
// to nothing here. OEM URLs never acquire a stlib id.
export function modelIdFromModelUrl(modelUrl:string):ModelIdBinding{
  const url=String(modelUrl||'').trim();
  if(/^https?:\/\//i.test(url))return{modelId:null,reason:'OEM_URL_NO_STLIB_ID'};
  const match=/^\/models\/equipment\/(stlib-ele-[a-z0-9-]+-v[0-9]+)\.glb$/i.exec(url);
  if(!match)return{modelId:null,reason:'UNRESOLVED_NEVER_GUESS'};
  const id=match[1].toLowerCase();
  if(id.includes('-t1-'))return{modelId:null,reason:'UNREGISTERED_T1'};
  return{modelId:id,reason:'MAPPED'};
}

// The registry binding rule. modelId is set only when classId maps to a
// registered stlib model id through the class bindings. A null classId, a
// legacy modelUrl, an OEM URL, or an unregistered T1 path all bind to null
// with the reason recorded, never to a guessed id.
export function generic3dModelForClass(classId:string|null):ModelIdBinding{
  if(classId===null||classId===undefined||String(classId).trim()===''){
    return{modelId:null,reason:'UNRESOLVED_NEVER_GUESS'};
  }
  const binding=electricalClassModelBinding(String(classId).trim().toUpperCase());
  if(!binding)return{modelId:null,reason:'UNRESOLVED_NEVER_GUESS'};
  return modelIdFromModelUrl(binding.modelUrl);
}

function checkConfidences(confidences:PerDimensionConfidence):void{
  const keys=['x','y','z','geometry','topology','identity'] as const;
  for(const key of keys){
    const value=confidences[key];
    if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1){
      throw new Error(`Invalid confidence for ${key}: ${String(value)} (must be a finite number from 0 to 1)`);
    }
  }
}

function checkEvidence(evidence:CandidateEvidence[]):void{
  if(!Array.isArray(evidence)||evidence.length===0){
    throw new Error('A candidate needs at least one evidence entry with a source ref');
  }
  for(const entry of evidence){
    if(!entry||typeof entry.source!=='string'||entry.source.trim()===''){
      throw new Error('Every evidence entry needs a non-empty source ref');
    }
  }
}

// Create one reviewable equipment candidate. Placement math stays in
// lib/asset-placement.ts (resolveAssetPlacement); this function only creates
// the candidate, groups nothing, and binds modelId through the registry.
// It never places equipment, never invents coordinates, and never promotes.
export function createAssetExtractionCandidate(input:CreateCandidateInput):AssetExtractionCandidate{
  const sourceId=String(input.sourceRef?.sourceId||'').trim();
  if(sourceId==='')throw new Error('A candidate needs a sourceRef.sourceId');
  const componentKey=String(input.componentKey||'').trim();
  if(componentKey==='')throw new Error('A candidate needs a componentKey');
  checkConfidences(input.confidences);
  checkEvidence(input.evidence);

  const symbolKey=normalizeSymbolKey(input.sourceRef.symbolKey||input.componentKey);
  const binding=generic3dModelForClass(input.classId);

  const zMeters=input.zMeters===undefined?null:input.zMeters;
  let zReason:string;
  if(zMeters===null){
    zReason='Z_NOT_STATED';
  }else{
    if(typeof zMeters!=='number'||!Number.isFinite(zMeters)){
      throw new Error('zMeters must be a finite number or null');
    }
    if(input.zSource!=='SOURCE_ELEVATION'&&input.zSource!=='GOVERNED_B2_SURFACE'){
      throw new Error('A finite Z needs a governed source (SOURCE_ELEVATION or GOVERNED_B2_SURFACE); no Z is ever invented');
    }
    zReason=input.zSource==='SOURCE_ELEVATION'?'SOURCE_ELEVATION':'GOVERNED_B2_SURFACE';
  }

  const planPosition=input.planPosition===undefined?null:input.planPosition;

  return{
    candidateId:deriveCandidateId(sourceId,symbolKey),
    sourceRef:{...input.sourceRef,sourceId,symbolKey},
    componentKey,
    classId:input.classId===undefined?null:input.classId,
    modelId:binding.modelId,
    modelIdReason:binding.reason,
    confidences:{...input.confidences},
    evidence:input.evidence.map(entry=>({...entry})),
    physicalTruth:false,
    reviewRequired:true,
    status:'CANDIDATE',
    duplicateGroupId:null,
    feedsCandidateId:input.feedsCandidateId===undefined?null:input.feedsCandidateId,
    zMeters,
    zReason,
    scaleReason:input.scaleConfirmed===true?null:'SCALE_NOT_CONFIRMED',
    planPosition:planPosition===null?null:{x:planPosition.x,y:planPosition.y},
  };
}

function proximityBucket(candidate:AssetExtractionCandidate):string{
  const position=candidate.planPosition;
  if(position===null||!Number.isFinite(position.x)||!Number.isFinite(position.y)){
    return 'NO_POSITION';
  }
  const bucket=(value:number)=>Math.floor(value/PROXIMITY_BUCKET_METERS);
  return `${bucket(position.x)}:${bucket(position.y)}`;
}

function groupKey(candidate:AssetExtractionCandidate):string{
  const sheet=String(candidate.sourceRef.sheet||'').trim().toUpperCase();
  const symbolKey=normalizeSymbolKey(candidate.sourceRef.symbolKey||candidate.componentKey);
  const classId=candidate.classId===null?'NO_CLASS':candidate.classId;
  return `${sheet}|${symbolKey}|${classId}|${proximityBucket(candidate)}`;
}

// Group candidates by (source sheet, normalized symbol key, classId, spatial
// proximity bucket). Groups of two or more share a deterministic
// duplicateGroupId; singletons keep null. Grouping never merges, never
// deletes, and never changes a candidate's status: duplicates are resolved
// in review, by a human, with an audit trail.
export function groupExtractionCandidates(
  candidates:AssetExtractionCandidate[],
):AssetExtractionCandidate[]{
  const groups=new Map<string,AssetExtractionCandidate[]>();
  for(const candidate of candidates){
    const key=groupKey(candidate);
    const list=groups.get(key)||[];
    list.push(candidate);
    groups.set(key,list);
  }
  const grouped:AssetExtractionCandidate[]=[];
  for(const [key,list] of groups){
    if(list.length<2){
      grouped.push({...list[0],duplicateGroupId:null});
      continue;
    }
    const duplicateGroupId=`dup-${hash53(key)}`;
    for(const candidate of list){
      grouped.push({...candidate,duplicateGroupId});
    }
  }
  return grouped;
}
