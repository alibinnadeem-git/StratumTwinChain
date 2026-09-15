'use client';

import {ChangeEvent,useEffect,useMemo,useState} from 'react';
import {extractSheetIdentity,type PositionedSheetText,type SheetIdentityCandidate} from '@/lib/title-block';

type StoredSheetIdentity=SheetIdentityCandidate&{confirmedAt?:string};
const STORAGE_KEY='stratum_title_block_reviews';

const fileSha=async(file:File)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(value=>value.toString(16).padStart(2,'0')).join('');
const keyOf=(item:StoredSheetIdentity)=>`${item.sourceSha256}:${item.page}`;

function readStored():StoredSheetIdentity[]{
  try{const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');return Array.isArray(parsed)?parsed:[]}catch{return[]}
}
function writeStored(next:StoredSheetIdentity[]){
  localStorage.setItem(STORAGE_KEY,JSON.stringify(next));
  try{
    const graph=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}');
    if(graph&&typeof graph==='object'&&!Array.isArray(graph)){
      graph.titleBlocks=next;
      localStorage.setItem('stratum_compiled_graph',JSON.stringify(graph));
      window.dispatchEvent(new Event('stratum:graph-updated'));
    }
  }catch{}
}

async function inspectPdf(file:File,onProgress:(label:string)=>void):Promise<StoredSheetIdentity[]>{
  const pdfjs:any=await import('pdfjs-dist/legacy/build/pdf.mjs');
  try{pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).toString()}catch{}
  const digest=await fileSha(file);
  const document=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),wasmUrl:'/pdfjs/wasm/'}).promise;
  const out:StoredSheetIdentity[]=[];
  try{
    for(let pageNumber=1;pageNumber<=document.numPages;pageNumber++){
      onProgress(`${file.name}: title-block scan page ${pageNumber} of ${document.numPages}`);
      const page=await document.getPage(pageNumber);
      try{
        const viewport=page.getViewport({scale:1});
        const text=await page.getTextContent();
        const items:PositionedSheetText[]=(text.items||[]).flatMap((item:any)=>{
          const value=String(item?.str||'').trim();if(!value)return[];
          const transform=item.transform||[1,0,0,1,0,0];
          const point=viewport.convertToViewportPoint(Number(transform[4]||0),Number(transform[5]||0));
          const width=Math.abs(Number(item.width||0))/Math.max(viewport.width,1);
          const height=Math.abs(Number(item.height||transform[3]||0))/Math.max(viewport.height,1);
          return[{text:value,x:point[0]/Math.max(viewport.width,1),y:point[1]/Math.max(viewport.height,1),width,height}];
        });
        out.push(extractSheetIdentity({page:pageNumber,sourceName:file.name,sourceSha256:digest,items}));
      }finally{page.cleanup()}
    }
  }finally{await document.destroy()}
  return out;
}

