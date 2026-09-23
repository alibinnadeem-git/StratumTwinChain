'use client';

import Link from 'next/link';
import {ChangeEvent,useEffect,useState} from 'react';
import {
  findSameOriginRecoveryCandidates,
  graphSummary,
  isSpatialGraph,
  readCurrentSpatialGraph,
  readIndexedRecovery,
  replaceCurrentSpatialGraph,
  restoreBestSpatialGraph,
  SPATIAL_RECOVERY_EVENT,
} from '@/lib/spatial-browser-recovery';
import {SERVER_SYNC_EVENT,SERVER_SYNC_REQUEST_EVENT} from '@/components/SpatialAutoSync';

type Health={
  liveDataReady?:boolean;
  databaseConfigured?:boolean;
  authConfigured?:boolean;
  databaseReachable?:boolean;
  schema?:{spatialPersistenceReady?:boolean};
  chainRpcConfigured?:boolean;
  mode?:string;
};

export default function SpatialWorkspaceStatus({compact=false,authenticated=false}:{compact?:boolean;authenticated?:boolean}){
  const [graph,setGraph]=useState(()=>typeof window==='undefined'?null:readCurrentSpatialGraph());
  const [health,setHealth]=useState<Health|null>(null);
  const [message,setMessage]=useState('');
  const [recoveryReady,setRecoveryReady]=useState(false);
  const [syncState,setSyncState]=useState<{state:string;error?:string;status?:number;revision?:number}|null>(null);

  useEffect(()=>{
    const refresh=()=>setGraph(readCurrentSpatialGraph());
    const receiveLegacy=(event:MessageEvent)=>{
      const allowed=new Set(['https://stratum-twin-chain.vercel.app']);
      if(!allowed.has(event.origin))return;
      const data=event.data as {type?:string;version?:number;graph?:unknown;sourceOrigin?:string}|null;
      if(!data||data.type!=='STRATUM_SPATIAL_RECOVERY'||data.version!==1||!isSpatialGraph(data.graph))return;
      replaceCurrentSpatialGraph(data.graph);
      setMessage(`Recovered ${graphSummary(data.graph).entities} Spatial objects from the earlier STRATUM site.`);
    };
    refresh();
    window.addEventListener('stratum:graph-updated',refresh);
    window.addEventListener(SPATIAL_RECOVERY_EVENT,refresh);
    window.addEventListener('message',receiveLegacy);
    const receiveSync=(event:Event)=>setSyncState((event as CustomEvent).detail||null);
    window.addEventListener(SERVER_SYNC_EVENT,receiveSync);
    setRecoveryReady(true);
    fetch('/api/health',{cache:'no-store'}).then(r=>r.json()).then(setHealth).catch(()=>setHealth(null));
    return()=>{
      window.removeEventListener('stratum:graph-updated',refresh);
      window.removeEventListener(SPATIAL_RECOVERY_EVENT,refresh);
      window.removeEventListener('message',receiveLegacy);
      window.removeEventListener(SERVER_SYNC_EVENT,receiveSync);
    };
  },[]);

  const summary=graphSummary(graph);
  const infrastructureReady=Boolean(health?.databaseReachable&&health?.authConfigured&&health?.schema?.spatialPersistenceReady);
  const serverReady=infrastructureReady&&authenticated;

  async function restore(){
    const before=readCurrentSpatialGraph();
    if(before){setMessage('Your current browser model is already present.');return;}
    const recovered=await restoreBestSpatialGraph();
    if(recovered.graph)setMessage(`Recovered ${graphSummary(recovered.graph).entities} Spatial objects from ${recovered.source==='indexeddb'?'the protected browser backup':'a previous same-site STRATUM copy'}.`);
    else setMessage('No recoverable model was found under this web address. If the model was created under another STRATUM URL, browser security keeps that storage separate; export from that URL and import the JSON backup here.');
  }

  async function restorePrevious(){
    const candidates=findSameOriginRecoveryCandidates();
    const graph=candidates[0]?.graph||await readIndexedRecovery('previous');
    if(!graph){setMessage('No previous browser copy is available on this web address.');return;}
    replaceCurrentSpatialGraph(graph);
    setMessage(`Restored a previous browser copy with ${graphSummary(graph).entities} Spatial objects.`);
  }

  function recoverLegacy(){
    const target=encodeURIComponent(window.location.origin);
    const popup=window.open(`https://stratum-twin-chain.vercel.app/recovery-bridge?target=${target}`,'stratum-spatial-recovery','popup,width=560,height=640');
    if(!popup)setMessage('The browser blocked the recovery window. Allow pop-ups for this site and try again.');
    else setMessage('Checking the earlier STRATUM site for a browser-local Spatial model…');
  }

  function download(){
    if(!graph){setMessage('There is no Spatial model in this browser to export.');return;}
    const blob=new Blob([JSON.stringify(graph,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`stratum-spatial-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    setMessage('Spatial backup exported.');
  }

  async function importBackup(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];event.target.value='';
    if(!file)return;
    try{
      const parsed=JSON.parse(await file.text());
      if(!isSpatialGraph(parsed))throw new Error('The selected JSON is not a valid STRATUM Spatial graph.');
      replaceCurrentSpatialGraph(parsed);
      setMessage(`Imported ${graphSummary(parsed).entities} Spatial objects. Existing browser work was preserved as the previous recovery copy.`);
    }catch(error){setMessage(error instanceof Error?error.message:'Backup import failed.');}
  }

  return <section className={compact?'workspace-status compact':'workspace-status'} aria-label="Project workspace status" data-recovery-ready={recoveryReady?'true':'false'}>
    <div className="workspace-status-main">
      <div>
        <div className="eyebrow">Project workspace</div>
        <strong>{graph?`${summary.sources} source${summary.sources===1?'':'s'} · ${summary.entities} Spatial object${summary.entities===1?'':'s'}`:'No Spatial model found on this web address'}</strong>
        <span>{graph?'Protected locally. Open Spatial and continue working.':'Recover the model before re-importing anything.'}</span>
      </div>
      <div className="workspace-health">
        <span className={graph?'proof':'pending'}>{graph?'MODEL FOUND':'MODEL MISSING'}</span>
        <span className={serverReady?'proof':'pending'}>{serverReady?'SERVER SYNC READY':infrastructureReady?'SIGN IN FOR SERVER SYNC':'SERVER SYNC OFFLINE'}</span>
      </div>
    </div>

    <div className="workspace-actions primary">
      {!graph&&<button className="action" type="button" onClick={()=>void restore()}>Recover model</button>}
      {graph&&<Link className="action" href="/spatial">Open Spatial</Link>}
      {!graph&&<button className="ghost" type="button" onClick={recoverLegacy}>Recover earlier STRATUM model</button>}
      {!graph&&<Link className="ghost" href="/compiler">Import sources</Link>}
      {!authenticated&&<Link className="ghost" href="/login">Sign in to load saved model</Link>}
      {graph&&authenticated&&<button className="ghost" type="button" onClick={()=>window.dispatchEvent(new Event(SERVER_SYNC_REQUEST_EVENT))}>Sync model now</button>}
    </div>

    <details className="secondary-details workspace-why">
      <summary>Backup & recovery</summary>
      <div className="workspace-actions">
        <button className="ghost" type="button" onClick={download} disabled={!graph}>Export backup</button>
        <label className="ghost file-button">Import backup<input aria-label="Import Spatial backup" type="file" accept=".json,application/json" onChange={event=>void importBackup(event)}/></label>
        <button className="ghost" type="button" onClick={()=>void restorePrevious()}>Restore previous copy</button>
      </div>
      {!serverReady&&<>
       <p className="muted">{infrastructureReady
        ?<>Production runtime bindings are ready. <Link href="/login">Sign in</Link> to use tenant-scoped server persistence and live asset context; browser recovery remains available while signed out.</>
        :'Production Spatial sync is unavailable because the database or authentication binding is not ready. The browser recovery layer protects the working model on this device.'}</p>
       <p className="muted">If the missing model was created on a different STRATUM hostname, browser same-origin security keeps that storage separate. Open that old hostname on the same device, export the model there, then import the JSON backup here.</p>
      </>}
    </details>
    {graph&&syncState&&<div className="notice" role="status"><strong>SERVER SYNC</strong><span>{syncState.state==='SAVED'?`Saved project model revision ${syncState.revision??'—'} on the server.`:syncState.state==='PROJECT_REQUIRED'?'Choose a project in Import → Server sync & review baseline.':syncState.state==='FAILED'?`Model could not be saved: ${syncState.error||`HTTP ${syncState.status}`}`:syncState.state==='UNAVAILABLE'?`Server sync unavailable${syncState.status?` (HTTP ${syncState.status})`:''}. Your browser model remains available.`:syncState.state==='SCHEMA_NOT_READY'?'Server Spatial storage is not ready. Your browser model remains available.':'Checking server sync…'}</span></div>}
    {message&&<div className="notice" role="status"><strong>WORKSPACE</strong><span>{message}</span></div>}
  </section>;
}
