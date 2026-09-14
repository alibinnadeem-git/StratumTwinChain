'use client';

import {useEffect,useState} from 'react';
import {proposeRooms,type RoomEntity,type RoomProposal} from '@/lib/room-reconstruction';

const STORAGE='stratum_compiled_graph';
type Graph={entities?:RoomEntity[];roomReconstructionProposals?:RoomProposal[];[key:string]:unknown};
function readGraph():Graph{try{const parsed=JSON.parse(localStorage.getItem(STORAGE)||'{}');return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{}}catch{return{}}}

export default function RoomReconstructionReview(){
 const [proposals,setProposals]=useState<RoomProposal[]>([]);
 function refresh(){
  const graph=readGraph(),next=proposeRooms(graph.entities||[]);setProposals(next);
  const proposalMap=new Map(next.map(item=>[item.candidateId,item]));
  const entities=(graph.entities||[]).map(entity=>entity.kind==='vector-boundary-candidate'?{...entity,meta:{...(entity.meta||{}),automaticRoomProposal:proposalMap.get(entity.id)||null}}:entity);
  if(JSON.stringify(graph.roomReconstructionProposals||[])!==JSON.stringify(next)){
   localStorage.setItem(STORAGE,JSON.stringify({...graph,entities,roomReconstructionProposals:next}));
   window.dispatchEvent(new Event('stratum:graph-updated'));
  }
 }
 useEffect(()=>{refresh();window.addEventListener('stratum:graph-updated',refresh);return()=>window.removeEventListener('stratum:graph-updated',refresh)},[]);
 const eligible=proposals.filter(item=>item.eligible);
 return <section className="card" style={{marginTop:16}} aria-label="Automatic room reconstruction review">
  <div className="section-head"><div><div className="eyebrow">Room reconstruction · Deterministic proposals</div><h2>Closed geometry + contained source labels + topology checks</h2><p className="muted">STRATUM evaluates extracted closed paths for geometric sanity, self-intersection, compactness, duplicate/nested boundaries and contained source-grounded room labels. High-confidence results are proposals only. A human must still confirm the boundary in Drawing review before it becomes a reviewed room.</p></div><span className="pending">{eligible.length}/{proposals.length} REVIEWABLE</span></div>
  {!proposals.length&&<p className="muted" style={{marginBottom:0}}>No PDF closed-boundary candidates are available yet.</p>}
  {proposals.length>0&&<div style={{display:'grid',gap:10}}>{proposals.slice(0,24).map(item=><article className="card" style={{padding:14}} key={item.candidateId}><div className="section-head"><div><strong>{item.name||'Unnamed boundary'}</strong><small style={{display:'block'}}>Candidate {item.candidateId.slice(-24)} · area {item.area.toFixed(2)} · compactness {item.compactness.toFixed(3)} · confidence {Math.round(item.confidence*100)}%</small></div><span className={item.eligible?'proof':'pending'}>{item.eligible?'ROOM PROPOSAL':'REVIEW NEEDED'}</span></div>{item.reasons.length>0&&<p className="muted" style={{marginBottom:0}}>{item.reasons.join(' ')}</p>}</article>)}</div>}
  <p className="muted" style={{marginBottom:0,marginTop:12}}>Automatic room proposals do not set <b>geometryValidated</b>, do not create STRATUM Assets, and do not establish Verified state, DIR finality, PoVI finality, or physical truth.</p>
 </section>;
}
