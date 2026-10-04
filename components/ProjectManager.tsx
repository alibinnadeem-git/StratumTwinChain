'use client';

import Link from 'next/link';
import {useEffect,useState} from 'react';
import {writeSelectedSpatialProjectId} from '@/lib/spatial-project-selection';

type Project={
 id:string;
 project_code:string;
 name:string;
 client_name:string|null;
 location_label:string|null;
 status:'ACTIVE'|'PLANNING'|'COMMISSIONING'|'OPERATIONS'|'ARCHIVED';
 progress_percent:number;
 asset_count:number;
 latest_spatial_revision:number|null;
};

type Form={
 projectCode:string;
 name:string;
 clientName:string;
 locationLabel:string;
 status:'ACTIVE'|'PLANNING'|'COMMISSIONING'|'OPERATIONS';
};

export default function ProjectManager({canManage}:{canManage:boolean}){
 const [items,setItems]=useState<Project[]>([]);
 const [open,setOpen]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('Loading tenant projects…');
 const [selected,setSelected]=useState('');
 const [form,setForm]=useState<Form>({projectCode:'',name:'',clientName:'',locationLabel:'',status:'ACTIVE'});

 async function refresh(){
  const response=await fetch('/api/projects',{cache:'no-store',credentials:'same-origin'});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body?.error||('Project load failed ('+response.status+').'));
  setItems(body.projects||[]);
  setMessage(body.projects?.length?'Tenant projects loaded.':'No tenant projects exist yet.');
 }

 useEffect(()=>{
  try{setSelected(localStorage.getItem('stratum_spatial_project_id')||'')}catch{}
  void refresh().catch(error=>setMessage(error instanceof Error?error.message:'Unable to load tenant projects.'));
 },[]);

 async function create(){
  if(!canManage||busy)return;
  if(!form.projectCode.trim()||!form.name.trim()){
   setMessage('Project code and project name are required.');
   return;
  }
  setBusy(true);
  try{
   const response=await fetch('/api/projects',{
    method:'POST',
    headers:{'content-type':'application/json'},
    credentials:'same-origin',
    body:JSON.stringify(form)
   });
   const body=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(body?.error||('Project creation failed ('+response.status+').'));
   setForm({projectCode:'',name:'',clientName:'',locationLabel:'',status:'ACTIVE'});
   setOpen(false);
   setSelected(body.project.id);
   writeSelectedSpatialProjectId(body.project.id);
   await refresh();
   setMessage('Created '+body.project.project_code+' and selected it for Spatial.');
  }catch(error){
   setMessage(error instanceof Error?error.message:'Unable to create project.');
  }finally{
   setBusy(false);
  }
 }

 async function update(projectId:string,patch:Record<string,unknown>,success:string){
  if(!canManage||busy)return;
  setBusy(true);
  try{
   const response=await fetch('/api/projects',{
    method:'PATCH',
    headers:{'content-type':'application/json'},
    credentials:'same-origin',
    body:JSON.stringify({projectId,...patch})
   });
   const body=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(body?.error||('Project update failed ('+response.status+').'));
   await refresh();
   setMessage(success);
  }catch(error){
   setMessage(error instanceof Error?error.message:'Unable to update project.');
  }finally{
   setBusy(false);
  }
 }

 function useForSpatial(project:Project){
  writeSelectedSpatialProjectId(project.id);
  setSelected(project.id);
  setMessage(project.project_code+' is now the active project for Import and Spatial server persistence.');
 }

 return <>
  <div className="page-head">
   <div>
    <div className="eyebrow">Portfolio</div>
    <h1 className="title">Projects</h1>
    <p className="subtitle">Create the real tenant project once, then use the same organization-scoped identity across Import, Spatial, source backup and review persistence.</p>
   </div>
   {canManage&&<button type="button" className="action" onClick={()=>setOpen(value=>!value)}>{open?'Close':'New project'}</button>}
  </div>

  {open&&<section className="card" style={{marginBottom:16}} aria-label="Create tenant project">
   <div className="eyebrow">Create tenant project</div>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10,marginTop:10}}>
    <label><span>Project code</span><input aria-label="Project code" value={form.projectCode} onChange={event=>setForm(value=>({...value,projectCode:event.target.value}))} placeholder="e.g. SFO-DC-01"/></label>
    <label><span>Project name</span><input aria-label="Project name" value={form.name} onChange={event=>setForm(value=>({...value,name:event.target.value}))} placeholder="Project name"/></label>
    <label><span>Client</span><input aria-label="Client" value={form.clientName} onChange={event=>setForm(value=>({...value,clientName:event.target.value}))} placeholder="Optional"/></label>
    <label><span>Location</span><input aria-label="Location" value={form.locationLabel} onChange={event=>setForm(value=>({...value,locationLabel:event.target.value}))} placeholder="Optional"/></label>
    <label><span>Status</span><select aria-label="Project status" value={form.status} onChange={event=>setForm(value=>({...value,status:event.target.value as Form['status']}))}><option value="ACTIVE">Active</option><option value="PLANNING">Planning</option><option value="COMMISSIONING">Commissioning</option><option value="OPERATIONS">Operations</option></select></label>
   </div>
   <div className="button-row" style={{marginTop:12}}>
    <button type="button" className="action" onClick={create} disabled={busy}>Create & use for Spatial</button>
    <button type="button" className="ghost" onClick={()=>setOpen(false)} disabled={busy}>Cancel</button>
   </div>
  </section>}

  {message&&<div className="notice" role="status" style={{marginBottom:16}}><strong>PROJECT WORKSPACE</strong><span>{message}</span></div>}

  {!items.length?
   <section className="card">
    <div className="eyebrow">No tenant projects</div>
    <h2>Create the first real project</h2>
    <p className="muted">Spatial persistence, source vault backup and authenticated model recovery require a real organization-scoped project UUID. STRATUM will not invent one.</p>
   </section>
   :
   <div className="project-grid">{items.map(project=><article className="card project-card" key={project.id}>
    <div className="project-status">{project.status}</div>
    <div className="eyebrow">{project.project_code}</div>
    <h2>{project.name}</h2>
    <p className="muted">{project.client_name||'No client recorded'}<br/>{project.location_label||'No location recorded'}</p>
    <div className="progress"><i style={{width:project.progress_percent+'%'}}/></div>
    {canManage&&project.status!=='ARCHIVED'?
     <label className="muted" style={{display:'grid',gap:5,marginTop:10}}>
      Management progress
      <input
       aria-label={'Progress for '+project.project_code}
       type="range"
       min="0"
       max="100"
       value={project.progress_percent}
       disabled={busy}
       onChange={event=>void update(project.id,{progressPercent:Number(event.target.value)},'Updated '+project.project_code+' management progress.')}
      />
     </label>
     :
     <p className="muted">Management progress: {project.progress_percent}%</p>}

    <div className="project-kpis">
     <div><strong>{project.progress_percent}%</strong><span>Progress</span></div>
     <div><strong>{project.asset_count}</strong><span>Assets</span></div>
     <div><strong>{project.latest_spatial_revision?'r'+project.latest_spatial_revision:'—'}</strong><span>Spatial</span></div>
    </div>

    <div className="button-row" style={{marginTop:12}}>
     {project.status!=='ARCHIVED'&&<>
      <button type="button" className={selected===project.id?'action':'ghost'} onClick={()=>useForSpatial(project)}>{selected===project.id?'Selected for Spatial':'Use for Spatial'}</button>
      <Link className="ghost" href="/compiler" onClick={()=>useForSpatial(project)}>Open Import</Link>
     </>}
     {canManage&&project.status!=='ARCHIVED'&&<button type="button" className="ghost" disabled={busy} onClick={()=>void update(project.id,{status:'ARCHIVED'},'Archived '+project.project_code+'. Server records and provenance were retained.')}>Archive</button>}
     {canManage&&project.status==='ARCHIVED'&&<button type="button" className="ghost" disabled={busy} onClick={()=>void update(project.id,{status:'ACTIVE'},'Restored '+project.project_code+' to Active.')}>Restore</button>}
    </div>
   </article>)}</div>
  }

  <p className="muted" style={{marginTop:16}}>Project status and progress are management state only. They do not establish asset verification, DIR finality, PoVI finality or physical truth. Archived tenant projects are retained rather than destructively deleted.</p>
 </>;
}
