'use client';

import Link from 'next/link';
import {ChangeEvent,useEffect,useMemo,useRef,useState} from 'react';
import {resolveElectricalComponent} from '@/lib/electrical-component-library';
import styles from './TwinWorkspace.module.css';

export type TwinAsset={id:string;asset_code:string;asset_type:string;name:string;model:string|null;serial_number:string|null;location_label:string|null;status:string;project_code:string;project_name:string;site_name:string;system_name:string|null;manufacturer_name:string|null;latest_event_type:string|null;ledger_network:string|null;ledger_tx_hash:string|null;ledger_block_height:string|null};
type DiscoveredObject={name:string;sourceId:string;assetId?:string|null;layer:string};
type IngestResult={twin:{id:string;assetCode:string;name:string};assets:{id:string;assetCode:string;name:string;eventId:string;canonicalHash:string}[]};
type LayerId='L0'|'L1'|'L2'|'L3'|'L4'|'L5'|'L6'|'L7'|'L8';

const LAYERS:{id:LayerId;name:string;short:string}[]=[
 {id:'L0',name:'Source',short:'CAD · PDF · BIM'},
 {id:'L1',name:'Architectural',short:'Rooms · walls · floors'},
 {id:'L2',name:'Electrical Physical',short:'Equipment · devices'},
 {id:'L3',name:'Electrical Logical',short:'Feeders · circuits'},
 {id:'L4',name:'STRATUM Assets',short:'Tracked identities'},
 {id:'L5',name:'Installation',short:'As-installed progress'},
 {id:'L6',name:'Evidence',short:'Photos · QA · tests'},
 {id:'L7',name:'Operations',short:'Health · work · telemetry'},
 {id:'L8',name:'Trust / DIR',short:'Immutable record proof'}
];
const normalize=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const assetKeys=(a:TwinAsset)=>[a.asset_code,a.name,a.asset_type,a.serial_number||'',a.model||''].map(normalize).filter(Boolean);
function matchAsset(name:string,assets:TwinAsset[]){const n=normalize(name);if(!n)return null;return assets.find(a=>assetKeys(a).some(k=>k.length>3&&(n.includes(k)||k.includes(n))))||null;}
function classifyLayer(name:string):LayerId{const n=name.toLowerCase();if(/wall|door|floor|room|ceiling|roof|stair|column|architect/.test(n))return'L1';if(/feeder|circuit|wire|cable|conduit|tray|busway|busduct|line|path/.test(n))return'L3';if(resolveElectricalComponent(name)||/panel|transform|switchgear|breaker|ats|generator|ups|charger|evse|recept|outlet|disconnect|meter|equipment|pdu|mcc|motor|pump|inverter|battery|sensor/.test(n))return'L2';return'L2';}