export default function TitleBlockIntelligence(){
  const [items,setItems]=useState<StoredSheetIdentity[]>([]);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');

  useEffect(()=>{setItems(readStored());},[]);
  const confirmed=useMemo(()=>items.filter(item=>item.reviewState==='CONFIRMED').length,[items]);

  async function process(files:File[]){
    const pdfs=files.filter(file=>file.name.toLowerCase().endsWith('.pdf'));
    if(!pdfs.length||busy)return;
    setBusy(true);
    try{
      let next=readStored();
      for(const file of pdfs){
        const candidates=await inspectPdf(file,setMessage);
        const existing=new Map(next.map(item=>[keyOf(item),item]));
        for(const candidate of candidates){
          const prior=existing.get(keyOf(candidate));
          existing.set(keyOf(candidate),prior?.reviewState==='CONFIRMED'?{...candidate,reviewState:'CONFIRMED',confirmedAt:prior.confirmedAt,alignmentEligible:false,geometryScaleAuthority:false}:candidate);
        }
        next=[...existing.values()].sort((a,b)=>a.sourceName.localeCompare(b.sourceName)||a.page-b.page);
        writeStored(next);setItems(next);
      }
      setMessage(`Title-block scan complete: ${next.length} sheet identity candidate${next.length===1?'':'s'} · ${next.filter(item=>item.reviewState==='CONFIRMED').length} human-confirmed. Confirmation does not establish alignment, geometry scale, Verified state or PoVI finality.`);
    }catch(error){setMessage(error instanceof Error?`Title-block scan failed: ${error.message}`:'Title-block scan failed.');}
    finally{setBusy(false)}
  }

  useEffect(()=>{
    const onDrop=(event:DragEvent)=>{const files=Array.from(event.dataTransfer?.files||[]);if(files.some(file=>file.name.toLowerCase().endsWith('.pdf')))void process(files)};
    const onChange=(event:Event)=>{const target=event.target as HTMLInputElement|null;if(target?.files?.length)void process(Array.from(target.files))};
    window.addEventListener('drop',onDrop,true);window.addEventListener('change',onChange,true);
    return()=>{window.removeEventListener('drop',onDrop,true);window.removeEventListener('change',onChange,true)};
  // process intentionally omitted so the capture listeners remain stable for the page lifetime.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  function updateReview(target:StoredSheetIdentity,confirmedState:boolean){
    const next=items.map(item=>keyOf(item)===keyOf(target)?{...item,reviewState:confirmedState?'CONFIRMED':'CANDIDATE',confirmedAt:confirmedState?new Date().toISOString():undefined,alignmentEligible:false as const,geometryScaleAuthority:false as const}:item) as StoredSheetIdentity[];
    setItems(next);writeStored(next);
    setMessage(confirmedState?'Sheet identity confirmed for review. Automatic alignment and geometry scale remain disabled until separate validation/calibration steps.':'Sheet identity returned to candidate review state.');
  }

  function clear(){setItems([]);writeStored([]);setMessage('Title-block review candidates cleared from this browser workspace. No source files or server records were deleted.');}

  return <section className="card" style={{marginTop:16}}>
    <div className="section-head"><div><div className="eyebrow">Title-block intelligence · Human reviewed</div><h2>Resolve sheet identity before multi-sheet alignment</h2><p className="muted">PDF text and position are used to propose sheet number, title, revision, issue date, discipline, floor/level and drawing scale. Every result remains a candidate until explicitly confirmed. A parsed scale is reference metadata only: confirmation never establishes geometry scale, alignment, Verified state, DIR finality or physical truth.</p></div><span className="pending">{confirmed}/{items.length} CONFIRMED</span></div>
    <div className="button-row"><label className="ghost" style={{cursor:'pointer'}}>Analyze PDF title blocks<input hidden type="file" accept=".pdf" multiple disabled={busy} onChange={(event:ChangeEvent<HTMLInputElement>)=>{void process(Array.from(event.target.files||[]));event.target.value=''}}/></label>{items.length>0&&<button type="button" onClick={clear}>Clear review candidates</button>}</div>
    {message&&<div className="notice" style={{marginTop:12}}><strong>{busy?'ANALYZING':'TITLE BLOCK'}</strong><span>{message}</span></div>}
    {!items.length&&<p className="muted" style={{marginBottom:0}}>Drop/select PDFs in the compiler or use the analyzer above. No inferred sheet identity exists yet.</p>}
    {items.length>0&&<div style={{display:'grid',gap:10,marginTop:12}}>{items.map(item=><article className="card" key={keyOf(item)} style={{padding:14}}>
      <div className="section-head"><div><strong>{item.sourceName} · page {item.page}</strong><small style={{display:'block'}}>Source SHA-256 {item.sourceSha256.slice(0,16)}… · {item.region} · confidence {Math.round(item.confidence*100)}%</small></div><span className={item.reviewState==='CONFIRMED'?'proof':'pending'}>{item.reviewState}</span></div>
      <div className="grid two" style={{marginTop:8}}><div><div className="label">Sheet number</div><b>{item.sheetNumber.value||'Unresolved'}</b><small style={{display:'block'}}>confidence {Math.round(item.sheetNumber.confidence*100)}% · {item.sheetNumber.method}</small></div><div><div className="label">Sheet title</div><b>{item.sheetTitle.value||'Unresolved'}</b><small style={{display:'block'}}>confidence {Math.round(item.sheetTitle.confidence*100)}% · {item.sheetTitle.method}</small></div><div><div className="label">Discipline</div><b>{item.discipline.value||'Unresolved'}</b><small style={{display:'block'}}>confidence {Math.round(item.discipline.confidence*100)}% · {item.discipline.method}</small></div><div><div className="label">Floor / level</div><b>{item.floor.value||'Unresolved'}</b><small style={{display:'block'}}>confidence {Math.round(item.floor.confidence*100)}% · {item.floor.method}</small></div><div><div className="label">Drawing scale</div><b>{item.drawingScale.value||'Unresolved'}</b><small style={{display:'block'}}>confidence {Math.round(item.drawingScale.confidence*100)}% · {item.drawingScale.method} · REVIEW ONLY</small></div><div><div className="label">Revision / issue date</div><b>{item.revision.value||'—'} · {item.issueDate.value||'—'}</b></div></div>
      <p className="muted" style={{marginBottom:8}}>Evidence: {[...new Set([...item.sheetNumber.evidence,...item.sheetTitle.evidence,...item.revision.evidence,...item.issueDate.evidence,...item.discipline.evidence,...item.floor.evidence,...item.drawingScale.evidence])].filter(Boolean).slice(0,10).join(' · ')||'No strong labeled evidence; review required.'}</p>
      {item.drawingScale.value&&<div className="notice" style={{marginBottom:8}}><strong>SCALE IS NOT GEOMETRY AUTHORITY</strong><span>{item.drawingScale.value} was extracted as title-block metadata. It does not rescale source geometry until a separate calibration/alignment validation step explicitly applies an accepted transform.</span></div>}
      <div className="button-row">{item.reviewState==='CONFIRMED'?<button type="button" onClick={()=>updateReview(item,false)}>Reopen identity review</button>:<button type="button" onClick={()=>updateReview(item,true)} disabled={!item.sheetNumber.value}>Confirm sheet identity</button>}</div>
    </article>)}</div>}
  </section>;
}
