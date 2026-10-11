"use client";

import Link from "next/link";
import {useEffect,useMemo,useRef,useState} from "react";
import {resolveElectricalComponent} from "@/lib/electrical-component-library";
import {resolveSpatialModel} from "@/lib/spatial-model-resolution";
import {decideSourceModelVisual} from "@/lib/spatial-viewer-geometry-policy";
import {unresolvedAssetVisual} from "@/lib/unresolved-asset-visual";
import {deriveSpatialEvidenceEnvelope} from "@/lib/spatial-evidence-envelope";
import {deriveDigitalTwinProjectReadiness} from "@/lib/digital-twin-readiness";
import {deriveRenderLocalOrigin} from "@/lib/render-local-origin";
import {resolveReconciledAssetPlacement} from "@/lib/z-solution-chain";
import {fitProceduralObjectToMeters,normalizeObjectToMeters} from "@/lib/three-model-normalization";
import {decodeGlbBase64,inspectStandaloneGlb} from "@/lib/spatial-glb-import";
import SpatialAssetInspector from "@/components/SpatialAssetInspector";
import {readPrimarySpatialGraph} from "@/lib/spatial-browser-recovery";
import {buildSpatialCoordinationReviewIndex,findingsForEntity} from "@/lib/spatial-coordination-review";
import {buildCoordinationIntelligence,type CoordinationSnapshot} from "@/lib/coordination-intelligence";
import {type RegisteredSpatialAsset} from "@/lib/spatial-asset-link";
import {findDrawingSourcesNeedingReprocess} from "@/lib/spatial-source-reprocess";
import {isIdentifiedProjectEquipment} from "@/lib/spatial-ui-counts";
import {spatialEntitySourceKey,spatialSourceKey,spatialSourceLayerLabels} from "@/lib/spatial-source-layer";
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
  sources:{name:string;ext:string;sha256:string;discipline:string;floor?:string;elevation?:number;unitName?:string;unitToMeters?:number;state?:string;entities?:number;vectors?:number;textItems?:number;sldPages?:number;nonSldPlanPages?:number;planTypes?:string[]}[];
  entities:Entity[];links?:GraphLink[];stats:Record<Layer,number>;
  coordinationIntelligence?:CoordinationSnapshot;
};

type RenderStatus="STARTING"|"WEBGL"|"FALLBACK";
const layerNames:Record<Layer,string>={L0:"Source",L1:"Architectural",L2:"Electrical Physical",L3:"Electrical Logical",L4:"STRATUM Assets"};
const colors:Record<Layer,number>={L0:0x31566d,L1:0x7f98a6,L2:0xe5a14d,L3:0x62bfff,L4:0x43d98f};
const systemOptions:{id:SystemMode;label:string}[]=[
  {id:"ALL",label:"All systems"},{id:"POWER",label:"Power distribution"},{id:"EMERGENCY",label:"Emergency power"},
  {id:"EV",label:"EV infrastructure"},{id:"LOW_VOLTAGE",label:"Low voltage"},{id:"RENEWABLE",label:"Renewables"},
];

