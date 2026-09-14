'use client';

import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';

type DetectorCtor=new (options?:{formats?:string[]})=>{detect:(source:ImageBitmapSource)=>Promise<Array<{rawValue?:string}>>};
type FieldScannerProps={mode?:'preview'|'standalone';intent?:'inspection'|'capture'};

export default function FieldScanner({mode='preview',intent='inspection'}:FieldScannerProps){
  const videoRef=useRef<HTMLVideoElement|null>(null);
  const streamRef=useRef<MediaStream|null>(null);
  const rafRef=useRef<number|null>(null);
  const router=useRouter();
  const [scanning,setScanning]=useState(false);
  const [value,setValue]=useState('');
  const [detected,setDetected]=useState('');
  const [message,setMessage]=useState('Scan QR / barcode or enter an asset code or serial number.');
  const standalone=mode==='standalone';
  const capture=intent==='capture';

  const stop=()=>{
    if(rafRef.current)cancelAnimationFrame(rafRef.current);
    rafRef.current=null;
    streamRef.current?.getTracks().forEach(t=>t.stop());
    streamRef.current=null;
    setScanning(false);
  };

  useEffect(()=>()=>stop(),[]);

  async function start(){
    if(!navigator.mediaDevices?.getUserMedia){setMessage('Camera scanning is unavailable in this browser. Enter the asset code or serial number below.');return;}
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
      streamRef.current=stream;
      if(videoRef.current){videoRef.current.srcObject=stream;await videoRef.current.play();}
      setScanning(true);setMessage('Camera active. Point it at a QR or equipment barcode.');
      const Detector=(window as unknown as {BarcodeDetector?:DetectorCtor}).BarcodeDetector;
      if(!Detector){setMessage('Camera is active, but automatic QR recognition is not supported by this browser. Use the visible code or enter it below.');return;}
      const detector=new Detector({formats:['qr_code','code_128','code_39','ean_13','data_matrix']});
      const tick=async()=>{
        if(!videoRef.current||videoRef.current.readyState<2||!streamRef.current)return;
        try{
          const results=await detector.detect(videoRef.current);
          const raw=results?.[0]?.rawValue?.trim();
          if(raw){
            let normalized=raw;
            try{const u=new URL(raw);normalized=u.searchParams.get('q')||u.pathname.split('/').filter(Boolean).pop()||raw;}catch{}
            setDetected(normalized);setValue(normalized);setMessage(`Detected ${normalized}`);stop();return;
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

  function continueFlow(){
    const q=(detected||value).trim();
    if(!q){setMessage('Scan or enter an asset code / serial number first.');return;}
    stop();
    router.push(`/inspection?q=${encodeURIComponent(q)}${capture?'&intent=capture':''}`);
  }

  return <div className={standalone?'field-scanner card':'phone'}>
    <div className={standalone?'field-scanner-head':'phone-head'}>STRATUM SPATIAL VERIFIED <span>FIELD</span></div>
    {standalone&&<div><h2>{capture?'Identify equipment to capture evidence':'Identify equipment'}</h2><p className="muted">{capture?'Scan once, then continue into the existing field inspection session to attach evidence without creating a separate workflow.':'Use the rear camera when available. Manual asset code or serial entry remains available when camera recognition is unavailable.'}</p></div>}
    <div className="scan-box" style={{position:'relative',overflow:'hidden'}}>
      {scanning?<video ref={videoRef} playsInline muted autoPlay aria-label="Live equipment scanner camera" style={{width:'100%',height:'100%',objectFit:'cover',position:'absolute',inset:0}}/>:<><div className="scan-line"/><b>{detected?'Equipment detected':'Scan equipment'}</b><span>{detected||'QR · Barcode · Serial'}</span></>}
    </div>
    <div className={standalone?'scanner-status':'phone-card'} aria-live="polite"><small>Scanner status</small><strong>{detected||'Ready to identify equipment'}</strong><span>{message}</span></div>
    <button className={standalone?'action':undefined} type="button" onClick={scanning?stop:start}>{scanning?'Stop camera':'Open scanner'}</button>
    <div style={{display:'grid',gap:8,marginTop:10}}>
      <label className={standalone?'scanner-manual-label':undefined}><span className={standalone?'muted':undefined}>{standalone?'Manual fallback':''}</span><input aria-label="Asset code or serial" value={value} onChange={e=>{setValue(e.target.value);setDetected('')}} placeholder="Asset code / serial / QR value" style={{width:'100%',padding:'11px 12px',borderRadius:9,border:'1px solid #244c67',background:'#07131f',color:'#fff'}}/></label>
      <button className={standalone?'action':undefined} type="button" onClick={continueFlow} disabled={!value.trim()&&!detected} style={{opacity:(!value.trim()&&!detected)?.55:1}}>{capture?'Continue to field capture':'Continue inspection'}</button>
    </div>
    {standalone&&<p className="muted scanner-resilience">The scanned identifier remains in this page state if the camera stops. Inspection drafts are persisted locally on the next step so field work can recover from an interrupted session.</p>}
    <style jsx>{`
      .field-scanner{max-width:720px;margin:0 auto;display:grid;gap:14px}.field-scanner-head{font-size:11px;font-weight:900;letter-spacing:.08em;color:var(--muted)}.field-scanner-head span{color:var(--cyan)}.field-scanner .scan-box{min-height:300px;border-radius:14px}.scanner-status{display:grid;gap:4px;padding:12px;border:1px solid var(--line);border-radius:10px;background:rgba(0,0,0,.14)}.scanner-status small,.scanner-status span{color:var(--muted)}.scanner-manual-label{display:grid;gap:6px}.scanner-resilience{font-size:11px;line-height:1.5;margin:0}@media(max-width:600px){.field-scanner{padding:12px}.field-scanner .scan-box{min-height:46vh}.field-scanner button{width:100%;min-height:48px}}
    `}</style>
  </div>;
}
