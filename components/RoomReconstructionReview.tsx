'use client';

import {useEffect,useRef,useState} from 'react';
import {proposeRooms,reconstructWallLoopCandidates,type RoomEntity,type RoomProposal} from '@/lib/room-reconstruction';
import {readPrimarySpatialGraph,writePrimarySpatialGraphIfUnchanged} from '@/lib/spatial-browser-recovery';
import {entitiesSignature,graphSignature} from '@/lib/graph-signature';

type Graph={entities?:RoomEntity[];roomReconstructionProposals?:RoomProposal[];[key:string]:unknown};

export default function RoomReconstructionReview(){
 const [proposals,setProposals]=useState<RoomProposal[]>([]);
 const runningRef=useRef(false);
 async function refresh(){
  if(runningRef.current)return; // never overlap: avoids duplicate writes during a cascade
  runningRef.current=true;
  let rerun=false;
  try{
  const stored=await readPrimarySpatialGraph();
  const graph=(stored||{}) as Graph;
  const base=(graph.entities||[]).filter(entity=>entity.meta?.reconstruction!=='wall-segment-loop');
  const stitched=reconstructWallLoopCandidates(base);
  const combined=[...base,...stitched];
  const next=proposeRooms(combined);
  const proposalMap=new Map(next.map(item=>[item.candidateId,item]));
  const entities=combined.map(entity=>entity.kind==='vector-boundary-candidate'?{...entity,meta:{...(entity.meta||{}),automaticRoomProposal:proposalMap.get(entity.id)||null}}:entity);
  const changed=JSON.stringify(graph.roomReconstructionProposals||[])!==JSON.stringify(next)||entitiesSignature(graph.entities||[])!==entitiesSignature(entities);
  // A human review (e.g. a room confirmation) written while this pass ran must not be reverted:
  // write only against the graph read above, otherwise recompute from the latest.
  if(changed&&!await writePrimarySpatialGraphIfUnchanged({...graph,entities,roomReconstructionProposals:next} as any,graphSignature(stored))){
   rerun=true;return;
  }
  setProposals(next);
  if(changed)window.dispatchEvent(new Event('stratum:graph-updated'));
  }finally{runningRef.current=false;if(rerun)void refresh()}
 }
 useEffect(()=>{
  // Debounce graph-updated bursts into a single reconstruction pass.
  let timer:ReturnType<typeof setTimeout>|null=null;
  const run=()=>{if(timer)clearTimeout(timer);timer=setTimeout(()=>void refresh(),250)};
  void refresh();
  window.addEventListener('stratum:graph-updated',run);
  return()=>{if(timer)clearTimeout(timer);window.removeEventListener('stratum:graph-updated',run)};
 },[]);
 const eligible=proposals.filter(item=>item.eligible);
 const stitchedCount=proposals.filter(item=>item.candidateId.startsWith('wall-loop-')).length;
 return <section className="card" style={{marginTop:16}} aria-label="Automatic room reconstruction review">
  <div className="section-head"><div><div className="eyebrow">Room reconstruction · Deterministic proposals</div><h2>Closed paths + conservative wall-loop stitching + source labels</h2><p className="muted">STRATUM evaluates extracted closed paths and isolated wall-segment loops for geometric sanity, self-intersection, compactness, duplicate geometry and contained source-grounded room labels. Wall endpoints may snap only within a small tolerance and only inside the same source/page. Branching or open topology fails closed. High-confidence results are proposals only; a human must still confirm the boundary in Drawing review.</p></div><span className="pending">{eligible.length}/{proposals.length} REVIEWABLE</span></div>
  {stitchedCount>0&&<div className="notice" style={{marginBottom:12}}><strong>{stitchedCount} WALL LOOP{stitchedCount===1?'':'S'} PROPOSED</strong><span>These boundaries were reconstructed from simple closed wall-segment cycles. They remain review-only and do not represent measured or Verified room geometry.</span></div>}
  {!proposals.length&&<p className="muted" style={{marginBottom:0}}>No closed-path or simple wall-loop room candidates are available yet.</p>}
  {proposals.length>0&&<div style={{display:'grid',gap:10}}>{proposals.slice(0,24).map(item=><article className="card" style={{padding:14}} key={item.candidateId}><div className="section-head"><div><strong>{item.name||'Unnamed boundary'}</strong><small style={{display:'block'}}>Candidate {item.candidateId.slice(-24)} · area {item.area.toFixed(2)} · compactness {item.compactness.toFixed(3)} · confidence {Math.round(item.confidence*100)}%</small></div><span className={item.eligible?'proof':'pending'}>{item.eligible?'ROOM PROPOSAL':'REVIEW NEEDED'}</span></div>{item.reasons.length>0&&<p className="muted" style={{marginBottom:0}}>{item.reasons.join(' ')}</p>}</article>)}</div>}
  <p className="muted" style={{marginBottom:0,marginTop:12}}>Automatic room proposals do not set <b>geometryValidated</b>, do not create STRATUM Assets, and do not establish Verified state, DIR finality, PoVI finality, or physical truth.</p>
 </section>;
}