function n(value:unknown,fallback=0){const x=Number(value);return Number.isFinite(x)?x:fallback}
function sheetPageKey(e:Entity){const page=Number(e.meta?.page||0),sourceKey=String(e.meta?.sourceSha256||e.source||'').trim();return sourceKey&&Number.isInteger(page)&&page>0?`${sourceKey}:${page}`:null}
function sheetFrameKey(e:Entity){const pageKey=sheetPageKey(e);if(!pageKey)return null;const frameId=String(e.meta?.planFrameId||'').trim();return frameId?`${pageKey}:${frameId}`:pageKey}
function planTypeLabel(value:unknown){return String(value||'').replaceAll('_',' ').toLowerCase().replace(/\b\w/g,letter=>letter.toUpperCase())}
function metaNumber(e:Entity,key:string){const value=e.meta?.[key];if(value===null||value===undefined||value==='')return null;const x=Number(value);return Number.isFinite(x)?x:null}
function isSld(e:Entity){return Boolean(e.meta?.sldCandidate===true||e.meta?.sldSpatialProjection||e.meta?.sldLogicalDepth!==undefined||/single.?line|one.?line|\bsld\b|riser/i.test(String(e.meta?.sheetTitle||e.source)))}
function physicalElevationKnown(e:Entity){if(e.meta?.elevationKnown===false||e.meta?.physicalElevationKnown===false)return false;return e.meta?.elevationKnown===true||e.meta?.physicalElevationKnown===true}
function displayElevation(e:Entity,mode:ViewMode){
  const base=n(e.z);
  if(mode==="ELECTRICAL"&&isSld(e)){
    const logical=metaNumber(e,"sldLogicalDepth")??0;
    return base+logical*2.4;
  }
  if(!physicalElevationKnown(e)&&e.meta?.zResolutionStatus==="RESOLVED_DESIGN_CANDIDATE"){
    const candidate=metaNumber(e,"zCandidateMeters");
    if(candidate!==null)return candidate;
  }
  if(!physicalElevationKnown(e)){
    const localSurface=metaNumber(e,"localReviewSurfaceZ");
    if(localSurface!==null)return localSurface;
    const crossSheetSurface=metaNumber(e,"crossSheetReviewSurfaceZ");
    if(crossSheetSurface!==null)return crossSheetSurface;
    const reviewSurface=metaNumber(e,"reviewSurfaceZ");
    if(reviewSurface!==null)return reviewSurface;
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
  const [discipline,setDiscipline]=useState("ALL");
  const [sheetFrame,setSheetFrame]=useState("AUTO");
  const [hiddenSources,setHiddenSources]=useState<string[]>([]);
  const [exploded,setExploded]=useState(false);
  const [xray,setXray]=useState(false);
  const [search,setSearch]=useState("");
  const [selected,setSelected]=useState<Entity|null>(null);
  const [fitRevision,setFitRevision]=useState(0);
  const [labels,setLabels]=useState(true);
  const [hudOpen,setHudOpen]=useState(false);
  const [activeProjectId,setActiveProjectId]=useState<string|null>(null);
  const [modelLoadErrors,setModelLoadErrors]=useState<string[]>([]);

  useEffect(()=>{
    let active=true;
    const load=async()=>{
      try{
        const primary=await readPrimarySpatialGraph();
        if(!active)return;
        setGraph(primary as Graph|null);
        setActiveProjectId(localStorage.getItem('stratum_spatial_project_id'));
        const stored=localStorage.getItem(ELECTRICAL_MODEL_REGISTRY_STORAGE_KEY);
        setRegistry(stored?normalizeElectricalModelRegistry(JSON.parse(stored)):DEFAULT_ELECTRICAL_MODEL_REGISTRY);
      }catch{}
    };
    void load();
    const refresh=()=>{void load()};
    window.addEventListener("stratum:graph-updated",refresh);window.addEventListener("storage",refresh);window.addEventListener("stratum:model-registry-updated",refresh);
    return()=>{active=false;window.removeEventListener("stratum:graph-updated",refresh);window.removeEventListener("storage",refresh);window.removeEventListener("stratum:model-registry-updated",refresh)};
  },[]);

  const disciplines=useMemo(()=>graph?[...new Set([...graph.sources.map(source=>source.discipline||"Unclassified"),...graph.entities.map(entity=>String(entity.meta?.planDiscipline||entity.meta?.discipline||'')).filter(Boolean)])].sort():[],[graph]);
  const sourceLayers=useMemo(()=>graph?.sources||[],[graph]);
  const sourceLayerLabels=useMemo(()=>spatialSourceLayerLabels(sourceLayers),[sourceLayers]);
  const staleDrawingSources=useMemo(()=>graph?findDrawingSourcesNeedingReprocess(graph.sources,graph.entities):[],[graph]);
  const hiddenSourceSet=useMemo(()=>new Set(hiddenSources),[hiddenSources]);
  const sourceDisciplines=useMemo(()=>new Map((graph?.sources||[]).flatMap(source=>{const d=source.discipline||"Unclassified";return [[spatialSourceKey(source),d],[source.name,d]] as [string,string][];})),[graph]);
  const sheetFrames=useMemo(()=>{
    if(!graph)return[] as {key:string;source:string;page:number;planType:string;discipline:string;aligned:boolean;count:number;title:string;floor:string|null}[];
    const map=new Map<string,{key:string;source:string;page:number;planType:string;discipline:string;aligned:boolean;count:number;title:string;floor:string|null}>();
    for(const entity of graph.entities){
      if(entity.meta?.nonSpatial===true)continue;
      const key=sheetFrameKey(entity);if(!key)continue;
      const plan=Boolean(entity.meta?.nonSldPlan===true),sld=isSld(entity),underlay=entity.kind==="source-raster-underlay";
      if(!plan&&!sld&&!underlay)continue;
      const page=Number(entity.meta?.page),prior=map.get(key),planType=plan?String(entity.meta?.planType||"PLAN_VIEW_UNCLASSIFIED"):sld?"SLD":String(entity.meta?.planType||"RASTER_DRAWING");
      const entityDiscipline=String(entity.meta?.planDiscipline||entity.meta?.discipline||sourceDisciplines.get(entity.source)||"Unclassified");
      const aligned=Boolean(entity.meta?.planXYValidated===true||entity.meta?.sheetXYTransform||entity.meta?.autoSheetAlignmentCandidateId||entity.meta?.sheetTransform);
      const title=String(entity.meta?.planFrameTitle||entity.meta?.sheetTitle||planTypeLabel(planType));
      const frameFloor=String(entity.meta?.planFrameFloor||entity.floor||'').trim()||null;
      map.set(key,{key,source:entity.source,page,planType:prior?.planType&&prior.planType!=="RASTER_DRAWING"?prior.planType:planType,discipline:prior?.discipline&&prior.discipline!=="Unclassified"?prior.discipline:entityDiscipline,aligned:Boolean(prior?.aligned||aligned),count:(prior?.count||0)+1,title:prior?.title||title,floor:prior?.floor||frameFloor});
    }
    return[...map.values()].sort((a,b)=>a.source.localeCompare(b.source)||a.page-b.page);
  },[graph,sourceDisciplines]);
  const activeSheetFrame=useMemo(()=>{
    if(sheetFrame==="ALL")return null;
    if(sheetFrame!=="AUTO")return sheetFrame;
    if(sheetFrames.length<=1)return null;
    const preferred=mode==="ELECTRICAL"
      ?sheetFrames.find(frame=>frame.planType==="SLD")||sheetFrames.find(frame=>/ELECTRICAL|UTILITY|LOW_VOLTAGE/.test(frame.planType))||sheetFrames.find(frame=>frame.planType!=="RASTER_DRAWING")
      :sheetFrames.find(frame=>frame.planType!=="RASTER_DRAWING")||sheetFrames[0];
    return preferred?.key||sheetFrames[0]?.key||null;
  },[sheetFrame,sheetFrames,mode]);
  const nonSldPlanSheets=useMemo(()=>sheetFrames.filter(frame=>frame.planType!=="SLD"&&frame.planType!=="RASTER_DRAWING").length,[sheetFrames]);
  const activeScaleValidation=useMemo(()=>{
    if(!graph)return null as null|Record<string,unknown>;
    const candidates=graph.entities.filter(entity=>{if(!entity.meta?.scaleValidationEvidence)return false;if(!activeSheetFrame)return true;const pageKey=sheetPageKey(entity);return sheetFrameKey(entity)===activeSheetFrame||Boolean(pageKey&&(activeSheetFrame===pageKey||activeSheetFrame.startsWith(pageKey+':')))});
    return candidates[0]?.meta?.scaleValidationEvidence as Record<string,unknown>||null;
  },[graph,activeSheetFrame]);
  const coordinationSnapshot=useMemo(()=>graph?.coordinationIntelligence||(graph?buildCoordinationIntelligence(graph):undefined),[graph]);
  const coordinationReview=useMemo(()=>buildSpatialCoordinationReviewIndex(coordinationSnapshot),[coordinationSnapshot]);
  const levels=useMemo(()=>{
    if(!graph)return[] as [string,number][];
    const map=new Map<string,number|null>();
    for(const e of graph.entities){const f=e.floor||"UNRESOLVED";if(!map.has(f)||physicalElevationKnown(e))map.set(f,physicalElevationKnown(e)?n(e.z):null)}
    for(const s of graph.sources){if(s.floor&&!map.has(s.floor))map.set(s.floor,null)}
    return[...map.entries()].sort((a,b)=>(a[1]??0)-(b[1]??0));
  },[graph]);
  const visible=useMemo(()=>{
    if(!graph)return[];
    const q=search.trim().toLowerCase();
    return graph.entities.filter(e=>{
      if(e.meta?.nonSpatial===true)return false;
      const sourceKey=spatialEntitySourceKey(e,graph.sources);
      if(hiddenSourceSet.has(sourceKey))return false;
      const frame=sheetFrameKey(e);if(activeSheetFrame&&frame&&frame!==activeSheetFrame)return false;
      if(floor!=="ALL"&&(e.floor||"UNRESOLVED")!==floor)return false;
      const entityDiscipline=String(e.meta?.planDiscipline||e.meta?.discipline||sourceDisciplines.get(sourceKey)||sourceDisciplines.get(e.source)||"Unclassified");
      if(discipline!=="ALL"&&entityDiscipline!==discipline)return false;
      if(mode==="ELECTRICAL"&&(!(["L2","L3","L4"] as Layer[]).includes(e.layer)||!isSld(e)))return false;
      if(systemMode!=="ALL"&&e.layer==="L2"&&entitySystem(e)!==systemMode)return false;
      if(q&&!`${e.name} ${e.source} ${e.floor||""} ${e.zone||""}`.toLowerCase().includes(q))return false;
      return true;
    });
  },[graph,floor,discipline,mode,systemMode,search,sourceDisciplines,hiddenSourceSet,activeSheetFrame]);
  const inventory=useMemo(()=>visible.filter(e=>e.kind!=="line"&&e.kind!=="sld-feeder-candidate"&&e.kind!=="wall-segment"&&e.kind!=="source-raster-underlay"&&e.kind!=="elevation-control-point"&&e.kind!=="elevation-review-surface-triangle"),[visible]);
  const identifiedEquipment=useMemo(()=>visible.filter(isIdentifiedProjectEquipment).length,[visible]);
  const visibleLines=useMemo(()=>visible.filter(e=>e.kind==="line").length,[visible]);
  const rasterUnderlays=useMemo(()=>visible.filter(e=>e.kind==="source-raster-underlay").length,[visible]);
  const rooms=useMemo(()=>graph?.entities.filter(e=>e.kind==="room-boundary").length||0,[graph]);
  const sldObjects=useMemo(()=>graph?.entities.filter(e=>e.layer==="L2"&&isSld(e)).length||0,[graph]);
  const unresolvedZ=useMemo(()=>graph?.entities.filter(e=>e.layer==="L2"&&!physicalElevationKnown(e)&&!isSld(e)).length||0,[graph]);
  const modelMapped=useMemo(()=>graph?.entities.filter(e=>{
    if(e.layer!=="L2"||e.kind==="line")return false;
    if(e.kind==="cad-text"||e.meta?.cadPhysicalAnchor===false)return false;
    if(e.kind==="imported-3d-model")return typeof e.meta?.embeddedGlb==='string';
    return Boolean(resolveSpatialModel(e,registry).model?.modelUrl.trim());
  }).length||0,[graph,registry]);
  const matching=useMemo(()=>inventory,[inventory]);
  const projectAssets=useMemo(()=>activeProjectId?registeredAssets.filter(asset=>asset.project_id===activeProjectId&&!/^STR-UAT-/i.test(asset.asset_code)):[],[activeProjectId,registeredAssets]);
  const twinReadiness=useMemo(()=>graph?deriveDigitalTwinProjectReadiness(graph.entities,projectAssets,registry):null,[graph,projectAssets,registry]);
  const fallbackBounds=useMemo(()=>bounds2d(visible),[visible]);
  const renderOrigin=useMemo(()=>deriveRenderLocalOrigin(visible),[visible]);

  useEffect(()=>{
    if(!graph)return;
    const valid=new Set(graph.sources.map(source=>spatialSourceKey(source)));
    setHiddenSources(current=>current.filter(source=>valid.has(source)));
    if(sheetFrame!=="AUTO"&&sheetFrame!=="ALL"&&!sheetFrames.some(frame=>frame.key===sheetFrame))setSheetFrame("AUTO");
  },[graph?.createdAt,sheetFrames,sheetFrame]);

  function toggleSource(key:string){
    setHiddenSources(current=>current.includes(key)?current.filter(source=>source!==key):[...current,key]);
  }

  useEffect(()=>{
    if(!graph||!mount.current)return;
    let disposed=false,cleanup=()=>{};
    setModelLoadErrors([]);
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
      const spatialRoot=new THREE.Group();
      spatialRoot.name="STRATUM_RENDER_LOCAL_ROOT";
      spatialRoot.position.set(-renderOrigin.x,0,-renderOrigin.y);
      scene.add(spatialRoot);
      const camera=new THREE.PerspectiveCamera(44,host.clientWidth/Math.max(host.clientHeight,1),0.05,2000);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.setSize(host.clientWidth,host.clientHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;
      renderer.shadowMap.enabled=true;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=environment==="NIGHT"?.8:1.05;
      host.appendChild(renderer.domElement);
      const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.07;controls.maxPolarAngle=Math.PI*.495;
      runtime.current={THREE,camera,controls,scene,spatialRoot,renderOrigin};
      renderer.domElement.dataset.renderOriginX=String(renderOrigin.x);
      renderer.domElement.dataset.renderOriginY=String(renderOrigin.y);
      renderer.domElement.dataset.renderOriginAuthority=renderOrigin.authority;
      scene.add(new THREE.HemisphereLight(0xccecff,0x071018,environment==="NIGHT"?.8:1.7));
      const sun=new THREE.DirectionalLight(environment==="EMERGENCY"?0xff9378:0xffffff,environment==="NIGHT"?1.2:3.2);sun.position.set(16,25,12);sun.castShadow=true;scene.add(sun);
      scene.add(new THREE.AmbientLight(0x7796a8,.45));
      const groups={L0:new THREE.Group(),L1:new THREE.Group(),L2:new THREE.Group(),L3:new THREE.Group(),L4:new THREE.Group()} as Record<Layer,any>;
      (Object.keys(groups) as Layer[]).forEach(l=>spatialRoot.add(groups[l]));
      groups.L0.visible=mode!=="ELECTRICAL";groups.L1.visible=mode!=="ELECTRICAL";groups.L2.visible=true;groups.L3.visible=true;groups.L4.visible=true;
      const entityById=new Map(graph.entities.map(e=>[e.id,e]));
      const clickable:any[]=[];const clickableEntities=new Set<string>();const entityAnchors=new Map<string,any>();const coordinationAnchors=new Map<string,any>();
      const floorIndex=new Map(levels.map(([name],i)=>[name,i]));
      const extra=(e:Entity)=>exploded?(floorIndex.get(e.floor||"UNRESOLVED")||0)*2.6:0;
      const height=(e:Entity)=>{
        if(e.layer==="L2"||e.layer==="L4"){
          const cfg=resolveSpatialModel(e,registry).model;
          return resolveReconciledAssetPlacement({name:e.name,floor:e.floor,z:e.z,meta:e.meta},{registry:cfg}).placement.baseZ+extra(e);
        }
        return displayElevation(e,mode)+extra(e);
      };
      const isVisible=(e:Entity)=>visible.some(v=>v.id===e.id);
      const material=(color:number,opacity=1,emissive=0)=>new THREE.MeshStandardMaterial({color,emissive,emissiveIntensity:.2,metalness:.28,roughness:.48,transparent:opacity<1,opacity,depthWrite:opacity>.2});
      const tag=(obj:any,e:Entity)=>{obj.userData.entity=e;entityAnchors.set(e.id,obj);clickableEntities.add(e.id);renderer.domElement.dataset.clickableAssets=String(clickableEntities.size);obj.traverse?.((node:any)=>{if(node.isMesh){node.userData.entity=e;if(!node.userData?.interactionProxy){node.castShadow=true;node.receiveShadow=true}const mats=Array.isArray(node.material)?node.material:[node.material];for(const mat of mats){if(mat?.emissive&&mat.userData?.stratumBaseEmissive===undefined){mat.userData=mat.userData||{};mat.userData.stratumBaseEmissive=mat.emissive.getHex();mat.userData.stratumBaseEmissiveIntensity=Number(mat.emissiveIntensity||0)}}clickable.push(node)}})};
      const interactionProxy=(root:any,target:[number,number,number])=>{const proxy=new THREE.Mesh(new THREE.BoxGeometry(Math.max(target[0]+.3,.8),Math.max(target[1]+.3,.8),Math.max(target[2]+.3,.8)),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false}));proxy.userData.interactionProxy=true;root.add(proxy)};
      const reviewMarker=(e:Entity)=>{
        if(mode!=="REVIEW")return;
        const review=coordinationReview.get(e.id);if(!review)return;
        const color=review.severity==="H3"?0xff5a52:0xffb84d;
        const root=new THREE.Group();
        root.position.set(e.x,height(e)+2.45,e.y);
        const sphere=new THREE.Mesh(new THREE.SphereGeometry(.23,18,12),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.95,depthTest:false}));
        const ring=new THREE.Mesh(new THREE.TorusGeometry(.34,.035,8,24),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.92,depthTest:false}));
        ring.rotation.x=Math.PI/2;
        root.add(sphere,ring);
        root.userData.entity=e;sphere.userData.entity=e;ring.userData.entity=e;
        coordinationAnchors.set(e.id,root);
        clickable.push(sphere,ring);groups.L4.add(root);
        renderer.domElement.dataset.coordinationAssets=String(Number(renderer.domElement.dataset.coordinationAssets||0)+1);
      };
      const label=(text:string,x:number,y:number,z:number,color="#cfefff",entity?:Entity,offset=0)=>{
        if(!labels)return;const canvas=document.createElement("canvas");canvas.width=512;canvas.height=112;const ctx=canvas.getContext("2d");if(!ctx)return;
        ctx.fillStyle="rgba(3,12,18,.82)";ctx.roundRect(4,4,504,104,16);ctx.fill();ctx.fillStyle=color;ctx.font="700 28px system-ui";ctx.fillText(text.slice(0,30),20,49);ctx.fillStyle="#83a6b7";ctx.font="20px system-ui";ctx.fillText(entity&&!physicalElevationKnown(entity)?(Number.isFinite(Number(entity.meta?.zCandidateMeters))?`Z ${String(entity.meta?.zCandidateReferencePoint||'reference').replaceAll('_',' ').toLowerCase()} ref ${Number(entity.meta?.zCandidateMeters).toFixed(2)} m`:metaNumber(entity,'localReviewSurfaceZ')!==null?`${String(entity.meta?.localReviewSurfaceKind||'Local').replaceAll('_',' ')} local surface ${metaNumber(entity,'localReviewSurfaceZ')!.toFixed(2)} m`:metaNumber(entity,'crossSheetReviewSurfaceZ')!==null?`${String(entity.meta?.crossSheetReviewSurfaceKind||'Cross-sheet').replaceAll('_',' ')} cross-sheet surface ${metaNumber(entity,'crossSheetReviewSurfaceZ')!.toFixed(2)} m`:metaNumber(entity,'reviewSurfaceZ')!==null?`${String(entity.meta?.reviewSurfaceKind||'Project datum').replaceAll('_',' ')} review surface ${metaNumber(entity,'reviewSurfaceZ')!.toFixed(2)} m`:'Review plane · Z unresolved'):entity?`${y.toFixed(2)} m Z`:'Drawing level · Z unverified',20,82);
        const texture=new THREE.CanvasTexture(canvas),sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false}));sprite.scale.set(2.9,.64,1);sprite.position.set(x+offset*.08,y+1.2+offset*.82,z);if(entity){sprite.userData.entity=entity;clickable.push(sprite);if(offset>0){const leaderStart=new THREE.Vector3(x-renderOrigin.x,y+.2,z-renderOrigin.y),leaderEnd=new THREE.Vector3(sprite.position.x-renderOrigin.x,sprite.position.y,sprite.position.z-renderOrigin.y);const leader=new THREE.Line(new THREE.BufferGeometry().setFromPoints([leaderStart,leaderEnd]),new THREE.LineDashedMaterial({color:0xffb85c,dashSize:.12,gapSize:.08,transparent:true,opacity:.65}));leader.position.set(renderOrigin.x,0,renderOrigin.y);leader.computeLineDistances();spatialRoot.add(leader)}}spatialRoot.add(sprite);
      };
      const wall=(a:XY,b:XY,e:Entity)=>{const dx=b.x-a.x,dz=b.y-a.y,len=Math.hypot(dx,dz);if(len<.02)return;const op=xray?.12:.55,m=new THREE.Mesh(new THREE.BoxGeometry(len,2.7,.09),material(colors.L1,op));m.position.set((a.x+b.x)/2,height(e)+1.35,(a.y+b.y)/2);m.rotation.y=-Math.atan2(dz,dx);groups.L1.add(m)};
      const room=(e:Entity)=>{if(!e.vertices||e.vertices.length<3||!isVisible(e))return;const shape=new THREE.Shape();e.vertices.forEach((p,i)=>{const lx=p.x-renderOrigin.x,ly=p.y-renderOrigin.y;i?shape.lineTo(lx,ly):shape.moveTo(lx,ly)});shape.closePath();const floorMesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),material(0x173748,xray?.07:.18));floorMesh.rotation.x=Math.PI/2;floorMesh.position.set(renderOrigin.x,height(e)+.01,renderOrigin.y);groups.L1.add(floorMesh);for(let i=0;i<e.vertices.length;i++)wall(e.vertices[i],e.vertices[(i+1)%e.vertices.length],e)};
      const rasterUnderlay=(e:Entity)=>{
        if(!isVisible(e))return;
        const source=e.meta?.embeddedRasterDataUrl;
        if(typeof source!=="string"||!source.startsWith("data:image/")||!Number.isFinite(e.x2)||!Number.isFinite(e.y2))return;
        const width=Math.abs(e.x2!-e.x),depth=Math.abs(e.y2!-e.y);if(width<.01||depth<.01)return;
        new THREE.TextureLoader().load(source,texture=>{
          if(disposed)return;
          texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
          const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,depth),new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:xray?.32:.9,side:THREE.DoubleSide,depthWrite:false}));
          mesh.rotation.x=-Math.PI/2;mesh.position.set((e.x+e.x2!)/2,height(e)+.015,(e.y+e.y2!)/2);mesh.renderOrder=-10;groups.L1.add(mesh);
        });
      };
      const attachSpatialEvidence=(root:any,e:Entity,modelResolution:ReturnType<typeof resolveSpatialModel>|null)=>{
        const envelope=deriveSpatialEvidenceEnvelope(e,modelResolution);
        root.userData.coordinationReadiness=envelope.readiness;
        root.userData.horizontalEvidenceState=envelope.horizontal.state;
        root.userData.horizontalCoordinateFrame=envelope.horizontal.coordinateFrame;
        root.userData.verticalEvidenceState=envelope.vertical.state;
        root.userData.verticalCoordinateFrame=envelope.vertical.coordinateFrame;
        root.userData.spatialEvidenceLineages=envelope.distinctEvidenceLineages;
        root.userData.horizontalUncertaintyBoundMeters=envelope.horizontal.totalUncertaintyBoundMeters;
        root.userData.verticalUncertaintyBoundMeters=envelope.vertical.totalUncertaintyBoundMeters;
        root.userData.physicalClashAuthority=false;
        root.userData.asBuiltAuthority=false;
      };
      const fallbackShape=(e:Entity)=>{
        if(e.kind==='sheet-callout-candidate'||e.kind==='annotated-asset-candidate'||(e.kind==='cad-text'&&e.meta?.cadPhysicalAnchor===false)){
          const root=new THREE.Group();
          const candidates=inventory.filter(item=>item.kind==='sheet-callout-candidate'||item.kind==='annotated-asset-candidate');
          const nearby=candidates.filter(item=>Math.hypot(item.x-e.x,item.y-e.y)<1);
          const clusterIndex=nearby.findIndex(item=>item.id===e.id);
          const angle=clusterIndex*2.39996;
          const distance=nearby.length>1?.42+Math.sqrt(clusterIndex)*.14:0;
          const dx=Math.cos(angle)*distance,dz=Math.sin(angle)*distance;
          const marker=new THREE.Mesh(new THREE.SphereGeometry(.085,12,8),new THREE.MeshBasicMaterial({color:0xffb85c,transparent:true,opacity:.6,depthTest:false}));
          marker.position.y=.14;root.add(marker);
          const ring=new THREE.Mesh(new THREE.TorusGeometry(.13,.012,6,20),new THREE.MeshBasicMaterial({color:0xffb85c,transparent:true,opacity:.7,depthTest:false}));ring.rotation.x=Math.PI/2;ring.position.y=.14;root.add(ring);
          const stem=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-dx,.02,-dz),new THREE.Vector3(0,.14,0)]),new THREE.LineDashedMaterial({color:0xffb85c,dashSize:.08,gapSize:.055}));stem.computeLineDistances();root.add(stem);
          root.position.set(e.x+dx,height(e),e.y+dz);tag(root,e);clickable.push(marker,ring);
          groups.L2.add(root);
          return;
        }
        const modelResolution=resolveSpatialModel(e,registry),def=modelResolution.component||resolveElectricalComponent(e.name),shape=def?.twinShape||"cabinet",cfg=modelResolution.model;
        const reconciled=resolveReconciledAssetPlacement({name:e.name,floor:e.floor,z:e.z,meta:e.meta},{registry:cfg}),placement=reconciled.placement;
        const target:[number,number,number]=[placement.dimensions.width,placement.dimensions.height,placement.dimensions.depth];
        const root=new THREE.Group(),op=.27;
        let geo:any;if(shape==="transformer")geo=new THREE.BoxGeometry(1.7,1.55,1.25);else if(shape==="generator")geo=new THREE.BoxGeometry(2.2,1.2,1.1);else if(shape==="motor")geo=new THREE.CylinderGeometry(.48,.48,1.15,20);else if(shape==="evse")geo=new THREE.BoxGeometry(.62,1.4,.44);else geo=new THREE.BoxGeometry(1.05,1.8,.62);
        const mesh=new THREE.Mesh(geo,material(colors.L2,op,0x211000));if(shape==="motor")mesh.rotation.z=Math.PI/2;root.add(mesh);
        try{fitProceduralObjectToMeters(root,target)}catch{}
        root.position.set(e.x,placement.baseZ,e.y);root.rotation.y=THREE.MathUtils.degToRad(-(e.rotation||0));
        root.userData.dimensionAuthority=placement.dimensions.authority;root.userData.targetDimensionsMeters=target;root.userData.zPlacementAuthority=placement.zAuthority;root.userData.zPlacementConfidence=placement.zConfidence;root.userData.zSolutionStatus=reconciled.solution.status;root.userData.zSolutionConflicts=reconciled.solution.conflicts.length;
        root.userData.modelResolutionTier=modelResolution.tier;root.userData.modelGeometryAuthority=modelResolution.geometryAuthority;root.userData.modelIdentityAuthority=modelResolution.identityAuthority;root.userData.exactProductIdentity=modelResolution.exactProductIdentity;root.userData.modelComponentKey=modelResolution.componentKey;root.userData.physicalIdentityVerified=false;
        root.userData.visibleAuthorityLabel='UNVERIFIED · NO MODEL · PROXY';
        root.userData.authorityEligible=false;root.userData.takeoffEligible=false;
        root.userData.measurementEligible=false;root.userData.exportEligible=false;
        attachSpatialEvidence(root,e,modelResolution);
        interactionProxy(root,target);tag(root,e);groups[e.layer==="L4"?"L4":"L2"].add(root);label(e.name+' · UNVERIFIED · PROXY',e.x,placement.baseZ,e.y,isSld(e)?"#8fcfff":"#ffd08a",e);
      };
      // UI-only review geometry: never enters the source graph, canonical XYZ,
      // quantities, measurements, compliance or exports. No default story spacing.
      const renderProvisionalMarker=(e:Entity,kind:'GHOST_MARKER'|'SHEET_PIN')=>{
        if(!Number.isFinite(e.x)||!Number.isFinite(e.y))return; // inspector list remains selectable
        const pin=kind==='SHEET_PIN';
        const color=pin?0xffca76:0x8bbcff;
        const root=new THREE.Group();
        // Scene zero is an explicitly non-spatial drawing/review plane, NOT asset Z.
        root.position.set(e.x,0,e.y);
        const sphere=new THREE.Mesh(new THREE.SphereGeometry(pin?.12:.29,16,12),
          new THREE.MeshBasicMaterial({color,transparent:true,opacity:pin?.52:.24,depthTest:false,depthWrite:false}));
        sphere.position.y=pin?.13:.30;
        const ring=new THREE.Mesh(new THREE.TorusGeometry(pin?.21:.43,.025,8,28),
          new THREE.MeshBasicMaterial({color,transparent:true,opacity:.85,depthTest:false,depthWrite:false}));
        ring.rotation.x=Math.PI/2;ring.position.y=.09;
        root.add(sphere,ring);
        root.userData.provisionalOnly=true;
        root.userData.placeholder=kind;
        root.userData.visibleAuthorityLabel='UNVERIFIED · '+kind;
        root.userData.authorityEligible=false;
        root.userData.canonicalZ=null;
        root.userData.takeoffEligible=false;
        root.userData.measurementEligible=false;
        root.userData.exportEligible=false;
        root.userData.spatialPlacementAuthority='REVIEW_UI_ONLY';
        tag(root,e);clickable.push(sphere,ring);
        groups[e.layer].add(root);
        label(pin?'SHEET PIN · XYZ UNRESOLVED':'GHOST · Z UNRESOLVED',e.x,0,e.y,pin?'#ffca76':'#8bbcff',e);
      };
      const loader=new GLTFLoader();
      const equipment=(e:Entity)=>{
        if(!isVisible(e))return;
        const provisional=unresolvedAssetVisual(e);
        const visual=decideSourceModelVisual(e,registry);
        if(provisional.kind==='SHEET_PIN'&&!isSld(e)){
          renderProvisionalMarker(e,'SHEET_PIN');
          return;
        }
        if(!visual.model&&provisional.kind!=='NONE'&&!isSld(e)){
          renderProvisionalMarker(e,'GHOST_MARKER');
          return;
        }
        if(e.kind==="imported-3d-model"){
          try{
            const encoded=e.meta?.embeddedGlb;
            if(typeof encoded!=="string")throw new Error('Model bytes are missing');
            const bytes=decodeGlbBase64(encoded);
            inspectStandaloneGlb(bytes);
            loader.parse(bytes,'',gltf=>{
              if(disposed)return;
              try{
                const sourceBounds=e.meta?.modelBoundsMeters;
                if(!Array.isArray(sourceBounds)||sourceBounds.length!==3||!sourceBounds.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>0))throw new Error('Model bounds are invalid');
                const def=resolveElectricalComponent(e.name),cfg=def?registry.find(r=>r.componentKey===def.key):null;
                const reconciled=resolveReconciledAssetPlacement({name:e.name,floor:e.floor,z:e.z,meta:e.meta},{registry:cfg}),placement=reconciled.placement;
                const target:[number,number,number]=[placement.dimensions.width,placement.dimensions.height,placement.dimensions.depth];
                const model=gltf.scene;
                const normalized=normalizeObjectToMeters(model,target,.08);
                const root=new THREE.Group();root.position.set(e.x,placement.baseZ,e.y);
                root.rotation.y=THREE.MathUtils.degToRad(-(e.rotation||0));
                root.userData.dimensionAuthority=placement.dimensions.authority+'_REVIEW_VISUALIZATION';
                root.userData.sourceModelBounds=sourceBounds;
                root.userData.targetDimensionsMeters=target;
                root.userData.normalization={scalar:normalized.scalar,ratioSpread:normalized.ratioSpread,reviewRequired:true};
                root.userData.zDisplayAuthority=placement.zAuthority;root.userData.zPlacementConfidence=placement.zConfidence;root.userData.zSolutionStatus=reconciled.solution.status;root.userData.zSolutionConflicts=reconciled.solution.conflicts.length;
                attachSpatialEvidence(root,e,null);
                root.add(model);interactionProxy(root,target);tag(root,e);
                groups.L2.add(root);label(e.name,e.x,placement.baseZ,e.y,'#ffd08a',e);
                const renderedBox=new THREE.Box3().setFromObject(root);if(!renderedBox.isEmpty()){renderedBox.translate(new THREE.Vector3(renderOrigin.x,0,renderOrigin.y));bounds.union(renderedBox);}
                runtime.current?.fit?.();
              }catch{setModelLoadErrors(current=>current.includes(e.id)?current:[...current,e.id])}
            },()=>{if(!disposed)setModelLoadErrors(current=>current.includes(e.id)?current:[...current,e.id])});
          }catch{setModelLoadErrors(current=>current.includes(e.id)?current:[...current,e.id])}
          return;
        }
        if(e.kind==='sheet-callout-candidate'||e.kind==='annotated-asset-candidate'||(e.kind==='cad-text'&&e.meta?.cadPhysicalAnchor===false)){fallbackShape(e);return}
        const modelResolution=resolveSpatialModel(e,registry),cfg=visual.model;
        if(!cfg?.modelUrl.trim()||!["GLB","GLTF"].includes(cfg.format)){fallbackShape(e);return}
        const reconciled=resolveReconciledAssetPlacement({name:e.name,floor:e.floor,z:e.z,meta:e.meta},{registry:cfg}),placement=reconciled.placement;
        const target:[number,number,number]=[placement.dimensions.width,placement.dimensions.height,placement.dimensions.depth];
        loader.load(cfg.modelUrl,gltf=>{
          if(disposed)return;
          try{
            const model=gltf.scene;
            model.position.set(0,0,0);model.scale.set(1,1,1);
            model.rotation.set(THREE.MathUtils.degToRad(cfg.rotation[0]),THREE.MathUtils.degToRad(cfg.rotation[1]),THREE.MathUtils.degToRad(cfg.rotation[2]));
            const normalized=normalizeObjectToMeters(model,target,.05);
            const root=new THREE.Group();
            root.position.set(e.x+cfg.offset[0],placement.baseZ+cfg.offset[1],e.y+cfg.offset[2]);
            root.rotation.y=THREE.MathUtils.degToRad(-(e.rotation||0));
            root.userData.dimensionAuthority=placement.dimensions.authority;
            root.userData.targetDimensionsMeters=target;root.userData.zPlacementAuthority=placement.zAuthority;root.userData.zPlacementConfidence=placement.zConfidence;root.userData.zSolutionStatus=reconciled.solution.status;root.userData.zSolutionConflicts=reconciled.solution.conflicts.length;
            root.userData.modelResolutionTier=modelResolution.tier;root.userData.modelGeometryAuthority=modelResolution.geometryAuthority;root.userData.modelIdentityAuthority=modelResolution.identityAuthority;root.userData.exactProductIdentity=modelResolution.exactProductIdentity;root.userData.modelComponentKey=modelResolution.componentKey;root.userData.modelResolutionConfidence=modelResolution.confidence;root.userData.physicalIdentityVerified=false;
            root.userData.visibleAuthorityLabel=visual.label;
            root.userData.resolutionDisplayTier=visual.tier;
            root.userData.canonicalZ=provisional.kind!=='NONE'?null:e.z??null;
            root.userData.physicalTruth=false;
            root.userData.reviewRequired=true;
            root.userData.takeoffEligible=false;
            root.userData.measurementEligible=false;
            root.userData.exportEligible=false;
            root.userData.authorityEligible=false;
            root.userData.geometryIsRepresentative=true;
            attachSpatialEvidence(root,e,modelResolution);
            root.userData.normalization={scalar:normalized.scalar,ratioSpread:normalized.ratioSpread,reviewRequired:normalized.reviewRequired};
            if(normalized.reviewRequired)console.warn("STRATUM model dimension mismatch requires review",{component:e.name,target,intrinsic:normalized.intrinsic,ratios:normalized.ratios,ratioSpread:normalized.ratioSpread});
            if(provisional.kind!=='NONE'||visual.tier==='UNRESOLVED_CLASS_PREVIEW'){
              model.traverse((node:any)=>{
                if(!node.isMesh)return;
                const style=(mat:any)=>{const copy=mat.clone();copy.transparent=true;copy.opacity=.24;
                  copy.depthWrite=false;if(copy.color)copy.color.lerp(new THREE.Color(0x8bbcff),.6);
                  return copy};
                node.material=Array.isArray(node.material)?node.material.map(style):style(node.material);
              });
            }
            root.add(model);interactionProxy(root,target);tag(root,e);groups[e.layer==="L4"?"L4":"L2"].add(root);
            label(e.name+' · '+visual.label,e.x,placement.baseZ,e.y,
              visual.tier==='RESOLVED_UNVERIFIED'?'#b2ffe7':'#ffd08a',e);
            const renderedBox=new THREE.Box3().setFromObject(root);if(!renderedBox.isEmpty()){renderedBox.translate(new THREE.Vector3(renderOrigin.x,0,renderOrigin.y));bounds.union(renderedBox);}
            runtime.current?.fit?.();
          }catch(error){
            console.warn("STRATUM meter normalization failed; procedural envelope fallback active",e.name,error);
            fallbackShape(e);
          }
        },undefined,()=>{if(!disposed)fallbackShape(e)});
      };
      if(mode==="REVIEW"){
        renderer.domElement.dataset.coordinationAssets="0";
        for(const reviewEntity of visible)reviewMarker(reviewEntity);
      }
      for(const e of graph.entities){
        if(!isVisible(e))continue;
        if(e.kind==="source-raster-underlay"){rasterUnderlay(e);continue}
        if(e.kind==="elevation-review-surface-triangle"&&Array.isArray(e.vertices)&&e.vertices.length===3){
          const zs=(e.meta?.elevationTriangle as any)?.zMeters;
          if(Array.isArray(zs)&&zs.length===3&&zs.every((z:any)=>Number.isFinite(Number(z)))){
            const verts=e.vertices;
            const geometry=new THREE.BufferGeometry();
            geometry.setAttribute('position',new THREE.Float32BufferAttribute([
              verts[0].x-renderOrigin.x,Number(zs[0])+extra(e),verts[0].y-renderOrigin.y,
              verts[1].x-renderOrigin.x,Number(zs[1])+extra(e),verts[1].y-renderOrigin.y,
              verts[2].x-renderOrigin.x,Number(zs[2])+extra(e),verts[2].y-renderOrigin.y
            ],3));
            geometry.setIndex([0,1,2]);geometry.computeVertexNormals();
            const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0x3e9db8,transparent:true,opacity:.16,side:THREE.DoubleSide,depthWrite:false,roughness:.85,metalness:0}));
            mesh.position.set(renderOrigin.x,0,renderOrigin.y);mesh.userData.reviewSurface=true;groups.L1.add(mesh);
            const edge=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(verts[0].x-renderOrigin.x,Number(zs[0])+.025+extra(e),verts[0].y-renderOrigin.y),
              new THREE.Vector3(verts[1].x-renderOrigin.x,Number(zs[1])+.025+extra(e),verts[1].y-renderOrigin.y),
              new THREE.Vector3(verts[2].x-renderOrigin.x,Number(zs[2])+.025+extra(e),verts[2].y-renderOrigin.y)
            ]),new THREE.LineBasicMaterial({color:0x62c7df,transparent:true,opacity:.42}));
            edge.position.set(renderOrigin.x,0,renderOrigin.y);groups.L1.add(edge);
          }
          continue;
        }
        if(e.kind==="room-boundary"||e.kind==="floor-boundary"){room(e);continue}
        if(e.kind==="wall-segment"&&Number.isFinite(e.x2)&&Number.isFinite(e.y2)){wall({x:e.x,y:e.y},{x:e.x2!,y:e.y2!},e);continue}
        if((e.kind==="line"||e.kind==="sld-feeder-candidate")&&Number.isFinite(e.x2)&&Number.isFinite(e.y2)){
          const pts=[new THREE.Vector3(e.x-renderOrigin.x,height(e)+.08,e.y-renderOrigin.y),new THREE.Vector3(e.x2!-renderOrigin.x,n(e.z2,e.z)+extra(e)+.08,e.y2!-renderOrigin.y)];const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:colors[e.layer],transparent:true,opacity:.82}));line.position.set(renderOrigin.x,0,renderOrigin.y);groups[e.layer].add(line);continue;
        }
        if(e.layer==="L2"){equipment(e);continue}
        if(e.layer==="L4"){
          const derivedFrom=String(e.meta?.derivedFrom||"");
          const sourceEntity=derivedFrom?entityById.get(derivedFrom):null;
          if(sourceEntity&&isVisible(sourceEntity))continue;
          equipment(e);continue;
        }
      }
      for(const link of graph.links||[]){
        if(!["SAME_TAG","SLD_FEEDS","SOURCE_RELATION"].includes(link.type))continue;const a=entityById.get(link.from),b=entityById.get(link.to);if(!a||!b||!isVisible(a)||!isVisible(b))continue;
        const pts=[new THREE.Vector3(a.x-renderOrigin.x,height(a)+.65,a.y-renderOrigin.y),new THREE.Vector3(b.x-renderOrigin.x,height(b)+.65,b.y-renderOrigin.y)];const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineDashedMaterial({color:link.type==="SLD_FEEDS"?0x56b9ff:0xa57cff,dashSize:.28,gapSize:.14,transparent:true,opacity:.78}));line.position.set(renderOrigin.x,0,renderOrigin.y);line.computeLineDistances();groups.L3.add(line);
      }
      const visiblePoints=visible.flatMap(e=>[{x:e.x,y:height(e),z:e.y},...(Number.isFinite(e.x2)&&Number.isFinite(e.y2)?[{x:e.x2!,y:n(e.z2,e.z)+extra(e),z:e.y2!}]:[])]);
      const bounds=new THREE.Box3();visiblePoints.forEach(p=>bounds.expandByPoint(new THREE.Vector3(p.x,p.y,p.z)));
      if(bounds.isEmpty())bounds.expandByPoint(new THREE.Vector3(-5,0,-5)).expandByPoint(new THREE.Vector3(5,5,5));
      const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3()),span=Math.max(size.x,size.y,size.z,8);
      const minX=bounds.min.x-2,minZ=bounds.min.z-2,minY=Math.min(bounds.min.y,0),maxY=Math.max(bounds.max.y+3,4);
      const axis=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(minX-renderOrigin.x,minY,minZ-renderOrigin.y),new THREE.Vector3(minX-renderOrigin.x,maxY,minZ-renderOrigin.y)]),new THREE.LineBasicMaterial({color:0x49d39a}));axis.position.set(renderOrigin.x,0,renderOrigin.y);spatialRoot.add(axis);
      for(const [name,z] of levels){const y=(z??0)+(exploded?(floorIndex.get(name)||0)*2.6:0),grid=new THREE.GridHelper(Math.max(span*1.15,20),20,0x244d61,0x102c39);grid.position.set(center.x,y,center.z);grid.material.transparent=true;grid.material.opacity=.18;spatialRoot.add(grid);label(z===null?`${name} · Z unverified`:`${name} · ${z.toFixed(2)} m`,minX+.8,y,minZ,"#7be0b1")}
      const fit=()=>{const absoluteCenter=bounds.getCenter(new THREE.Vector3()),c=new THREE.Vector3(absoluteCenter.x-renderOrigin.x,absoluteCenter.y,absoluteCenter.z-renderOrigin.y),s=bounds.getSize(new THREE.Vector3()),d=Math.max(s.x,s.y,s.z,8);controls.target.copy(c);camera.position.set(c.x+d*.9,c.y+d*.72+4,c.z+d);camera.near=.05;camera.far=Math.max(1000,d*20);camera.updateProjectionMatrix();controls.update()};fit();
      runtime.current.fit=fit;runtime.current.clickable=clickable;
      renderer.domElement.setAttribute("aria-label","Interactive Spatial model");
      renderer.domElement.setAttribute("role","application");
      renderer.domElement.style.cursor="grab";
      const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
      const hitEntity=(ev:PointerEvent|MouseEvent)=>{const rect=renderer.domElement.getBoundingClientRect();if(!rect.width||!rect.height)return null;pointer.x=((ev.clientX-rect.left)/rect.width)*2-1;pointer.y=-((ev.clientY-rect.top)/rect.height)*2+1;ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(clickable,true)[0];let node:any=hit?.object;while(node&&!node.userData?.entity)node=node.parent;return node?.userData?.entity as Entity|undefined};
      const selectAt=(ev:PointerEvent|MouseEvent)=>{const entity=hitEntity(ev);if(entity){renderer.domElement.dataset.selectedAsset=entity.id;setSelected(entity);return true}return false};
      let down:{x:number;y:number}|null=null,moved=false,ignoreNextClick=false;
      const pointerDown=(ev:PointerEvent)=>{down={x:ev.clientX,y:ev.clientY};moved=false;renderer.domElement.style.cursor="grabbing"};
      const pointerMove=(ev:PointerEvent)=>{if(down){if(Math.hypot(ev.clientX-down.x,ev.clientY-down.y)>6)moved=true;return}renderer.domElement.style.cursor=hitEntity(ev)?"pointer":"grab"};
      const pointerUp=(ev:PointerEvent)=>{renderer.domElement.style.cursor="grab";const wasMoved=moved;down=null;moved=false;if(wasMoved){ignoreNextClick=true;return}if(selectAt(ev))ignoreNextClick=true};
      const clickPick=(ev:MouseEvent)=>{if(ignoreNextClick){ignoreNextClick=false;return}selectAt(ev)};
      const pointerCancel=()=>{down=null;moved=false;ignoreNextClick=false;renderer.domElement.style.cursor="grab"};
      renderer.domElement.addEventListener("pointerdown",pointerDown);
      renderer.domElement.addEventListener("pointermove",pointerMove);
      renderer.domElement.addEventListener("pointerup",pointerUp);
      renderer.domElement.addEventListener("pointercancel",pointerCancel);
      renderer.domElement.addEventListener("click",clickPick);
      const ro=new ResizeObserver(()=>{if(!host.clientWidth||!host.clientHeight)return;camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight)});ro.observe(host);
      const publishPrimaryHit=()=>{
        const first=[...entityAnchors.entries()][0];
        if(first){const [id,obj]=first,p=new THREE.Vector3();obj.getWorldPosition(p);p.project(camera);renderer.domElement.dataset.primaryAsset=id;renderer.domElement.dataset.primaryHitX=String(((p.x+1)/2)*renderer.domElement.clientWidth);renderer.domElement.dataset.primaryHitY=String(((-p.y+1)/2)*renderer.domElement.clientHeight)}
        const review=[...coordinationAnchors.entries()][0];
        if(review){const [id,obj]=review,p=new THREE.Vector3();obj.getWorldPosition(p);p.project(camera);renderer.domElement.dataset.coordinationAsset=id;renderer.domElement.dataset.coordinationHitX=String(((p.x+1)/2)*renderer.domElement.clientWidth);renderer.domElement.dataset.coordinationHitY=String(((-p.y+1)/2)*renderer.domElement.clientHeight)}
      };
      let frame=0;const animate=()=>{controls.update();publishPrimaryHit();renderer.render(scene,camera);frame=requestAnimationFrame(animate)};animate();
      cleanup=()=>{runtime.current=null;cancelAnimationFrame(frame);ro.disconnect();renderer.domElement.removeEventListener("pointerdown",pointerDown);renderer.domElement.removeEventListener("pointermove",pointerMove);renderer.domElement.removeEventListener("pointerup",pointerUp);renderer.domElement.removeEventListener("pointercancel",pointerCancel);renderer.domElement.removeEventListener("click",clickPick);controls.dispose();renderer.dispose();host.replaceChildren()};
    })();
    return()=>{disposed=true;cleanup()};
  },[graph,registry,mode,environment,systemMode,floor,exploded,xray,labels,visible,levels,renderOrigin.x,renderOrigin.y]);

  useEffect(()=>{
    const r=runtime.current;if(!r?.scene)return;
    r.scene.traverse((node:any)=>{
      if(!node?.isMesh||!node.userData?.entity)return;
      const active=node.userData.entity.id===selected?.id;
      const mats=Array.isArray(node.material)?node.material:[node.material];
      for(const mat of mats){
        if(!mat?.emissive)continue;
        const base=mat.userData?.stratumBaseEmissive;
        const baseIntensity=mat.userData?.stratumBaseEmissiveIntensity;
        mat.emissive.setHex(active?0x20bfff:(typeof base==="number"?base:0x000000));
        mat.emissiveIntensity=active ? .72 : (typeof baseIntensity==="number"?baseIntensity:0);
      }
    });
  },[selected?.id]);

  useEffect(()=>{
    const selectFromReview=(event:Event)=>{
      const detail=(event as CustomEvent<{entityId?:string;mode?:ViewMode}>).detail||{};
      const entity=graph?.entities.find(item=>item.id===detail.entityId);
      if(!entity)return;
      setSelected(entity);
      if(detail.mode)setMode(detail.mode);
      setFitRevision(value=>value+1);
    };
    window.addEventListener('stratum:select-spatial-entity',selectFromReview);
    return()=>window.removeEventListener('stratum:select-spatial-entity',selectFromReview);
  },[graph]);

  useEffect(()=>{runtime.current?.fit?.()},[fitRevision]);
  useEffect(()=>{
    const r=runtime.current;if(!r||!selected)return;const y=displayElevation(selected,mode),origin=r.renderOrigin||{x:0,y:0},target=new r.THREE.Vector3(selected.x-origin.x,y+1,selected.y-origin.y),span=5;r.controls.target.copy(target);r.camera.position.copy(target).add(new r.THREE.Vector3(span,span*.75,span));r.controls.update();
  },[selected?.id,mode]);

  if(!graph||!Array.isArray(graph.entities)||graph.entities.length===0)return <section className="card" style={{marginBottom:18}}><div className="eyebrow">Spatial viewer</div><h2>No compiled spatial objects yet</h2><p className="subtitle">Import and successfully extract a drawing, SLD or DXF first. A source fingerprint by itself does not unlock the project viewer.</p><Link className="action" href="/compiler">Review engineering sources</Link></section>;

  const width=fallbackBounds.maxX-fallbackBounds.minX,height2=fallbackBounds.maxY-fallbackBounds.minY;
  const sx=(x:number)=>((x-fallbackBounds.minX)/width)*92+4,sy=(y:number)=>96-((y-fallbackBounds.minY)/height2)*92;
  const reviewPins=inventory.filter(item=>item.kind==='sheet-callout-candidate'||item.kind==='annotated-asset-candidate');
  const plural=(count:number,singular:string)=>`${count} ${singular}${count===1?'':'s'}`;

  return <section style={{border:"1px solid #1b3a50",borderRadius:18,overflow:"hidden",background:"#07111b",marginBottom:18}} aria-label="Spatial viewer">
    <div style={{padding:"16px 18px",display:"flex",justifyContent:"space-between",gap:14,alignItems:"center",flexWrap:"wrap",borderBottom:"1px solid #17334a"}}>
      <div><div className="eyebrow">STRATUM Spatial Verified</div><h2 style={{margin:"3px 0"}}>Spatial model</h2><p className="muted" style={{margin:0}}>{plural(graph.sources.length,'source')} · {plural(sheetFrames.length,'drawing frame')} · {plural(nonSldPlanSheets,'non-SLD plan')} · {plural(levels.length,'level')} · {plural(rooms,'room')} · {plural(visibleLines,'drawing line')} · {plural(rasterUnderlays,'drawing underlay')} · {plural(sldObjects,'SLD object')}</p></div>
      <div className="button-row"><Link className="ghost" href="/compiler">Edit sources</Link><Link className="ghost" href="/component-library">3D models</Link></div>
    </div>

    {twinReadiness&&twinReadiness.totalEquipment>0&&<details className="secondary-details" style={{margin:"12px 14px"}}>
      <summary>Digital twin readiness · {twinReadiness.demoReady}/{twinReadiness.totalEquipment} demo-ready</summary>
      <div className="grid two" style={{marginTop:10}}>
        <div><div className="label">Exact product twin</div><b>{twinReadiness.exactTwinReady}</b><small style={{display:'block'}}>Source-supported exact product geometry + 3D design coordinates + registered asset.</small></div>
        <div><div className="label">Family twin</div><b>{twinReadiness.familyTwinReady}</b><small style={{display:'block'}}>3D design coordinates + family geometry + registered asset; exact product identity remains unresolved.</small></div>
        <div><div className="label">Asset bound</div><b>{twinReadiness.assetBound}/{twinReadiness.totalEquipment}</b><small style={{display:'block'}}>Unique registered asset opens the click-through lifecycle context.</small></div>
        <div><div className="label">DIR finalized</div><b>{twinReadiness.dirFinalized}/{twinReadiness.totalEquipment}</b><small style={{display:'block'}}>Ledger finality is shown separately from spatial/physical truth.</small></div>
        <div><div className="label">Maintenance configured</div><b>{twinReadiness.maintenanceConfigured}/{twinReadiness.totalEquipment}</b><small style={{display:'block'}}>Linked asset has maintenance plan/status context.</small></div>
        <div><div className="label">Needs review</div><b>{twinReadiness.reviewBlocked+twinReadiness.spatial2DReviewReady+twinReadiness.spatial3DReviewReady+twinReadiness.sourceOnly}</b><small style={{display:'block'}}>Includes evidence conflicts, incomplete Z, missing asset links or source-only placement.</small></div>
      </div>
      <p className="muted" style={{marginTop:10}}>Design/review readiness only. Demo-ready means the interactive design twin chain is assembled; it does not establish installed physical identity, field/as-built coordinates, physical clash authority, engineering approval, DIR truth of position, or PoVI finality.</p>
      {twinReadiness.components.some(component=>!component.demoReady)&&<div style={{display:'grid',gap:8,marginTop:10}}>
        {twinReadiness.components.filter(component=>!component.demoReady).slice(0,12).map(component=><div className="binding-panel" key={component.entityId}>
          <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center',flexWrap:'wrap'}}><strong>{component.name}</strong><span className="pending">{component.state.replaceAll('_',' ')}</span></div>
          <small style={{display:'block',marginTop:4}}>{component.blockerLabels.length?component.blockerLabels.join(' · '):'No hard blocker; review chain remains incomplete.'}</small>
          <small style={{display:'block',marginTop:3}}>Model {component.model.tier.replaceAll('_',' ')} · asset {component.assetCode||'not bound'} · DIR {component.dirFinalized?'finalized':'not finalized'} · maintenance {component.maintenanceConfigured?'configured':'not configured'}</small>
          <button className="ghost" style={{marginTop:7}} onClick={()=>{const entity=graph.entities.find(item=>item.id===component.entityId);if(entity){setSelected(entity);setFitRevision(value=>value+1)}}}>Review component</button>
        </div>)}
      </div>}
    </details>}

    {staleDrawingSources.length>0&&<details className="secondary-details" style={{margin:"12px 14px"}}>
      <summary>Legacy drawing frame · {staleDrawingSources.length} source{staleDrawingSources.length===1?'':'s'} can be refreshed</summary>
      <p className="muted">This browser model predates the current retained-basemap/non-SLD pipeline. Existing extracted objects remain inspectable; refresh the retained source when available to rebuild the drawing frame with current semantics. This is a migration task, not a failed parse.</p>
      <div className="button-row"><Link className="ghost" href="/import">Refresh drawing source</Link></div>
    </details>}

    <div className="spatial-mode-tabs" role="group" aria-label="Spatial view mode">
      <button type="button" className={mode==="MODEL"?"action":"ghost"} aria-pressed={mode==="MODEL"} onMouseDown={event=>event.preventDefault()} onClick={()=>setMode("MODEL")}><b>Model</b><small>Rooms and source placement</small></button>
      <button type="button" className={mode==="ELECTRICAL"?"action":"ghost"} aria-pressed={mode==="ELECTRICAL"} onMouseDown={event=>event.preventDefault()} onClick={()=>setMode("ELECTRICAL")}><b>Electrical</b><small>SLD topology</small></button>
      <button type="button" className={mode==="REVIEW"?"action":"ghost"} aria-pressed={mode==="REVIEW"} onMouseDown={event=>event.preventDefault()} onClick={()=>setMode("REVIEW")}><b>Review</b><small>Source candidates</small></button>
    </div>

    {sheetFrames.length>1&&sheetFrame==="AUTO"&&activeSheetFrame&&<p className="muted" style={{padding:'0 14px',fontSize:11,margin:'8px 0'}}>Multiple drawing frames were recognized. Auto-safe isolation is showing one sheet frame at a time so unrelated plans do not stack at the same origin. Choose another sheet above, or explicitly select the review overlay.</p>}
    {sheetFrames.length>1&&sheetFrame==="ALL"&&<p className="muted" style={{padding:'0 14px',fontSize:11,margin:'8px 0'}}>Review overlay is showing multiple source sheets together. Overlap is not evidence of shared coordinates, physical alignment, clash, or as-built position unless the individual sheet transforms have been reviewed.</p>}
    {graph.entities.some(e=>e.meta?.drawingBasemap===true)&&<p className="muted" style={{padding:'0 14px',fontSize:11,margin:'8px 0'}}>Source drawing basemap is shown on the drawing plane. Sheet/image XY is preserved for review; physical scale/alignment and Z remain unverified until calibrated or otherwise source-established.</p>}
    {activeScaleValidation&&<div className="notice" style={{margin:"8px 14px"}}><strong>SCALE {String(activeScaleValidation.status||'UNRESOLVED')}</strong><span>{String(activeScaleValidation.reason||'Independent scale review is required.')}{Number.isFinite(Number(activeScaleValidation.corroboratedMetersPerNormalizedSheetUnit))?' · candidate '+Number(activeScaleValidation.corroboratedMetersPerNormalizedSheetUnit).toFixed(4)+' m / normalized sheet unit':''} · never auto-applied</span></div>}
    {graph.entities.some(e=>e.kind==='sheet-callout-candidate'&&e.meta?.coordinateUnits==='sheet')&&<p className="muted" style={{padding:'0 14px',fontSize:11,margin:'8px 0'}}>Drawing callout pins are separated for review. Their spacing is diagrammatic until sheet scale and alignment are verified.</p>}
    {modelLoadErrors.length>0&&<div className="notice" role="alert"><strong>3D IMPORT NEEDS ATTENTION</strong><span>{modelLoadErrors.length} uploaded model{modelLoadErrors.length===1?'':'s'} could not be rendered. Its source record remains available for review; no substitute geometry was displayed.</span></div>}

    <div style={{display:"flex",gap:8,padding:"10px 12px",alignItems:"center",flexWrap:"wrap",borderBottom:"1px solid #17334a"}}>
      <select aria-label="Floor isolation" value={floor} onChange={e=>setFloor(e.target.value)}><option value="ALL">All floors</option>{levels.map(([f])=><option key={f} value={f}>{f}</option>)}</select>
      <select aria-label="Discipline isolation" value={discipline} onChange={e=>setDiscipline(e.target.value)}><option value="ALL">All disciplines</option>{disciplines.map(value=><option key={value} value={value}>{value}</option>)}</select>
      <select aria-label="Sheet page isolation" value={sheetFrame} onChange={e=>setSheetFrame(e.target.value)} style={{maxWidth:360}}><option value="AUTO">Auto-safe sheet isolation</option>{sheetFrames.length>1&&<option value="ALL">All sheet frames · review overlay</option>}{sheetFrames.map(frame=><option key={frame.key} value={frame.key}>{frame.source} · p{frame.page} · {frame.title}{frame.floor?` · ${frame.floor}`:''}{frame.aligned?' · aligned':''}</option>)}</select>
      <input aria-label="Search objects" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search equipment, room or source" style={{minWidth:220,flex:"1 1 240px"}}/>
      <button className="ghost" onClick={()=>setFitRevision(v=>v+1)}>Fit model</button>
      <button className="ghost" onClick={()=>setLabels(v=>!v)}>{labels?"Hide labels":"Show labels"}</button>
    </div>

    <details style={{borderBottom:"1px solid #17334a"}}><summary style={{padding:"10px 14px",cursor:"pointer"}}>Source layers · {sourceLayers.length-hiddenSources.length}/{sourceLayers.length} visible</summary>
      <div style={{padding:"0 12px 12px"}}>
        <div className="button-row" style={{marginBottom:10}}>
          <button className="ghost" type="button" onClick={()=>setHiddenSources([])} disabled={!hiddenSources.length}>Show all sources</button>
          <button className="ghost" type="button" onClick={()=>setHiddenSources(sourceLayers.map(source=>spatialSourceKey(source)))} disabled={!sourceLayers.length||hiddenSources.length===sourceLayers.length}>Hide all sources</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:8}}>
          {sourceLayers.map(source=>{
            const key=spatialSourceKey(source),label=sourceLayerLabels.get(key)||source.name;
            const active=!hiddenSourceSet.has(key);
            const entityCount=graph.entities.filter(entity=>spatialEntitySourceKey(entity,graph.sources)===key&&entity.meta?.nonSpatial!==true&&entity.kind!=='line').length;
            return <label key={key} style={{display:"flex",alignItems:"flex-start",gap:8,border:"1px solid #17334a",borderRadius:10,padding:"9px 10px"}}>
              <input type="checkbox" aria-label={`Toggle source ${label}`} checked={active} onChange={()=>toggleSource(key)}/>
              <span style={{minWidth:0}}><strong style={{display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={source.name}>{label}</strong><small className="muted">{source.discipline||"Unclassified"} · {source.ext?.toUpperCase()||"SOURCE"} · {entityCount} spatial object{entityCount===1?"":"s"}</small></span>
            </label>;
          })}
        </div>
      </div>
    </details>

    <details style={{borderBottom:"1px solid #17334a"}}><summary style={{padding:"10px 14px",cursor:"pointer"}}>Advanced view controls</summary><div style={{display:"flex",gap:8,padding:"0 12px 12px",flexWrap:"wrap"}}>
      <button className="ghost" aria-pressed={exploded} onClick={()=>setExploded(v=>!v)}>{exploded?"Collapse building":"Explode building"}</button>
      <button className="ghost" aria-pressed={xray} onClick={()=>setXray(v=>!v)}>{xray?"Disable X-Ray":"X-Ray architecture"}</button>
      <select aria-label="Environment mode" value={environment} onChange={e=>setEnvironment(e.target.value as EnvironmentMode)}><option value="ENGINEERING">Engineering</option><option value="CINEMATIC">Cinematic</option><option value="NIGHT">Night Operations</option><option value="EMERGENCY">Emergency Mode</option></select>
      <select aria-label="System isolation" value={systemMode} onChange={e=>setSystemMode(e.target.value as SystemMode)}>{systemOptions.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select>
    </div></details>

    <div className="compiled-twin-grid" style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(270px,340px)"}}>
      <div className="spatial-viewer-stage" style={{position:"relative",minHeight:520,background:"#041019"}}>
        {mode==="ELECTRICAL"&&sldObjects===0&&<div className="spatial-electrical-empty" role="status"><strong>No SLD topology in this project yet</strong><span>Import an SLD to populate Electrical. Your selected object remains available in the inspector.</span><div className="notice" style={{margin:'10px 0 0'}}><strong>REFERENCE EXAMPLE · NOT PROJECT DATA</strong><span>Utility / service → transformer → main switchboard → panel / feeder → connected load. Logical depth is not physical Z.</span></div><Link className="ghost" href="/docs#sld-example" style={{display:'inline-block',marginTop:10}}>Open bundled SLD example</Link></div>}
        {labels&&mode!=="ELECTRICAL"&&reviewPins.length>0&&<div className="spatial-pin-list" aria-label="Review pin labels"><strong>Review pins · {reviewPins.length}</strong>{reviewPins.map((item,index)=><button key={item.id} type="button" className={selected?.id===item.id?'active':''} onClick={()=>setSelected(item)} title={`Select ${item.name}`}><span>{index+1}. {item.name}</span><small>{physicalElevationKnown(item)?'Z reviewed':'Z unverified'}</small></button>)}</div>}
        {renderStatus!=="FALLBACK"&&<div ref={mount} style={{height:"100%",minHeight:520}}/>}
        {renderStatus==="FALLBACK"&&<div style={{height:"min(72vh,760px)",minHeight:520,padding:14}} role="img" aria-label="2D spatial fallback">
          <svg viewBox="0 0 100 100" width="100%" height="100%" style={{background:"#06141e",borderRadius:12}}>
            {(graph.links||[]).filter(l=>["SLD_FEEDS","SAME_TAG","SOURCE_RELATION"].includes(l.type)).map(l=>{const a=graph.entities.find(e=>e.id===l.from),b=graph.entities.find(e=>e.id===l.to);if(!a||!b)return null;return <line key={l.id} x1={sx(a.x)} y1={sy(a.y)} x2={sx(b.x)} y2={sy(b.y)} stroke={l.type==="SLD_FEEDS"?"#57baff":"#9a7cff"} strokeWidth=".35" strokeDasharray="1 1"/>})}
            {visible.filter(e=>e.kind==="source-raster-underlay"&&typeof e.meta?.embeddedRasterDataUrl==="string"&&Number.isFinite(e.x2)&&Number.isFinite(e.y2)).map(e=><image key={e.id} href={String(e.meta?.embeddedRasterDataUrl)} x={Math.min(sx(e.x),sx(e.x2!))} y={Math.min(sy(e.y),sy(e.y2!))} width={Math.abs(sx(e.x2!)-sx(e.x))} height={Math.abs(sy(e.y2!)-sy(e.y))} opacity=".9" preserveAspectRatio="none"/>)}
            {visible.filter(e=>e.kind!=="source-raster-underlay").map(e=>(e.kind==="line"||e.kind==="sld-feeder-candidate")&&Number.isFinite(e.x2)&&Number.isFinite(e.y2)?<line key={e.id} x1={sx(e.x)} y1={sy(e.y)} x2={sx(e.x2!)} y2={sy(e.y2!)} stroke={e.layer==="L3"?"#62bfff":"#7895a4"} strokeWidth=".28"/>:<g key={e.id} onClick={()=>setSelected(e)} style={{cursor:"pointer"}}><circle cx={sx(e.x)} cy={sy(e.y)} r={e.layer==="L2"?1.25:.75} fill={e.layer==="L2"?"#e5a14d":e.layer==="L4"?"#43d98f":"#7f98a6"}/>{labels&&e.layer==="L2"&&<text x={sx(e.x)+1.7} y={sy(e.y)-1+Math.max(0,inventory.findIndex(item=>item.id===e.id))*3} fill="#d8edf6" fontSize="2.2">{e.name.slice(0,24)}{physicalElevationKnown(e)?'':' · Z unverified'}</text>}</g>)}
          </svg><p className="muted" style={{margin:"8px 0 0"}}>Interactive 2D fallback active. Source placement and selection remain available while this device/browser cannot initialize WebGL.</p>
        </div>}
        <div className="spatial-hud"><button type="button" className="ghost" aria-expanded={hudOpen} onClick={()=>setHudOpen(value=>!value)}>Infrastructure HUD · {inventory.length} view objects {hudOpen?'▴':'▾'}</button>{hudOpen&&<div className="spatial-hud-body"><small>{renderStatus==="WEBGL"?"3D WEBGL":"2D FALLBACK"} · {mode}</small><div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:"4px 12px",marginTop:6,fontSize:12}}><span>PLAN FRAMES</span><b>{sheetFrames.length}</b><span>NON-SLD PLANS</span><b>{nonSldPlanSheets}</b><span>DRAWING LINES</span><b>{visibleLines}</b><span>DRAWING UNDERLAYS</span><b>{rasterUnderlays}</b><span>VIEW OBJECTS</span><b>{inventory.length}</b><span>IDENTIFIED EQUIPMENT</span><b>{identifiedEquipment}</b><span>SLD</span><b>{sldObjects}</b><span>UNRESOLVED Z</span><b>{unresolvedZ}</b><span>3D MODELS</span><b>{modelMapped}</b>{mode==="REVIEW"&&<><span>COORDINATION</span><b>{[...coordinationReview.values()].filter(item=>visible.some(entity=>entity.id===item.entityId)).length}</b></>}</div></div>}</div>
      </div>

      <aside style={{padding:15,borderLeft:"1px solid #17334a",overflow:"auto"}}>
        <label>Imported object<select aria-label="Imported object" value={selected?.id||""} onChange={e=>setSelected(graph.entities.find(x=>x.id===e.target.value)||null)} style={{width:"100%"}}><option value="">{matching.length?'Select an object':'No selectable objects in this view'}</option>{matching.map(e=><option key={e.id} value={e.id}>{e.name} · {e.floor||"UNRESOLVED"}</option>)}</select></label>
        <SpatialAssetInspector selected={selected} registeredAssets={projectAssets} modelRegistry={registry} onEntityUpdated={entity=>setSelected(entity as Entity)}/>
        {selected&&unresolvedAssetVisual(selected).kind!=='NONE'&&!isSld(selected)&&<div className="notice" role="status" aria-label="Provisional asset placeholder" style={{marginTop:12}}>
          <strong>{unresolvedAssetVisual(selected).label}</strong>
          <span>Selectable source evidence only. The displayed marker is not canonical Z, a verified object, a quantity-takeoff item, measurable geometry or an exportable 3D asset. Review the digital record and obtain: {unresolvedAssetVisual(selected).missingInputs.join(' · ')}.</span>
          <a className="ghost" href="#z-resolution-review" style={{display:'inline-block',marginTop:8}}>Review elevation evidence</a>
        </div>}

        {selected&&findingsForEntity(coordinationSnapshot,selected.id).length>0&&<div className="card" style={{marginTop:10,padding:12}} aria-label="Selected asset coordination review">
          <div className="eyebrow">Coordination review</div>
          <strong>{findingsForEntity(coordinationSnapshot,selected.id).length} open source conflict{findingsForEntity(coordinationSnapshot,selected.id).length===1?"":"s"}</strong>
          <small style={{display:"block",marginTop:6}}>Review markers flag source conflicts only. They do not establish a geometric clash, code compliance, AHJ approval, or engineering approval.</small>
          <ul style={{margin:"8px 0 0",paddingLeft:18}}>
            {findingsForEntity(coordinationSnapshot,selected.id).slice(0,4).map(finding=><li key={finding.id}><small>{finding.humanControlLevel} · {finding.findingType.replaceAll("_"," ")} · {finding.title}</small></li>)}
          </ul>
        </div>}
        {selected&&isSld(selected)&&<div className="notice" style={{marginTop:12}}><strong>SLD → SPATIAL PROJECTION</strong><span>The vertical separation in Electrical mode expresses logical power hierarchy. It is not an as-built physical elevation until field/design evidence establishes Z.</span></div>}
        {selected&&!physicalElevationKnown(selected)&&Number.isFinite(Number(selected.meta?.zCandidateMeters))&&<div className="notice" style={{marginTop:12}}><strong>Z REFERENCE CANDIDATE · REVIEW REQUIRED</strong><span>Source evidence places the {String(selected.meta?.zCandidateReferencePoint||'reference').replaceAll('_',' ').toLowerCase()} at {Number(selected.meta?.zCandidateMeters).toFixed(3)} m · {String(selected.meta?.zResolutionAuthority||'SOURCE Z EVIDENCE').replaceAll('_',' ')} · confidence {Math.round(Number(selected.meta?.zResolutionConfidence||0)*100)}%. The 3D base is derived separately from that reference and the current equipment height. This is design/drawing evidence, not field-verified physical elevation.</span></div>}
        {selected&&!physicalElevationKnown(selected)&&metaNumber(selected,'zCandidateMeters')===null&&metaNumber(selected,'localReviewSurfaceZ')===null&&metaNumber(selected,'crossSheetReviewSurfaceZ')!==null&&!isSld(selected)&&<div className="notice" style={{marginTop:12}}><strong>CROSS-SHEET Z REVIEW SURFACE</strong><span>{String(selected.meta?.crossSheetReviewSurfaceKind||'SOURCE SURFACE').replaceAll('_',' ')} = {metaNumber(selected,'crossSheetReviewSurfaceZ')!.toFixed(3)} m via reviewed sheet alignment · confidence {Math.round(Number(selected.meta?.crossSheetReviewSurfaceConfidence||0)*100)}%. This is coordination-derived design evidence, not field-verified physical elevation.</span></div>}
        {selected&&!physicalElevationKnown(selected)&&metaNumber(selected,'zCandidateMeters')===null&&metaNumber(selected,'localReviewSurfaceZ')===null&&metaNumber(selected,'crossSheetReviewSurfaceZ')===null&&metaNumber(selected,'reviewSurfaceZ')!==null&&!isSld(selected)&&<div className="notice" style={{marginTop:12}}><strong>PROJECT DATUM REVIEW SURFACE</strong><span>{String(selected.meta?.reviewSurfaceKind||'PROJECT DATUM').replaceAll('_',' ')} = {Number(selected.meta?.reviewSurfaceZ).toFixed(3)} m from source evidence. The object is displayed on that review surface, but its own physical Z remains unresolved until mounting/base/field evidence establishes it.</span></div>}
        {selected&&!physicalElevationKnown(selected)&&metaNumber(selected,'zCandidateMeters')===null&&metaNumber(selected,'localReviewSurfaceZ')===null&&metaNumber(selected,'crossSheetReviewSurfaceZ')===null&&metaNumber(selected,'reviewSurfaceZ')===null&&!isSld(selected)&&<div className="notice" style={{marginTop:12}}><strong>Z NEEDS REVIEW</strong><span>This object has source placement, but physical elevation is not yet established. Review floor/elevation evidence before treating Z as physical placement.</span><a className="ghost" href="#z-resolution-review" style={{display:'inline-block',marginTop:8}}>Open Z resolution workflow</a></div>}
        {selected&&<button className="ghost" style={{width:"100%",marginTop:12}} onClick={()=>setFitRevision(v=>v+1)}>Fit full model</button>}
        <div className="notice" style={{marginTop:14}}><strong>TRUTH BOUNDARY</strong><span>DIR finality secures the immutable record; it does not by itself establish physical truth. Observed/source-derived geometry never silently overwrites Verified infrastructure state.</span></div>
      </aside>
    </div>
    <style jsx>{`.spatial-mode-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:12px;border-bottom:1px solid #17334a}.spatial-mode-tabs button{display:flex;flex-direction:column;gap:2px;white-space:normal;min-width:0;text-align:center}.spatial-mode-tabs small{font-weight:400;font-size:11px;line-height:1.3}.spatial-viewer-stage{min-height:600px}.spatial-electrical-empty{position:absolute;z-index:1;left:50%;top:50%;transform:translate(-50%,-50%);width:min(90%,360px);padding:22px;text-align:center;border:1px solid #245069;border-radius:14px;background:#081723}.spatial-electrical-empty strong,.spatial-electrical-empty span{display:block}.spatial-electrical-empty span{font-size:12px;color:#8fa8bf;margin-top:8px}.spatial-pin-list{position:absolute;z-index:2;left:12px;bottom:12px;width:min(205px,calc(100% - 24px));max-height:48%;overflow:auto;padding:8px;background:rgba(3,12,18,.92);border:1px solid #245069;border-radius:10px}.spatial-pin-list>strong{display:block;font-size:11px;margin-bottom:6px;color:#ffcf84}.spatial-pin-list button{display:flex;justify-content:space-between;align-items:center;gap:8px;width:100%;padding:6px;color:#d8edf6;background:transparent;border:0;border-radius:6px;text-align:left;cursor:pointer;font-size:12px}.spatial-pin-list button:hover,.spatial-pin-list button.active{background:#16415a}.spatial-pin-list small{font-size:10px;color:#ffcf84;white-space:nowrap}.spatial-hud{position:absolute;top:12px;right:12px;z-index:2;max-width:calc(100% - 24px);background:rgba(3,12,18,.88);border:1px solid #245069;border-radius:12px}.spatial-hud button{width:100%;font-size:11px;padding:8px 10px}.spatial-hud-body{padding:10px 12px;max-height:55vh;overflow:auto}@media(max-width:820px){.compiled-twin-grid{grid-template-columns:1fr!important}.compiled-twin-grid aside{border-left:0!important;border-top:1px solid #17334a}.spatial-viewer-stage{height:65vh;min-height:520px}}@media(max-width:450px){.spatial-mode-tabs{gap:4px;padding:8px}.spatial-mode-tabs button{padding:9px 2px;font-size:12px}.spatial-mode-tabs small{font-size:10px}.spatial-hud{right:8px;top:8px}.spatial-pin-list{max-height:50%;width:min(190px,calc(100% - 24px))}}select,input{background:#08131d;color:#d8edf6;border:1px solid #28465f;border-radius:9px;padding:9px 10px}`}</style>
  </section>;
}
