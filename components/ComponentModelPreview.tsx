'use client';

import {useEffect,useRef,useState} from 'react';
import type {Object3D,Mesh,Material,Texture} from 'three';

function disposeModel(root:Object3D){
 const textures=new Set<Texture>();const materials=new Set<Material>();
 root.traverse(object=>{const mesh=object as Mesh;if(!mesh.isMesh)return;mesh.geometry.dispose();
  for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
   materials.add(material);for(const value of Object.values(material))if(value&&typeof value==='object'&&'isTexture' in value)textures.add(value as Texture);
  }
 });textures.forEach(texture=>texture.dispose());materials.forEach(material=>material.dispose());
}

export default function ComponentModelPreview({url,format,name}:{url:string;format:string;name:string}){
 const host=useRef<HTMLDivElement>(null);
 const action=useRef<(command:string)=>void>(()=>{});
 const [state,setState]=useState('Loading 3D model…');
 const [ready,setReady]=useState(false);
 const [attempt,setAttempt]=useState(0);
 useEffect(()=>{
  const target=host.current;if(!target)return;
  setReady(false);action.current=()=>{};
  if(!url){setState('No 3D model file is mapped to this component.');return;}
  if(!['GLB','GLTF'].includes(format)){setState('This format is not supported by the library preview.');return;}
  let cancelled=false;let cleanup=()=>{};
  setState('Loading 3D model…');
  void (async()=>{
   try{
    const [THREE,{GLTFLoader},{OrbitControls}]=await Promise.all([import('three'),import('three/examples/jsm/loaders/GLTFLoader.js'),import('three/examples/jsm/controls/OrbitControls.js')]);
    if(cancelled)return;
    let renderer:InstanceType<typeof THREE.WebGLRenderer>;
    try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}catch{setState('3D preview unavailable: this browser could not start WebGL.');return;}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.domElement.setAttribute('aria-label',`${name} interactive 3D preview`);
    renderer.domElement.setAttribute('role','img');target.appendChild(renderer.domElement);
    const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(40,1,.001,1000);
    const controls=new OrbitControls(camera,renderer.domElement);controls.enablePan=false;controls.enableDamping=false;
    scene.add(new THREE.HemisphereLight(0xffffff,0x567789,2));
    const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(3,5,4);scene.add(key);
    const fill=new THREE.DirectionalLight(0x9edfff,2);fill.position.set(-3,1,-4);scene.add(fill);
    let model:Object3D|undefined;let radius=1;
    const render=()=>renderer.render(scene,camera);
    const fit=()=>{const halfFov=THREE.MathUtils.degToRad(camera.fov/2);const angle=Math.min(halfFov,Math.atan(Math.tan(halfFov)*camera.aspect));const distance=radius/Math.sin(angle)*1.18;
     camera.position.set(1,.8,1.3).normalize().multiplyScalar(distance);camera.near=Math.max(radius/1000,.000001);camera.far=distance+radius*100;camera.updateProjectionMatrix();controls.target.set(0,0,0);controls.minDistance=radius*1.15;controls.maxDistance=radius*30;controls.update();render();};
    const resize=()=>{const width=Math.max(target.clientWidth,1);renderer.setSize(width,320);camera.aspect=width/320;camera.updateProjectionMatrix();if(model)fit();};
    const observer=new ResizeObserver(resize);observer.observe(target);resize();controls.addEventListener('change',render);
    const lost=(event:Event)=>{event.preventDefault();setReady(false);setState('3D preview interrupted. Retry to reload the model.');};renderer.domElement.addEventListener('webglcontextlost',lost);
    cleanup=()=>{observer.disconnect();controls.removeEventListener('change',render);controls.dispose();renderer.domElement.removeEventListener('webglcontextlost',lost);if(model)disposeModel(model);renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
    action.current=command=>{if(!model)return;if(command==='fit'){fit();return;}if(command==='left'||command==='right'){camera.position.applyAxisAngle(new THREE.Vector3(0,1,0),command==='left'?.25:-.25);}else{camera.position.multiplyScalar(command==='in'?.8:1.25);}controls.update();render();};
    new GLTFLoader().load(url,gltf=>{
     if(cancelled){disposeModel(gltf.scene);return;}
     try{
      model=gltf.scene;const bounds=new THREE.Box3().setFromObject(model);const size=bounds.getSize(new THREE.Vector3());radius=size.length()/2;
      if(bounds.isEmpty()||!Number.isFinite(radius)||radius<=0)throw new Error('Empty geometry');
      let triangles=0;model.traverse(object=>{const mesh=object as Mesh;if(mesh.isMesh)triangles+=(mesh.geometry.index?.count||mesh.geometry.getAttribute('position')?.count||0)/3;});
      if(!triangles)throw new Error('No mesh geometry');
      model.position.sub(bounds.getCenter(new THREE.Vector3()));scene.add(model);fit();
      renderer.domElement.dataset.triangles=String(Math.floor(triangles));renderer.domElement.dataset.modelUrl=url;
      setReady(true);setState('3D model loaded');
     }catch{if(model){scene.remove(model);disposeModel(model);model=undefined;}render();setState('Unable to display this model. Check its file and try again.');}
    },undefined,()=>{if(!cancelled)setState('Unable to load this model. Check its file and try again.');});
   }catch{if(!cancelled)setState('Unable to start the 3D preview. Please try again.');}
  })();
  return()=>{cancelled=true;action.current=()=>{};cleanup();};
 },[url,format,name,attempt]);
 return <section aria-label="Component 3D preview" style={{marginTop:16,border:'1px solid #245b73',borderRadius:12,overflow:'hidden',background:'#061019'}}>
  <div ref={host} style={{height:320,width:'100%',touchAction:'none'}}/>
  <div style={{padding:12}}><p role="status" style={{margin:'0 0 8px',color:'#b9d9e5'}}>{state}</p>
   <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{[['left','Rotate left'],['right','Rotate right'],['in','Zoom in'],['out','Zoom out'],['fit','Reset view']].map(([command,label])=><button type="button" key={command} disabled={!ready} onClick={()=>action.current(command)} style={{minHeight:44,padding:'8px 12px',background:'#163146',color:'#d9eef7',border:'1px solid #245b73',borderRadius:8}}>{label}</button>)}
    {!ready&&url&&['GLB','GLTF'].includes(format)&&state!=='Loading 3D model…'&&<button type="button" onClick={()=>setAttempt(value=>value+1)}>Retry preview</button>}
   </div><small style={{display:'block',marginTop:8,color:'#89a9b8'}}>Drag to rotate · scroll or pinch to zoom. Source model preview; installed placement is not shown.</small>
  </div>
 </section>;
}
