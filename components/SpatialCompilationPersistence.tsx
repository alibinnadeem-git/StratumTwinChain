'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';

type Project={id:string;project_code:string;name:string};
type LatestCompilation={
  id:string;
  project_id:string;
  revision:number;
  graph_sha256:string;
  graph_version:string;
  source_count:number;
  entity_count:number;
  link_count:number;
  source_sha256s:string[];
  graph_json:unknown;
  created_at:string;
  review_action:'ACCEPT_REVIEW_BASELINE'|'REOPEN_REVIEW'|null;
  review_reason:string|null;
  review_occurred_at:string|null;
};
type CompilationResponse={
  schemaReady:boolean;
  truthBoundary:string;
  projects:Project[];
  latest:LatestCompilation|null;
  error?:string;
};

type LocalGraph={version:string;createdAt:string;sources:unknown[];entities:unknown[];links:unknown[];stats:Record<string,number>};
const PROJECT_KEY='stratum_spatial_project_id';

function shortHash(value:string|undefined){return value?`${value.slice(0,12)}…${value.slice(-8)}`:'—';}
function timestamp(value:string|undefined|null){return value?new Date(value).toLocaleString():'—';}

function readLocalGraph():LocalGraph{
  const raw=localStorage.getItem('stratum_compiled_graph');
  if(!raw)throw new Error('No compiled Spatial graph is saved in this browser yet. Compile or review sources first.');
  const graph=JSON.parse(raw) as Partial<LocalGraph>;
  if(!graph||typeof graph!=='object'||typeof graph.version!=='string'||!Array.isArray(graph.sources)||!Array.isArray(graph.entities)||!Array.isArray(graph.links)||!graph.stats||typeof graph.stats!=='object'){
    throw new Error('The saved browser graph is not a valid STRATUM Spatial compilation. Existing data was not changed.');
  }
  return graph as LocalGraph;
}

