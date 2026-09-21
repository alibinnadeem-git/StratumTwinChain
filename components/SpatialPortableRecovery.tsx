'use client';

import {ChangeEvent,useEffect,useState} from 'react';
import {
  createSpatialRecoveryBundle,
  graphSummary,
  readCurrentSpatialGraph,
  restoreSpatialRecoveryBundle,
  SPATIAL_RECOVERY_EVENT,
} from '@/lib/spatial-browser-recovery';

function safeTimestamp(){
  return new Date().toISOString().replace(/[:.]/g,'-');
}

export default function SpatialPortableRecovery(){
  const [summary,setSummary]=useState(()=>graphSummary(null));
  const [message,setMessage]=useState('Portable recovery keeps the browser graph and its protected history movable without creating Verified state.');
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    const refresh=()=>setSummary(graphSummary(readCurrentSpatialGraph()));
    refresh();
    window.addEventListener('stratum:graph-updated',refresh);
    window.addEventListener(SPATIAL_RECOVERY_EVENT,refresh);
    return()=>{
      window.removeEventListener('stratum:graph-updated',refresh);
      window.removeEventListener(SPATIAL_RECOVERY_EVENT,refresh);
    };
  },[]);

  async function exportBundle(){
    if(busy)return;
    setBusy(true);
    try{
      const bundle=await createSpatialRecoveryBundle();
      if(!bundle.current&&!bundle.lastGood&&!bundle.indexedLatest&&!bundle.sameOriginBackups.length){
        throw new Error('No STRATUM Spatial graph is available to export yet.');
      }
      const blob=new Blob([JSON.stringify(bundle,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob);
      const anchor=document.createElement('a');
      anchor.href=url;
      anchor.download=`stratum-spatial-recovery-${safeTimestamp()}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setMessage(`Recovery bundle exported: ${bundle.summary.distinctGraphs} protected graph copy/copies · ${bundle.summary.totalEntities} total entity records across copies.`);
    }catch(error){
      setMessage(error instanceof Error?error.message:'Unable to export the STRATUM Spatial Recovery bundle.');
    }finally{setBusy(false)}
  }

  async function importBundle(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];
    event.target.value='';
    if(!file||busy)return;
    setBusy(true);
    try{
      const parsed=JSON.parse(await file.text());
      const restored=await restoreSpatialRecoveryBundle(parsed);
      const next=graphSummary(restored.graph);
      setSummary(next);
      setMessage(`Recovery bundle restored: ${next.sources} sources · ${next.entities} entities · ${next.links} links. Auto-sync will submit this graph when a real server project and runtime database are available.`);
    }catch(error){
      setMessage(error instanceof Error?error.message:'Unable to restore the STRATUM Spatial Recovery bundle. Existing browser data was not intentionally cleared.');
    }finally{setBusy(false)}
  }

  return <section className="card" style={{marginTop:14}} aria-label="Portable Spatial recovery">
    <div className="section-head">
      <div><div className="eyebrow">Portable recovery</div><h3>Move the full browser Spatial workspace safely</h3></div>
      <span className={summary.entities?'proof':'pending'}>{summary.entities?'RECOVERY READY':'NO GRAPH'}</span>
    </div>
    <p className="muted">Exports the current graph together with last-good, previous, same-origin and IndexedDB recovery copies. Importing a package restores the browser workspace only; it does not create assets, approve evidence, create a DIR or establish PoVI finality.</p>
    <div className="spec-grid">
      <div><span>Current sources</span><strong>{summary.sources}</strong></div>
      <div><span>Current entities</span><strong>{summary.entities}</strong></div>
      <div><span>Current links</span><strong>{summary.links}</strong></div>
      <div><span>Graph created</span><strong>{summary.createdAt?new Date(summary.createdAt).toLocaleString():'—'}</strong></div>
    </div>
    <div className="button-row" style={{marginTop:12}}>
      <button className="action" type="button" onClick={exportBundle} disabled={busy||!summary.entities}>Export recovery bundle</button>
      <label className="ghost" style={{cursor:busy?'not-allowed':'pointer'}}>
        Import recovery bundle
        <input hidden type="file" accept=".json,application/json" onChange={importBundle} disabled={busy}/>
      </label>
    </div>
    <div className="notice" role="status" style={{marginTop:12}}><strong>RECOVERY</strong><span>{message}</span></div>
  </section>;
}
