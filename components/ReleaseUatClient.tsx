'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {BrowserQRCodeReader} from '@zxing/browser';

type Check={status:'pending'|'pass'|'fail';detail:string};
type Evidence={
 sessionId:string;
 webgl:Check;
 qrDecoder:Check;
 camera:Check;
 submitted:boolean;
};

const initial:Check={status:'pending',detail:'Not tested yet'};

function newSession(){
 try{return crypto.randomUUID()}catch{return `uat-${Date.now()}-${Math.random().toString(36).slice(2)}`}
}

export default function ReleaseUatClient(){
 const [sessionId]=useState(newSession);
 const [webgl,setWebgl]=useState<Check>(initial);
 const [qrDecoder,setQrDecoder]=useState<Check>(initial);
 const [camera,setCamera]=useState<Check>(initial);
 const [submitted,setSubmitted]=useState(false);
 const [submitError,setSubmitError]=useState('');
 const videoRef=useRef<HTMLVideoElement>(null);

 const allPass=useMemo(()=>[webgl,qrDecoder,camera].every(x=>x.status==='pass'),[webgl,qrDecoder,camera]);

 useEffect(()=>{
  try{
   const canvas=document.createElement('canvas');
   const gl=(canvas.getContext('webgl2')||canvas.getContext('webgl')) as WebGLRenderingContext|null;
   if(!gl){setWebgl({status:'fail',detail:'WebGL context unavailable'});return}
   const version=String(gl.getParameter(gl.VERSION)||'WebGL');
   let renderer='renderer available';
   const debug=gl.getExtension('WEBGL_debug_renderer_info') as any;
   if(debug)renderer=String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)||renderer);
   setWebgl({status:'pass',detail:`${version} · ${renderer}`});
  }catch(error){
   setWebgl({status:'fail',detail:error instanceof Error?error.message:'WebGL probe failed'});
  }
 },[]);

 useEffect(()=>{
  let cancelled=false;
  (async()=>{
   try{
    const reader=new BrowserQRCodeReader();
    const target=`/api/release-uat/qr?session=${encodeURIComponent(sessionId)}`;
    const result=await reader.decodeFromImageUrl(target);
    if(cancelled)return;
    const text=result.getText();
    const expected=`STRATUM-RELEASE-UAT:${sessionId}`;
    if(text!==expected)throw new Error('Decoded QR payload did not match release target');
    setQrDecoder({status:'pass',detail:'ZXing decoded the release QR target on this device'});
   }catch(error){
    if(!cancelled)setQrDecoder({status:'fail',detail:error instanceof Error?error.message:'QR decoder failed'});
   }
  })();
  return()=>{cancelled=true};
 },[sessionId]);

 async function submit(nextCamera:Check){
  const payload={
   sessionId,
   webgl,
   qrDecoder,
   camera:nextCamera,
   timestamp:new Date().toISOString(),
   screen:{width:window.screen.width,height:window.screen.height,pixelRatio:window.devicePixelRatio},
   viewport:{width:window.innerWidth,height:window.innerHeight},
   touchPoints:navigator.maxTouchPoints||0,
  };
  try{
   const response=await fetch('/api/release-uat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
   if(!response.ok)throw new Error(`Evidence submission failed: ${response.status}`);
   setSubmitted(true);
   setSubmitError('');
  }catch(error){
   setSubmitted(false);
   setSubmitError(error instanceof Error?error.message:'Evidence submission failed');
  }
 }

 async function runCamera(){
  setCamera({status:'pending',detail:'Requesting real camera stream…'});
  let stream:MediaStream|undefined;
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera API unavailable in this browser');
   stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
   const track=stream.getVideoTracks()[0];
   if(!track)throw new Error('No video track returned');
   const video=videoRef.current;
   if(video){
    video.srcObject=stream;
    await video.play();
   }
   const settings=track.getSettings();
   const next:Check={
    status:'pass',
    detail:`Camera stream opened${settings.facingMode?` · ${settings.facingMode}`:''}${settings.width&&settings.height?` · ${settings.width}×${settings.height}`:''}`,
   };
   setCamera(next);
   await submit(next);
  }catch(error){
   const next:Check={status:'fail',detail:error instanceof Error?error.message:'Camera test failed'};
   setCamera(next);
   await submit(next);
  }finally{
   stream?.getTracks().forEach(track=>track.stop());
   if(videoRef.current)videoRef.current.srcObject=null;
  }
 }

 const row=(name:string,value:Check)=><div className="notice" style={{marginTop:10}}>
  <strong>{value.status==='pass'?'✓':value.status==='fail'?'✕':'…'} {name}</strong>
  <span>{value.detail}</span>
 </div>;

 return <div className="card" style={{maxWidth:820}}>
  <div className="eyebrow">Physical-device release acceptance</div>
  <h1 className="title">Release UAT</h1>
  <p className="subtitle">Run this page on the real phone or tablet being accepted. It tests a live WebGL context, the shipped QR decoder and an actual camera stream. No photo/video is uploaded or retained.</p>
  {row('WebGL',webgl)}
  {row('QR decoder',qrDecoder)}
  {row('Camera',camera)}
  <div className="button-row" style={{marginTop:18}}>
   <button className="action" type="button" onClick={runCamera} disabled={webgl.status==='pending'||qrDecoder.status==='pending'}>{webgl.status==='pending'||qrDecoder.status==='pending'?'Preparing device checks…':'Run camera test + submit evidence'}</button>
  </div>
  <video ref={videoRef} muted playsInline style={{width:1,height:1,opacity:.01,position:'absolute',pointerEvents:'none'}}/>
  <div className="notice" style={{marginTop:14}}>
   <strong>UAT SESSION</strong>
   <span className="mono">{sessionId}</span>
  </div>
  {submitted&&<div className="notice" style={{marginTop:10}}><strong>{allPass?'✓ EVIDENCE SUBMITTED':'EVIDENCE SUBMITTED WITH A FAILED CHECK'}</strong><span>{allPass?'WebGL, QR decoder and camera all passed on this physical device.':'Review the failed check above before release certification.'}</span></div>}
  {submitError&&<div className="notice" style={{marginTop:10}}><strong>SUBMISSION ERROR</strong><span>{submitError}</span></div>}
  <p className="muted" style={{marginTop:16}}>This device check confirms browser/device capability only. It does not establish asset identity, physical truth, Verified state, DIR finality or PoVI finality.</p>
 </div>;
}
