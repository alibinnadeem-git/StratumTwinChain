'use client';

import {ChangeEvent,useEffect,useMemo,useState} from 'react';
import {declaredScaleMetersPerNormalizedSheetUnit,drawingScaleDenominator,extractSheetIdentity,type PositionedSheetText,type SheetField,type SheetIdentityCandidate} from '@/lib/title-block';
import {readPrimarySpatialGraph,writePrimarySpatialGraph} from '@/lib/spatial-browser-recovery';

type EditableIdentityField='sheetNumber'|'sheetTitle'|'discipline'|'drawingScale'|'floor'|'revision'|'issueDate';
type StoredSheetIdentity=SheetIdentityCandidate&{confirmedAt?:string;identityGaps?:string[];correctedAt?:string;correctedFields?:EditableIdentityField[]};
const STORAGE_KEY='stratum_title_block_reviews';

const fileSha=async(file:File)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(value=>value.toString(16).padStart(2,'0')).join('');
const keyOf=(item:StoredSheetIdentity)=>`${item.sourceSha256}:${item.page}`;

function readStored():StoredSheetIdentity[]{
  try{const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');return Array.isArray(parsed)?parsed:[]}catch{return[]}
}
async function writeStored(next:StoredSheetIdentity[]){
  localStorage.setItem(STORAGE_KEY,JSON.stringify(next));
  try{
    const graph=await readPrimarySpatialGraph();
    if(graph&&typeof graph==='object'&&!Array.isArray(graph)){
      graph.titleBlocks=next;
      await writePrimarySpatialGraph(graph);
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
        out.push(extractSheetIdentity({page:pageNumber,sourceName:file.name,sourceSha256:digest,items,pageWidthPoints:viewport.width,pageHeightPoints:viewport.height}));
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
          if(prior){
            const corrected=new Set(prior.correctedFields||[]);
            const merged:StoredSheetIdentity={
              ...candidate,
              sheetNumber:corrected.has('sheetNumber')?prior.sheetNumber:candidate.sheetNumber,
              sheetTitle:corrected.has('sheetTitle')?prior.sheetTitle:candidate.sheetTitle,
              discipline:corrected.has('discipline')?prior.discipline:candidate.discipline,
              drawingScale:corrected.has('drawingScale')?prior.drawingScale:candidate.drawingScale,
              floor:corrected.has('floor')?prior.floor:candidate.floor,
              revision:corrected.has('revision')?prior.revision:candidate.revision,
              issueDate:corrected.has('issueDate')?prior.issueDate:candidate.issueDate,
            };
            if(corrected.has('drawingScale')){
              const denominator=drawingScaleDenominator(merged.drawingScale.value);
              merged.scaleCalibration={...merged.scaleCalibration,denominator,metersPerNormalizedSheetUnit:declaredScaleMetersPerNormalizedSheetUnit(merged.drawingScale.value,merged.pageGeometry.maxDimensionPoints,merged.scaleCalibration.normalizedSheetSpan),method:'HUMAN_CORRECTED_SCALE_CANDIDATE',reviewRequired:true,autoApply:false,physicalPositionVerified:false};
            }
            existing.set(keyOf(candidate),{...merged,reviewState:prior.reviewState,confirmedAt:prior.confirmedAt,identityGaps:prior.identityGaps||[],correctedAt:prior.correctedAt,correctedFields:prior.correctedFields||[],alignmentEligible:false,geometryScaleAuthority:false});
          }else existing.set(keyOf(candidate),candidate);
        }
        next=[...existing.values()].sort((a,b)=>a.sourceName.localeCompare(b.sourceName)||a.page-b.page);
        await writeStored(next);setItems(next);
      }
      setMessage(`Title-block scan complete: ${next.length} sheet identity candidate${next.length===1?'':'s'} · ${next.filter(item=>item.reviewState==='CONFIRMED').length} human-confirmed. Confirmation does not establish alignment, geometry scale, Verified state or PoVI finality.`);
    }catch(error){setMessage(error instanceof Error?`Title-block scan failed: ${error.message}`:'Title-block scan failed.');}
    finally{setBusy(false)}
  }

  useEffect(()=>{
    // Guard against browser navigation on accidental file drops. Main-pipeline
    // imports remain single-source-of-truth; this review tool only processes
    // files explicitly selected through its own input.
    const guard=(event:DragEvent)=>{if(event.dataTransfer&&[...(event.dataTransfer.types||[])].includes('Files'))event.preventDefault();};
    window.addEventListener('dragover',guard);window.addEventListener('drop',guard);
    return()=>{window.removeEventListener('dragover',guard);window.removeEventListener('drop',guard);};
  },[]);

  const identityGaps=(item:StoredSheetIdentity)=>[
    !item.sheetNumber.value&&'sheet number',!item.sheetTitle.value&&'sheet title',
    !item.discipline.value&&'discipline',!item.drawingScale.value&&'drawing scale',
    !item.floor.value&&'floor / level',!item.revision.value&&'revision',!item.issueDate.value&&'issue date',
  ].filter(Boolean) as string[];

  async function correctField(target:StoredSheetIdentity,key:EditableIdentityField,value:string){
    const clean=value.trim();
    const next=items.map(item=>{
      if(keyOf(item)!==keyOf(target))return item;
      const previous=item[key] as SheetField;
      const nextField:SheetField={value:clean||null,confidence:clean?1:0,evidence:[...previous.evidence.slice(0,6),clean?`Human correction: ${clean}`:'Human cleared value'],method:'HUMAN_CORRECTED'};
      const updated:StoredSheetIdentity={...item,[key]:nextField,correctedAt:new Date().toISOString(),correctedFields:[...new Set([...(item.correctedFields||[]),key])],reviewState:'CANDIDATE',confirmedAt:undefined,identityGaps:[],alignmentEligible:false,geometryScaleAuthority:false};
      if(key==='drawingScale'){
        const denominator=drawingScaleDenominator(nextField.value);
        updated.scaleCalibration={...item.scaleCalibration,denominator,metersPerNormalizedSheetUnit:declaredScaleMetersPerNormalizedSheetUnit(nextField.value,item.pageGeometry.maxDimensionPoints,item.scaleCalibration.normalizedSheetSpan),method:'HUMAN_CORRECTED_SCALE_CANDIDATE',reviewRequired:true,autoApply:false,physicalPositionVerified:false};
      }
      return updated;
    }) as StoredSheetIdentity[];
    setItems(next);await writeStored(next);
    setMessage('Human correction saved as review evidence. Reconfirm the sheet identity before downstream use.');
  }

  async function updateReview(target:StoredSheetIdentity,confirmedState:boolean){
    const gaps=confirmedState?identityGaps(target):[];
    const next=items.map(item=>keyOf(item)===keyOf(target)?{...item,reviewState:confirmedState?'CONFIRMED':'CANDIDATE',confirmedAt:confirmedState?new Date().toISOString():undefined,identityGaps:confirmedState?gaps:[],alignmentEligible:false as const,geometryScaleAuthority:false as const}:item) as StoredSheetIdentity[];
    setItems(next);await writeStored(next);
    setMessage(confirmedState?(gaps.length?`Sheet identity confirmed with gaps (${gaps.join(', ')} unresolved). Gaps remain review-only; alignment and geometry scale remain disabled.`:'Sheet identity confirmed for review. Automatic alignment and geometry scale remain disabled until separate validation/calibration steps.'):'Sheet identity returned to candidate review state.');
  }

  async function clear(){setItems([]);await writeStored([]);setMessage('Title-block review candidates cleared from this browser workspace. No source files or server records were deleted.');}

  return <section className="card" style={{marginTop:16}}>
    <div className="section-head"><div><div className="eyebrow">Title-block intelligence · Human reviewed</div><h2>Resolve sheet identity before multi-sheet alignment</h2><p className="muted">PDF text and position are used to propose sheet number, title, revision, issue date, discipline, floor/level and drawing scale. Every result remains a candidate until explicitly confirmed. Page dimensions are retained only so alignment review can sanity-check normalized coordinate scale. A parsed scale is reference metadata only: confirmation never establishes geometry scale, alignment, Verified state, DIR finality or physical truth.</p></div><span className="pending">{confirmed}/{items.length} CONFIRMED</span></div>
    <div className="button-row"><label className="ghost" style={{cursor:'pointer'}}>Analyze PDF title blocks<input hidden type="file" accept=".pdf" multiple disabled={busy} onChange={(event:ChangeEvent<HTMLInputElement>)=>{void process(Array.from(event.target.files||[]));event.target.value=''}}/></label>{items.length>0&&<button type="button" onClick={()=>void clear()}>Clear review candidates</button>}</div>
    {message&&<div className="notice" style={{marginTop:12}}><strong>{busy?'ANALYZING':'TITLE BLOCK'}</strong><span>{message}</span></div>}
    {!items.length&&<p className="muted" style={{marginBottom:0}}>Use “Analyze PDF title blocks” for explicit sheet-identity review. Main-pipeline imports stay separate so this tool never creates a shadow upload.</p>}
    {items.length>0&&<div style={{display:'grid',gap:10,marginTop:12}}>{items.map(item=><article className="card" key={keyOf(item)} style={{padding:14}}>
      <div className="section-head"><div><strong>{item.sourceName} · page {item.page}</strong><small style={{display:'block'}}>Source SHA-256 {item.sourceSha256.slice(0,16)}… · {item.region} · confidence {Math.round(item.confidence*100)}%</small></div><span className={item.reviewState==='CONFIRMED'?'proof':'pending'}>{item.reviewState}</span></div>
      <div className="grid two" style={{marginTop:8}}><div><div className="label">Sheet number</div><b>{item.sheetNumber.value||'Unresolved'}</b><small style={{display:'block'}}>confidence {Math.round(item.sheetNumber.confidence*100)}% · {item.sheetNumber.method}</small></div><div><div className="label">Sheet title</div><b>{item.sheetTitle.value||'Unresolved'}</b><small style={{display:'block'}}>confidence {Math.round(item.sheetTitle.confidence*100)}% · {item.sheetTitle.method}</small></div><div><div className="label">Discipline</div><b>{item.discipline.value||'Unresolved'}</b><small style={{display:'block'}}>confidence {Math.round(item.discipline.confidence*100)}% · {item.discipline.method}</small></div><div><div className="label">Floor / level</div><b>{item.floor.value||'Unresolved'}</b><small style={{display:'block'}}>confidence {Math.round(item.floor.confidence*100)}% · {item.floor.method}</small></div><div><div className="label">Drawing scale</div><b>{item.drawingScale.value||'Unresolved'}</b><small style={{display:'block'}}>confidence {Math.round(item.drawingScale.confidence*100)}% · {item.drawingScale.method} · REVIEW ONLY{item.pageGeometry?.maxDimensionPoints?` · page max ${Math.round(item.pageGeometry.maxDimensionPoints)} pt`:''}</small>{item.scaleCalibration?.denominator&&<small style={{display:'block'}}>denominator {item.scaleCalibration.denominator.toFixed(3)}{item.scaleCalibration.metersPerNormalizedSheetUnit?` · candidate ${item.scaleCalibration.metersPerNormalizedSheetUnit.toFixed(4)} m / normalized sheet unit`:' · physical page geometry unavailable'}</small>}</div><div><div className="label">North / orientation evidence</div><b>{item.northOrientation?.reference?.replaceAll('_',' ')||'Unresolved'}</b><small style={{display:'block'}}>{item.northOrientation?.angleDegreesFromPageUp!==null&&item.northOrientation?.angleDegreesFromPageUp!==undefined?`${item.northOrientation.angleDegreesFromPageUp.toFixed(2)}° from page-up · `:''}confidence {Math.round((item.northOrientation?.confidence||0)*100)}% · {item.northOrientation?.method||'UNRESOLVED'}</small></div><div><div className="label">Revision / issue date</div><b>{item.revision.value||'—'} · {item.issueDate.value||'—'}</b></div></div>
      <p className="muted" style={{marginBottom:8}}>Evidence: {[...new Set([...item.sheetNumber.evidence,...item.sheetTitle.evidence,...item.revision.evidence,...item.issueDate.evidence,...item.discipline.evidence,...item.floor.evidence,...item.drawingScale.evidence,...(item.northOrientation?.evidence||[])])].filter(Boolean).slice(0,10).join(' · ')||'No strong labeled evidence; review required.'}</p>
      {item.drawingScale.value&&<div className="notice" style={{marginBottom:8}}><strong>SCALE IS NOT GEOMETRY AUTHORITY</strong><span>{item.drawingScale.value} was extracted as drawing evidence. {item.scaleCalibration?.metersPerNormalizedSheetUnit?`The declared scale plus PDF page geometry yields a ${item.scaleCalibration.metersPerNormalizedSheetUnit.toFixed(4)} m/unit calibration candidate, but it is not applied automatically.`:'A physical meters/unit calibration cannot be derived from this source alone.'} Human review or an independent dimension/control-point check is still required.</span></div>}
      {item.northOrientation?.reference&&<div className="notice" style={{marginBottom:8}}><strong>NORTH IS REVIEW EVIDENCE</strong><span>{item.northOrientation.reference.replaceAll('_',' ')}{item.northOrientation.angleDegreesFromPageUp!==null?` indicates ${item.northOrientation.angleDegreesFromPageUp.toFixed(2)}° from page-up`:''}. This does not rotate geometry automatically and does not establish surveyed/project north.</span></div>}
      <details className="secondary-details" style={{marginTop:8}}>
       <summary>Correct extracted identity</summary>
       <div className="grid two" style={{marginTop:8}}>
        {([['sheetNumber','Sheet number'],['sheetTitle','Sheet title'],['discipline','Discipline'],['drawingScale','Drawing scale'],['floor','Floor / level'],['revision','Revision'],['issueDate','Issue date']] as [EditableIdentityField,string][]).map(([key,label])=><label key={key}><span>{label}</span><input value={(item[key] as SheetField).value||''} onChange={event=>void correctField(item,key,event.target.value)}/></label>)}
       </div>
       <small className="muted">A correction is human review evidence, not physical verification. Any correction reopens identity review.</small>
      </details>
      <div className="button-row">{item.reviewState==='CONFIRMED'?<button type="button" onClick={()=>void updateReview(item,false)}>Reopen identity review</button>:<button type="button" onClick={()=>void updateReview(item,true)} disabled={!(item.sheetNumber.value||item.sheetTitle.value)} title={item.sheetNumber.value||item.sheetTitle.value?'Confirm identity; unresolved fields remain explicit gaps':'A sheet number or title is required before confirmation'}>Confirm sheet identity</button>}</div>
      {item.reviewState==='CONFIRMED'&&item.identityGaps&&item.identityGaps.length>0&&<p className="muted" style={{marginTop:6,marginBottom:0}}><strong>Confirmed with gaps:</strong> {item.identityGaps.join(', ')} unresolved — excluded from alignment eligibility and geometry authority.</p>}
    </article>)}</div>}
  </section>;
}
