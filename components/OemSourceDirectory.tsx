'use client';
import {useEffect,useMemo,useState} from 'react';
import {OEM_SOURCES} from '@/lib/oem-source-catalog';
import {OEM_CAD_CANDIDATES} from '@/lib/oem-cad-candidates';
import {ELECTRICAL_COMPONENTS} from '@/lib/electrical-component-library';
import {DEFAULT_ELECTRICAL_MODEL_REGISTRY,ELECTRICAL_MODEL_REGISTRY_STORAGE_KEY,normalizeElectricalModelRegistry,oemModelBinding} from '@/lib/electrical-model-registry';
import styles from './OemSourceDirectory.module.css';

export default function OemSourceDirectory(){
 const [search,setSearch]=useState(''),[evidence,setEvidence]=useState('ALL');
 const [registry,setRegistry]=useState(DEFAULT_ELECTRICAL_MODEL_REGISTRY);
 useEffect(()=>{const refresh=()=>{try{const raw=localStorage.getItem(ELECTRICAL_MODEL_REGISTRY_STORAGE_KEY);setRegistry(normalizeElectricalModelRegistry(raw?JSON.parse(raw):null))}catch{setRegistry(DEFAULT_ELECTRICAL_MODEL_REGISTRY)}};refresh();window.addEventListener('stratum:model-registry-updated',refresh);return()=>window.removeEventListener('stratum:model-registry-updated',refresh)},[]);
 const components=new Map(ELECTRICAL_COMPONENTS.map(item=>[item.key,item.name]));
 const models=new Map(registry.map(item=>[item.componentKey,item]));
 const visible=useMemo(()=>OEM_SOURCES.filter(source=>(evidence==='ALL'||source.evidence===evidence)&&`${source.manufacturer} ${source.families.join(' ')} ${source.fields.join(' ')} ${source.formats.join(' ')} ${OEM_CAD_CANDIDATES.filter(item=>item.sourceId===source.id).map(item=>`${item.sku} ${item.product}`).join(' ')}`.toLowerCase().includes(search.trim().toLowerCase())),[search,evidence]);
 function exportSources(){const payload=JSON.stringify({format:'STRATUM_OEM_SOURCE_DIRECTORY',researchedAt:'2026-09-24',records:visible},null,2);const url=URL.createObjectURL(new Blob([payload],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='stratum-oem-sources.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 function inspectModel(key:string){window.dispatchEvent(new CustomEvent('stratum:select-model-registry',{detail:{componentKey:key}}));document.getElementById('spatial-3d-asset-registry')?.scrollIntoView({behavior:'smooth',block:'start'})}
 return <section className={styles.directory} aria-label="OEM source directory">
  <div className={styles.head}><div><span className={styles.eyebrow}>MANUFACTURER RESEARCH · 24 SEPTEMBER 2026</span><h2>OEM data and model sources</h2><p>Find a manufacturer’s technical catalog, product data, drawings or BIM/CAD portal. These links are discovery records. Model files and ratings enter a project only after an exact product, document revision and reuse rights have been checked.</p></div><strong>{OEM_SOURCES.length} sources</strong></div>
  <div className={styles.filters}><label>Find a manufacturer or family<input aria-label="Search OEM sources" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Switchgear, chargers, chillers, pumps…"/></label><label>Source type<select aria-label="Filter OEM source type" value={evidence} onChange={e=>setEvidence(e.target.value)}><option value="ALL">All source types</option><option value="CAD_BIM_PORTAL">CAD / BIM portals</option><option value="PRODUCT_DOCUMENTS">Product documents</option></select></label></div>
  <div className={styles.actions}><p className={styles.count}>{visible.length} matching source{visible.length===1?'':'s'}</p><button type="button" onClick={exportSources}>Export matching sources as JSON</button></div>
  <div className={styles.grid}>{visible.map(source=>{const binding=oemModelBinding(source.id,registry);return <article className={styles.card} key={source.id}>
   <div className={styles.title}><h3>{source.manufacturer}</h3><span>{source.evidence==='CAD_BIM_PORTAL'?'CAD / BIM SOURCE':'DOCUMENT SOURCE'}</span></div>
   <p>{source.families.join(' · ')}</p>
   <div className={styles.tags}>{source.formats.map(format=><span key={format}>{format}</span>)}</div>
   <div className={styles.detail}><b>Fields to capture</b><span>{source.fields.join(' · ')}</span></div>
   <div className={styles.detail}><b>Acquisition</b><span>{source.access}</span></div>
   <div className={styles.detail}><b>Spatial 3D Asset Registry</b><span>{binding?.status==='CLASS_PENDING'?'Class mapping pending':binding?.status==='MODEL_PENDING'?'Class linked · 3D model pending':'Class linked · 3D model mapped; inspect provenance'}</span></div>
   {OEM_CAD_CANDIDATES.filter(item=>item.sourceId===source.id).map(item=><div className={styles.detail} key={item.id}><b>Exact product · {item.sku}</b><span><a href={item.productUrl} target="_blank" rel="noopener noreferrer">{item.product} ↗</a> · {item.cadFormat} · {item.status==='CAD_DOWNLOAD_IDENTIFIED'?'CAD download identified; file not imported':'Manufacturer product identified; CAD file not imported'}{item.dimensionsMeters?` · W × H × D: ${item.dimensionsMeters.map(n=>`${n*1000} mm`).join(' × ')}`:''}</span></div>)}
   {source.componentKeys.length>0&&<div className={styles.detail}><b>Library classes</b><span>{source.componentKeys.map((key,i)=><span key={key}>{i>0?' · ':''}<a href={`#${key}`}>{components.get(key)||key}</a>{models.get(key)?.modelUrl?` (${models.get(key)?.geometryStatus==='LICENSED_COMMUNITY'?'community model':models.get(key)?.geometryStatus==='OEM_SUPPLIED'?'OEM model':'STRATUM visualization'})`:''}</span>)}</span></div>}
   {source.componentKeys.length>0&&<button type="button" className={styles.inspect} onClick={()=>inspectModel(source.componentKeys[0])}>Inspect 3D registry mapping</button>}
   <a className={styles.sourceLink} href={source.url} target="_blank" rel="noopener noreferrer">Open official source ↗</a>
  </article>})}</div>
  {!visible.length&&<p className={styles.empty}>No listed source matches. Try a broader equipment family.</p>}
  <p className={styles.footer}>Public catalogs do not establish the exact equipment installed on a STRATUM Power project. Bind an OEM SKU, regional datasheet, revision, nameplate or approved submittal to each asset; retain the source URL and file hash. Revit, STEP and CAD files need a separate validated conversion to GLB for the web viewer.</p>
 </section>;
}
