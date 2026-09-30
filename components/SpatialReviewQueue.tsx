'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {readPrimarySpatialGraph} from '@/lib/spatial-browser-recovery';

type Layer='L0'|'L1'|'L2'|'L3'|'L4';
type Entity={id:string;name:string;source:string;layer:Layer;kind:string;floor?:string;meta?:Record<string,unknown>};
type Graph={entities?:Entity[]};
type ReviewItem={id:string;name:string;source:string;reason:string;floor:string};

function reasonFor(entity:Entity){
 if(entity.meta?.equipmentType==='UNRESOLVED'&&/callout|annotated-asset/i.test(entity.kind))return 'Asset type needs legend / schedule review';
 if(entity.meta?.zReviewRequired===true)return 'Elevation needs review';
 if(entity.floor==='UNRESOLVED'&&entity.layer==='L2')return 'Floor needs review';
 if(entity.meta?.reviewRequired===true)return 'Source needs review';
 if(/candidate/i.test(entity.kind))return 'Candidate needs confirmation';
 return null;
}

export default function SpatialReviewQueue(){
 const [graph,setGraph]=useState<Graph|null>(null);
 useEffect(()=>{
  let active=true;
  const load=async()=>{try{const next=await readPrimarySpatialGraph();if(active)setGraph(next as Graph|null)}catch{if(active)setGraph(null)}};
  const refresh=()=>{void load()};
  void load();
  window.addEventListener('stratum:graph-updated',refresh);
  window.addEventListener('storage',refresh);
  return()=>{active=false;window.removeEventListener('stratum:graph-updated',refresh);window.removeEventListener('storage',refresh)};
 },[]);
 const items=useMemo<ReviewItem[]>(()=>{
  const seen=new Set<string>();
  return (graph?.entities||[]).flatMap(entity=>{
   const reason=reasonFor(entity);if(!reason||seen.has(entity.id))return[];
   seen.add(entity.id);
   return[{id:entity.id,name:entity.name,source:entity.source,reason,floor:entity.floor||'UNRESOLVED'}];
  });
 },[graph]);
 const shown=items.slice(0,4);
 return <section className={`spatial-review-task ${items.length?'has-review':'clear'}`} aria-labelledby="spatial-review-title">
  <div className="spatial-review-head"><div><div className="eyebrow">Next task</div><h2 id="spatial-review-title">{items.length?`${items.length} item${items.length===1?'':'s'} need review`:'No flagged model-review items'}</h2><p>{items.length?'Resolve the flagged items first. A review flag is not a failure—it means STRATUM is refusing to guess.':'Nothing in the current browser model is explicitly flagged for source review. This does not mean the infrastructure is Verified.'}</p></div><span className={items.length?'pending':'verified'}>{items.length?'NEEDS REVIEW':'NO FLAGS'}</span></div>
  {shown.length>0&&<div className="spatial-review-list">{shown.map(item=><div className="spatial-review-row" key={item.id}><div><strong>{item.name}</strong><small>{item.reason} · {item.floor} · {item.source}</small></div><span>REVIEW</span></div>)}</div>}
  <div className="button-row"><a className="action" href="#spatial-model">Inspect model</a>{items.length>0&&<Link className="ghost" href="/compiler">Fix source / geometry</Link>}</div>
  <small className="spatial-review-boundary">Observed and proposed data never silently becomes Verified infrastructure state.</small>
 </section>;
}