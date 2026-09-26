'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import {readPrimarySpatialGraph} from '@/lib/spatial-browser-recovery';
import {
 listArchivedSourceMetadata,
 readArchivedSource,
 SOURCE_ARCHIVE_EVENT,
 type ArchivedSourceMetadata,
} from '@/lib/source-browser-archive';
import {
 listProjectVaultSources,
 restoreProjectSourceToBrowser,
 uploadArchivedSourceToProject,
 type ProjectVaultSource,
} from '@/lib/spatial-project-source-vault-client';
import {
 readSelectedSpatialProjectId,
 SPATIAL_PROJECT_SELECTION_EVENT,
 writeSelectedSpatialProjectId,
} from '@/lib/spatial-project-selection';

type Project={id:string;project_code?:string;name?:string};
type GraphSource={name:string;sha256:string;ext?:string;size?:number};

function uniqueSources(sources:GraphSource[]){
 const map=new Map<string,GraphSource>();
 for(const source of sources){
  const sha=String(source.sha256||'').toLowerCase();
  if(/^[a-f0-9]{64}$/.test(sha)&&!map.has(sha))map.set(sha,{...source,sha256:sha});
 }
 return[...map.values()];
}

export default function SpatialProjectSourceVault(){
 const [projects,setProjects]=useState<Project[]>([]);
 const [projectId,setProjectId]=useState('');
 const [schemaReady,setSchemaReady]=useState<boolean|null>(null);
 const [serverSources,setServerSources]=useState<ProjectVaultSource[]>([]);
 const [localSources,setLocalSources]=useState<ArchivedSourceMetadata[]>([]);
 const [graphSources,setGraphSources]=useState<GraphSource[]>([]);
 const [message,setMessage]=useState('Loading project source protection…');
 const [busy,setBusy]=useState(false);

 const refresh=useCallback(async(preferredProjectId?:string)=>{
  const [local,graph]=await Promise.all([listArchivedSourceMetadata(),readPrimarySpatialGraph()]);
  const current=uniqueSources((graph?.sources||[]) as GraphSource[]);
  setLocalSources(local);setGraphSources(current);
  try{
   const response=await fetch('/api/spatial/compilations',{cache:'no-store',credentials:'same-origin'});
   const body=await response.json().catch(()=>({}));
   if(response.status===401||response.status===403){
    setProjects([]);setSchemaReady(null);setServerSources([]);setMessage('Sign in to protect project source files on the server.');
    return;
   }
   if(!response.ok)throw new Error(body?.error||`Project lookup failed (${response.status}).`);
   const nextProjects=(body.projects||[]) as Project[];
   setProjects(nextProjects);
   let selected=preferredProjectId||readSelectedSpatialProjectId();
   if(!nextProjects.some(project=>project.id===selected)){
    const restorable=String(body.restorableProjectId||'');
    selected=nextProjects.length===1?nextProjects[0].id:nextProjects.some(project=>project.id===restorable)?restorable:'';
   }
   setProjectId(selected);
   if(selected)writeSelectedSpatialProjectId(selected);
   if(!selected){
    setSchemaReady(null);setServerSources([]);setMessage(nextProjects.length?'Select a tenant project before backing up source files.':'No tenant projects are available.');
    return;
   }
   const vault=await listProjectVaultSources(selected);
   setSchemaReady(Boolean(vault.schemaReady));setServerSources(vault.sources||[]);
   setMessage(vault.schemaReady?'Project source vault is ready. Backups are explicit and private to this tenant project.':'Project source vault schema is not deployed yet; browser-local source protection remains active.');
  }catch(error){
   setSchemaReady(null);setServerSources([]);setMessage(error instanceof Error?error.message:'Project source vault is unavailable.');
  }
 },[]);

 useEffect(()=>{
  void refresh();
  const onArchive=()=>void refresh(projectId||undefined);
  const onGraph=()=>void refresh(projectId||undefined);
  const onProject=(event:Event)=>{
   const next=String((event as CustomEvent<{projectId?:string}>).detail?.projectId||'');
   if(next&&next!==projectId)void refresh(next);
  };
  window.addEventListener(SOURCE_ARCHIVE_EVENT,onArchive);
  window.addEventListener('stratum:graph-updated',onGraph);
  window.addEventListener(SPATIAL_PROJECT_SELECTION_EVENT,onProject);
  return()=>{
   window.removeEventListener(SOURCE_ARCHIVE_EVENT,onArchive);
   window.removeEventListener('stratum:graph-updated',onGraph);
   window.removeEventListener(SPATIAL_PROJECT_SELECTION_EVENT,onProject);
  };
 },[projectId,refresh]);

 const localBySha=useMemo(()=>new Map(localSources.map(source=>[source.sha256.toLowerCase(),source])),[localSources]);
 const verifiedBySha=useMemo(()=>new Map(serverSources.filter(source=>source.complete).map(source=>[source.sha256.toLowerCase(),source])),[serverSources]);
 const currentLocal=useMemo(()=>graphSources.filter(source=>localBySha.has(source.sha256)),[graphSources,localBySha]);
 const currentServer=useMemo(()=>graphSources.filter(source=>verifiedBySha.has(source.sha256)),[graphSources,verifiedBySha]);
 const uploadable=useMemo(()=>graphSources.filter(source=>localBySha.has(source.sha256)&&!verifiedBySha.has(source.sha256)),[graphSources,localBySha,verifiedBySha]);
 const restoreCandidates=useMemo(()=>{
  const scope=graphSources.length?graphSources.map(source=>source.sha256):serverSources.filter(source=>source.complete).map(source=>source.sha256.toLowerCase());
  const allowed=new Set(scope);
  return serverSources.filter(source=>source.complete&&allowed.has(source.sha256.toLowerCase())&&!localBySha.has(source.sha256.toLowerCase()));
 },[graphSources,serverSources,localBySha]);
 const selectedProject=useMemo(()=>projects.find(project=>project.id===projectId)||null,[projects,projectId]);

 async function selectProject(next:string){
  setProjectId(next);writeSelectedSpatialProjectId(next);setMessage('Loading project source vault…');
  await refresh(next);
 }

 async function backup(){
  if(!projectId||busy||schemaReady!==true||!uploadable.length)return;
  setBusy(true);
  let completed=0;
  try{
   for(const source of uploadable){
    const archived=await readArchivedSource(source.sha256);
    if(!archived)continue;
    await uploadArchivedSourceToProject(projectId,archived,setMessage);
    completed++;
   }
   await refresh(projectId);
   setMessage(`Protected ${completed} source${completed===1?'':'s'} in the tenant project vault. Byte integrity is verified; engineering meaning and physical truth remain unchanged.`);
  }catch(error){
   await refresh(projectId);
   setMessage(error instanceof Error?error.message:'Project source backup failed.');
  }finally{setBusy(false)}
 }

 async function restore(){
  if(busy||!restoreCandidates.length)return;
  setBusy(true);
  let completed=0;
  try{
   for(const source of restoreCandidates){
    await restoreProjectSourceToBrowser(source,setMessage);
    completed++;
   }
   await refresh(projectId);
   setMessage(`Restored ${completed} verified source${completed===1?'':'s'} into this browser's protected local archive. Stale drawings can now be reprocessed with the current compiler.`);
  }catch(error){
   await refresh(projectId);
   setMessage(error instanceof Error?error.message:'Project source restore failed.');
  }finally{setBusy(false)}
 }

 return <section className="card" style={{marginTop:16}} aria-label="Project source vault">
  <div className="section-head">
   <div><div className="eyebrow">Project source protection</div><h2>Keep original project files recoverable</h2></div>
   <span className={schemaReady===true?'proof':'pending'}>{schemaReady===true?'SERVER VAULT READY':'LOCAL FALLBACK'}</span>
  </div>
  <p className="muted">Browser-local copies keep parsing fast and offline-capable. For signed-in tenant projects, you can explicitly copy those exact SHA-256 source bytes into a private server vault and restore them on another device before reprocessing. No source is uploaded automatically.</p>

  <div className="spec-grid">
   <label><span>Project</span><select aria-label="Project source vault project" value={projectId} onChange={event=>void selectProject(event.target.value)} disabled={busy||!projects.length}><option value="">Select project</option>{projects.map(project=><option key={project.id} value={project.id}>{project.project_code||'PROJECT'} · {project.name||project.id}</option>)}</select></label>
   <div><span>Current graph sources</span><strong>{graphSources.length}</strong></div>
   <div><span>Protected in this browser</span><strong>{currentLocal.length}</strong></div>
   <div><span>Verified on server</span><strong>{currentServer.length}</strong></div>
   <div><span>Need server backup</span><strong>{uploadable.length}</strong></div>
   <div><span>Recoverable from server</span><strong>{restoreCandidates.length}</strong></div>
  </div>

  <div className="button-row" style={{marginTop:14}}>
   <button className="action" type="button" onClick={()=>void backup()} disabled={busy||schemaReady!==true||!projectId||!uploadable.length}>{busy?'Working…':'Back up local project sources'}</button>
   <button className="ghost" type="button" onClick={()=>void restore()} disabled={busy||!restoreCandidates.length}>Restore server sources to this browser</button>
   <button className="ghost" type="button" onClick={()=>void refresh(projectId||undefined)} disabled={busy}>Refresh source status</button>
  </div>

  {selectedProject&&<p className="muted" style={{marginBottom:0}}>Selected tenant project: {selectedProject.project_code||'PROJECT'} · {selectedProject.name||selectedProject.id}</p>}
  <p className="spatial-review-boundary">Source-vault verification proves exact byte preservation only. It does not identify installed equipment, establish drawing scale/alignment/Z, approve engineering use, create a STRATUM Asset, finalize a DIR, or establish PoVI/physical truth.</p>
  {message&&<div className="notice" role="status" style={{marginTop:12}}><strong>SOURCE VAULT</strong><span>{message}</span></div>}
 </section>;
}
