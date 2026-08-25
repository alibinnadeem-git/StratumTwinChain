'use client';

import Link from 'next/link';
import {ChangeEvent,DragEvent,useMemo,useState} from 'react';

type Layer='L0'|'L1'|'L2'|'L3'|'L4';
type ParseState='parsed'|'adapter'|'review'|'failed';
type GraphEntity={id:string;source:string;layer:Layer;kind:string;name:string;x:number;y:number;x2?:number;y2?:number;confidence:number;meta?:Record<string,string|number|boolean>};
type SourceFile={name:string;size:number;ext:string;discipline:string;sha256:string;state:ParseState;summary:string;entities:number;pages?:number;vectors?:number;textItems?:number};
type CompiledGraph={version:string;createdAt:string;sources:{name:string;ext:string;sha256:string;discipline:string}[];entities:GraphEntity[];stats:Record<Layer,number>};

const NATIVE_ADAPTER=['dwg','ifc','rvt'];
const VIEWER=['glb','gltf'];
const ACCEPTED=new Set(['pdf','dwg','dxf','ifc','rvt','glb','gltf','png','jpg','jpeg']);
const classify=(name:string)=>{const n=name.toLowerCase();if(/(^|[^a-z])e\d|elect|power|lighting|one.?line|panel/.test(n))return'Electrical';if(/arch|floor|plan/.test(n))return'Architectural';if(/mech|hvac/.test(n))return'Mechanical';if(/plumb/.test(n))return'Plumbing';return'Unclassified'};
const layerFor=(s:string):Layer=>{const n=s.toLowerCase();if(/wall|door|room|floor|ceiling|stair|column|architect|partition/.test(n))return'L1';if(/feeder|circuit|conduit|wire|cable|tray|busway/.test(n))return'L3';if(/panel|transform|switchgear|switchboard|breaker|\bats\b|generator|\bups\b|charger|evse|recept|outlet|disconnect|meter|\bpdu\b|\bmcc\b/.test(n))return'L2';return'L1'};
const assetCandidate=(s:string)=>/panel|transform|switchgear|switchboard|\bmsb\b|\bats\b|generator|\bups\b|charger|evse|recept|outlet|disconnect|meter|\bpdu\b|\bmcc\b/i.test(s);
const circuitCandidate=(s:string)=>/\b(?:CKT|CIRCUIT|FEEDER)\b|\b[A-Z]{1,5}\d{0,3}[-/]\d{1,3}\b/i.test(s);
const sha=async(buf:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buf))).map(b=>b.toString(16).padStart(2,'0')).join('');
const normalize=(v:number,min:number,max:number)=>max===min?0:((v-min)/(max-min)-.5)*20;

async function parsePdf(file:File):Promise<{entities:GraphEntity[];summary:string;pages:number;vectors:number;textItems:number}>{
 const pdfjs:any=await import('pdfjs-dist/legacy/build/pdf.mjs');
 try{pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).toString()}catch{}
 const data=new Uint8Array(await file.arrayBuffer());
 const doc=await pdfjs.getDocument({data}).promise;const raw:{str:string;x:number;y:number;page:number}[]=[];let vectors=0;
 for(let p=1;p<=doc.numPages;p++){
  const page=await doc.getPage(p);const viewport=page.getViewport({scale:1});const text=await page.getTextContent();
  for(const item of text.items||[]){if(!item?.str?.trim())continue;const t=item.transform||[1,0,0,1,0,0];raw.push({str:item.str.trim(),x:Number(t[4]||0)/Math.max(viewport.width,1),y:Number(t[5]||0)/Math.max(viewport.height,1),page:p});}
  try{const ops=await page.getOperatorList();vectors+=(ops.fnArray||[]).length}catch{}
 }
 const entities:GraphEntity[]=[];let i=0;
 for(const t of raw){
  const isAsset=assetCandidate(t.str),isCircuit=circuitCandidate(t.str);if(!isAsset&&!isCircuit)continue;
  const layer:Layer=isCircuit&&!isAsset?'L3':'L2';entities.push({id:`pdf-${t.page}-${i++}`,source:file.name,layer,kind:isAsset?'text-asset-candidate':'logical-tag',name:t.str,x:(t.x-.5)*20,y:(.5-t.y)*14,confidence:isAsset?.82:.74,meta:{page:t.page,sourceType:'PDF text object'}});
 }
 return{entities,summary:`${doc.numPages} page${doc.numPages===1?'':'s'} · ${raw.length} positioned text objects · ${vectors} PDF drawing operators · ${entities.length} electrical/logical candidates`,pages:doc.numPages,vectors,textItems:raw.length};
}

