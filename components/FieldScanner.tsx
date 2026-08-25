'use client';

import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';

type DetectorCtor=new (options?:{formats?:string[]})=>{detect:(source:ImageBitmapSource)=>Promise<Array<{rawValue?:string}>>};

export default function FieldScanner(){
  const videoRef=useRef<HTMLVideoElement|null>(null);
  const streamRef=useRef<MediaStream|null>(null);
  const rafRef=useRef<number|null>(null);
  const router=useRouter();
  const [scanning,setScanning]=useState(false);
  const [value,setValue]=useState('');
  const [detected,setDetected]=useState('');
  const [message,setMessage]=useState('Scan QR / barcode or enter an asset code or serial number.');

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
    router.push(`/inspection?q=${encodeURIComponent(q)}`);
  }

  return <div className="phone">
    <div className="phone-head">STRATUM VERIFIED <span>FIELD</span></div>
    <div className="scan-box" style={{position:'relative',overflow:'hidden'}}>
      {scanning?<video ref={videoRef} playsInline muted autoPlay style={{width:'100%',height:'100%',objectFit:'cover',position:'absolute',inset:0}}/>:<><div className="scan-line"/><b>{detected?'Equipment detected':'Scan equipment'}</b><span>{detected||'QR · Barcode · Serial'}</span></>}
    </div>
    <div className="phone-card"><small>Scanner status</small><strong>{detected||'Ready to identify equipment'}</strong><span>{message}</span></div>
    <button type="button" onClick={scanning?stop:start}>{scanning?'Stop camera':'Open scanner'}</button>
    <div style={{display:'grid',gap:8,marginTop:10}}>
      <input aria-label="Asset code or serial" value={value} onChange={e=>{setValue(e.target.value);setDetected('')}} placeholder="Asset code / serial / QR value" style={{width:'100%',padding:'11px 12px',borderRadius:9,border:'1px solid #244c67',background:'#07131f',color:'#fff'}}/>
      <button type="button" onClick={continueFlow} disabled={!value.trim()&&!detected} style={{opacity:(!value.trim()&&!detected)?.55:1}}>Continue inspection</button>
    </div>
  </div>;
}
