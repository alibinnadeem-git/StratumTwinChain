"use client";

import Link from "next/link";
import {useEffect,useMemo,useRef,useState} from "react";
import {resolveElectricalComponent} from "@/lib/electrical-component-library";
import {resolveAssetPlacement} from "@/lib/asset-placement";
import {fitProceduralObjectToMeters,normalizeObjectToMeters} from "@/lib/three-model-normalization";
import SpatialAssetInspector from "@/components/SpatialAssetInspector";
import {type RegisteredSpatialAsset} from "@/lib/spatial-asset-link";
import {
  DEFAULT_ELECTRICAL_MODEL_REGISTRY,
  ELECTRICAL_MODEL_REGISTRY_STORAGE_KEY,
  ElectricalModelConfig,
  normalizeElectricalModelRegistry,
} from "@/lib/electrical-model-registry";

type Layer="L0"|"L1"|"L2"|"L3"|"L4";
type ViewMode="MODEL"|"ELECTRICAL"|"REVIEW";
type EnvironmentMode="CINEMATIC"|"ENGINEERING"|"NIGHT"|"EMERGENCY";
type SystemMode="ALL"|"POWER"|"EMERGENCY"|"EV"|"LOW_VOLTAGE"|"RENEWABLE";
type XY={x:number;y:number};
type Entity={
  id:string;source:string;layer:Layer;kind:string;name:string;x:number;y:number;z?:number;
  x2?:number;y2?:number;z2?:number;rotation?:number;scale?:number;floor?:string;zone?:string;
  vertices?:XY[];confidence:number;meta?:Record<string,unknown>;
};
type GraphLink={id:string;from:string;to:string;type:string;confidence:number};
type Graph={
  version:string;createdAt:string;
  sources:{name:string;ext:string;sha256:string;discipline:string;floor?:string;elevation?:number;unitName?:string;unitToMeters?:number}[];
  entities:Entity[];links?:GraphLink[];stats:Record<Layer,number>;
};

type RenderStatus="STARTING"|"WEBGL"|"FALLBACK";
const layerNames:Record<Layer,string>={L0:"Source",L1:"Architectural",L2:"Electrical Physical",L3:"Electrical Logical",L4:"STRATUM Assets"};
const colors:Record<Layer,number>={L0:0x31566d,L1:0x7f98a6,L2:0xe5a14d,L3:0x62bfff,L4:0x43d98f};
const systemOptions:{id:SystemMode;label:string}[]=[
  {id:"ALL",label:"All systems"},{id:"POWER",label:"Power distribution"},{id:"EMERGENCY",label:"Emergency power"},
  {id:"EV",label:"EV infrastructure"},{id:"LOW_VOLTAGE",label:"Low voltage"},{id:"RENEWABLE",label:"Renewables"},
];

function n(value:unknown,fallback=0){const x=Number(value);return Number.isFinite(x)?x:fallback}
function metaNumber(e:Entity,key:string){const value=e.meta?.[key];const x=Number(value);return Number.isFinite(x)?x:null}
function isSld(e:Entity){return Boolean(e.meta?.sldCandidate===true||e.meta?.sldSpatialProjection||e.meta?.sldLogicalDepth!==undefined||/single.?line|one.?line|\bsld\b|riser/i.test(String(e.meta?.sheetTitle||e.source)))}
function physicalElevationKnown(e:Entity){return e.meta?.elevationKnown===true||e.meta?.physicalElevationKnown===true||e.meta?.sourceType==="DXF"||e.meta?.coordinateUnits==="m"&&e.floor!=="UNRESOLVED"}
function displayElevation(e:Entity,mode:ViewMode){
  const base=n(e.z);
  if(mode==="ELECTRICAL"&&isSld(e)){
    const logical=metaNumber(e,"sldLogicalDepth")??0;
    return base+logical*2.4;
  }
  return base;
}
function entitySystem(e:Entity):SystemMode{
  const def=resolveElectricalComponent(e.name),name=`${e.name} ${def?.category||""}`.toLowerCase();
  if(/generator|ats|ups|battery|emergency/.test(name))return"EMERGENCY";
  if(/ev|charger/.test(name))return"EV";
  if(/solar|pv|inverter|renewable/.test(name))return"RENEWABLE";
  if(/fire alarm|security|access control|intercom|communication|data|sensor|low voltage/.test(name))return"LOW_VOLTAGE";
  return"POWER";
}
function bounds2d(entities:Entity[]){
  const pts=entities.flatMap(e=>[{x:e.x,y:e.y},...(Number.isFinite(e.x2)&&Number.isFinite(e.y2)?[{x:e.x2!,y:e.y2!}]:[])]);
  if(!pts.length)return{minX:-10,maxX:10,minY:-10,maxY:10};
  let minX=Math.min(...pts.map(p=>p.x)),maxX=Math.max(...pts.map(p=>p.x)),minY=Math.min(...pts.map(p=>p.y)),maxY=Math.max(...pts.map(p=>p.y));
  if(maxX-minX<1){minX-=1;maxX+=1}if(maxY-minY<1){minY-=1;maxY+=1}
  return{minX,maxX,minY,maxY};
}

