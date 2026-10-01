/**
 * Browser-local review evidence for inferred equipment Z.
 *
 * Historical learning is deliberately NOT authoritative. Records are retained as
 * review events so STRATUM can explain which human decisions informed a prior.
 * Priors are derived only from the latest decision for unique project/entity
 * pairs and from normalized offsets relative to a named support datum.
 */
export type ZHistoryReferencePoint='BASE'|'CENTERLINE'|'MOUNTING_POINT'|'GRADE'|'FLOOR_DATUM'|'UNSPECIFIED';
export type ZReviewActor={userId:string;organizationId:string;role:string};

export type ZHistoryEvent={
  id:string;
  decisionKey:string;
  projectId:string;
  entityId:string;
  componentKey:string;
  supportKind:string;
  supportZMeters:number|null;
  offsetMeters:number|null;
  referencePoint:ZHistoryReferencePoint;
  absoluteReferenceZMeters:number|null;
  inferenceMethod:string;
  sourceInferenceId:string;
  basis:string[];
  sourceRefs:unknown[];
  actorUserId:string;
  organizationId:string;
  actorRole:string;
  decision:'H2_ACCEPTED_INFERENCE'|'H2_REJECTED_INFERENCE';
  canonical:false;
  physicalTruth:false;
  occurredAt:string;
  supersedesId?:string;
};

export type ZHistoryPrior={
  n:number;
  meanOffsetMeters:number;
  medianOffsetMeters:number;
  stdMeters:number;
  minOffsetMeters:number;
  maxOffsetMeters:number;
  supportKind:string;
  referencePoint:ZHistoryReferencePoint;
  eventIds:string[];
};

const KEY='stratum_z_history_v2';
const MIN_SAMPLES=3;
let memoryFallback:ZHistoryEvent[]=[];

const storageAvailable=()=>typeof localStorage!=='undefined';
const clean=(value:string)=>String(value||'').trim();

function readAll():ZHistoryEvent[]{
  if(!storageAvailable())return memoryFallback;
  try{
    const parsed=JSON.parse(localStorage.getItem(KEY)||'[]');
    if(!Array.isArray(parsed))return[];
    return parsed.filter((event:ZHistoryEvent)=>{
      if(!event||event.physicalTruth!==false||event.canonical!==false||!Boolean(event.actorUserId)||!Boolean(event.organizationId))return false;
      if(!['H2_ACCEPTED_INFERENCE','H2_REJECTED_INFERENCE'].includes(event.decision))return false;
      return event.decision==='H2_REJECTED_INFERENCE'||(Number.isFinite(event.offsetMeters)&&Number.isFinite(event.supportZMeters)&&Number.isFinite(event.absoluteReferenceZMeters));
    });
  }catch{return[]}
}
function writeAll(events:ZHistoryEvent[]){
  if(!storageAvailable()){memoryFallback=events;return}
  try{localStorage.setItem(KEY,JSON.stringify(events))}catch{}
}
function median(values:number[]){
  if(!values.length)return 0;
  const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
}
function safeId(value:string){return value.replace(/[^a-zA-Z0-9_.:-]/g,'_').slice(0,220)}

export function recordConfirmedZ(input:{
  projectId:string;
  entityId:string;
  componentKey:string;
  supportKind:string;
  supportZMeters:number;
  offsetMeters:number;
  referencePoint:ZHistoryReferencePoint;
  absoluteReferenceZMeters:number;
  inferenceMethod:string;
  sourceInferenceId:string;
  basis?:string[];
  sourceRefs?:unknown[];
  actorUserId:string;
  organizationId:string;
  actorRole:string;
}):ZHistoryEvent|null{
  const projectId=clean(input.projectId),entityId=clean(input.entityId),componentKey=clean(input.componentKey).toLowerCase(),supportKind=clean(input.supportKind).toUpperCase();
  const actorUserId=clean(input.actorUserId),organizationId=clean(input.organizationId),actorRole=clean(input.actorRole);
  if(!projectId||!entityId||!componentKey||!supportKind||!actorUserId||!organizationId||!actorRole||![input.supportZMeters,input.offsetMeters,input.absoluteReferenceZMeters].every(Number.isFinite))return null;
  const events=readAll(),decisionKey=`${projectId}:${entityId}`;
  const prior=[...events].reverse().find(event=>event.decisionKey===decisionKey);
  if(prior&&prior.sourceInferenceId===input.sourceInferenceId&&Math.abs(prior.offsetMeters-input.offsetMeters)<1e-9)return prior;
  const occurredAt=new Date().toISOString();
  const event:ZHistoryEvent={
    id:safeId(`${decisionKey}:${occurredAt}:${input.sourceInferenceId}`),decisionKey,projectId,entityId,componentKey,supportKind,
    supportZMeters:input.supportZMeters,offsetMeters:input.offsetMeters,referencePoint:input.referencePoint,
    absoluteReferenceZMeters:input.absoluteReferenceZMeters,inferenceMethod:input.inferenceMethod,sourceInferenceId:input.sourceInferenceId,
    basis:(input.basis||[]).slice(0,12),sourceRefs:(input.sourceRefs||[]).slice(0,12),actorUserId,organizationId,actorRole,decision:'H2_ACCEPTED_INFERENCE',canonical:false,physicalTruth:false,occurredAt,
    ...(prior?{supersedesId:prior.id}:{})
  };
  events.push(event);writeAll(events);return event;
}