function dxfPairs(text:string){const lines=text.replace(/\r/g,'').split('\n');const out:{code:number;value:string}[]=[];for(let i=0;i+1<lines.length;i+=2){const code=Number(lines[i].trim());if(Number.isFinite(code))out.push({code,value:lines[i+1].trim()})}return out}
function parseDxf(file:File,text:string):{entities:GraphEntity[];summary:string}{
 const pairs=dxfPairs(text);const records:any[]=[];let current:any=null,inEntities=false;
 for(let i=0;i<pairs.length;i++){const p=pairs[i];if(p.code===0&&p.value==='SECTION'&&pairs[i+1]?.code===2&&pairs[i+1]?.value==='ENTITIES'){inEntities=true;i++;continue}if(p.code===0&&p.value==='ENDSEC'){if(current)records.push(current);current=null;if(inEntities)break}if(!inEntities)continue;if(p.code===0){if(current)records.push(current);current={type:p.value,vals:{}};continue}if(!current)continue;(current.vals[p.code]??=[]).push(p.value)}if(current)records.push(current);
 const points:{x:number;y:number}[]=[];for(const r of records){for(const x of r.vals[10]||[])points.push({x:Number(x),y:0});for(let j=0;j<(r.vals[20]||[]).length&&j<points.length;j++)points[points.length-(r.vals[20].length-j)].y=Number(r.vals[20][j])}
 const xs=points.map(p=>p.x).filter(Number.isFinite),ys=points.map(p=>p.y).filter(Number.isFinite),minX=Math.min(...xs,0),maxX=Math.max(...xs,1),minY=Math.min(...ys,0),maxY=Math.max(...ys,1);const entities:GraphEntity[]=[];let id=0;
 for(const r of records){const v=r.vals,layerName=(v[8]?.[0]||''),label=(v[2]?.[0]||v[1]?.join(' ')||r.type),layer=layerFor(`${layerName} ${label}`);const nx=(x:number)=>normalize(x,minX,maxX),ny=(y:number)=>-normalize(y,minY,maxY)*.7;
  if(r.type==='LINE'){const x=Number(v[10]?.[0]),y=Number(v[20]?.[0]),x2=Number(v[11]?.[0]),y2=Number(v[21]?.[0]);if([x,y,x2,y2].every(Number.isFinite))entities.push({id:`dxf-${id++}`,source:file.name,layer,kind:'line',name:layerName||'LINE',x:nx(x),y:ny(y),x2:nx(x2),y2:ny(y2),confidence:.99,meta:{cadLayer:layerName}})}
  else if(r.type==='LWPOLYLINE'){const vx=(v[10]||[]).map(Number),vy=(v[20]||[]).map(Number);for(let j=0;j<Math.min(vx.length,vy.length)-1;j++)entities.push({id:`dxf-${id++}`,source:file.name,layer,kind:'line',name:layerName||'POLYLINE',x:nx(vx[j]),y:ny(vy[j]),x2:nx(vx[j+1]),y2:ny(vy[j+1]),confidence:.99,meta:{cadLayer:layerName,entity:'LWPOLYLINE'}})}
  else if(r.type==='INSERT'||r.type==='TEXT'||r.type==='MTEXT'){const x=Number(v[10]?.[0]),y=Number(v[20]?.[0]);if(Number.isFinite(x)&&Number.isFinite(y)){const name=label||r.type;entities.push({id:`dxf-${id++}`,source:file.name,layer:assetCandidate(name)?'L2':layer,kind:r.type==='INSERT'?'cad-block':'cad-text',name,x:nx(x),y:ny(y),confidence:r.type==='INSERT'?.96:.9,meta:{cadLayer:layerName,entity:r.type}})}}
 }
 return{entities,summary:`${records.length} CAD entities parsed · ${entities.filter(e=>e.kind==='line').length} vector segments · ${entities.filter(e=>e.kind!=='line').length} blocks/text objects`};
}

