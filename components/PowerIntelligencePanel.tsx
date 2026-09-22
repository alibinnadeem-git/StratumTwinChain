'use client';

import {useEffect,useMemo,useState} from 'react';
import type {PowerIntelligenceSnapshot} from '@/lib/power-intelligence';

type Graph={powerIntelligence?:PowerIntelligenceSnapshot};
const STORAGE_KEY='stratum_compiled_graph';

export default function PowerIntelligencePanel(){
 const [snapshot,setSnapshot]=useState<PowerIntelligenceSnapshot|null>(null);
 useEffect(()=>{
  const load=()=>{
   try{const graph=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null') as Graph|null;setSnapshot(graph?.powerIntelligence||null)}
   catch{setSnapshot(null)}
  };
  load();window.addEventListener('stratum:graph-updated',load);window.addEventListener('storage',load);
  return()=>{window.removeEventListener('stratum:graph-updated',load);window.removeEventListener('storage',load)};
 },[]);
 const findings=useMemo(()=>snapshot?.findings||[],[snapshot]);
 if(!snapshot||snapshot.requirements.length===0)return null;
 return <section className="card" aria-label="Expected power review" style={{marginBottom:16}}>
  <div className="section-head">
   <div><div className="eyebrow">Cross-discipline power intelligence</div><h2 style={{margin:'3px 0'}}>Expected power review</h2><p className="subtitle" style={{margin:0}}>Powered equipment discovered outside the electrical graph is reconciled against available electrical objects. Findings are advisory until qualified engineering review.</p></div>
   <span className={findings.length?'pending':'verified'}>{findings.length?`${findings.length} REVIEW`:'NO POWER FLAGS'}</span>
  </div>
  <div className="asset-summary-strip" style={{marginTop:12}}>
   <div><span>Expected loads</span><strong>{snapshot.summary.expected}</strong></div>
   <div><span>Matched</span><strong>{snapshot.summary.matched}</strong></div>
   <div><span>Missing</span><strong>{snapshot.summary.missing}</strong></div>
   <div><span>Conflicted</span><strong>{snapshot.summary.conflicted}</strong></div>
  </div>
  {findings.length>0&&<div className="spatial-review-list" style={{marginTop:12}}>{findings.slice(0,8).map(item=><div className="spatial-review-row" key={item.id}><div><strong>{item.title}</strong><small>{item.detail}</small></div><span>{item.findingType.replaceAll('_',' ')}</span></div>)}</div>}
  <details className="secondary-details" style={{marginTop:10}}><summary>Expected load evidence</summary><div className="activity-list" style={{marginTop:10}}>{snapshot.requirements.slice(0,12).map(item=><div className="card" key={item.id}><strong>{item.tag||item.equipmentClass.replaceAll('_',' ')}</strong><div className="muted">{item.sourceDiscipline} · {item.status} · {Math.round(item.confidence*100)}% confidence</div><small>{item.inputKw!==null?`${item.inputKw} kW input`:item.inputKva!==null?`${item.inputKva} kVA input`:item.connectedLoadEstimateKva!==null?`${item.connectedLoadEstimateKva} kVA derived reference`:'Electrical rating unresolved'} · {item.authorityClass.replaceAll('_',' ')}</small>{item.assumptions.length>0&&<p className="muted" style={{marginBottom:0}}>{item.assumptions.join(' ')}</p>}</div>)}</div></details>
  <small className="spatial-review-boundary">Expected power is not a final load calculation, code-compliance determination, or engineering approval.</small>
 </section>;
}
