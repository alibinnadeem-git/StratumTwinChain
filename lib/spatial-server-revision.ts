/**
 * Project-scoped server-revision base tracking for the browser working graph.
 *
 * A local graph may be edited while the server receives a newer append-only
 * snapshot from another session. The stored base revision is used only for
 * optimistic concurrency; it is not authority or verification state.
 */
const KEY='stratum_local_server_revisions_v2';
export const SERVER_NEWER_EVENT='stratum:server-newer-available';
export const SERVER_NEWER_RESOLVED_EVENT='stratum:server-newer-resolved';
export const SERVER_NEWER_STATE_KEY='stratum_server_newer_notice_v1';

export type ServerNewerDetail={
  revision:number;
  localRevision:number|null;
  storedAt:string|null;
  projectId:string;
  reason?:'SERVER_NEWER'|'LOCAL_BASE_UNKNOWN'|'REVISION_CONFLICT';
};

function readMap():Record<string,number>{
  try{
    const parsed=JSON.parse(localStorage.getItem(KEY)||'{}');
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return{};
    const out:Record<string,number>={};
    for(const [projectId,revision] of Object.entries(parsed as Record<string,unknown>)){
      const n=Number(revision);if(projectId&&Number.isInteger(n)&&n>=0)out[projectId]=n;
    }
    return out;
  }catch{return{}}
}
function writeMap(map:Record<string,number>){try{localStorage.setItem(KEY,JSON.stringify(map))}catch{}}

export function readLocalServerRevision(projectId:string):number|null{
  const id=String(projectId||'').trim();if(!id)return null;
  const value=readMap()[id];
  return Number.isInteger(value)&&value>=0?value:null;
}
export function writeLocalServerRevision(projectId:string,revision:number):void{
  const id=String(projectId||'').trim();
  if(!id||!Number.isInteger(revision)||revision<0)return;
  const map=readMap();map[id]=revision;writeMap(map);
}
export function clearLocalServerRevision(projectId:string):void{
  const id=String(projectId||'').trim();if(!id)return;
  const map=readMap();delete map[id];writeMap(map);
}
export function readServerNewerNotice():ServerNewerDetail|null{
  try{
    const parsed=JSON.parse(sessionStorage.getItem(SERVER_NEWER_STATE_KEY)||'null') as ServerNewerDetail|null;
    return parsed&&typeof parsed.projectId==='string'&&Number.isInteger(parsed.revision)?parsed:null;
  }catch{return null}
}
export function publishServerNewer(detail:ServerNewerDetail):void{
  try{sessionStorage.setItem(SERVER_NEWER_STATE_KEY,JSON.stringify(detail))}catch{}
  try{window.dispatchEvent(new CustomEvent(SERVER_NEWER_EVENT,{detail}))}catch{}
}
export function publishServerNewerResolved(projectId:string,revision:number):void{
  try{
    const current=readServerNewerNotice();
    if(!current||current.projectId===projectId)sessionStorage.removeItem(SERVER_NEWER_STATE_KEY);
  }catch{}
  try{window.dispatchEvent(new CustomEvent(SERVER_NEWER_RESOLVED_EVENT,{detail:{projectId,revision}}))}catch{}
}