export default function CompiledGraphViewer({registeredAssets=[]}:{registeredAssets?:RegisteredSpatialAsset[]}){
  const mount=useRef<HTMLDivElement|null>(null),runtime=useRef<any>(null);
  const [graph,setGraph]=useState<Graph|null>(null);
  const [registry,setRegistry]=useState<ElectricalModelConfig[]>(DEFAULT_ELECTRICAL_MODEL_REGISTRY);
  const [renderStatus,setRenderStatus]=useState<RenderStatus>("STARTING");
  const [mode,setMode]=useState<ViewMode>("MODEL");
  const [environment,setEnvironment]=useState<EnvironmentMode>("ENGINEERING");
  const [systemMode,setSystemMode]=useState<SystemMode>("ALL");
  const [floor,setFloor]=useState("ALL");
  const [hiddenDisciplines,setHiddenDisciplines]=useState<string[]>([]);
  const [hiddenSources,setHiddenSources]=useState<string[]>([]);
  const [exploded,setExploded]=useState(false);
  const [xray,setXray]=useState(false);
  const [search,setSearch]=useState("");
  const [selected,setSelected]=useState<Entity|null>(null);
  const [fitRevision,setFitRevision]=useState(0);
  const [labels,setLabels]=useState(true);

  useEffect(()=>{
    const load=()=>{
      try{
        const raw=localStorage.getItem("stratum_compiled_graph");
        setGraph(raw?JSON.parse(raw):null);
        const stored=localStorage.getItem(ELECTRICAL_MODEL_REGISTRY_STORAGE_KEY);
        setRegistry(stored?normalizeElectricalModelRegistry(JSON.parse(stored)):DEFAULT_ELECTRICAL_MODEL_REGISTRY);
      }catch{}
    };
    load();
    window.addEventListener("stratum:graph-updated",load);window.addEventListener("storage",load);window.addEventListener("stratum:model-registry-updated",load);
    return()=>{window.removeEventListener("stratum:graph-updated",load);window.removeEventListener("storage",load);window.removeEventListener("stratum:model-registry-updated",load)};
  },[]);

  const disciplines=useMemo(()=>graph?[...new Set(graph.sources.map(source=>source.discipline||"Unclassified"))].sort():[],[graph]);
  const sourceDisciplines=useMemo(()=>new Map((graph?.sources||[]).map(source=>[source.name,source.discipline||"Unclassified"])),[graph]);
  const levels=useMemo(()=>{
    if(!graph)return[] as [string,number][];
    const map=new Map<string,number>();
    for(const e of graph.entities){const f=e.floor||"UNRESOLVED";if(!map.has(f)||physicalElevationKnown(e))map.set(f,n(e.z))}
    for(const s of graph.sources){if(s.floor&&!map.has(s.floor))map.set(s.floor,n(s.elevation))}
    return[...map.entries()].sort((a,b)=>a[1]-b[1]);
  },[graph]);
  const visible=useMemo(()=>{
    if(!graph)return[];
    const q=search.trim().toLowerCase();
    return graph.entities.filter(e=>{
      if(floor!=="ALL"&&(e.floor||"UNRESOLVED")!==floor)return false;
      const entityDiscipline=sourceDisciplines.get(e.source)||String(e.meta?.discipline||"Unclassified");
      if(hiddenDisciplines.includes(entityDiscipline)||hiddenSources.includes(e.source))return false;
      if(mode==="ELECTRICAL"&&!(["L2","L3","L4"] as Layer[]).includes(e.layer))return false;
      if(systemMode!=="ALL"&&e.layer==="L2"&&entitySystem(e)!==systemMode)return false;
      if(q&&!`${e.name} ${e.source} ${e.floor||""} ${e.zone||""}`.toLowerCase().includes(q))return false;
      return true;
    });
  },[graph,floor,hiddenDisciplines,hiddenSources,mode,systemMode,search,sourceDisciplines]);
  const inventory=useMemo(()=>visible.filter(e=>e.kind!=="line"&&e.kind!=="sld-feeder-candidate"&&e.kind!=="wall-segment"),[visible]);
  const rooms=useMemo(()=>graph?.entities.filter(e=>e.kind==="room-boundary").length||0,[graph]);
  const sldObjects=useMemo(()=>graph?.entities.filter(e=>e.layer==="L2"&&isSld(e)).length||0,[graph]);
  const unresolvedZ=useMemo(()=>graph?.entities.filter(e=>e.layer==="L2"&&!physicalElevationKnown(e)&&!isSld(e)).length||0,[graph]);
  const modelMapped=useMemo(()=>graph?.entities.filter(e=>{
    if(e.layer!=="L2"||e.kind==="line")return false;const def=resolveElectricalComponent(e.name);return!!def&&!!registry.find(r=>r.componentKey===def.key)?.modelUrl.trim();
  }).length||0,[graph,registry]);
  const matching=useMemo(()=>inventory,[inventory]);
  const fallbackBounds=useMemo(()=>bounds2d(visible),[visible]);

  useEffect(()=>{
    if(!graph||!mount.current)return;
    let disposed=false,cleanup=()=>{};
    (async()=>{
      const THREE=await import("three");
      const {OrbitControls}=await import("three/examples/jsm/controls/OrbitControls.js");
      const {GLTFLoader}=await import("three/examples/jsm/loaders/GLTFLoader.js");
      if(disposed||!mount.current)return;
      const host=mount.current;host.replaceChildren();
      let renderer:any;
      try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance",alpha:false});}
      catch{setRenderStatus("FALLBACK");return}
      setRenderStatus("WEBGL");
      const scene=new THREE.Scene();
      scene.background=new THREE.Color(environment==="NIGHT"?0x02070b:environment==="EMERGENCY"?0x130504:0x07131d);
      const camera=new THREE.PerspectiveCamera(44,host.clientWidth/Math.max(host.clientHeight,1),0.05,2000);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.setSize(host.clientWidth,host.clientHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;
      renderer.shadowMap.enabled=true;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=environment==="NIGHT"?.8:1.05;
      host.appendChild(renderer.domElement);
      const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.07;controls.maxPolarAngle=Math.PI*.495;
      runtime.current={THREE,camera,controls,scene};
      scene.add(new THREE.HemisphereLight(0xccecff,0x071018,environment==="NIGHT"?.8:1.7));
      const sun=new THREE.DirectionalLight(environment==="EMERGENCY"?0xff9378:0xffffff,environment==="NIGHT"?1.2:3.2);sun.position.set(16,25,12);sun.castShadow=true;scene.add(sun);
      scene.add(new THREE.AmbientLight(0x7796a8,.45));
      const groups={L0:new THREE.Group(),L1:new THREE.Group(),L2:new THREE.Group(),L3:new THREE.Group(),L4:new THREE.Group()} as Record<Layer,any>;
      (Object.keys(groups) as Layer[]).forEach(l=>scene.add(groups[l]));
      groups.L0.visible=mode!=="ELECTRICAL";groups.L1.visible=mode!=="ELECTRICAL";groups.L2.visible=true;groups.L3.visible=true;groups.L4.visible=mode!=="MODEL";
      const entityById=new Map(graph.entities.map(e=>[e.id,e]));
      const clickable:any[]=[];
      const floorIndex=new Map(levels.map(([name],i)=>[name,i]));
      const extra=(e:Entity)=>exploded?(floorIndex.get(e.floor||"UNRESOLVED")||0)*2.6:0;
      const height=(e:Entity)=>displayElevation(e,mode)+extra(e);
      const isVisible=(e:Entity)=>visible.some(v=>v.id===e.id);
      const material=(color:number,opacity=1,emissive=0)=>new THREE.MeshStandardMaterial({color,emissive,emissiveIntensity:.2,metalness:.28,roughness:.48,transparent:opacity<1,opacity,depthWrite:opacity>.2});
      const tag=(obj:any,e:Entity)=>{obj.userData.entity=e;obj.traverse?.((node:any)=>{if(node.isMesh){node.userData.entity=e;node.castShadow=true;node.receiveShadow=true;clickable.push(node)}})};
      const label=(text:string,x:number,y:number,z:number,color="#cfefff")=>{
        if(!labels)return;const canvas=document.createElement("canvas");canvas.width=512;canvas.height=112;const ctx=canvas.getContext("2d");if(!ctx)return;
        ctx.fillStyle="rgba(3,12,18,.82)";ctx.roundRect(4,4,504,104,16);ctx.fill();ctx.fillStyle=color;ctx.font="700 28px system-ui";ctx.fillText(text.slice(0,30),20,49);ctx.fillStyle="#83a6b7";ctx.font="20px system-ui";ctx.fillText(`${y.toFixed(2)} m Z`,20,82);
        const texture=new THREE.CanvasTexture(canvas),sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false}));sprite.scale.set(3.5,.77,1);sprite.position.set(x,y+2.2,z);scene.add(sprite);
      };
      const wall=(a:XY,b:XY,e:Entity)=>{const dx=b.x-a.x,dz=b.y-a.y,len=Math.hypot(dx,dz);if(len<.02)return;const op=xray?.12:.55,m=new THREE.Mesh(new THREE.BoxGeometry(len,2.7,.09),material(colors.L1,op));m.position.set((a.x+b.x)/2,height(e)+1.35,(a.y+b.y)/2);m.rotation.y=-Math.atan2(dz,dx);groups.L1.add(m)};
      const room=(e:Entity)=>{if(!e.vertices||e.vertices.length<3||!isVisible(e))return;const shape=new THREE.Shape();e.vertices.forEach((p,i)=>i?shape.lineTo(p.x,p.y):shape.moveTo(p.x,p.y));shape.closePath();const floorMesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),material(0x173748,xray?.07:.18));floorMesh.rotation.x=Math.PI/2;floorMesh.position.y=height(e)+.01;groups.L1.add(floorMesh);for(let i=0;i<e.vertices.length;i++)wall(e.vertices[i],e.vertices[(i+1)%e.vertices.length],e)};
      const fallbackShape=(e:Entity)=>{
        const def=resolveElectricalComponent(e.name),shape=def?.twinShape||"cabinet",cfg=def?registry.find(r=>r.componentKey===def.key):null;
        const placement=resolveAssetPlacement({name:e.name,floor:e.floor,z:e.z,meta:e.meta},cfg);
        const target:[number,number,number]=[placement.dimensions.width,placement.dimensions.height,placement.dimensions.depth];
        const root=new THREE.Group(),op=1;
        let geo:any;if(shape==="transformer")geo=new THREE.BoxGeometry(1.7,1.55,1.25);else if(shape==="generator")geo=new THREE.BoxGeometry(2.2,1.2,1.1);else if(shape==="motor")geo=new THREE.CylinderGeometry(.48,.48,1.15,20);else if(shape==="evse")geo=new THREE.BoxGeometry(.62,1.4,.44);else geo=new THREE.BoxGeometry(1.05,1.8,.62);
        const mesh=new THREE.Mesh(geo,material(colors.L2,op,0x211000));if(shape==="motor")mesh.rotation.z=Math.PI/2;root.add(mesh);
        try{fitProceduralObjectToMeters(root,target)}catch{}
        root.position.set(e.x,height(e),e.y);root.rotation.y=THREE.MathUtils.degToRad(-(e.rotation||0));
        root.userData.dimensionAuthority=placement.dimensions.authority;root.userData.targetDimensionsMeters=target;
        tag(root,e);groups.L2.add(root);label(e.name,e.x,height(e),e.y,isSld(e)?"#8fcfff":"#ffd08a");
      };
      const loader=new GLTFLoader();
      const equipment=(e:Entity)=>{
        if(!isVisible(e))return;
        const def=resolveElectricalComponent(e.name),cfg=def?registry.find(r=>r.componentKey===def.key):null;
        if(!cfg?.modelUrl.trim()||!["GLB","GLTF"].includes(cfg.format)){fallbackShape(e);return}
        const placement=resolveAssetPlacement({name:e.name,floor:e.floor,z:e.z,meta:e.meta},cfg);
        const target:[number,number,number]=[placement.dimensions.width,placement.dimensions.height,placement.dimensions.depth];
        loader.load(cfg.modelUrl,gltf=>{
          if(disposed)return;
          try{
            const model=gltf.scene;
            model.position.set(0,0,0);model.scale.set(1,1,1);
            model.rotation.set(THREE.MathUtils.degToRad(cfg.rotation[0]),THREE.MathUtils.degToRad(cfg.rotation[1]),THREE.MathUtils.degToRad(cfg.rotation[2]));
            const normalized=normalizeObjectToMeters(model,target,.05);
            const root=new THREE.Group();
            root.position.set(e.x+cfg.offset[0],height(e)+cfg.offset[1],e.y+cfg.offset[2]);
            root.rotation.y=THREE.MathUtils.degToRad(-(e.rotation||0));
            root.userData.dimensionAuthority=placement.dimensions.authority;
            root.userData.targetDimensionsMeters=target;
            root.userData.normalization={scalar:normalized.scalar,ratioSpread:normalized.ratioSpread,reviewRequired:normalized.reviewRequired};
            if(normalized.reviewRequired)console.warn("STRATUM model dimension mismatch requires review",{component:e.name,target,intrinsic:normalized.intrinsic,ratios:normalized.ratios,ratioSpread:normalized.ratioSpread});
            root.add(model);tag(root,e);groups.L2.add(root);label(e.name,e.x,height(e),e.y);
            const renderedBox=new THREE.Box3().setFromObject(root);if(!renderedBox.isEmpty())bounds.union(renderedBox);
            runtime.current?.fit?.();
          }catch(error){
            console.warn("STRATUM meter normalization failed; procedural envelope fallback active",e.name,error);
            fallbackShape(e);
          }
        },undefined,()=>{if(!disposed)fallbackShape(e)});
      };
      for(const e of graph.entities){
        if(!isVisible(e))continue;
        if(e.kind==="room-boundary"||e.kind==="floor-boundary"){room(e);continue}
        if(e.kind==="wall-segment"&&Number.isFinite(e.x2)&&Number.isFinite(e.y2)){wall({x:e.x,y:e.y},{x:e.x2!,y:e.y2!},e);continue}
        if((e.kind==="line"||e.kind==="sld-feeder-candidate")&&Number.isFinite(e.x2)&&Number.isFinite(e.y2)){
          const pts=[new THREE.Vector3(e.x,height(e)+.08,e.y),new THREE.Vector3(e.x2!,n(e.z2,e.z)+extra(e)+.08,e.y2!)];groups[e.layer].add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:colors[e.layer],transparent:true,opacity:.82})));continue;
        }
        if(e.layer==="L2"){equipment(e);continue}
        if(e.layer==="L4"){
          const marker=new THREE.Mesh(new THREE.TorusGeometry(.34,.025,8,32),new THREE.MeshBasicMaterial({color:colors.L4}));marker.rotation.x=Math.PI/2;marker.position.set(e.x,height(e)+.04,e.y);tag(marker,e);groups.L4.add(marker);continue;
        }
      }
      for(const link of graph.links||[]){
        if(!["SAME_TAG","SLD_FEEDS","SOURCE_RELATION"].includes(link.type))continue;const a=entityById.get(link.from),b=entityById.get(link.to);if(!a||!b||!isVisible(a)||!isVisible(b))continue;
        const pts=[new THREE.Vector3(a.x,height(a)+.65,a.y),new THREE.Vector3(b.x,height(b)+.65,b.y)];const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineDashedMaterial({color:link.type==="SLD_FEEDS"?0x56b9ff:0xa57cff,dashSize:.28,gapSize:.14,transparent:true,opacity:.78}));line.computeLineDistances();groups.L3.add(line);
      }
      const visiblePoints=visible.flatMap(e=>[{x:e.x,y:height(e),z:e.y},...(Number.isFinite(e.x2)&&Number.isFinite(e.y2)?[{x:e.x2!,y:n(e.z2,e.z)+extra(e),z:e.y2!}]:[])]);
      const bounds=new THREE.Box3();visiblePoints.forEach(p=>bounds.expandByPoint(new THREE.Vector3(p.x,p.y,p.z)));
      if(bounds.isEmpty())bounds.expandByPoint(new THREE.Vector3(-5,0,-5)).expandByPoint(new THREE.Vector3(5,5,5));
      const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3()),span=Math.max(size.x,size.y,size.z,8);
      const minX=bounds.min.x-2,minZ=bounds.min.z-2,minY=Math.min(bounds.min.y,0),maxY=Math.max(bounds.max.y+3,4);
      const axis=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(minX,minY,minZ),new THREE.Vector3(minX,maxY,minZ)]),new THREE.LineBasicMaterial({color:0x49d39a}));scene.add(axis);
      for(const [name,z] of levels){const y=z+(exploded?(floorIndex.get(name)||0)*2.6:0),grid=new THREE.GridHelper(Math.max(span*1.15,20),20,0x244d61,0x102c39);grid.position.y=y;grid.material.transparent=true;grid.material.opacity=.18;scene.add(grid);label(`${name} · ${z.toFixed(2)} m`,minX+.8,y,minZ,"#7be0b1")}
      const fit=()=>{const c=bounds.getCenter(new THREE.Vector3()),s=bounds.getSize(new THREE.Vector3()),d=Math.max(s.x,s.y,s.z,8);controls.target.copy(c);camera.position.set(c.x+d*.9,c.y+d*.72+4,c.z+d);camera.near=.05;camera.far=Math.max(1000,d*20);camera.updateProjectionMatrix();controls.update()};fit();
      runtime.current.fit=fit;
      const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
      const pick=(ev:PointerEvent)=>{const rect=renderer.domElement.getBoundingClientRect();pointer.x=((ev.clientX-rect.left)/rect.width)*2-1;pointer.y=-((ev.clientY-rect.top)/rect.height)*2+1;ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(clickable,true)[0];let node:any=hit?.object;while(node&&!node.userData?.entity)node=node.parent;if(node?.userData?.entity)setSelected(node.userData.entity)};
      renderer.domElement.addEventListener("pointerup",pick);
      const ro=new ResizeObserver(()=>{if(!host.clientWidth||!host.clientHeight)return;camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight)});ro.observe(host);
      let frame=0;const animate=()=>{controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(animate)};animate();
      cleanup=()=>{runtime.current=null;cancelAnimationFrame(frame);ro.disconnect();renderer.domElement.removeEventListener("pointerup",pick);controls.dispose();renderer.dispose();host.replaceChildren()};
    })();
    return()=>{disposed=true;cleanup()};
  },[graph,registry,mode,environment,systemMode,floor,exploded,xray,labels,visible,levels]);

  useEffect(()=>{runtime.current?.fit?.()},[fitRevision]);
  useEffect(()=>{
    const r=runtime.current;if(!r||!selected)return;const y=displayElevation(selected,mode),target=new r.THREE.Vector3(selected.x,y+1,selected.y),span=5;r.controls.target.copy(target);r.camera.position.copy(target).add(new r.THREE.Vector3(span,span*.75,span));r.controls.update();
  },[selected?.id,mode]);

  if(!graph||!Array.isArray(graph.entities)||graph.entities.length===0)return <section className="card" style={{marginBottom:18}}><div className="eyebrow">Spatial viewer</div><h2>No compiled spatial objects yet</h2><p className="subtitle">Import and successfully extract a drawing, SLD or DXF first. A source fingerprint by itself does not unlock the project viewer.</p><Link className="action" href="/compiler">Review engineering sources</Link></section>;

  const width=fallbackBounds.maxX-fallbackBounds.minX,height2=fallbackBounds.maxY-fallbackBounds.minY;
  const sx=(x:number)=>((x-fallbackBounds.minX)/width)*92+4,sy=(y:number)=>96-((y-fallbackBounds.minY)/height2)*92;

  return <section style={{border:"1px solid #1b3a50",borderRadius:18,overflow:"hidden",background:"#07111b",marginBottom:18}} aria-label="Spatial viewer">
    <div style={{padding:"16px 18px",display:"flex",justifyContent:"space-between",gap:14,alignItems:"center",flexWrap:"wrap",borderBottom:"1px solid #17334a"}}>
      <div><div className="eyebrow">STRATUM Spatial Verified</div><h2 style={{margin:"3px 0"}}>Spatial model</h2><p className="muted" style={{margin:0}}>{graph.sources.length} source(s) · {levels.length} level(s) · {rooms} room(s) · {sldObjects} SLD object(s)</p></div>
      <div className="button-row"><Link className="ghost" href="/compiler">Edit sources</Link><Link className="ghost" href="/component-library">3D models</Link></div>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8,padding:12,borderBottom:"1px solid #17334a"}} role="group" aria-label="Spatial view mode">
      <button className={mode==="MODEL"?"action":"ghost"} aria-pressed={mode==="MODEL"} onClick={()=>setMode("MODEL")}><b>Model</b><br/><small>Rooms + equipment at physical Z</small></button>
      <button className={mode==="ELECTRICAL"?"action":"ghost"} aria-pressed={mode==="ELECTRICAL"} onClick={()=>setMode("ELECTRICAL")}><b>Electrical</b><br/><small>SLD topology projected spatially</small></button>
      <button className={mode==="REVIEW"?"action":"ghost"} aria-pressed={mode==="REVIEW"} onClick={()=>setMode("REVIEW")}><b>Review</b><br/><small>Source confidence + candidates</small></button>
    </div>

    <div style={{display:"flex",gap:8,padding:"10px 12px",alignItems:"center",flexWrap:"wrap",borderBottom:"1px solid #17334a"}}>
      <select aria-label="Floor isolation" value={floor} onChange={e=>setFloor(e.target.value)}><option value="ALL">All floors</option>{levels.map(([f])=><option key={f} value={f}>{f}</option>)}</select>
      <input aria-label="Search objects" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search equipment, room or source" style={{minWidth:220,flex:"1 1 240px"}}/>
      <button className="ghost" onClick={()=>setFitRevision(v=>v+1)}>Fit model</button>
      <button className="ghost" onClick={()=>setLabels(v=>!v)}>{labels?"Hide labels":"Show labels"}</button>
    </div>

    <details style={{borderBottom:"1px solid #17334a"}}><summary style={{padding:"10px 14px",cursor:"pointer"}}>Layers</summary>
      <div style={{display:"grid",gap:10,padding:"0 12px 12px"}}>
        <div><strong style={{fontSize:12}}>Disciplines</strong><div className="button-row" style={{marginTop:6}}>{disciplines.map(value=>{const on=!hiddenDisciplines.includes(value);return <button key={value} type="button" className={on?"action":"ghost"} aria-label={value+" layer"} aria-pressed={on} onClick={()=>setHiddenDisciplines(current=>on?[...current,value]:current.filter(item=>item!==value))}>{value}</button>})}</div></div>
        <div><strong style={{fontSize:12}}>Sources</strong><div className="button-row" style={{marginTop:6}}>{(graph?.sources||[]).map(source=>{const on=!hiddenSources.includes(source.name);return <button key={source.sha256||source.name} type="button" className={on?"action":"ghost"} aria-label={source.name+" source layer"} aria-pressed={on} title={source.name} onClick={()=>setHiddenSources(current=>on?[...current,source.name]:current.filter(item=>item!==source.name))}>{source.name.length>28?source.name.slice(0,25)+"…":source.name}</button>})}</div></div>
        <div className="button-row"><button type="button" className="ghost" onClick={()=>{setHiddenDisciplines([]);setHiddenSources([])}} disabled={!hiddenDisciplines.length&&!hiddenSources.length}>Show all layers</button></div>
        <small className="muted">Layer visibility changes the view only. It never changes source authority, review state or the persisted engineering record.</small>
      </div>
    </details>

    <details style={{borderBottom:"1px solid #17334a"}}><summary style={{padding:"10px 14px",cursor:"pointer"}}>Advanced view controls</summary><div style={{display:"flex",gap:8,padding:"0 12px 12px",flexWrap:"wrap"}}>
      <button className="ghost" aria-pressed={exploded} onClick={()=>setExploded(v=>!v)}>{exploded?"Collapse building":"Explode building"}</button>
      <button className="ghost" aria-pressed={xray} onClick={()=>setXray(v=>!v)}>{xray?"Disable X-Ray":"X-Ray architecture"}</button>
      <select aria-label="Environment mode" value={environment} onChange={e=>setEnvironment(e.target.value as EnvironmentMode)}><option value="ENGINEERING">Engineering</option><option value="CINEMATIC">Cinematic</option><option value="NIGHT">Night Operations</option><option value="EMERGENCY">Emergency Mode</option></select>
      <select aria-label="System isolation" value={systemMode} onChange={e=>setSystemMode(e.target.value as SystemMode)}>{systemOptions.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select>
    </div></details>

    <div className="compiled-twin-grid" style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(270px,340px)"}}>
      <div style={{position:"relative",minHeight:520,background:"#041019"}}>
        {renderStatus!=="FALLBACK"&&<div ref={mount} style={{height:"min(72vh,760px)",minHeight:520}}/>}
        {renderStatus==="FALLBACK"&&<div style={{height:"min(72vh,760px)",minHeight:520,padding:14}} role="img" aria-label="2D spatial fallback">
          <svg viewBox="0 0 100 100" width="100%" height="100%" style={{background:"#06141e",borderRadius:12}}>
            {(graph.links||[]).filter(l=>["SLD_FEEDS","SAME_TAG","SOURCE_RELATION"].includes(l.type)).map(l=>{const a=graph.entities.find(e=>e.id===l.from),b=graph.entities.find(e=>e.id===l.to);if(!a||!b)return null;return <line key={l.id} x1={sx(a.x)} y1={sy(a.y)} x2={sx(b.x)} y2={sy(b.y)} stroke={l.type==="SLD_FEEDS"?"#57baff":"#9a7cff"} strokeWidth=".35" strokeDasharray="1 1"/>})}
            {visible.map(e=>(e.kind==="line"||e.kind==="sld-feeder-candidate")&&Number.isFinite(e.x2)&&Number.isFinite(e.y2)?<line key={e.id} x1={sx(e.x)} y1={sy(e.y)} x2={sx(e.x2!)} y2={sy(e.y2!)} stroke={e.layer==="L3"?"#62bfff":"#7895a4"} strokeWidth=".28"/>:<g key={e.id} onClick={()=>setSelected(e)} style={{cursor:"pointer"}}><circle cx={sx(e.x)} cy={sy(e.y)} r={e.layer==="L2"?1.25:.75} fill={e.layer==="L2"?"#e5a14d":e.layer==="L4"?"#43d98f":"#7f98a6"}/>{labels&&e.layer==="L2"&&<text x={sx(e.x)+1.7} y={sy(e.y)-1} fill="#d8edf6" fontSize="2.2">{e.name.slice(0,24)}</text>}</g>)}
          </svg><p className="muted" style={{margin:"8px 0 0"}}>Interactive 2D fallback active. Source placement and selection remain available while this device/browser cannot initialize WebGL.</p>
        </div>}
        <div style={{position:"absolute",top:12,right:12,background:"rgba(3,12,18,.86)",border:"1px solid #245069",borderRadius:12,padding:"10px 12px",pointerEvents:"none"}}><div className="eyebrow">INFRASTRUCTURE HUD</div><small>{renderStatus==="WEBGL"?"3D WEBGL":"2D FALLBACK"} · {mode}</small><div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:"4px 12px",marginTop:6,fontSize:12}}><span>VISIBLE</span><b>{visible.length}</b><span>SLD</span><b>{sldObjects}</b><span>UNRESOLVED Z</span><b>{unresolvedZ}</b><span>3D MODELS</span><b>{modelMapped}</b></div></div>
      </div>

      <aside style={{padding:15,borderLeft:"1px solid #17334a",overflow:"auto"}}>
        <label>Imported object<select aria-label="Imported object" value={selected?.id||""} onChange={e=>setSelected(graph.entities.find(x=>x.id===e.target.value)||null)} style={{width:"100%"}}><option value="">Select an object</option>{matching.map(e=><option key={e.id} value={e.id}>{e.name} · {e.floor||"UNRESOLVED"}</option>)}</select></label>
        <SpatialAssetInspector selected={selected} registeredAssets={registeredAssets} onEntityUpdated={entity=>setSelected(entity as Entity)}/>
        {selected&&isSld(selected)&&<div className="notice" style={{marginTop:12}}><strong>SLD → SPATIAL PROJECTION</strong><span>The vertical separation in Electrical mode expresses logical power hierarchy. It is not an as-built physical elevation until field/design evidence establishes Z.</span></div>}
        {selected&&!physicalElevationKnown(selected)&&!isSld(selected)&&<div className="notice" style={{marginTop:12}}><strong>Z NEEDS REVIEW</strong><span>This object has source placement, but physical elevation is not yet established. Review floor/elevation before treating Z as physical placement.</span></div>}
        {selected&&<button className="ghost" style={{width:"100%",marginTop:12}} onClick={()=>setFitRevision(v=>v+1)}>Fit full model</button>}
        <div className="notice" style={{marginTop:14}}><strong>TRUTH BOUNDARY</strong><span>DIR finality secures the immutable record; it does not by itself establish physical truth. Observed/source-derived geometry never silently overwrites Verified infrastructure state.</span></div>
      </aside>
    </div>
    <style jsx>{`@media(max-width:820px){.compiled-twin-grid{grid-template-columns:1fr!important}.compiled-twin-grid aside{border-left:0!important;border-top:1px solid #17334a}}select,input{background:#08131d;color:#d8edf6;border:1px solid #28465f;border-radius:9px;padding:9px 10px}`}</style>
  </section>;
}