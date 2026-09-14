'use client';

import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {normalizeScanValue} from '@/lib/scan-code';

type DetectorCtor=new (options?:{formats?:string[]})=>{detect:(source:ImageBitmapSource)=>Promise<Array<{rawValue?:string}>>};
type ResolvedAsset={
 id:string;asset_code:string;asset_type:string;name:string;serial_number:string|null;location_label:string|null;status:string;
 project_id:string;project_code:string;project_name:string;site_name:string;system_name:string|null;
 administratively_archived?:boolean;administrative_state?:string;archive_reason?:string|null;archive_occurred_at?:string|null;
};

export default function FieldScanner(){
  const videoRef=useRef<HTMLVideoElement|null>(null);
  const streamRef=useRef<MediaStream|null>(null);
  const rafRef=useRef<number|null>(null);
  const router=useRouter();
  const [scanning,setScanning]=useState(false);
  const [starting,setStarting]=useState(false);
  const [resolving,setResolving]=useState(false);
  const generation=useRef(0);
  const [value,setValue]=useState('');
  const [asset,setAsset]=useState<ResolvedAsset|null>(null);
  const [message,setMessage]=useState('Scan a STRATUM QR / barcode or enter an asset code or serial number.');

  const stop=()=>{
    generation.current++;setStarting(false);
    if(rafRef.current!==null)cancelAnimationFrame(rafRef.current);
    rafRef.current=null;
    streamRef.current?.getTracks().forEach(t=>t.stop());
    streamRef.current=null;
    setScanning(false);
  };

  useEffect(()=>()=>stop(),[]);

  async function identify(input=value){
    const normalized=normalizeScanValue(input);
    setAsset(null);
    if(!normalized){setMessage('This QR / code format is not recognized. Use a STRATUM asset code, serial, QR token, Passport URL, or public verification URL.');return;}
    setValue(normalized.query);setResolving(true);setMessage('Resolving asset inside your active organization…');
    try{
      const response=await fetch(`/api/assets/resolve?q=${encodeURIComponent(normalized.query)}`,{cache:'no-store',credentials:'same-origin'});
      const body=await response.json();
      if(!response.ok)throw Object.assign(new Error(body.error||'Asset lookup failed'),{status:response.status});
      setAsset(body.asset);
      if(body.asset?.administratively_archived)setMessage('Asset identified, but it is administratively archived. Inspection is blocked until it is restored by an authorized administrator.');
      else setMessage('Asset identified in your organization. Opening it does not establish Verified state; continue to the controlled inspection or Passport as needed.');
    }catch(error:any){
      if(error?.status===401)setMessage('Sign in before resolving field assets. Public verification remains available separately.');
      else setMessage(error instanceof Error?error.message:'Asset lookup failed');
    }finally{setResolving(false);}
  }

  async function start(){
    setAsset(null);
    if(!navigator.mediaDevices?.getUserMedia){setMessage('Camera scanning is unavailable in this browser. Enter the asset code or serial number below.');return;}
    const attempt=++generation.current;setStarting(true);
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
      if(attempt!==generation.current){stream.getTracks().forEach(t=>t.stop());return;}
      streamRef.current=stream;
      if(videoRef.current){videoRef.current.srcObject=stream;await videoRef.current.play();}
      setStarting(false);setScanning(true);setMessage('Camera active. Point it at a STRATUM QR or equipment barcode.');
      const Detector=(window as unknown as {BarcodeDetector?:DetectorCtor}).BarcodeDetector;
      if(!Detector){setMessage('Camera is active, but automatic QR recognition is not supported by this browser. Use the visible code or enter it below.');return;}
      const detector=new Detector({formats:['qr_code','code_128','code_39','ean_13','data_matrix']});
      const tick=async()=>{
        if(!streamRef.current||attempt!==generation.current)return;
        if(!videoRef.current||videoRef.current.readyState<2){rafRef.current=requestAnimationFrame(tick);return;}
        try{
          const results=await detector.detect(videoRef.current);
          const raw=results?.[0]?.rawValue?.trim();
          if(raw){
            const normalized=normalizeScanValue(raw);
            if(!normalized){setMessage('A code was detected, but its payload is not a supported STRATUM identity format.');stop();return;}
            setValue(normalized.query);stop();void identify(normalized.query);return;
          }
        }catch{}
        rafRef.current=requestAnimationFrame(tick);
      };
      rafRef.current=requestAnimationFrame(tick);
    }catch(err){
      const name=err instanceof DOMException?err.name:'CameraError';
      setMessage(name==='NotAllowedError'?'Camera permission was denied. Allow camera access in the browser, or enter the asset code manually.':'Could not start the camera. Enter the asset code or serial number manually.');
      stop();
    }
  }

  function continueInspection(){
    if(!asset){setMessage('Identify an asset in your organization before starting inspection.');return;}
    if(asset.administratively_archived){setMessage('Archived assets cannot start a new inspection. Restore the asset first.');return;}
    stop();router.push(`/inspection?q=${encodeURIComponent(asset.id)}`);
  }

  return <div className="phone">
    <div className="phone-head">STRATUM VERIFIED <span>FIELD</span></div>
    <div className="scan-box" style={{position:'relative',overflow:'hidden'}}>
      <video ref={videoRef} playsInline muted autoPlay style={{width:'100%',height:'100%',objectFit:'cover',position:'absolute',inset:0,display:scanning?'block':'none'}}/>{!scanning&&<><div className="scan-line"/><b>{asset?'Asset identified':'Scan equipment'}</b><span>{asset?.asset_code||'QR · Barcode · Serial'}</span></>}
    </div>
    <div className="phone-card"><small>Scanner status</small><strong>{asset?.name||'Ready to identify equipment'}</strong><span>{message}</span></div>
    <button type="button" disabled={starting||resolving} onClick={scanning?stop:start}>{scanning?'Stop camera':starting?'Starting camera…':'Open scanner'}</button>
    <div style={{display:'grid',gap:8,marginTop:10}}>
      <input aria-label="Asset code or serial" value={value} onChange={e=>{setValue(e.target.value);setAsset(null)}} placeholder="Asset code / serial / QR value" style={{width:'100%',padding:'11px 12px',borderRadius:9,border:'1px solid #244c67',background:'#07131f',color:'#fff'}}/>
      <button type="button" onClick={()=>identify()} disabled={!value.trim()||resolving} style={{opacity:(!value.trim()||resolving)?0.55:1}}>{resolving?'Resolving…':'Identify asset'}</button>
    </div>
    {asset&&<div className="phone-card" style={{marginTop:10}}><small>{asset.administratively_archived?'ADMINISTRATIVELY ARCHIVED':'LIVE TENANT ASSET'}</small><strong>{asset.asset_code} · {asset.name}</strong><span>{asset.site_name} · {asset.location_label||'Location pending'}</span>{asset.administratively_archived&&<span>{asset.archive_reason||'Archived by an authorized administrator.'}</span>}<div className="button-row" style={{marginTop:10}}><Link className="action" href={`/assets/${encodeURIComponent(asset.id)}`}>Open Passport</Link><Link className="action" href={`/verify?q=${encodeURIComponent(asset.asset_code)}`}>Public verification</Link></div><button type="button" onClick={continueInspection} disabled={Boolean(asset.administratively_archived)} style={{width:'100%',marginTop:8,opacity:asset.administratively_archived?0.55:1}}>Continue inspection</button></div>}
    <p className="muted" style={{fontSize:11,marginTop:10}}>QR/barcode recognition establishes identity lookup only. It does not establish Verified state, DIR finality, PoVI finality, or physical truth.</p>
  </div>;
}
