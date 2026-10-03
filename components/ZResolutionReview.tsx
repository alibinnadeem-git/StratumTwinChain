'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {readPrimarySpatialGraph} from '@/lib/spatial-browser-recovery';
import {isIdentifiedProjectEquipment} from '@/lib/spatial-ui-counts';

type Entity={
 id:string;name?:string;source?:string;layer?:string;kind?:string;floor?:string;z?:number;
 meta?:Record<string,unknown>;
};
type Graph={entities?:Entity[]};

function finite(value:unknown){const n=Number(value);return Number.isFinite(n)?n:null}
function physicalZKnown(entity:Entity){
 return entity.meta?.physicalElevationKnown===true||entity.meta?.elevationKnown===true||entity.meta?.zPlacementAuthority==='MEASURED_OR_REVIEWED';
}
function semantic(entity:Entity){
 const nested=entity.meta?.elevationControl;
 const nestedSemantic=nested&&typeof nested==='object'&&'semantic' in nested?(nested as {semantic?:unknown}).semantic:null;
 return String(entity.meta?.elevationControlSemantic||entity.meta?.semantic||entity.meta?.controlSemantic||nestedSemantic||'').replaceAll('_',' ');
}

export default function ZResolutionReview(){
 const [graph,setGraph]=useState<Graph|null>(null);
 useEffect(()=>{
  let active=true;
  const load=async()=>{try{const value=await readPrimarySpatialGraph();if(active)setGraph(value as Graph|null)}catch{if(active)setGraph(null)}};
  const refresh=()=>{void load()};void load();
  window.addEventListener('stratum:graph-updated',refresh);window.addEventListener('storage',refresh);
  return()=>{active=false;window.removeEventListener('stratum:graph-updated',refresh);window.removeEventListener('storage',refresh)};
 },[]);

 const summary=useMemo(()=>{
  const entities=graph?.entities||[];
  const equipment=entities.filter(isIdentifiedProjectEquipment);
  const unresolved=equipment.filter(entity=>!physicalZKnown(entity));
  const controls=entities.filter(entity=>entity.kind==='elevation-control-point');
  const triangles=entities.filter(entity=>entity.kind==='elevation-review-surface-triangle');
  const datumEntities=entities.filter(entity=>finite(entity.meta?.reviewSurfaceZ)!==null||finite(entity.meta?.floorDatumMeters)!==null);
  const candidateEquipment=unresolved.filter(entity=>finite(entity.meta?.zCandidateMeters)!==null);
  const localSurfaceEquipment=unresolved.filter(entity=>finite(entity.meta?.localReviewSurfaceZ)!==null);
  const crossSheetEquipment=unresolved.filter(entity=>finite(entity.meta?.crossSheetReviewSurfaceZ)!==null);
  const controlKinds=new Map<string,number>();
  for(const control of controls){const key=semantic(control)||String(control.meta?.elevationControlKind||'ELEVATION CONTROL').replaceAll('_',' ');controlKinds.set(key,(controlKinds.get(key)||0)+1)}
  return{equipment,unresolved,controls,triangles,datumEntities,candidateEquipment,localSurfaceEquipment,crossSheetEquipment,controlKinds};
 },[graph]);

 function inspect(entity:Entity){
  window.dispatchEvent(new CustomEvent('stratum:select-spatial-entity',{detail:{entityId:entity.id,mode:'REVIEW'}}));
  document.getElementById('spatial-model')?.scrollIntoView({behavior:'smooth',block:'start'});
 }

 return <section id="z-resolution-review" className="card" aria-label="Elevation and Z resolution" style={{marginTop:16}}>
  <div className="section-head">
   <div>
    <div className="eyebrow">Elevation / Z · Evidence chain</div>
    <h2>Resolve Z without inventing height.</h2>
    <p className="muted">STRATUM separates source elevation controls, local surfaces, object mounting/reference evidence and physical verification. A review placement can improve the model without becoming field-verified truth.</p>
   </div>
   <span className={summary.unresolved.length?'pending':'proof'}>{summary.unresolved.length?summary.unresolved.length+' UNRESOLVED':'NO Z FLAGS'}</span>
  </div>

  <div className="simple-kpis">
   <div><span>Equipment needing Z</span><strong>{summary.unresolved.length}</strong></div>
   <div><span>FFE / FF / FG / FS controls</span><strong>{summary.controls.length}</strong></div>
   <div><span>Triangulated review surfaces</span><strong>{summary.triangles.length}</strong></div>
   <div><span>Object Z candidates</span><strong>{summary.candidateEquipment.length}</strong></div>
  </div>

  {summary.controls.length>0?<div className="notice" style={{marginTop:12}}>
   <strong>SOURCE ELEVATION CONTROLS</strong>
   <span>{[...summary.controlKinds.entries()].map(([key,count])=>key+' × '+count).join(' · ')}. Eligible finished-floor/finished-grade/finished-surface controls can seed review surfaces; structural elevations are not silently reused as terrain.</span>
  </div>:<div className="notice" style={{marginTop:12}}>
   <strong>NO FFE / FF / FG / FS CONTROLS FOUND</strong>
   <span>To establish a source-grounded vertical surface, import a drawing containing explicit finished-floor, finished-grade/finished-surface, spot-elevation, section/elevation or equivalent project datum evidence. Three suitable positioned grade/floor controls can support a local triangulated review surface.</span>
  </div>}

  <div className="grid two" style={{marginTop:12}}>
   <div className="card" style={{padding:12}}>
    <div className="eyebrow">1 · Project / floor datum</div>
    <strong>{summary.datumEntities.length?summary.datumEntities.length+' object'+(summary.datumEntities.length===1?'':'s')+' carry source datum context':'Source datum unresolved'}</strong>
    <p className="muted">FFE/FF and reviewed section datums can establish a floor review surface. FG/FS/grade controls can establish grade/surface evidence. Datum evidence alone does not establish an equipment base.</p>
   </div>
   <div className="card" style={{padding:12}}>
    <div className="eyebrow">2 · Local surface</div>
    <strong>{summary.localSurfaceEquipment.length} local · {summary.crossSheetEquipment.length} cross-sheet placements</strong>
    <p className="muted">Positioned controls may form a local triangulated surface. Cross-sheet transfer requires reviewed sheet alignment. Both remain design/review evidence.</p>
   </div>
   <div className="card" style={{padding:12}}>
    <div className="eyebrow">3 · Object reference</div>
    <strong>{summary.candidateEquipment.length} source Z reference candidate{summary.candidateEquipment.length===1?'':'s'}</strong>
    <p className="muted">AFF/mounting evidence must identify the reference point—base, bottom, centerline, top or mounting point—before STRATUM can convert it into an equipment placement chain.</p>
   </div>
   <div className="card" style={{padding:12}}>
    <div className="eyebrow">4 · Reconcile / verify</div>
    <strong>Conflicts fail closed</strong>
    <p className="muted">Independent absolute-Z chains are compared. A reviewer may select a design chain for visualization, while physical Z remains unverified until source/field evidence establishes it.</p>
   </div>
  </div>

  {summary.unresolved.length>0&&<div style={{display:'grid',gap:8,marginTop:12}}>
   <strong>Next unresolved equipment</strong>
   {summary.unresolved.slice(0,5).map(entity=><div className="spatial-review-row" key={entity.id}>
    <div><strong>{entity.name||entity.id}</strong><small>{entity.floor||'UNRESOLVED'} · {entity.source||'source'} · {finite(entity.meta?.zCandidateMeters)!==null?'Z candidate available':'needs vertical evidence'}</small></div>
    <button className="ghost" type="button" onClick={()=>inspect(entity)}>Inspect Z</button>
   </div>)}
   {summary.unresolved.length>5&&<small className="muted">Showing 5 of {summary.unresolved.length} unresolved equipment objects.</small>}
  </div>}

  <div className="button-row" style={{marginTop:12}}>
   <a className="action" href="#spatial-model">Open Spatial inspector</a>
   <Link className="ghost" href="/compiler#z-review">Review/import elevation sources</Link>
   <Link className="ghost" href="/docs#z-method">Z methodology</Link>
  </div>
  <small className="spatial-review-boundary">X/Y scale can help convert source units consistently, but it never supplies a missing Z datum by itself.</small>
 </section>;
}
