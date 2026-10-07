'use client';

import {useEffect,useMemo,useState} from 'react';

type Reading={
 id:string;
 sensor_key:string;
 measurement:string;
 unit:string;
 value_json:number|string|boolean;
 quality:'GOOD'|'UNCERTAIN'|'BAD';
 observed_at:string;
 received_at:string;
 source_protocol:string;
 source_ref?:string|null;
 truth_boundary?:string;
};

function numeric(value:unknown){
 const n=Number(value);
 return Number.isFinite(n)?n:null;
}

function Trend({values}:{values:number[]}){
 if(values.length<2)return <span className="muted">trend pending</span>;
 const min=Math.min(...values),max=Math.max(...values),range=Math.max(max-min,0.000001);
 const points=values.map((value,index)=>`${(index/(values.length-1))*100},${28-((value-min)/range)*24}`).join(' ');
 return <svg viewBox="0 0 100 32" width="110" height="32" role="img" aria-label="Recent telemetry trend">
  <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke"/>
 </svg>;
}

export default function AssetTelemetryPanel({assetId}:{assetId:string}){
 const [latest,setLatest]=useState<Reading[]>([]);
 const [history,setHistory]=useState<Record<string,Reading[]>>({});
 const [status,setStatus]=useState('CONNECTING');
 const [message,setMessage]=useState('');

 useEffect(()=>{
  let active=true;
  let stream:EventSource|null=null;
  const apply=(reading:Reading)=>{
   setLatest(current=>{
    const next=current.filter(item=>item.sensor_key!==reading.sensor_key);
    return [...next,reading].sort((a,b)=>a.measurement.localeCompare(b.measurement));
   });
   setHistory(current=>{
    const values=[...(current[reading.sensor_key]||[]),reading].slice(-20);
    return {...current,[reading.sensor_key]:values};
   });
  };
  const load=async()=>{
   try{
    const response=await fetch('/api/telemetry/latest?assetId='+encodeURIComponent(assetId),{cache:'no-store',credentials:'same-origin'});
    const body=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(body?.error||'Unable to load telemetry');
    if(!active)return;
    const readings=Array.isArray(body.readings)?body.readings as Reading[]:[];
    setLatest(readings);
    setHistory(Object.fromEntries(readings.map(reading=>[reading.sensor_key,[reading]])));
    setStatus('LIVE');
    stream=new EventSource('/api/telemetry/stream?assetId='+encodeURIComponent(assetId));
    stream.addEventListener('snapshot',event=>{
     if(!active)return;
     const payload=JSON.parse((event as MessageEvent).data||'{}');
     for(const reading of payload.readings||[])apply(reading);
     setStatus('LIVE');
    });
    stream.addEventListener('reading',event=>{
     if(!active)return;
     apply(JSON.parse((event as MessageEvent).data));
     setStatus('LIVE');
    });
    stream.addEventListener('error',()=>{if(active)setStatus('RECONNECTING')});
   }catch(error){
    if(active){setStatus('UNAVAILABLE');setMessage(error instanceof Error?error.message:'Telemetry unavailable')}
   }
  };
  void load();
  return()=>{active=false;stream?.close()};
 },[assetId]);

 const bad=useMemo(()=>latest.filter(item=>item.quality!=='GOOD').length,[latest]);

 return <section className="card" style={{marginTop:12,padding:14}} aria-label="Live asset telemetry">
  <div className="section-head">
   <div>
    <div className="eyebrow">Observed operations</div>
    <h3 style={{margin:'3px 0'}}>Live telemetry</h3>
   </div>
   <span className={status==='LIVE'?'proof':'pending'}>{status}</span>
  </div>
  <p className="muted" style={{marginTop:4}}>Operational telemetry is Observed data. It can inform status and maintenance, but it never silently changes Verified state, asset identity, DIR finality, or PoVI finality.</p>
  {bad>0&&<div className="notice" role="status"><strong>TELEMETRY QUALITY ATTENTION</strong><span>{bad} current point{bad===1?'':'s'} report UNCERTAIN or BAD quality.</span></div>}
  {message&&<div className="notice" role="status"><strong>TELEMETRY UNAVAILABLE</strong><span>{message}</span></div>}
  {latest.length?<div style={{display:'grid',gap:8}}>
   {latest.map(reading=>{
    const values=(history[reading.sensor_key]||[]).map(item=>numeric(item.value_json)).filter((value):value is number=>value!==null);
    return <div key={reading.sensor_key} style={{display:'grid',gridTemplateColumns:'minmax(150px,1.4fr) minmax(90px,.6fr) 120px minmax(120px,.8fr)',gap:10,alignItems:'center',padding:'9px 0',borderBottom:'1px solid #17334a'}}>
     <div><strong>{reading.measurement}</strong><small className="muted" style={{display:'block'}}>{reading.sensor_key}</small></div>
     <div><strong>{String(reading.value_json)} {reading.unit}</strong><small className="muted" style={{display:'block'}}>{reading.quality}</small></div>
     <Trend values={values}/>
     <div><small className="muted">{reading.source_protocol.replaceAll('_',' ')}<br/>{new Date(reading.observed_at).toLocaleTimeString()}</small></div>
    </div>;
   })}
  </div>:status!=='UNAVAILABLE'&&<p className="muted">No telemetry readings have been received for this asset yet.</p>}
 </section>;
}