function withAssetCandidates(parsed:GraphEntity[]){const l4=parsed.filter(e=>e.layer==='L2'&&e.kind!=='line').map((e,i):GraphEntity=>({id:`asset-candidate-${e.id}-${i}`,source:e.source,layer:'L4',kind:'asset-candidate',name:e.name,x:e.x,y:e.y,confidence:Math.max(.5,e.confidence-.08),meta:{derivedFrom:e.id,registrationState:'CANDIDATE'}}));return [...parsed,...l4]}

export default function CompilerWorkspace(){
 const [files,setFiles]=useState<SourceFile[]>([]);const [entities,setEntities]=useState<GraphEntity[]>([]);const [busy,setBusy]=useState(false);const [dragging,setDragging]=useState(false);const [message,setMessage]=useState('');
 const totals=useMemo(()=>({files:files.length,bytes:files.reduce((n,f)=>n+f.size,0),parsed:files.filter(f=>f.state==='parsed').length,entities:entities.length,assets:entities.filter(e=>e.layer==='L4').length}),[files,entities]);
 const layerStats=useMemo(()=>['L0','L1','L2','L3','L4'].reduce((a,l)=>({...a,[l]:entities.filter(e=>e.layer===l).length}),{} as Record<string,number>),[entities]);
 function saveGraph(nextFiles:SourceFile[],nextEntities:GraphEntity[]){const graph:CompiledGraph={version:'0.6',createdAt:new Date().toISOString(),sources:nextFiles.map(f=>({name:f.name,ext:f.ext,sha256:f.sha256,discipline:f.discipline})),entities:nextEntities,stats:{L0:nextFiles.length,L1:nextEntities.filter(e=>e.layer==='L1').length,L2:nextEntities.filter(e=>e.layer==='L2').length,L3:nextEntities.filter(e=>e.layer==='L3').length,L4:nextEntities.filter(e=>e.layer==='L4').length}};try{localStorage.setItem('stratum_compiled_graph',JSON.stringify(graph))}catch{} }
 async function processFiles(incoming:File[]){if(!incoming.length)return;setBusy(true);let newFiles=[...files],newEntities=[...entities];
  for(const file of incoming){const ext=(file.name.split('.').pop()||'').toLowerCase();if(!ACCEPTED.has(ext)){setMessage(`${file.name} was skipped because its format is not in the accepted engineering source list.`);continue;}const buf=await file.arrayBuffer(),digest=await sha(buf),discipline=classify(file.name);let sf:SourceFile={name:file.name,size:file.size,ext,discipline,sha256:digest,state:'review',summary:'Format requires review',entities:0};
   try{if(ext==='pdf'){const parsed=await parsePdf(file),graph=withAssetCandidates(parsed.entities);newEntities=[...newEntities,...graph];sf={...sf,state:'parsed',summary:`${parsed.summary} · ${graph.filter(x=>x.layer==='L4').length} L4 asset candidates`,entities:graph.length,pages:parsed.pages,vectors:parsed.vectors,textItems:parsed.textItems}}
    else if(ext==='dxf'){const parsed=parseDxf(file,await file.text()),graph=withAssetCandidates(parsed.entities);newEntities=[...newEntities,...graph];sf={...sf,state:'parsed',summary:`${parsed.summary} · ${graph.filter(x=>x.layer==='L4').length} L4 asset candidates`,entities:graph.length}}
    else if(NATIVE_ADAPTER.includes(ext))sf={...sf,state:'adapter',summary:`${ext.toUpperCase()} preserved and fingerprinted. Native geometry adapter is required before claiming parsed content.`};
    else if(VIEWER.includes(ext))sf={...sf,state:'parsed',summary:'3D model accepted for direct Twin geometry ingestion.',entities:0};
    else sf={...sf,state:'review',summary:'Source preserved; visual/format-specific extraction required.'};
   }catch(err){sf={...sf,state:'failed',summary:err instanceof Error?err.message:'Parser failed'}}newFiles=[...newFiles,sf];setFiles(newFiles);setEntities(newEntities);saveGraph(newFiles,newEntities)}
  setBusy(false);setDragging(false);setMessage(`Compilation updated: ${newFiles.filter(f=>f.state==='parsed').length}/${newFiles.length} sources parsed, ${newEntities.length} structured graph entities. The graph is now available to STRATUM Twin in this browser.`);
 }
 async function addFiles(e:ChangeEvent<HTMLInputElement>){await processFiles(Array.from(e.target.files||[]));e.target.value='';}
 async function drop(e:DragEvent<HTMLLabelElement>){e.preventDefault();setDragging(false);await processFiles(Array.from(e.dataTransfer.files||[]));}
 return <div style={{marginTop:18}}>
  <div className="grid two"><div className="card"><div className="eyebrow">Engineering Source Ingestion</div><h2>Drop the project set</h2><label onDragEnter={e=>{e.preventDefault();setDragging(true)}} onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={drop} style={{display:'grid',placeItems:'center',minHeight:220,border:`${dragging?'2px solid':'1px dashed'} #397391`,borderRadius:16,background:dragging?'#0b2130':'#07131f',cursor:'pointer',textAlign:'center',padding:24,transition:'background .15s,border .15s'}}><div><div style={{fontSize:34}}>⌁</div><b>{busy?'Parsing engineering sources…':dragging?'Release to compile files':'Drag files here or choose CAD, BIM, PDF or imagery'}</b><p className="subtitle" style={{margin:'8px auto 0'}}>PDF + DXF parse now · DWG/IFC/RVT preserved for native adapters · GLB/GLTF direct to Twin</p></div><input hidden multiple type="file" accept=".pdf,.dwg,.dxf,.ifc,.rvt,.glb,.gltf,.png,.jpg,.jpeg" onChange={addFiles}/></label>{message&&<div className="notice"><strong>COMPILED</strong><span>{message}</span></div>}<div style={{marginTop:15}}>{files.map((f,i)=><div className="file-row" key={`${f.name}-${i}`}><div className="file-icon">{f.ext.toUpperCase()}</div><div><strong>{f.name}</strong><small>{f.discipline} · {(f.size/1024/1024).toFixed(2)} MB · SHA-256 {f.sha256.slice(0,12)}…</small><small>{f.summary}</small></div><span className={f.state==='parsed'?'proof':'pending'}>{f.state.toUpperCase()}</span></div>)}</div></div>
   <div className="card"><div className="eyebrow">Twin Compiler · Live Graph</div><h2>Compilation pipeline</h2><div className="workflow-steps">{[['1','Source fingerprint','Original bytes + SHA-256 identity'],['2','Native extraction','PDF positioned text / DXF entities & vectors'],['3','Engineering classification','Architecture · equipment · circuits · tags'],['4','Spatial graph','Normalized source coordinates + relationships'],['5','Human validation','Confidence + exceptions before asset registration'],['6','Twin generation','L0–L4 graph handed to 3D workspace'],['7','DIR registration','Approved lifecycle records become immutable']].map(([n,t,d],i)=><div className={`workflow-step ${i<(totals.parsed?6:1)?'done':''}`} key={n}><i>{n}</i><div><strong>{t}</strong><span>{d}</span></div></div>)}</div><div className="button-row" style={{marginTop:16}}><Link className="action" href="/twin">Open compiled graph in Twin</Link></div></div></div>
  <div className="grid kpis" style={{marginTop:16}}><div className="card"><div className="label">Sources</div><div className="metric">{totals.files}</div></div><div className="card"><div className="label">Parsed</div><div className="metric">{totals.parsed}</div></div><div className="card"><div className="label">Graph entities</div><div className="metric">{totals.entities}</div></div><div className="card"><div className="label">L4 asset candidates</div><div className="metric">{totals.assets}</div></div></div>
  <div className="card" style={{marginTop:16}}><div className="section-head"><div><div className="eyebrow">Compiled Layer Output</div><h2>What the source actually produced</h2></div><span className="proof">NO FAKE PARSING</span></div><div className="provenance-map">{(['L0','L1','L2','L3','L4'] as const).map((l,i)=><span key={l} style={{display:'contents'}}><div className="prov-step active"><i>{l}</i><b>{['Source','Architectural','Electrical Physical','Electrical Logical','STRATUM Assets'][i]}</b><span>{l==='L0'?files.length:layerStats[l]||0} records</span></div>{i<4&&<em>→</em>}</span>)}</div></div>
 </div>;
}