export default function TwinWorkspace({assets,referenceModelUrl}:{assets:TwinAsset[];referenceModelUrl?:string}){
 const mount=useRef<HTMLDivElement|null>(null);
 const [modelUrl,setModelUrl]=useState(referenceModelUrl||'');
 const [modelName,setModelName]=useState(referenceModelUrl?'STRATUM Reference Twin':'Layered Infrastructure Twin');
 const [modelSha256,setModelSha256]=useState('');
 const [sourceType,setSourceType]=useState(referenceModelUrl?'GLTF':'REFERENCE');
 const [objects,setObjects]=useState<DiscoveredObject[]>([]);
 const [layerCounts,setLayerCounts]=useState<Record<string,number>>({});
 const [selected,setSelected]=useState<TwinAsset|null>(assets[0]||null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [mode,setMode]=useState<'all'|'verified'|'pending'>('all');
 const [activeLayers,setActiveLayers]=useState<LayerId[]>(LAYERS.map(l=>l.id));
 const fileUrl=useRef<string|null>(null);
 const verifiedCount=useMemo(()=>assets.filter(a=>!!a.ledger_block_height).length,[assets]);
 const boundCount=useMemo(()=>objects.filter(o=>o.assetId).length,[objects]);
 const toggleLayer=(id:LayerId)=>setActiveLayers(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id]);

 async function onFile(e:ChangeEvent<HTMLInputElement>){
  const file=e.target.files?.[0];if(!file)return;
  const ext=(file.name.split('.').pop()||'').toLowerCase();
  const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
  setModelSha256(Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join(''));
  setModelName(file.name);setSourceType(ext.toUpperCase());
  if(fileUrl.current)URL.revokeObjectURL(fileUrl.current);
  if(['glb','gltf'].includes(ext)){
   fileUrl.current=URL.createObjectURL(file);setModelUrl(fileUrl.current);
   setMessage('3D model loaded. Recognized electrical objects are classified against the STRATUM Electrical Component Library and bound to asset/DIR state when matches exist.');
  }else{
   setModelUrl('');
   setMessage(`${file.name} is registered as L0 Source. Use Twin Compiler for PDF/CAD/BIM extraction; recognized components are mapped to the Electrical Component Library before spatial Twin generation.`);
  }
  e.target.value='';
 }

 async function ingest(){
  const candidates=objects.filter(o=>!o.assetId&&['L2','L4'].includes(o.layer));
  if(!candidates.length){setMessage('No unbound physical asset candidates are available to register.');return;}
  setBusy(true);setMessage('Registering candidate assets and creating immutable DIR lifecycle records…');
  try{
   const r=await fetch('/api/twin/ingest',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({modelName,modelSha256:modelSha256||undefined,objects:candidates.map(o=>({name:o.name,sourceId:o.sourceId}))})});
   const j=await r.json();if(!r.ok)throw new Error(j.error||'Twin ingestion failed');
   const out=j as IngestResult;setMessage(`${out.assets.length} durable asset identities created under ${out.twin.assetCode}. Their immutable DIR records are hashed and awaiting approval.`);setTimeout(()=>location.reload(),1100);
  }catch(e){setMessage(e instanceof Error?e.message:'Twin ingestion failed');}finally{setBusy(false);}
 }

 useEffect(()=>{
  let disposed=false;let cleanup=()=>{};
  (async()=>{
   if(!mount.current)return;
   const THREE=await import('three');const {OrbitControls}=await import('three/examples/jsm/controls/OrbitControls.js');const {GLTFLoader}=await import('three/examples/jsm/loaders/GLTFLoader.js');
   if(disposed||!mount.current)return;
   const host=mount.current;const scene=new THREE.Scene();scene.background=new THREE.Color(0x061019);scene.fog=new THREE.FogExp2(0x061019,.014);
   const camera=new THREE.PerspectiveCamera(42,host.clientWidth/Math.max(host.clientHeight,1),.1,2000);camera.position.set(18,15,22);
   const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(host.clientWidth,host.clientHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;host.replaceChildren(renderer.domElement);
   const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.target.set(0,1.4,0);
   scene.add(new THREE.HemisphereLight(0xc8ebff,0x071018,2.5));const key=new THREE.DirectionalLight(0xffffff,3.2);key.position.set(10,18,12);scene.add(key);
   const groups:Record<LayerId,any>=Object.fromEntries(LAYERS.map(l=>[l.id,new THREE.Group()])) as any;LAYERS.forEach(l=>{groups[l.id].visible=activeLayers.includes(l.id);scene.add(groups[l.id]);});
   const clickable:any[]=[];const discovery:DiscoveredObject[]=[];const counts:Record<string,number>={};const bump=(l:LayerId)=>counts[l]=(counts[l]||0)+1;
   const mat=(color:number,emissive=0)=>new THREE.MeshStandardMaterial({color,metalness:.35,roughness:.45,emissive,emissiveIntensity:.35,transparent:true,opacity:.96});
   const sourceMat=new THREE.MeshStandardMaterial({color:0x163f59,emissive:0x071d2b,emissiveIntensity:.4,transparent:true,opacity:.32,side:THREE.DoubleSide});
   const verifiedMat=()=>mat(0x25c979,0x062a1d);const pendingMat=()=>mat(0x4b9bd1,0x081c2b);const physicalMat=()=>mat(0xd28a3e,0x2e1606);const steel=()=>mat(0x667b88);const dark=()=>mat(0x24313a);const copper=()=>mat(0xb87333);
   function addBox(group:LayerId,name:string,size:[number,number,number],pos:[number,number,number],material:any,assetId:string|null=null){const m=new THREE.Mesh(new THREE.BoxGeometry(...size),material);m.position.set(...pos);m.userData={assetId,objectName:name,layer:group};groups[group].add(m);bump(group);if(group==='L2'||group==='L4'){clickable.push(m);discovery.push({name,sourceId:`${group}-${name}`,assetId,layer:group});}return m;}
   function line(group:LayerId,pts:[number,number,number][],color:number){const obj=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(p=>new THREE.Vector3(...p))),new THREE.LineBasicMaterial({color}));groups[group].add(obj);bump(group);return obj;}
   function registerRoot(root:any,name:string,assetId:string|null){root.userData={assetId,objectName:name,layer:'L2'};root.traverse((node:any)=>{if(node.isMesh){node.userData={assetId,objectName:name,layer:'L2'};clickable.push(node);}});groups.L2.add(root);bump('L2');discovery.push({name,sourceId:`L2-${name}`,assetId,layer:'L2'});}
   function equipment(name:string,pos:[number,number,number],asset:TwinAsset|null,scale=1){
    const def=resolveElectricalComponent(name);const shape=def?.twinShape||'cabinet';const root=new THREE.Group();root.position.set(...pos);root.scale.setScalar(scale);const primary=asset?(asset.ledger_block_height?verifiedMat():pendingMat()):physicalMat();
    const mesh=(geo:any,material:any,p:[number,number,number]=[0,0,0],r:[number,number,number]=[0,0,0])=>{const m=new THREE.Mesh(geo,material);m.position.set(...p);m.rotation.set(...r);root.add(m);return m;};
    if(shape==='transformer'){
     mesh(new THREE.BoxGeometry(2.3,2.2,1.7),primary,[0,1.2,0]);for(let x=-.65;x<=.65;x+=.65)mesh(new THREE.CylinderGeometry(.15,.21,.75,14),steel(),[x,2.65,0]);for(let x=-.85;x<=.85;x+=.34)mesh(new THREE.BoxGeometry(.08,1.7,1.9),dark(),[x,1.2,0]);
    }else if(['cabinet','panel','meter','breaker','rack'].includes(shape)){
     const w=shape==='panel'?1.2:shape==='rack'?1.7:2,h=shape==='breaker'?1.5:2.8,d=shape==='panel'?.45:1;mesh(new THREE.BoxGeometry(w,h,d),primary,[0,h/2,0]);mesh(new THREE.BoxGeometry(w*.78,h*.74,.04),dark(),[0,h/2,d/2+.025]);if(shape==='meter')mesh(new THREE.CylinderGeometry(.28,.28,.08,24),new THREE.MeshBasicMaterial({color:0x8bd5ea}),[0,h*.62,d/2+.08],[Math.PI/2,0,0]);else mesh(new THREE.BoxGeometry(.18,.08,.06),copper(),[w*.27,h*.53,d/2+.06]);
    }else if(shape==='generator'){
     mesh(new THREE.BoxGeometry(3.1,.35,1.7),dark(),[0,.2,0]);mesh(new THREE.BoxGeometry(1.7,1.6,1.4),primary,[.45,1.15,0]);mesh(new THREE.CylinderGeometry(.52,.52,1.35,18),steel(),[-.9,1.1,0],[0,0,Math.PI/2]);mesh(new THREE.CylinderGeometry(.08,.08,1.25,10),steel(),[1.1,2.25,.35]);
    }else if(shape==='evse'){
     mesh(new THREE.BoxGeometry(.85,1.8,.55),primary,[0,1.1,0]);mesh(new THREE.BoxGeometry(.48,.42,.05),new THREE.MeshBasicMaterial({color:0x3be39a}),[0,1.42,.3]);mesh(new THREE.CylinderGeometry(.09,.09,.65,12),dark(),[.58,1.1,0]);
    }else if(shape==='receptacle'){
     mesh(new THREE.BoxGeometry(.46,.68,.12),steel(),[0,.45,0]);mesh(new THREE.CylinderGeometry(.055,.055,.04,12),dark(),[-.1,.52,.08],[Math.PI/2,0,0]);mesh(new THREE.CylinderGeometry(.055,.055,.04,12),dark(),[.1,.52,.08],[Math.PI/2,0,0]);
    }else if(shape==='motor'){
     mesh(new THREE.CylinderGeometry(.7,.7,1.6,24),primary,[0,.8,0],[0,0,Math.PI/2]);mesh(new THREE.CylinderGeometry(.16,.16,.9,14),steel(),[1.15,.8,0],[0,0,Math.PI/2]);mesh(new THREE.BoxGeometry(1.5,.18,1.1),dark(),[0,.12,0]);
    }else if(shape==='battery'){
     for(let x=-.9;x<=.9;x+=.6)mesh(new THREE.BoxGeometry(.48,1.2,.75),primary,[x,.7,0]);mesh(new THREE.BoxGeometry(2.4,.16,.9),dark(),[0,.08,0]);
    }else if(shape==='solar'){
     mesh(new THREE.BoxGeometry(2.8,.12,1.7),new THREE.MeshStandardMaterial({color:0x255c86,metalness:.55,roughness:.25}),[0,1.2,0],[-.35,0,0]);mesh(new THREE.BoxGeometry(.15,1.2,.15),steel(),[0,.55,.45]);
    }else if(shape==='busduct'||shape==='tray'||shape==='conduit'){
     if(shape==='conduit')mesh(new THREE.CylinderGeometry(.18,.18,3.2,16),steel(),[0,1,0],[0,0,Math.PI/2]);else mesh(new THREE.BoxGeometry(3.2,.32,shape==='tray'?.8:.55),primary,[0,1,0]);
    }else if(shape==='light'){
     mesh(new THREE.CylinderGeometry(.75,.25,.45,22),new THREE.MeshStandardMaterial({color:0xe8e2c0,emissive:0xffe8a3,emissiveIntensity:1}),[0,2.3,0]);
    }else if(shape==='sensor'){
     mesh(new THREE.CylinderGeometry(.18,.18,.55,16),primary,[0,1.1,0]);mesh(new THREE.SphereGeometry(.22,16,12),new THREE.MeshBasicMaterial({color:0x54dca0}),[0,1.45,0]);
    }else if(shape==='ground'){
     mesh(new THREE.CylinderGeometry(.06,.06,2.2,10),copper(),[0,.95,0]);mesh(new THREE.BoxGeometry(1.1,.08,.22),copper(),[0,.1,0]);
    }else{
     mesh(new THREE.BoxGeometry(1.2,1.2,1.2),primary,[0,.7,0]);
    }
    registerRoot(root,name,asset?.id||null);
    if(asset){const badge=new THREE.Mesh(new THREE.BoxGeometry(.42,.42,.42),new THREE.MeshBasicMaterial({color:asset.ledger_block_height?0x39db8a:0x5aa9ff}));badge.position.set(pos[0],pos[1]+3.5*scale,pos[2]);badge.rotation.y=Math.PI/4;groups.L4.add(badge);bump('L4');}
    return root;
   }
   function buildLayeredReference(){
    const source=new THREE.Mesh(new THREE.PlaneGeometry(22,14),sourceMat);source.rotation.x=-Math.PI/2;source.position.y=.015;groups.L0.add(source);bump('L0');
    const wall=mat(0x5b7589);addBox('L1','North Wall',[22,2.8,.18],[0,1.4,-7],wall);addBox('L1','South Wall',[22,2.8,.18],[0,1.4,7],wall);addBox('L1','West Wall',[.18,2.8,14],[-11,1.4,0],wall);addBox('L1','East Wall',[.18,2.8,14],[11,1.4,0],wall);addBox('L1','Room Divider A',[.16,2.6,10],[-3,1.3,-1],wall);addBox('L1','Room Divider B',[7,2.6,.16],[5.5,1.3,1.4],wall);
    const physical:[string,[number,number,number],number][]=[['Dry-Type Transformer TX-01',[-7,0,-3],.9],['Main Switchboard MSB-01',[-1,0,-3],1],['Automatic Transfer Switch ATS-01',[4,0,-3],.85],['Diesel Generator GEN-01',[7.2,0,4],.9],['Panelboard LP-1',[3.2,0,4.5],.82],['EV Charging Station EVSE-01',[-7,0,4],.82],['EV Charging Station EVSE-02',[-4.8,0,4],.82]];
    physical.forEach((d,i)=>equipment(d[0],d[1],assets[i]||null,d[2]));
    for(let i=0;i<10;i++){const x=-9+(i%5)*3.5,z=i<5?.6:5.9;equipment(`Duplex Receptacle R-${String(i+1).padStart(2,'0')}`,[x,0,z],null,.55);}
    line('L3',[[-7,.18,-3],[-1,.18,-3],[4,.18,-3],[4,.18,4.3],[3.2,.18,4.3]],0x58b7ff);line('L3',[[-1,.2,-3],[-1,.2,0],[-7,.2,0],[-7,.2,4]],0x58b7ff);line('L3',[[-1,.22,-3],[7.2,.22,-3],[7.2,.22,4]],0x58b7ff);
    physical.slice(0,5).forEach((d,i)=>{const status=new THREE.Mesh(new THREE.BoxGeometry(.35,.35,.12),new THREE.MeshBasicMaterial({color:0x51d3a0}));status.position.set(d[1][0]+.65,3.3+(i%2)*.2,d[1][2]);groups.L5.add(status);bump('L5');});
    physical.slice(0,4).forEach(d=>{const evidence=new THREE.Mesh(new THREE.BoxGeometry(.42,.55,.05),new THREE.MeshBasicMaterial({color:0xf8d36d}));evidence.position.set(d[1][0]-.65,3.45,d[1][2]);groups.L6.add(evidence);bump('L6');});
    physical.slice(0,5).forEach((d,i)=>{const health=new THREE.Mesh(new THREE.BoxGeometry(.18,.8,.18),new THREE.MeshBasicMaterial({color:i===1?0xf0a44c:0x35cf82}));health.position.set(d[1][0]+.9,3.6,d[1][2]);groups.L7.add(health);bump('L7');});
    physical.slice(0,4).forEach(d=>{const proof=new THREE.Mesh(new THREE.OctahedronGeometry(.26),new THREE.MeshBasicMaterial({color:0xa67cff}));proof.position.set(d[1][0]-.9,3.55,d[1][2]);groups.L8.add(proof);bump('L8');});
   }
   function frame(obj:any){const box=new THREE.Box3().setFromObject(obj),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());const max=Math.max(size.x,size.y,size.z)||1;obj.position.sub(center);obj.scale.multiplyScalar(13/max);controls.target.set(0,1.2,0);camera.position.set(18,14,22);controls.update();}
   if(modelUrl){new GLTFLoader().load(modelUrl,gltf=>{if(disposed)return;const model=gltf.scene;let idx=0;model.traverse((node:any)=>{if(!node.isMesh)return;const objectName=node.name||node.parent?.name||`Twin object ${++idx}`;const base=classifyLayer(objectName);const match=matchAsset(objectName,assets);node.userData={assetId:match?.id||null,objectName,layer:base};const original=Array.isArray(node.material)?node.material[0]:node.material;node.material=match?(match.ledger_block_height?verifiedMat():pendingMat()):base==='L1'?mat(0x71899b):physicalMat();if(original?.map)node.material.map=original.map;groups[base].add(node);bump(base);clickable.push(node);discovery.push({name:objectName,sourceId:node.uuid,assetId:match?.id||null,layer:base});if(match){const badge=new THREE.Mesh(new THREE.BoxGeometry(.22,.22,.22),new THREE.MeshBasicMaterial({color:match.ledger_block_height?0x39db8a:0x5aa9ff}));badge.position.copy(node.position).add(new THREE.Vector3(0,.6,0));badge.rotation.y=Math.PI/4;groups.L4.add(badge);bump('L4');if(match.ledger_block_height){const p=new THREE.Mesh(new THREE.OctahedronGeometry(.12),new THREE.MeshBasicMaterial({color:0xa67cff}));p.position.copy(node.position).add(new THREE.Vector3(0,.95,0));groups.L8.add(p);bump('L8');}}});setObjects(discovery);setLayerCounts(counts);frame(groups.L1.children.length?groups.L1:groups.L2);},undefined,()=>{setMessage('Model load failed; showing the STRATUM electrical component reference twin instead.');buildLayeredReference();setObjects(discovery);setLayerCounts(counts);});}
   else{buildLayeredReference();setObjects(discovery);setLayerCounts(counts);}
   const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();const click=(ev:PointerEvent)=>{const rect=renderer.domElement.getBoundingClientRect();pointer.x=((ev.clientX-rect.left)/rect.width)*2-1;pointer.y=-((ev.clientY-rect.top)/rect.height)*2+1;ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(clickable,true)[0];if(!hit)return;const id=hit.object.userData.assetId;const a=assets.find(x=>x.id===id);if(a)setSelected(a);else setMessage(`${hit.object.userData.objectName||'This component'} is a recognized design component. Bind it to a STRATUM asset when it requires lifecycle tracking and DIR verification.`);};renderer.domElement.addEventListener('pointerup',click);
   const resize=()=>{if(!host.clientWidth||!host.clientHeight)return;camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight);};const ro=new ResizeObserver(resize);ro.observe(host);let frameId=0;const animate=()=>{controls.update();renderer.render(scene,camera);frameId=requestAnimationFrame(animate)};animate();
   cleanup=()=>{cancelAnimationFrame(frameId);ro.disconnect();renderer.domElement.removeEventListener('pointerup',click);controls.dispose();renderer.dispose();host.replaceChildren();};
  })();return()=>{disposed=true;cleanup();};
 },[assets,modelUrl,mode,activeLayers]);

 return <div className={styles.workspace}>
  <div className={styles.toolbar}><div><span className={styles.kicker}>STRATUM TWIN ENGINE</span><strong>{modelName}</strong><small>{sourceType} · L0–L8 layered twin</small></div><div className={styles.controls}><button className={mode==='all'?styles.active:''} onClick={()=>setMode('all')}>All</button><button className={mode==='verified'?styles.active:''} onClick={()=>setMode('verified')}>Verified</button><button className={mode==='pending'?styles.active:''} onClick={()=>setMode('pending')}>Pending</button><Link href="/component-library">Component library</Link><label className={styles.upload}>Submit design<input type="file" accept=".pdf,.dwg,.dxf,.ifc,.rvt,.glb,.gltf,.png,.jpg,.jpeg" onChange={onFile}/></label></div></div>
  <div className={styles.layerBar}>{LAYERS.map(l=><button key={l.id} onClick={()=>toggleLayer(l.id)} className={activeLayers.includes(l.id)?styles.layerOn:styles.layerOff}><b>{l.id}</b><span>{l.name}</span><small>{layerCounts[l.id]||0}</small></button>)}</div>
  <div className={styles.stageWrap}><div className={styles.canvas} ref={mount}/><div className={styles.legend}><span><i className={styles.green}/>DIR verified</span><span><i className={styles.blue}/>Registered / pending</span><span><i className={styles.orange}/>Recognized electrical component</span><span><i className={styles.purple}/>Immutable record marker</span></div><div className={styles.orbit}>Drag to orbit · scroll to zoom · click equipment to inspect</div></div>
  <aside className={styles.panel}><div className={styles.metrics}><div><b>{assets.length}</b><span>Asset identities</span></div><div><b>{verifiedCount}</b><span>DIR verified</span></div><div><b>{objects.length}</b><span>Twin objects</span></div><div><b>{boundCount}</b><span>Bound objects</span></div></div>
   <div className={styles.layerSummary}><span>LAYER MODEL</span>{LAYERS.map(l=><div key={l.id}><b>{l.id} {l.name}</b><small>{l.short}</small></div>)}</div>
   {selected?<><div className={styles.passportHead}><span>VERIFICATION PASSPORT</span><em className={selected.ledger_block_height?styles.seal:styles.pending}>{selected.ledger_block_height?'DIR VERIFIED':'PENDING'}</em></div><h2>{selected.name}</h2><p>{selected.asset_code} · {selected.asset_type}</p><div className={styles.facts}><div><span>Site</span><b>{selected.site_name}</b></div><div><span>System</span><b>{selected.system_name||'Unassigned'}</b></div><div><span>Manufacturer</span><b>{selected.manufacturer_name||'Not recorded'}</b></div><div><span>Serial</span><b>{selected.serial_number||'Pending'}</b></div><div><span>Lifecycle</span><b>{selected.status}</b></div><div><span>Latest event</span><b>{selected.latest_event_type||'REGISTER_ASSET'}</b></div></div><div className={styles.chainBox}><span>DIGITAL IMMUTABLE RECORDS (DIR)</span><strong>{selected.ledger_network||'stratum-devnet-1'}</strong><small>{selected.ledger_block_height?`Immutable record #${selected.ledger_block_height}`:'Record awaiting approval / finalization'}</small><small>{selected.ledger_tx_hash||'Hashes only — private model and evidence remain private'}</small></div><div className={styles.actions}><Link href={`/assets/${selected.id}`}>Open passport</Link><Link href="/dir">Verify in DIR</Link></div></>:<div className={styles.empty}>Select an asset to inspect its passport.</div>}
   <div className={styles.ingest}><span>DESIGN → VERIFIED ASSET</span><p>Recognized components stay visible in the Twin. Only meaningful maintainable equipment becomes a durable STRATUM Asset identity.</p><button disabled={busy||!objects.some(o=>!o.assetId&&o.layer==='L2')} onClick={ingest}>{busy?'Registering…':'Register discovered asset candidates'}</button>{message&&<div className={styles.message}>{message}</div>}</div>
  </aside>
 </div>
}