export default function SpatialCompilationPersistence(){
  const [projects,setProjects]=useState<Project[]>([]);
  const [projectId,setProjectId]=useState('');
  const [schemaReady,setSchemaReady]=useState<boolean|null>(null);
  const [latest,setLatest]=useState<LatestCompilation|null>(null);
  const [message,setMessage]=useState('Loading server review workspace…');
  const [reason,setReason]=useState('');
  const [busy,setBusy]=useState(false);
  const [loadArmed,setLoadArmed]=useState(false);

  const accepted=latest?.review_action==='ACCEPT_REVIEW_BASELINE';
  const selectedProject=useMemo(()=>projects.find(project=>project.id===projectId)||null,[projects,projectId]);

  const refresh=useCallback(async(nextProjectId?:string)=>{
    const selected=nextProjectId??projectId;
    const url=selected?`/api/spatial/compilations?projectId=${encodeURIComponent(selected)}`:'/api/spatial/compilations';
    const response=await fetch(url,{cache:'no-store'});
    const body=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(body?.error||`Server review workspace failed (${response.status}).`);
    const data=body as CompilationResponse;
    setProjects(data.projects||[]);
    setSchemaReady(Boolean(data.schemaReady));
    setLatest(data.latest||null);
    if(!selected&&data.projects?.length){
      const first=data.projects[0].id;
      setProjectId(first);
      try{localStorage.setItem(PROJECT_KEY,first)}catch{}
      return refresh(first);
    }
    setMessage(data.schemaReady
      ?data.latest?`Loaded server review snapshot revision ${data.latest.revision}.`:'No server review snapshot exists for this project yet.'
      :'Server persistence schema is not deployed in this environment yet. Browser compilation remains unchanged.');
  },[projectId]);

  useEffect(()=>{
    let active=true;
    (async()=>{
      try{await refresh();}
      catch(error){if(active){setSchemaReady(null);setMessage(error instanceof Error?error.message:'Unable to load the server review workspace.');}}
    })();
    return()=>{active=false};
  },[]); // Explicitly load server state once; compilation saves remain user-triggered.

  async function selectProject(next:string){
    setProjectId(next);try{if(next)localStorage.setItem(PROJECT_KEY,next);else localStorage.removeItem(PROJECT_KEY)}catch{};setLatest(null);setLoadArmed(false);setReason('');setMessage('Loading project review history…');
    try{await refresh(next)}catch(error){setMessage(error instanceof Error?error.message:'Unable to load project review history.');}
  }

  async function saveSnapshot(){
    if(!projectId||busy)return;
    setBusy(true);setLoadArmed(false);
    try{
      const graph=readLocalGraph();
      const response=await fetch('/api/spatial/compilations',{
        method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId,graph})
      });
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body?.error||`Snapshot save failed (${response.status}).`);
      await refresh(projectId);
      setMessage(body.idempotent?'This exact compilation already exists on the server; no duplicate revision was created.':`Saved Spatial review snapshot revision ${body.revision}. Human review is still required.`);
    }catch(error){setMessage(error instanceof Error?error.message:'Unable to save the Spatial review snapshot.');}
    finally{setBusy(false);}
  }

  function loadServerSnapshot(){
    if(!latest)return;
    if(!loadArmed){setLoadArmed(true);setMessage('Loading will replace the browser working graph with this server snapshot. Select “Confirm load” to continue.');return;}
    try{
      const graph=latest.graph_json as Partial<LocalGraph>;
      if(!graph||!Array.isArray(graph.sources)||!Array.isArray(graph.entities)||!Array.isArray(graph.links))throw new Error('The server snapshot is malformed; browser data was not changed.');
      localStorage.setItem('stratum_compiled_graph',JSON.stringify(graph));
      window.dispatchEvent(new Event('stratum:graph-updated'));
      setLoadArmed(false);
      setMessage(`Loaded server revision ${latest.revision} into the browser review workspace. This did not create or verify any STRATUM Asset.`);
    }catch(error){setLoadArmed(false);setMessage(error instanceof Error?error.message:'Unable to load the server review snapshot.');}
  }

  async function review(action:'ACCEPT_REVIEW_BASELINE'|'REOPEN_REVIEW'){
    if(!latest||busy)return;
    const cleaned=reason.trim();
    if(cleaned.length<5){setMessage('Enter a review reason of at least 5 characters.');return;}
    setBusy(true);setLoadArmed(false);
    try{
      const response=await fetch('/api/spatial/compilations',{
        method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({compilationId:latest.id,action,reason:cleaned})
      });
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body?.error||`Review update failed (${response.status}).`);
      setReason('');
      await refresh(projectId);
      setMessage(action==='ACCEPT_REVIEW_BASELINE'
        ?'Accepted as a Spatial review baseline. This is not Verified infrastructure state and does not create a DIR or PoVI finality.'
        :'Review reopened. Downstream consumers must treat this compilation as requiring renewed human review.');
    }catch(error){setMessage(error instanceof Error?error.message:'Unable to update the review state.');}
    finally{setBusy(false);}
  }

  return <section className="card" style={{marginTop:16}} aria-label="Spatial compilation server review">
    <div className="section-head"><div><div className="eyebrow">Server-backed Spatial review</div><h2>Persist the reviewed project graph</h2></div><span className={accepted?'proof':'pending'}>{accepted?'REVIEW BASELINE ACCEPTED':'REVIEW REQUIRED'}</span></div>
    <p className="muted">When a real tenant project is connected, STRATUM now protects the browser working graph with idempotent append-only server snapshots. Accepting a review baseline remains a separate human action and does not create a STRATUM Asset, DIR finality or physical truth.</p>

    <div className="spec-grid">
      <label><span>Project</span><select aria-label="Spatial compilation project" value={projectId} onChange={event=>selectProject(event.target.value)} disabled={busy||!projects.length}><option value="">Select project</option>{projects.map(project=><option value={project.id} key={project.id}>{project.project_code} · {project.name}</option>)}</select></label>
      <div><span>Persistence</span><strong>{schemaReady===true?'SERVER READY':schemaReady===false?'SCHEMA NOT DEPLOYED':'UNAVAILABLE / SIGN-IN REQUIRED'}</strong></div>
      <div><span>Latest revision</span><strong>{latest?`r${latest.revision}`:'—'}</strong></div>
      <div><span>Graph fingerprint</span><strong className="mono" title={latest?.graph_sha256}>{shortHash(latest?.graph_sha256)}</strong></div>
      <div><span>Sources / entities / links</span><strong>{latest?`${latest.source_count} / ${latest.entity_count} / ${latest.link_count}`:'—'}</strong></div>
      <div><span>Stored</span><strong>{timestamp(latest?.created_at)}</strong></div>
    </div>

    <div className="button-row" style={{marginTop:14}}>
      <button className="action" type="button" onClick={saveSnapshot} disabled={busy||!projectId||schemaReady!==true}>Save review snapshot</button>
      {latest&&<button className={loadArmed?'action':'ghost'} type="button" onClick={loadServerSnapshot} disabled={busy}>{loadArmed?'Confirm load':'Load server snapshot'}</button>}
      {loadArmed&&<button className="ghost" type="button" onClick={()=>{setLoadArmed(false);setMessage('Server snapshot load cancelled; browser working graph was unchanged.');}} disabled={busy}>Cancel load</button>}
    </div>

    {latest&&<div className="card" style={{marginTop:14,padding:14}}>
      <div className="eyebrow">Human review state</div>
      <p className="muted">{accepted?`Accepted ${timestamp(latest.review_occurred_at)}${latest.review_reason?` · ${latest.review_reason}`:''}`:'This server revision is not an accepted Spatial review baseline.'}</p>
      <label className="field-label" htmlFor="spatial-review-reason">Review reason</label>
      <textarea id="spatial-review-reason" aria-label="Spatial compilation review reason" rows={3} minLength={5} maxLength={500} value={reason} onChange={event=>setReason(event.target.value)} placeholder={accepted?'Explain why this compilation must be reopened for review.':'Describe what was reviewed and why this compilation may be used as the Spatial review baseline.'}/>
      <div className="button-row" style={{marginTop:10}}>
        <button type="button" className="action" disabled={busy} onClick={()=>review(accepted?'REOPEN_REVIEW':'ACCEPT_REVIEW_BASELINE')}>{accepted?'Reopen review':'Accept as Spatial review baseline'}</button>
      </div>
    </div>}

    {!projects.length&&<p className="muted">No organization-scoped server projects are available. Create/connect a real tenant project before persisting a compilation; the interface will not invent a project identifier.</p>}
    {selectedProject&&<p className="muted" style={{marginBottom:0}}>Selected: {selectedProject.project_code} · {selectedProject.name}</p>}
    {message&&<div className="notice" role="status" style={{marginTop:12}}><strong>SPATIAL REVIEW</strong><span>{message}</span></div>}
  </section>;
}