export function recordRejectedZ(input:{
  projectId:string;
  entityId:string;
  componentKey:string;
  supportKind?:string|null;
  supportZMeters?:number|null;
  offsetMeters?:number|null;
  referencePoint?:ZHistoryReferencePoint;
  absoluteReferenceZMeters?:number|null;
  inferenceMethod:string;
  sourceInferenceId:string;
  basis?:string[];
  sourceRefs?:unknown[];
  actorUserId:string;
  organizationId:string;
  actorRole:string;
}):ZHistoryEvent|null{
  const projectId=clean(input.projectId),entityId=clean(input.entityId),componentKey=clean(input.componentKey).toLowerCase();
  const supportKind=clean(input.supportKind||'UNRESOLVED').toUpperCase();
  const actorUserId=clean(input.actorUserId),organizationId=clean(input.organizationId),actorRole=clean(input.actorRole);
  if(!projectId||!entityId||!componentKey||!actorUserId||!organizationId||!actorRole||!clean(input.sourceInferenceId))return null;
  const events=readAll(),decisionKey=`${projectId}:${entityId}`;
  const prior=[...events].reverse().find(event=>event.decisionKey===decisionKey);
  if(prior?.decision==='H2_REJECTED_INFERENCE'&&prior.sourceInferenceId===input.sourceInferenceId)return prior;
  const occurredAt=new Date().toISOString();
  const event:ZHistoryEvent={
    id:safeId(`${decisionKey}:${occurredAt}:REJECT:${input.sourceInferenceId}`),decisionKey,projectId,entityId,componentKey,supportKind,
    supportZMeters:Number.isFinite(input.supportZMeters)?Number(input.supportZMeters):null,
    offsetMeters:Number.isFinite(input.offsetMeters)?Number(input.offsetMeters):null,
    referencePoint:input.referencePoint||'UNSPECIFIED',
    absoluteReferenceZMeters:Number.isFinite(input.absoluteReferenceZMeters)?Number(input.absoluteReferenceZMeters):null,
    inferenceMethod:input.inferenceMethod,sourceInferenceId:input.sourceInferenceId,
    basis:(input.basis||[]).slice(0,12),sourceRefs:(input.sourceRefs||[]).slice(0,12),actorUserId,organizationId,actorRole,
    decision:'H2_REJECTED_INFERENCE',canonical:false,physicalTruth:false,occurredAt,
    ...(prior?{supersedesId:prior.id}:{})
  };
  events.push(event);writeAll(events);return event;
}

export function historicalZPrior(componentKey:string,input:{projectId:string;organizationId:string;supportKind:string;referencePoint?:ZHistoryReferencePoint}):ZHistoryPrior|null{
  const key=clean(componentKey).toLowerCase(),projectId=clean(input.projectId),organizationId=clean(input.organizationId),supportKind=clean(input.supportKind).toUpperCase();
  if(!key||!projectId||!organizationId||!supportKind)return null;
  const latestByDecision=new Map<string,ZHistoryEvent>();
  for(const event of readAll()){
    if(event.componentKey!==key||event.projectId!==projectId||event.organizationId!==organizationId||event.supportKind!==supportKind)continue;
    const prior=latestByDecision.get(event.decisionKey);
    if(!prior||Date.parse(event.occurredAt)>=Date.parse(prior.occurredAt))latestByDecision.set(event.decisionKey,event);
  }
  const latest=[...latestByDecision.values()].filter(event=>event.decision==='H2_ACCEPTED_INFERENCE'&&Number.isFinite(event.offsetMeters)&&Number.isFinite(event.supportZMeters)&&Number.isFinite(event.absoluteReferenceZMeters));
  const groups=new Map<ZHistoryReferencePoint,ZHistoryEvent[]>();
  for(const event of latest){
    if(input.referencePoint&&event.referencePoint!==input.referencePoint)continue;
    const group=groups.get(event.referencePoint)||[];group.push(event);groups.set(event.referencePoint,group);
  }
  const selected=input.referencePoint
    ?groups.get(input.referencePoint)||[]
    :[...groups.values()].sort((a,b)=>b.length-a.length||String(a[0]?.referencePoint||'').localeCompare(String(b[0]?.referencePoint||'')))[0]||[];
  if(selected.length<MIN_SAMPLES)return null;
  const referencePoint=selected[0].referencePoint;
  const offsets=selected.map(event=>Number(event.offsetMeters)),mean=offsets.reduce((sum,value)=>sum+value,0)/offsets.length;
  const variance=offsets.length>1?offsets.reduce((sum,value)=>sum+(value-mean)**2,0)/(offsets.length-1):0;
  return{n:selected.length,meanOffsetMeters:mean,medianOffsetMeters:median(offsets),stdMeters:Math.sqrt(Math.max(0,variance)),minOffsetMeters:Math.min(...offsets),maxOffsetMeters:Math.max(...offsets),supportKind,referencePoint,eventIds:selected.map(event=>event.id)};
}

export function historicalZConfidence(n:number,stdMeters=0):number{
  const sample=Math.min(.78,.45+.05*Math.min(Math.max(0,n),12));
  const consistency=Math.max(.35,Math.min(1,1-stdMeters/.5));
  return Math.min(.78,sample*consistency);
}

export function listConfirmedZEvents(){return readAll()}
export function clearZHistory(){memoryFallback=[];try{localStorage.removeItem(KEY)}catch{}}
export const clearConfirmedZ=clearZHistory;
