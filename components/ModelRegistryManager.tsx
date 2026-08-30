'use client';

import {ChangeEvent,useEffect,useMemo,useState} from 'react';
import {ELECTRICAL_CATEGORIES,ELECTRICAL_COMPONENTS} from '@/lib/electrical-component-library';
import {DEFAULT_ELECTRICAL_MODEL_REGISTRY,ELECTRICAL_MODEL_REGISTRY_STORAGE_KEY,ElectricalModelConfig,normalizeElectricalModelRegistry} from '@/lib/electrical-model-registry';

const box:React.CSSProperties={border:'1px solid #173a4c',background:'#08151f',borderRadius:14,padding:16};
const field:React.CSSProperties={width:'100%',background:'#061019',border:'1px solid #1d465a',borderRadius:8,color:'#d9eef7',padding:'9px 10px'};
const btn:React.CSSProperties={background:'#163146',border:'1px solid #245b73',borderRadius:9,color:'#d9eef7',padding:'9px 12px',cursor:'pointer'};

export default function ModelRegistryManager(){
 const [registry,setRegistry]=useState<ElectricalModelConfig[]>(DEFAULT_ELECTRICAL_MODEL_REGISTRY);
 const [query,setQuery]=useState('');
 const [category,setCategory]=useState('ALL');
 const [selected,setSelected]=useState(ELECTRICAL_COMPONENTS[0]?.key||'');
 const [message,setMessage]=useState('');
 useEffect(()=>{try{const raw=localStorage.getItem(ELECTRICAL_MODEL_REGISTRY_STORAGE_KEY);if(raw)setRegistry(normalizeElectricalModelRegistry(JSON.parse(raw)));}catch{}},[]);
 const current=registry.find(x=>x.componentKey===selected)||registry[0];
 const component=ELECTRICAL_COMPONENTS.find(x=>x.key===selected);
 const mapped=registry.filter(x=>x.modelUrl.trim()).length;
 const visible=useMemo(()=>ELECTRICAL_COMPONENTS.filter(c=>(category==='ALL'||c.category===category)&&(!query||`${c.name} ${c.aliases.join(' ')}`.toLowerCase().includes(query.toLowerCase()))),[category,query]);
 function persist(next:ElectricalModelConfig[]){setRegistry(next);localStorage.setItem(ELECTRICAL_MODEL_REGISTRY_STORAGE_KEY,JSON.stringify(next));}
 function patch(update:Partial<ElectricalModelConfig>){if(!current)return;persist(registry.map(x=>x.componentKey===current.componentKey?{...x,...update}:x));}
 function tuplePatch(key:'rotation'|'offset',index:number,value:string){if(!current)return;const copy=[...current[key]] as [number,number,number];copy[index]=Number(value)||0;patch({[key]:copy} as any);}
 function reset(){persist(DEFAULT_ELECTRICAL_MODEL_REGISTRY);setMessage('Registry reset to procedural fallbacks.');}
 function exportJson(){const blob=new Blob([JSON.stringify(registry,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='stratum-electrical-model-registry.json';a.click();URL.revokeObjectURL(url);}
 async function importJson(e:ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];if(!file)return;try{const next=normalizeElectricalModelRegistry(JSON.parse(await file.text()));persist(next);setMessage(`Imported ${next.filter(x=>x.modelUrl).length} mapped 3D models.`);}catch{setMessage('Registry import failed: invalid JSON.');}e.target.value='';}
 return <section style={{...box,marginTop:18}} aria-label="3D Asset Registry">
  <div style={{display:'flex',gap:16,justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap'}}>
   <div><span style={{color:'#38e59c',fontWeight:800,letterSpacing:2,fontSize:12}}>REAL 3D ASSET REGISTRY</span><h2 style={{margin:'6px 0'}}>GLB / GLTF / OpenUSD Model Mapping</h2><p style={{maxWidth:850,color:'#89a9b8',margin:0}}>Assign a reusable detailed 3D model to each canonical electrical class. Twin Compiler can then instantiate the correct equipment family at recognized drawing coordinates while retaining the procedural model as a guaranteed fallback.</p></div>
   <div style={{display:'flex',gap:10,alignItems:'center'}}><strong style={{fontSize:30}}>{mapped}/{registry.length}</strong><span style={{color:'#89a9b8'}}>classes mapped</span></div>
  </div>
  <div style={{display:'grid',gridTemplateColumns:'minmax(260px,360px) minmax(0,1fr)',gap:16,marginTop:18}} className="model-registry-grid">
   <div style={box}>
    <input aria-label="Search component models" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search component class…" style={field}/>
    <select aria-label="Filter model category" value={category} onChange={e=>setCategory(e.target.value)} style={{...field,marginTop:8}}><option value="ALL">All categories</option>{ELECTRICAL_CATEGORIES.map(x=><option key={x}>{x}</option>)}</select>
    <div style={{maxHeight:520,overflow:'auto',marginTop:10,display:'grid',gap:6}}>{visible.map(c=>{const cfg=registry.find(x=>x.componentKey===c.key);return <button key={c.key} onClick={()=>setSelected(c.key)} style={{...btn,textAlign:'left',background:selected===c.key?'#0e4438':'#0a1a25'}}><div style={{display:'flex',justifyContent:'space-between',gap:10}}><b>{c.name}</b><span style={{color:cfg?.modelUrl?'#38e59c':'#6f8995'}}>{cfg?.modelUrl?'MODEL':'FALLBACK'}</span></div><small style={{color:'#7896a3'}}>{c.category}</small></button>})}</div>
   </div>
   {current&&component?<div style={box}>
    <div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><div><h3 style={{margin:'0 0 4px'}}>{component.name}</h3><small style={{color:'#7896a3'}}>{component.key} · fallback: {component.twinShape}</small></div><b style={{color:current.modelUrl?'#38e59c':'#e2a857'}}>{current.modelUrl?'DETAILED MODEL ACTIVE':'PROCEDURAL FALLBACK'}</b></div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 150px 120px',gap:10,marginTop:16}} className="registry-fields"><label>Model URL<input value={current.modelUrl} onChange={e=>patch({modelUrl:e.target.value})} placeholder="/models/electrical/transformer.glb or https://…" style={field}/></label><label>Format<select value={current.format} onChange={e=>patch({format:e.target.value as any})} style={field}><option>GLB</option><option>GLTF</option><option>USD</option><option>USDZ</option></select></label><label>Scale<input type="number" step="0.01" min="0.01" value={current.scale} onChange={e=>patch({scale:Number(e.target.value)||1})} style={field}/></label></div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginTop:12}} className="registry-fields"><fieldset style={{...box,padding:12}}><legend>Rotation °</legend><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>{['X','Y','Z'].map((n,i)=><label key={n}>{n}<input type="number" value={current.rotation[i]} onChange={e=>tuplePatch('rotation',i,e.target.value)} style={field}/></label>)}</div></fieldset><fieldset style={{...box,padding:12}}><legend>Position offset</legend><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>{['X','Y','Z'].map((n,i)=><label key={n}>{n}<input type="number" step="0.01" value={current.offset[i]} onChange={e=>tuplePatch('offset',i,e.target.value)} style={field}/></label>)}</div></fieldset></div>
    <div style={{display:'grid',gridTemplateColumns:'150px 1fr',gap:10,marginTop:12}} className="registry-fields"><label>LOD<select value={current.lod||'MEDIUM'} onChange={e=>patch({lod:e.target.value as any})} style={field}><option>LOW</option><option>MEDIUM</option><option>HIGH</option></select></label><label>Source / license<input value={current.source||''} onChange={e=>patch({source:e.target.value})} placeholder="Manufacturer BIM, STRATUM model, licensed source…" style={field}/></label></div>
    <label style={{display:'block',marginTop:12}}>Notes<textarea value={current.notes||''} onChange={e=>patch({notes:e.target.value})} rows={3} style={field}/></label>
    <div style={{display:'flex',gap:8,marginTop:14,flexWrap:'wrap'}}><button style={btn} onClick={exportJson}>Export registry</button><label style={{...btn,display:'inline-block'}}>Import registry<input type="file" accept="application/json,.json" onChange={importJson} hidden/></label><button style={btn} onClick={reset}>Reset fallbacks</button></div>{message&&<p style={{color:'#38e59c'}}>{message}</p>}
   </div>:null}
  </div>
  <style jsx global>{`@media(max-width:900px){.model-registry-grid{grid-template-columns:1fr!important}.registry-fields{grid-template-columns:1fr!important}}`}</style>
 </section>;
}
