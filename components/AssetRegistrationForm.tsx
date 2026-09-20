'use client';

import {FormEvent,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';

type Project={id:string;project_code:string;name:string};
type Site={id:string;project_id:string;name:string};
type System={id:string;project_id:string;name:string};
type Manufacturer={id:string;name:string};

export default function AssetRegistrationForm({
 projects,sites,systems,manufacturers,initialName='',initialType=''
}:{
 projects:Project[];sites:Site[];systems:System[];manufacturers:Manufacturer[];
 initialName?:string;initialType?:string;
}){
 const router=useRouter();
 const [projectId,setProjectId]=useState(projects[0]?.id||'');
 const [siteId,setSiteId]=useState('');
 const [systemId,setSystemId]=useState('');
 const [manufacturerId,setManufacturerId]=useState('');
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const availableSites=useMemo(()=>sites.filter(site=>site.project_id===projectId),[sites,projectId]);
 const availableSystems=useMemo(()=>systems.filter(system=>system.project_id===projectId),[systems,projectId]);

 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setMessage('');
  const data=new FormData(event.currentTarget);
  try{
   const response=await fetch('/api/assets',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({
     projectId,siteId,
     systemId:systemId||null,
     manufacturerId:manufacturerId||null,
     assetCode:String(data.get('assetCode')||'').trim(),
     assetType:String(data.get('assetType')||'').trim(),
     name:String(data.get('name')||'').trim(),
     model:String(data.get('model')||'').trim()||undefined,
     serialNumber:String(data.get('serialNumber')||'').trim()||undefined,
     locationLabel:String(data.get('locationLabel')||'').trim()||undefined,
     specifications:{registrationSource:'AUTHORIZED_HUMAN_REGISTRATION'}
    })
   });
   const body=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(body.error||'Unable to register asset');
   setMessage('Asset registered. Opening its Passport and QR identity…');
   router.push('/assets/'+encodeURIComponent(body.id));
   router.refresh();
  }catch(error){setMessage(error instanceof Error?error.message:'Unable to register asset');setBusy(false);}
 }

 if(!projects.length)return <div className="notice"><strong>PROJECT REQUIRED</strong><span>Create a live tenant project and site before registering equipment.</span></div>;

 return <form className="card" onSubmit={submit} style={{display:'grid',gap:12}}>
  <div className="eyebrow">Durable asset registration</div>
  <h2 style={{margin:0}}>Create the registry identity first</h2>
  <p className="muted" style={{marginTop:0}}>Registration creates an Asset Passport and QR identity only. It does not approve installation, create a finalized DIR, or establish physical truth.</p>
  <label>Project<select required value={projectId} onChange={event=>{setProjectId(event.target.value);setSiteId('');setSystemId('')}}><option value="">Choose project</option>{projects.map(item=><option key={item.id} value={item.id}>{item.project_code} · {item.name}</option>)}</select></label>
  <label>Site<select required value={siteId} onChange={event=>setSiteId(event.target.value)}><option value="">Choose site</option>{availableSites.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
  <label>System<select value={systemId} onChange={event=>setSystemId(event.target.value)}><option value="">Unassigned</option>{availableSystems.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
  <label>Manufacturer<select value={manufacturerId} onChange={event=>setManufacturerId(event.target.value)}><option value="">Not yet known</option>{manufacturers.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
  <div className="grid two">
   <label>Asset code<input name="assetCode" required minLength={2} maxLength={80} placeholder="LP-1"/></label>
   <label>Asset type<input name="assetType" required minLength={2} maxLength={80} defaultValue={initialType} placeholder="PANELBOARD"/></label>
   <label>Asset name<input name="name" required minLength={2} maxLength={160} defaultValue={initialName} placeholder="Lighting Panel LP-1"/></label>
   <label>Model<input name="model" maxLength={120} placeholder="Optional"/></label>
   <label>Serial number<input name="serialNumber" maxLength={120} placeholder="Optional"/></label>
   <label>Location<input name="locationLabel" maxLength={160} placeholder="Electrical Room 101"/></label>
  </div>
  <button className="action" type="submit" disabled={busy||!projectId||!siteId}>{busy?'Registering…':'Register asset & create QR identity'}</button>
  {message&&<div className="notice" role="status"><strong>REGISTRATION</strong><span>{message}</span></div>}
 </form>;
}
