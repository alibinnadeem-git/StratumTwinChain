'use client';

import Link from 'next/link';
import {ChangeEvent,useEffect,useMemo,useRef,useState} from 'react';
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
const assetKeys=(a:TwinAsset)=>[a.asset_code,a.name,a.serial_number||'',a.model||''].map(normalize).filter(Boolean);
function matchAsset(name:string,assets:TwinAsset[]){const n=normalize(name);if(!n)return null;return assets.find(a=>assetKeys(a).some(k=>k.length>4&&(n.includes(k)||k.includes(n))))||null;}
function classifyLayer(name:string):LayerId{const n=name.toLowerCase();if(/wall|door|floor|room|ceiling|roof|stair|column|architect/.test(n))return'L1';if(/feeder|circuit|wire|cable|conduit|tray|busway|line|path/.test(n))return'L3';if(/panel|transform|switchgear|breaker|ats|generator|ups|charger|evse|recept|outlet|disconnect|meter|equipment|pdu|mcc/.test(n))return'L2';return'L2';}

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
   setMessage('3D model loaded. Geometry is being classified into architectural, physical and logical layers; matched equipment is bound to STRATUM assets and DIR proof state.');
  }else{
   setModelUrl('');
   setMessage(`${file.name} is registered as L0 Source. PDF/CAD/BIM drawing intelligence belongs in Twin Compiler; this workspace now shows the complete L0–L8 layer model instead of generic blocks. Parsed geometry will replace the reference layer geometry when the compiler output is available.`);
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
   const mat=(color:number,emissive=0)=>new THREE.MeshStandardMaterial({color,metalness:.35,roughness:.45,emissive,emissiveIntensity:.35,transparent:true,opacity:.94});
   const sourceMat=new THREE.MeshStandardMaterial({color:0x163f59,emissive:0x071d2b,emissiveIntensity:.4,transparent:true,opacity:.32,side:THREE.DoubleSide});
   const verifiedMat=()=>mat(0x25c979,0x062a1d);const pendingMat=()=>mat(0x4b9bd1,0x081c2b);const physicalMat=()=>mat(0xd28a3e,0x2e1606);
   function addBox(group:LayerId,name:string,size:[number,number,number],pos:[number,number,number],material:any,assetId:string|null=null){const m=new THREE.Mesh(new THREE.BoxGeometry(...size),material);m.position.set(...pos);m.userData={assetId,objectName:name,layer:group};groups[group].add(m);bump(group);if(group==='L2'||group==='L4'){clickable.push(m);discovery.push({name,sourceId:`${group}-${name}`,assetId,layer:group});}return m;}
   function line(group:LayerId,pts:[number,number,number][],color:number){const obj=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(p=>new THREE.Vector3(...p))),new THREE.LineBasicMaterial({color}));groups[group].add(obj);bump(group);return obj;}
   function buildLayeredReference(){
    const source=new THREE.Mesh(new THREE.PlaneGeometry(22,14),sourceMat);source.rotation.x=-Math.PI/2;source.position.y=.015;groups.L0.add(source);bump('L0');
    const wall=mat(0x5b7589);addBox('L1','North Wall',[22,2.8,.18],[0,1.4,-7],wall);addBox('L1','South Wall',[22,2.8,.18],[0,1.4,7],wall);addBox('L1','West Wall',[.18,2.8,14],[-11,1.4,0],wall);addBox('L1','East Wall',[.18,2.8,14],[11,1.4,0],wall);addBox('L1','Room Divider A',[.16,2.6,10],[-3,1.3,-1],wall);addBox('L1','Room Divider B',[7,2.6,.16],[5.5,1.3,1.4],wall);
    const physical=[['Transformer TX-01',[-7,1.7,-3] as [number,number,number],[2.3,3.4,2.1] as [number,number,number]],['Main Switchgear MSB-01',[-1,1.5,-3],[3.2,3,1.3]],['ATS-01',[4,1.25,-3],[1.8,2.5,1.2]],['Generator GEN-01',[7.5,1.45,4],[3.6,2.9,2.2]],['Panel LP-1',[3.5,1.15,4.3],[1.25,2.3,.55]],['EVSE-01',[-7,1.1,4],[1.1,2.2,.8]],['EVSE-02',[-4.8,1.1,4],[1.1,2.2,.8]]];
    physical.forEach((d,i)=>{const a=assets[i]||null;addBox('L2',d[0] as string,d[2] as any,d[1] as any,a?(a.ledger_block_height?verifiedMat():pendingMat()):physicalMat(),a?.id||null);const ring=new THREE.Mesh(new THREE.TorusGeometry(1.25,.04,8,48),new THREE.MeshBasicMaterial({color:a?.ledger_block_height?0x39db8a:0x5aa9ff}));ring.rotation.x=Math.PI/2;ring.position.set((d[1] as any)[0],.08,(d[1] as any)[2]);groups.L4.add(ring);bump('L4');});
    for(let i=0;i<12;i++){const x=-9+(i%6)*3.4,z=i<6?0:5.8;addBox('L2',`Receptacle R-${String(i+1).padStart(2,'0')}`,[.3,.5,.18],[x,.35,z],physicalMat());}
    line('L3',[[-7,.18,-3],[-1,.18,-3],[4,.18,-3],[4,.18,4.3],[3.5,.18,4.3]],0x58b7ff);line('L3',[[-1,.2,-3],[-1,.2,0],[-7,.2,0],[-7,.2,4]],0x58b7ff);line('L3',[[-1,.22,-3],[7.5,.22,-3],[7.5,.22,4]],0x58b7ff);
    physical.slice(0,5).forEach((d,i)=>{const ghost=addBox('L5',`Installed ${d[0]}`,[.22,.22,.22],[(d[1] as any)[0],3.3+(i%2)*.2,(d[1] as any)[2]],mat(0x51d3a0));ghost.scale.set(1.2,1.2,1.2);});
    physical.slice(0,4).forEach((d,i)=>{const pin=new THREE.Mesh(new THREE.SphereGeometry(.18,16,12),new THREE.MeshBasicMaterial({color:0xf8d36d}));pin.position.set((d[1] as any)[0]+.7,3.5,(d[1] as any)[2]);groups.L6.add(pin);bump('L6');});
    physical.slice(0,5).forEach((d,i)=>{const health=new THREE.Mesh(new THREE.TorusGeometry(.75,.07,8,36),new THREE.MeshBasicMaterial({color:i===1?0xf0a44c:0x35cf82}));health.rotation.x=Math.PI/2;health.position.set((d[1] as any)[0],3.75,(d[1] as any)[2]);groups.L7.add(health);bump('L7');});
    physical.slice(0,4).forEach((d,i)=>{const proof=new THREE.Mesh(new THREE.OctahedronGeometry(.26),new THREE.MeshBasicMaterial({color:0xa67cff}));proof.position.set((d[1] as any)[0]-.7,3.55,(d[1] as any)[2]);groups.L8.add(proof);bump('L8');});
   }
   function frame(obj:any){const box=new THREE.Box3().setFromObject(obj),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());const max=Math.max(size.x,size.y,size.z)||1;obj.position.sub(center);obj.scale.multiplyScalar(13/max);controls.target.set(0,1.2,0);camera.position.set(18,14,22);controls.update();}
   if(modelUrl){new GLTFLoader().load(modelUrl,gltf=>{if(disposed)return;const model=gltf.scene;let idx=0;model.traverse((node:any)=>{if(!node.isMesh)return;const objectName=node.name||node.parent?.name||`Twin object ${++idx}`;const base=classifyLayer(objectName);const match=matchAsset(objectName,assets);node.userData={assetId:match?.id||null,objectName,layer:base};const original=Array.isArray(node.material)?node.material[0]:node.material;node.material=match?(match.ledger_block_height?verifiedMat():pendingMat()):base==='L1'?mat(0x71899b):physicalMat();if(original?.map)node.material.map=original.map;groups[base].add(node);bump(base);clickable.push(node);discovery.push({name:objectName,sourceId:node.uuid,assetId:match?.id||null,layer:base});if(match){const ring=new THREE.Mesh(new THREE.TorusGeometry(.4,.025,8,32),new THREE.MeshBasicMaterial({color:match.ledger_block_height?0x39db8a:0x5aa9ff}));ring.rotation.x=Math.PI/2;ring.position.copy(node.position);groups.L4.add(ring);bump('L4');if(match.ledger_block_height){const p=new THREE.Mesh(new THREE.OctahedronGeometry(.12),new THREE.MeshBasicMaterial({color:0xa67cff}));p.position.copy(node.position).add(new THREE.Vector3(0,.6,0));groups.L8.add(p);bump('L8');}}});setObjects(discovery);setLayerCounts(counts);frame(groups.L1.children.length?groups.L1:groups.L2);},undefined,()=>{setMessage('Model load failed; showing the layered STRATUM reference twin instead.');buildLayeredReference();setObjects(discovery);setLayerCounts(counts);});}
   else{buildLayeredReference();setObjects(discovery);setLayerCounts(counts);}
   const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();const click=(ev:PointerEvent)=>{const rect=renderer.domElement.getBoundingClientRect();pointer.x=((ev.clientX-rect.left)/rect.width)*2-1;pointer.y=-((ev.clientY-rect.top)/rect.height)*2+1;ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(clickable,true)[0];if(!hit)return;const id=hit.object.userData.assetId;const a=assets.find(x=>x.id===id);if(a)setSelected(a);else setMessage(`${hit.object.userData.objectName||'This object'} is currently a design object. Bind it to a STRATUM asset before it receives lifecycle and DIR verification.`);};renderer.domElement.addEventListener('pointerup',click);
   const resize=()=>{if(!host.clientWidth||!host.clientHeight)return;camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight);};const ro=new ResizeObserver(resize);ro.observe(host);let frameId=0;const animate=()=>{controls.update();renderer.render(scene,camera);frameId=requestAnimationFrame(animate)};animate();
   cleanup=()=>{cancelAnimationFrame(frameId);ro.disconnect();renderer.domElement.removeEventListener('pointerup',click);controls.dispose();renderer.dispose();host.replaceChildren();};
  })();return()=>{disposed=true;cleanup();};
 },[assets,modelUrl,mode,activeLayers]);

 return <div className={styles.workspace}>
  <div className={styles.toolbar}><div><span className={styles.kicker}>STRATUM TWIN ENGINE</span><strong>{modelName}</strong><small>{sourceType} · L0–L8 layered twin</small></div><div className={styles.controls}><button className={mode==='all'?styles.active:''} onClick={()=>setMode('all')}>All</button><button className={mode==='verified'?styles.active:''} onClick={()=>setMode('verified')}>Verified</button><button className={mode==='pending'?styles.active:''} onClick={()=>setMode('pending')}>Pending</button><label className={styles.upload}>Submit design<input type="file" accept=".pdf,.dwg,.dxf,.ifc,.rvt,.glb,.gltf,.png,.jpg,.jpeg" onChange={onFile}/></label></div></div>
  <div className={styles.layerBar}>{LAYERS.map(l=><button key={l.id} onClick={()=>toggleLayer(l.id)} className={activeLayers.includes(l.id)?styles.layerOn:styles.layerOff}><b>{l.id}</b><span>{l.name}</span><small>{layerCounts[l.id]||0}</small></button>)}</div>
  <div className={styles.stageWrap}><div className={styles.canvas} ref={mount}/><div className={styles.legend}><span><i className={styles.green}/>DIR verified</span><span><i className={styles.blue}/>Registered / pending</span><span><i className={styles.orange}/>Design object</span><span><i className={styles.purple}/>Immutable record marker</span></div><div className={styles.orbit}>Drag to orbit · scroll to zoom · click equipment to inspect</div></div>
  <aside className={styles.panel}><div className={styles.metrics}><div><b>{assets.length}</b><span>Asset identities</span></div><div><b>{verifiedCount}</b><span>DIR verified</span></div><div><b>{objects.length}</b><span>Twin objects</span></div><div><b>{boundCount}</b><span>Bound objects</span></div></div>
   <div className={styles.layerSummary}><span>LAYER MODEL</span>{LAYERS.map(l=><div key={l.id}><b>{l.id} {l.name}</b><small>{l.short}</small></div>)}</div>
   {selected?<><div className={styles.passportHead}><span>VERIFICATION PASSPORT</span><em className={selected.ledger_block_height?styles.seal:styles.pending}>{selected.ledger_block_height?'DIR VERIFIED':'PENDING'}</em></div><h2>{selected.name}</h2><p>{selected.asset_code} · {selected.asset_type}</p><div className={styles.facts}><div><span>Site</span><b>{selected.site_name}</b></div><div><span>System</span><b>{selected.system_name||'Unassigned'}</b></div><div><span>Manufacturer</span><b>{selected.manufacturer_name||'Not recorded'}</b></div><div><span>Serial</span><b>{selected.serial_number||'Pending'}</b></div><div><span>Lifecycle</span><b>{selected.status}</b></div><div><span>Latest event</span><b>{selected.latest_event_type||'REGISTER_ASSET'}</b></div></div><div className={styles.chainBox}><span>DIGITAL IMMUTABLE RECORDS (DIR)</span><strong>{selected.ledger_network||'stratum-devnet-1'}</strong><small>{selected.ledger_block_height?`Immutable record #${selected.ledger_block_height}`:'Record awaiting approval / finalization'}</small><small>{selected.ledger_tx_hash||'Hashes only — private model and evidence remain private'}</small></div><div className={styles.actions}><Link href={`/assets/${selected.id}`}>Open passport</Link><Link href="/dir">Verify in DIR</Link></div></>:<div className={styles.empty}>Select an asset to inspect its passport.</div>}
   <div className={styles.ingest}><span>DESIGN → VERIFIED ASSET</span><p>Only meaningful equipment candidates should become tracked assets. Architectural and logical objects remain contextual twin layers.</p><button disabled={busy||!objects.some(o=>!o.assetId&&o.layer==='L2')} onClick={ingest}>{busy?'Registering…':'Register discovered asset candidates'}</button>{message&&<div className={styles.message}>{message}</div>}</div>
  </aside>
 </div>
}
