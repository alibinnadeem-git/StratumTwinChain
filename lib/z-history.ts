/**
 * Browser-local review evidence for inferred equipment Z.
 *
 * Historical learning is deliberately NOT authoritative. Records are retained as
 * review events so STRATUM can explain which human decisions informed a prior.
 * Priors are derived only from the latest decision for unique project/entity
 * pairs and from normalized offsets relative to a named support datum.
 */
export type ZHistoryReferencePoint='BASE'|'CENTERLINE'|'MOUNTING_POINT'|'GRADE'|'FLOOR_DATUM'|'UNSPECIFIED';

export type ZHistoryEvent={
  id:string;
  decisionKey:string;
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
  basis:string[];
  sourceRefs:unknown[];
  actorUserId:string;
  organizationId:string;
  actorRole:string;
  decision:'H2_ACCEPTED_INFERENCE';
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
    return parsed.filter((event:ZHistoryEvent)=>event&&event.physicalTruth===false&&event.canonical===false&&event.decision==='H2_ACCEPTED_INFERENCE'&&Boolean(event.actorUserId)&&Boolean(event.organizationId)&&Number.isFinite(event.offsetMeters)&&Number.isFinite(event.supportZMeters));
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

export function historicalZPrior(componentKey:string,input:{projectId:string;supportKind:string;referencePoint?:ZHistoryReferencePoint}):ZHistoryPrior|null{
  const key=clean(componentKey).toLowerCase(),projectId=clean(input.projectId),supportKind=clean(input.supportKind).toUpperCase();
  if(!key||!projectId||!supportKind)return null;
  const latestByDecision=new Map<string,ZHistoryEvent>();
  for(const event of readAll()){
    if(event.componentKey!==key||event.projectId!==projectId||event.supportKind!==supportKind)continue;
    if(input.referencePoint&&event.referencePoint!==input.referencePoint)continue;
    const prior=latestByDecision.get(event.decisionKey);
    if(!prior||Date.parse(event.occurredAt)>=Date.parse(prior.occurredAt))latestByDecision.set(event.decisionKey,event);
  }
  const events=[...latestByDecision.values()];
  if(events.length<MIN_SAMPLES)return null;
  const offsets=events.map(event=>event.offsetMeters),mean=offsets.reduce((sum,value)=>sum+value,0)/offsets.length;
  const variance=offsets.length>1?offsets.reduce((sum,value)=>sum+(value-mean)**2,0)/(offsets.length-1):0;
  const referenceCounts=new Map<ZHistoryReferencePoint,number>();
  for(const event of events)referenceCounts.set(event.referencePoint,(referenceCounts.get(event.referencePoint)||0)+1);
  const referencePoint=[...referenceCounts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||'UNSPECIFIED';
  return{n:events.length,meanOffsetMeters:mean,medianOffsetMeters:median(offsets),stdMeters:Math.sqrt(Math.max(0,variance)),minOffsetMeters:Math.min(...offsets),maxOffsetMeters:Math.max(...offsets),supportKind,referencePoint,eventIds:events.map(event=>event.id)};
}

export function historicalZConfidence(n:number,stdMeters=0):number{
  const sample=Math.min(.78,.45+.05*Math.min(Math.max(0,n),12));
  const consistency=Math.max(.35,Math.min(1,1-stdMeters/.5));
  return Math.min(.78,sample*consistency);
}

export function listConfirmedZEvents(){return readAll()}
export function clearZHistory(){memoryFallback=[];try{localStorage.removeItem(KEY)}catch{}}
export const clearConfirmedZ=clearZHistory;
