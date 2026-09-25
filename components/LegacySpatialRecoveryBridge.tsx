'use client';

import {useEffect,useState} from 'react';
import {findSameOriginRecoveryCandidates,graphSummary,readPrimarySpatialGraph,restoreBestSpatialGraph,type SpatialGraphLike} from '@/lib/spatial-browser-recovery';

const ALLOWED_TARGETS=new Set([
 'https://stratumspatialverified.vercel.app',
 'https://stratum-twin-chain.vercel.app',
 'http://localhost:3000',
]);

export default function LegacySpatialRecoveryBridge(){
 const [graph,setGraph]=useState<SpatialGraphLike|null>(null);
 const [message,setMessage]=useState('Looking for a Spatial model on this STRATUM address…');
 const [target,setTarget]=useState('');

 useEffect(()=>{
  const raw=new URLSearchParams(window.location.search).get('target')||'';
  try{const origin=new URL(raw).origin;setTarget(ALLOWED_TARGETS.has(origin)?origin:'')}catch{setTarget('')}
  void (async()=>{
   const current=await readPrimarySpatialGraph();
   const recovered=current?{graph:current}:await restoreBestSpatialGraph();
   const candidate=recovered.graph||findSameOriginRecoveryCandidates()[0]?.graph||null;
   setGraph(candidate);
   setMessage(candidate?`Found ${graphSummary(candidate).sources} source(s) and ${graphSummary(candidate).entities} Spatial object(s) on ${window.location.origin}.`:'No recoverable Spatial graph was found on this STRATUM address.');
  })();
 },[]);

 function send(){
  if(!graph||!target){setMessage(!target?'Recovery target is not allowed.':'No model is available to send.');return;}
  if(!window.opener){setMessage('Return to the current STRATUM tab and start legacy recovery there so this window has a secure opener.');return;}
  window.opener.postMessage({type:'STRATUM_SPATIAL_RECOVERY',version:1,graph,sourceOrigin:window.location.origin},target);
  setMessage('Model sent to the current STRATUM tab. You can close this window.');
 }

 return <div className="bridge-page">
  <section className="card bridge-card">
   <div className="eyebrow">STRATUM Spatial recovery</div>
   <h1>Recover this browser model</h1>
   <p className="subtitle">{message}</p>
   <div className="workspace-actions">
    <button className="action" type="button" disabled={!graph||!target} onClick={send}>Send model to current STRATUM</button>
    <button className="ghost" type="button" onClick={()=>window.close()}>Close</button>
   </div>
   <p className="muted">Only a validated Spatial graph is transferred, directly between your browser tabs. No passwords, database credentials, evidence files or DIR secrets are included.</p>
  </section>
 </div>;
}
