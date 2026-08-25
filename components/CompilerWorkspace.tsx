'use client';

import {ChangeEvent,useMemo,useState} from 'react';

type SourceFile={name:string;size:number;ext:string;discipline:string;sha256:string;status:'ready'|'review'};

const classify=(name:string)=>{
  const n=name.toLowerCase();
  if(/(^|[^a-z])e\d|elect|power|lighting/.test(n))return 'Electrical';
  if(/arch|floor|plan/.test(n))return 'Architectural';
  if(/mech|hvac/.test(n))return 'Mechanical';
  if(/plumb/.test(n))return 'Plumbing';
  return 'Unclassified';
};

export default function CompilerWorkspace(){
  const [files,setFiles]=useState<SourceFile[]>([]);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const totals=useMemo(()=>({files:files.length,bytes:files.reduce((n,f)=>n+f.size,0),review:files.filter(f=>f.status==='review').length}),[files]);

  async function addFiles(e:ChangeEvent<HTMLInputElement>){
    const incoming=Array.from(e.target.files||[]);if(!incoming.length)return;
    setBusy(true);const next:SourceFile[]=[];
    for(const file of incoming){
      const ext=(file.name.split('.').pop()||'').toLowerCase();
      const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
      const sha256=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
      next.push({name:file.name,size:file.size,ext,discipline:classify(file.name),sha256,status:['pdf','dwg','dxf','ifc','rvt','glb','gltf','png','jpg','jpeg'].includes(ext)?'ready':'review'});
    }
    setFiles(v=>[...v,...next]);setBusy(false);setMessage(`${next.length} source file${next.length===1?'':'s'} fingerprinted locally. Parsing and graph extraction can now be queued without altering the originals.`);
    e.target.value='';
  }

  return <div className="grid two" style={{marginTop:18}}>
    <div className="card">
      <div className="eyebrow">Engineering Source Ingestion</div><h2>Drop the project set</h2>
      <label style={{display:'grid',placeItems:'center',minHeight:220,border:'1px dashed #397391',borderRadius:16,background:'#07131f',cursor:'pointer',textAlign:'center',padding:24}}>
        <div><div style={{fontSize:34}}>⌁</div><b>{busy?'Fingerprinting files…':'Drag / choose CAD, BIM, PDF or imagery'}</b><p className="subtitle" style={{margin:'8px auto 0'}}>PDF · DWG · DXF · IFC · RVT · GLB · GLTF · PNG · JPG</p></div>
        <input hidden multiple type="file" accept=".pdf,.dwg,.dxf,.ifc,.rvt,.glb,.gltf,.png,.jpg,.jpeg" onChange={addFiles}/>
      </label>
      {message&&<div className="notice"><strong>READY</strong><span>{message}</span></div>}
      <div style={{marginTop:15}}>{files.map((f,i)=><div className="file-row" key={`${f.name}-${i}`}><div className="file-icon">{f.ext.toUpperCase()}</div><div><strong>{f.name}</strong><small>{f.discipline} · {(f.size/1024/1024).toFixed(2)} MB · SHA-256 {f.sha256.slice(0,16)}…</small></div><span className={f.status==='ready'?'proof':'pending'}>{f.status==='ready'?'READY':'REVIEW'}</span></div>)}</div>
    </div>
    <div className="card">
      <div className="eyebrow">Twin Compiler</div><h2>Compilation pipeline</h2>
      <div className="workflow-steps">
        {[['1','Source fingerprint','Preserve original file + immutable digest'],['2','Drawing intelligence','Title blocks · layers · symbols · tags · geometry'],['3','Cross-sheet graph','References · circuits · panels · systems · dependencies'],['4','Human validation','Confidence review · exceptions · corrections'],['5','Project graph','Rooms · systems · assets · relationships'],['6','Twin generation','Spatial + logical layers'],['7','Verified registration','Durable asset IDs + lifecycle hashes']].map(([n,t,d],i)=><div className={`workflow-step ${i<Math.min(2,files.length?2:0)?'done':''}`} key={n}><i>{n}</i><div><strong>{t}</strong><span>{d}</span></div></div>)}
      </div>
      <div className="grid stats" style={{gridTemplateColumns:'repeat(3,1fr)',marginTop:16}}><div className="card"><div className="label">Sources</div><div className="metric">{totals.files}</div></div><div className="card"><div className="label">Size</div><div className="metric">{(totals.bytes/1024/1024).toFixed(1)}</div><div className="muted">MB</div></div><div className="card"><div className="label">Review</div><div className="metric">{totals.review}</div></div></div>
    </div>
  </div>;
}
