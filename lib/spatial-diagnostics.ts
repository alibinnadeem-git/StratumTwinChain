// Spatial pipeline diagnostics bus.
//
// Every stage of the Spatial render pipeline (parse -> z -> compile -> persist ->
// project -> render, plus the background graph worker) reports structured events
// here so that a silent failure or silent fallback becomes observable. The record
// is a bounded ring buffer kept on globalThis.__STRATUM_SPATIAL_DIAG so a dev HUD
// and Playwright specs can read it without any framework coupling.
//
// Recording is always on (it is cheap and must work in the production e2e build).
// Console mirroring and the dev HUD are gated by isSpatialDiagEnabled() so normal
// production users see nothing new.

export type SpatialDiagStage='parse'|'worker'|'z'|'compile'|'persist'|'project'|'render';
export type SpatialDiagLevel='info'|'warn'|'error';

export type SpatialDiagEvent={
  id:string;
  ts:number;
  stage:SpatialDiagStage;
  level:SpatialDiagLevel;
  code:string;
  message?:string;
  counts?:Record<string,number>;
  durationMs?:number;
  data?:Record<string,unknown>;
};

export type SpatialDiagStore={events:SpatialDiagEvent[];max:number};

export const SPATIAL_DIAG_GLOBAL='__STRATUM_SPATIAL_DIAG';
export const SPATIAL_DIAG_EVENT='stratum:spatial-diag';
export const SPATIAL_DIAG_FLAG_KEY='stratum_spatial_diag';

const MAX_EVENTS=750;
let seq=0;

function store():SpatialDiagStore{
  const scope=globalThis as unknown as Record<string,SpatialDiagStore|undefined>;
  let existing=scope[SPATIAL_DIAG_GLOBAL];
  if(!existing){existing={events:[],max:MAX_EVENTS};scope[SPATIAL_DIAG_GLOBAL]=existing}
  return existing;
}

function now():number{
  return typeof performance!=='undefined'&&typeof performance.now==='function'?performance.now():Date.now();
}

// Dev build, or an explicit localStorage flag ('1' forces on, '0' forces off).
// Controls console mirroring and dev-HUD visibility only, never recording.
export function isSpatialDiagEnabled():boolean{
  if(typeof window==='undefined')return false;
  try{
    const flag=window.localStorage.getItem(SPATIAL_DIAG_FLAG_KEY);
    if(flag==='1')return true;
    if(flag==='0')return false;
  }catch{}
  return process.env.NODE_ENV!=='production';
}

export function reportSpatialDiag(event:Omit<SpatialDiagEvent,'id'|'ts'>&{ts?:number}):SpatialDiagEvent{
  const full:SpatialDiagEvent={
    id:`${Date.now().toString(36)}-${(seq++).toString(36)}`,
    ts:event.ts??Date.now(),
    stage:event.stage,
    level:event.level,
    code:event.code,
    message:event.message,
    counts:event.counts,
    durationMs:event.durationMs,
    data:event.data,
  };
  try{
    const s=store();
    s.events.push(full);
    if(s.events.length>s.max)s.events.splice(0,s.events.length-s.max);
  }catch{}
  try{
    if(typeof window!=='undefined'){
      if(isSpatialDiagEnabled()){
        const line=`[stratum:spatial:${full.stage}] ${full.code}${full.message?` — ${full.message}`:''}`;
        const detail=full.counts||full.data;
        // eslint-disable-next-line no-console
        (full.level==='error'?console.error:full.level==='warn'?console.warn:console.info)(line,detail??'');
      }
      window.dispatchEvent(new CustomEvent(SPATIAL_DIAG_EVENT,{detail:full}));
    }
  }catch{}
  return full;
}

// Returns an elapsed-ms reader; pass its result as durationMs on the completion event.
export function startSpatialDiagTimer():()=>number{
  const started=now();
  return ()=>now()-started;
}

export function readSpatialDiag():SpatialDiagEvent[]{
  try{return [...store().events]}catch{return []}
}

export function clearSpatialDiag():void{
  try{store().events.length=0}catch{}
}
