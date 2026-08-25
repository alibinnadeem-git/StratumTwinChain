import Link from 'next/link';
import {liveAssets} from '@/lib/server/live-views';
import {scorePredictiveAsset, type PredictiveState} from '@/lib/predictive';

export const dynamic='force-dynamic';

const reference:PredictiveState[]=[
  {assetId:'ref-tx01',assetCode:'TX-01',name:'Main Transformer TX-01',assetType:'TRANSFORMER',site:'Reference Twin',healthScore:58,risk:'HIGH',impact:'CRITICAL',confidence:92,remainingUsefulLifeYears:6.8,anomalies:['Temperature 12.4°C above baseline','2 fault events in last 30 days'],recommendation:'Schedule targeted inspection within 14 days and capture diagnostic evidence.',signals:[{label:'Temperature',value:'69.2°C',status:'watch'},{label:'Load',value:'74%',status:'normal'},{label:'30d faults',value:'2',status:'watch'}]},
  {assetId:'ref-ups01',assetCode:'UPS-2A',name:'UPS Battery System 2A',assetType:'UPS',site:'Reference Twin',healthScore:76,risk:'MODERATE',impact:'HIGH',confidence:88,remainingUsefulLifeYears:2.4,anomalies:['Battery degradation trend detected'],recommendation:'Increase monitoring frequency and review during next planned maintenance window.',signals:[{label:'Temperature',value:'31.1°C',status:'normal'},{label:'Runtime',value:'82%',status:'watch'}]},
  {assetId:'ref-ev01',assetCode:'EVSE-C12',name:'EV Charger C12',assetType:'EV_CHARGER',site:'Reference Twin',healthScore:91,risk:'LOW',impact:'MODERATE',confidence:84,remainingUsefulLifeYears:7.1,anomalies:[],recommendation:'Continue normal monitoring and preventive maintenance cadence.',signals:[{label:'Load',value:'62%',status:'normal'},{label:'THD',value:'3.2%',status:'normal'}]}
];

function riskClass(r:string){return r==='CRITICAL'?'red':r==='HIGH'?'orange':r==='MODERATE'?'amber':'green';}

export default async function PredictivePage(){
  let states:PredictiveState[]=[];let live=true;
  try{states=(await liveAssets()).map(scorePredictiveAsset).sort((a,b)=>a.healthScore-b.healthScore);}catch{live=false;}
  if(!states.length){states=reference;live=false;}
  const critical=states.filter(x=>x.risk==='CRITICAL'||x.risk==='HIGH').length;
  const avg=Math.round(states.reduce((s,x)=>s+x.healthScore,0)/Math.max(states.length,1));
  const due=states.filter(x=>x.risk!=='LOW').length;
  return <>
    <div className="page-head"><div><div className="eyebrow">STRATUM Operate · Predictive Maintenance</div><h1 className="title">Asset health before failure.</h1><p className="subtitle">Explainable health scoring combines telemetry, lifecycle history, baseline deviation and asset criticality to prioritize intervention before infrastructure fails.</p></div><div className="badge">● {live?'LIVE ASSET DATA':'REFERENCE MODE'}</div></div>
    <div className="grid stats" style={{marginTop:20}}>
      <div className="card"><div className="eyebrow">Fleet health</div><h2 style={{fontSize:38,margin:'8px 0'}}>{avg}</h2><span>Average asset health score</span></div>
      <div className="card"><div className="eyebrow">Elevated risk</div><h2 style={{fontSize:38,margin:'8px 0'}}>{critical}</h2><span>High / critical assets</span></div>
      <div className="card"><div className="eyebrow">Action queue</div><h2 style={{fontSize:38,margin:'8px 0'}}>{due}</h2><span>Assets requiring review</span></div>
      <div className="card"><div className="eyebrow">Model mode</div><h2 style={{fontSize:24,margin:'13px 0'}}>{live?'Connected':'Ready'}</h2><span>{live?'Using live asset specifications':'Connect telemetry to activate live scoring'}</span></div>
    </div>

    {!live&&<div className="card" style={{marginTop:16,borderColor:'#6e5927'}}><b>Reference mode</b><p className="subtitle" style={{marginTop:6}}>The predictive engine is active, but production telemetry is not yet available to this deployment. The cards below demonstrate the same scoring model that will consume live sensor and lifecycle fields once connected.</p></div>}

    <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:16,marginTop:16}}>
      <div className="card"><div className="eyebrow">Predictive Health Map</div><h2>Prioritized assets</h2><div style={{display:'grid',gap:12,marginTop:14}}>{states.map(s=><div key={s.assetId} style={{border:'1px solid #23394a',borderRadius:14,padding:16,display:'grid',gridTemplateColumns:'92px 1fr 160px',gap:16,alignItems:'center'}}>
        <div style={{width:74,height:74,borderRadius:'50%',display:'grid',placeItems:'center',border:`7px solid ${s.healthScore<60?'#e65d4f':s.healthScore<82?'#d89a3c':'#33c77b'}`,fontSize:22,fontWeight:800}}>{s.healthScore}</div>
        <div><div className="eyebrow">{s.assetCode} · {s.assetType}</div><h3 style={{margin:'5px 0'}}>{s.name}</h3><div style={{opacity:.7,fontSize:13}}>{s.site}</div>{s.anomalies.length>0&&<div style={{marginTop:9,fontSize:13}}>{s.anomalies.slice(0,2).map(a=><div key={a}>⚠ {a}</div>)}</div>}</div>
        <div><div className={`badge ${riskClass(s.risk)}`}>{s.risk} RISK</div><div style={{fontSize:12,marginTop:10,opacity:.75}}>Impact: {s.impact}<br/>Confidence: {s.confidence}%{s.remainingUsefulLifeYears!==null?<><br/>RUL: {s.remainingUsefulLifeYears} yrs</>:null}</div>{!s.assetId.startsWith('ref-')&&<Link href={`/assets/${s.assetId}`} style={{display:'inline-block',marginTop:10}}>Open asset →</Link>}</div>
      </div>)}</div></div>

      <div className="card"><div className="eyebrow">Decision Engine</div><h2>Next best action</h2><div style={{display:'grid',gap:14,marginTop:14}}>{states.slice(0,4).map(s=><div key={s.assetId} style={{paddingBottom:14,borderBottom:'1px solid #1c3445'}}><b>{s.assetCode}</b><div style={{fontSize:13,marginTop:5,lineHeight:1.45}}>{s.recommendation}</div><div style={{display:'flex',gap:7,flexWrap:'wrap',marginTop:8}}>{s.signals.map(sig=><span key={sig.label} style={{fontSize:11,padding:'4px 7px',border:'1px solid #29475b',borderRadius:20}}>{sig.label}: {sig.value}</span>)}</div></div>)}</div></div>
    </div>

    <div className="card" style={{marginTop:16}}><div className="eyebrow">Closed-loop workflow</div><div className="provenance-map"><div className="prov-step active"><i>01</i><b>Telemetry</b><span>BACnet · Modbus · MQTT · APIs</span></div><em>→</em><div className="prov-step active"><i>02</i><b>Baseline</b><span>Commissioning + operating history</span></div><em>→</em><div className="prov-step active"><i>03</i><b>Risk</b><span>Anomaly · health · impact</span></div><em>→</em><div className="prov-step active"><i>04</i><b>Work Order</b><span>Inspection · repair · evidence</span></div><em>→</em><div className="prov-step active"><i>05</i><b>Verified Outcome</b><span>Hash → STRATUM Chain</span></div></div></div>
  </>;
}
