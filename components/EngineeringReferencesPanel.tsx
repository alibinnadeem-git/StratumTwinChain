'use client';

import Link from 'next/link';
import {FormEvent,useEffect,useMemo,useState} from 'react';

type Published={id:string;publisher:string;code:string;edition:string|null;title:string;category:string;publisherUrl:string;applicability:string};
type Project={id:string;project_code:string;name:string;site_id:string|null;site_name:string|null;location_label:string|null};
type Applicability={id:string;project_id:string;site_id:string|null;reference_type:string;publisher:string;reference_code:string;title:string;edition:string|null;jurisdiction_label:string|null;authority_class:string;applicability_status:string;effective_date:string|null;source_url:string|null;notes:string|null;created_at:string};
type Oem={id:string;manufacturer_name:string;model_pattern:string|null;document_type:string;title:string;revision:string|null;published_at:string|null;source_url:string|null;authority_class:string;created_at:string};
type Data={publishedReferences:Published[];projects:Project[];applicability:Applicability[];oemReferences:Oem[];error?:string};

export default function EngineeringReferencesPanel(){
 const [data,setData]=useState<Data|null>(null),[message,setMessage]=useState('Loading engineering references…'),[busy,setBusy]=useState(false),[projectId,setProjectId]=useState('');
 async function refresh(nextProjectId=projectId){
  try{
   const url='/api/engineering/references'+(nextProjectId?'?projectId='+encodeURIComponent(nextProjectId):'');
   const response=await fetch(url,{cache:'no-store'});const body=await response.json().catch(()=>({}));
   if(response.status===401){setData(null);setMessage('Sign in to view tenant-scoped applicability and OEM references.');return}
   if(!response.ok)throw new Error(body?.error||'Unable to load engineering references');
   setData(body as Data);setMessage('Publisher references and tenant records loaded.');
   if(!nextProjectId&&body.projects?.length){const first=body.projects[0].id;setProjectId(first)}
  }catch(error){setData(null);setMessage(error instanceof Error?error.message:'Unable to load engineering references.')}
 }
 useEffect(()=>{void refresh('')},[]);

 const sites=useMemo(()=>data?.projects.filter(item=>item.id===projectId&&item.site_id)||[],[data,projectId]);

 async function addApplicability(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;setBusy(true);const form=new FormData(event.currentTarget);
  try{
   const body={type:'APPLICABILITY',projectId:String(form.get('projectId')||''),siteId:String(form.get('siteId')||'')||null,referenceType:String(form.get('referenceType')||'CODE_STANDARD'),publisher:String(form.get('publisher')||''),referenceCode:String(form.get('referenceCode')||''),title:String(form.get('title')||''),edition:String(form.get('edition')||'')||null,jurisdictionLabel:String(form.get('jurisdictionLabel')||'')||null,authorityClass:String(form.get('authorityClass')||'PUBLISHED_REFERENCE'),applicabilityStatus:String(form.get('applicabilityStatus')||'REFERENCE'),effectiveDate:String(form.get('effectiveDate')||'')||null,sourceUrl:String(form.get('sourceUrl')||'')||null,notes:String(form.get('notes')||'')||null};
   const response=await fetch('/api/engineering/references',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const json=await response.json().catch(()=>({}));if(!response.ok)throw new Error(json?.error||'Unable to save applicability record');
   event.currentTarget.reset();setMessage('Applicability record appended. Published reference and project applicability remain separate.');await refresh(body.projectId);
  }catch(error){setMessage(error instanceof Error?error.message:'Unable to save applicability record.')}finally{setBusy(false)}
 }

 async function addOem(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;setBusy(true);const form=new FormData(event.currentTarget);
  try{
   const body={type:'OEM',manufacturerName:String(form.get('manufacturerName')||''),modelPattern:String(form.get('modelPattern')||'')||null,documentType:String(form.get('documentType')||'DATASHEET'),title:String(form.get('title')||''),revision:String(form.get('revision')||'')||null,publishedAt:String(form.get('publishedAt')||'')||null,sourceUrl:String(form.get('sourceUrl')||'')||null,authorityClass:String(form.get('authorityClass')||'OEM_PUBLISHED'),metadata:{}};
   const response=await fetch('/api/engineering/references',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const json=await response.json().catch(()=>({}));if(!response.ok)throw new Error(json?.error||'Unable to save OEM reference');
   event.currentTarget.reset();setMessage('OEM reference appended with explicit authority class.');await refresh(projectId);
  }catch(error){setMessage(error instanceof Error?error.message:'Unable to save OEM reference.')}finally{setBusy(false)}
 }

 return <>
  <section className="card" style={{marginBottom:16}}>
   <div className="section-head"><div><div className="eyebrow">Engineering knowledge</div><h2>Standards, AHJ applicability & OEM sources</h2></div><span className="pending">REFERENCE ≠ APPROVAL</span></div>
   <p className="muted">Publisher editions are reference metadata. A code/standard becomes project-applicable only through an explicit site/AHJ/contract record. OEM-published material, project-approved submittals and historical references also remain distinct authority classes.</p>
   {data?.projects?.length?<label>Project<select value={projectId} onChange={event=>{setProjectId(event.target.value);void refresh(event.target.value)}}><option value="">All projects</option>{[...new Map(data.projects.map(item=>[item.id,item])).values()].map(item=><option key={item.id} value={item.id}>{item.project_code} · {item.name}</option>)}</select></label>:null}
   {message&&<div className="notice" role="status" style={{marginTop:12}}><strong>REFERENCES</strong><span>{message}</span></div>}
  </section>

  {data&&<div className="grid two">
   <section className="card"><div className="eyebrow">Published reference catalog</div><h3>Publisher versions</h3><div className="activity-list">{data.publishedReferences.map(item=><div className="file-row" key={item.id}><div className="file-icon">{item.publisher.slice(0,4)}</div><div><strong>{item.code} · {item.edition||'Current'}</strong><small>{item.title}</small></div><span className="pending">REFERENCE</span></div>)}</div></section>
   <section className="card"><div className="eyebrow">Project applicability</div><h3>Recorded governing context</h3>{data.applicability.length?<div className="activity-list">{data.applicability.map(item=><div className="file-row" key={item.id}><div className="file-icon">{item.authority_class==='AHJ_ADOPTED'?'AHJ':'REF'}</div><div><strong>{item.reference_code} {item.edition||''}</strong><small>{item.title} · {item.jurisdiction_label||'Jurisdiction not recorded'}</small></div><span className={item.applicability_status==='APPLICABLE'?'proof':'pending'}>{item.applicability_status}</span></div>)}</div>:<p className="muted">No tenant applicability records are stored for this scope yet.</p>}</section>
  </div>}

  {data&&<section className="card" style={{marginTop:16}}><div className="eyebrow">OEM / project references</div><h3>Source authority registry</h3>{data.oemReferences.length?<div className="activity-list">{data.oemReferences.map(item=><div className="file-row" key={item.id}><div className="file-icon">OEM</div><div><strong>{item.manufacturer_name} · {item.title}</strong><small>{item.model_pattern||'All / unspecified models'} · {item.document_type}{item.revision?' · rev '+item.revision:''}</small></div><span className={item.authority_class==='PROJECT_SUBMITTAL'?'proof':'pending'}>{item.authority_class.replaceAll('_',' ')}</span></div>)}</div>:<p className="muted">No OEM/project reference documents are registered yet.</p>}</section>}

  {data&&<details className="secondary-details card"><summary>Add governed reference records</summary>
   <div className="grid two" style={{marginTop:12}}>
    <form onSubmit={addApplicability} className="card" style={{display:'grid',gap:9}}>
     <div className="eyebrow">Project / AHJ applicability</div>
     <label>Project<select name="projectId" required defaultValue={projectId}>{[...new Map(data.projects.map(item=>[item.id,item])).values()].map(item=><option key={item.id} value={item.id}>{item.project_code} · {item.name}</option>)}</select></label>
     <label>Site<select name="siteId"><option value="">Project-wide</option>{sites.map(site=><option key={site.site_id!} value={site.site_id!}>{site.site_name}</option>)}</select></label>
     <label>Reference type<select name="referenceType"><option>CODE_STANDARD</option><option>ZONING</option><option>FIRE_LIFE_SAFETY</option><option>PROJECT_SPEC</option><option>OWNER_STANDARD</option><option>OEM_REQUIREMENT</option></select></label>
     <label>Publisher<input name="publisher" required/></label><label>Code / reference<input name="referenceCode" required/></label><label>Title<input name="title" required/></label><label>Edition<input name="edition"/></label>
     <label>Authority<select name="authorityClass"><option>PUBLISHED_REFERENCE</option><option>AHJ_ADOPTED</option><option>CONTRACTUAL</option><option>OWNER_REQUIREMENT</option><option>OEM</option></select></label>
     <label>Status<select name="applicabilityStatus"><option>REFERENCE</option><option>REVIEW_REQUIRED</option><option>APPLICABLE</option><option>SUPERSEDED</option></select></label>
     <label>Jurisdiction / AHJ<input name="jurisdictionLabel"/></label><label>Effective date<input name="effectiveDate" type="date"/></label><label>Source URL<input name="sourceUrl" type="url"/></label><label>Notes<textarea name="notes" rows={3}/></label>
     <button className="action" type="submit" disabled={busy}>Append applicability record</button>
    </form>
    <form onSubmit={addOem} className="card" style={{display:'grid',gap:9}}>
     <div className="eyebrow">OEM / project document</div>
     <label>Manufacturer<input name="manufacturerName" required/></label><label>Model / pattern<input name="modelPattern"/></label>
     <label>Document type<select name="documentType"><option>DATASHEET</option><option>INSTALLATION</option><option>OPERATION</option><option>MAINTENANCE</option><option>SUBMITTAL</option><option>WARRANTY</option><option>OTHER</option></select></label>
     <label>Title<input name="title" required/></label><label>Revision<input name="revision"/></label><label>Published date<input name="publishedAt" type="date"/></label><label>Source URL<input name="sourceUrl" type="url"/></label>
     <label>Authority<select name="authorityClass"><option>OEM_PUBLISHED</option><option>PROJECT_SUBMITTAL</option><option>HISTORICAL_REFERENCE</option></select></label>
     <button className="action" type="submit" disabled={busy}>Append OEM reference</button>
    </form>
   </div>
  </details>}
  {!data&&<p className="muted"><Link href="/login">Sign in</Link> to use tenant-scoped standards/OEM governance.</p>}
 </>;
}
