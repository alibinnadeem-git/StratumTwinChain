'use client';

import {useEffect,useState} from 'react';
import {proposeSheetAlignments,type AlignmentProposal,type AlignmentSheet} from '@/lib/auto-sheet-alignment';
import {transformSheetPoint} from '@/lib/sheet-similarity';
import {readPrimarySpatialGraph,writePrimarySpatialGraph} from '@/lib/spatial-browser-recovery';

type GraphEntity={id:string;name:string;x:number;y:number;z?:number;kind:string;confidence:number;meta?:Record<string,unknown>};
type Graph={entities?:GraphEntity[];titleBlocks?:AlignmentSheet[];alignmentCandidates?:AlignmentProposal[];autoAlignmentReviews?:unknown[];[key:string]:unknown};
function entityKey(entity:GraphEntity){const sha=String(entity.meta?.sourceSha256||'').toLowerCase(),page=Number(entity.meta?.page||0);return sha&&page?`${sha}:${page}`:null}
async function saveGraph(graph:Graph){await writePrimarySpatialGraph(graph as any);window.dispatchEvent(new Event('stratum:graph-updated'))}

export default function AutoSheetAlignmentReview(){
 const [proposals,setProposals]=useState<AlignmentProposal[]>([]),[message,setMessage]=useState('');
 async function refresh(){const graph=(await readPrimarySpatialGraph()||{}) as Graph,next=proposeSheetAlignments(graph.entities||[],graph.titleBlocks||[]);setProposals(next);if(JSON.stringify(graph.alignmentCandidates||[])!==JSON.stringify(next)){graph.alignmentCandidates=next;await writePrimarySpatialGraph(graph as any)}}
 useEffect(()=>{const run=()=>{void refresh()};run();window.addEventListener('stratum:graph-updated',run);return()=>window.removeEventListener('stratum:graph-updated',run)},[]);

 async function apply(proposal:AlignmentProposal){
  if(!proposal.eligible){setMessage('This proposal is not eligible for application. Resolve its anchor, residual, discipline, floor or scale cross-check blockers first.');return}
  const graph=(await readPrimarySpatialGraph()||{}) as Graph,entities=graph.entities||[];let changed=0;
  graph.entities=entities.map(entity=>{
   if(entityKey(entity)!==proposal.movingKey)return entity;
   const meta={...(entity.meta||{})};
   if(meta.autoSheetAlignmentCandidateId&&meta.autoSheetAlignmentCandidateId!==proposal.id)return entity;
   const original=(meta.autoSheetAlignmentOriginal as {x:number;y:number}|undefined)||{x:entity.x,y:entity.y};
   const point=transformSheetPoint(original,proposal.transform);changed++;
   return{...entity,x:point.x,y:point.y,meta:{...meta,autoSheetAlignmentOriginal:original,autoSheetAlignmentCandidateId:proposal.id,alignmentMethod:'auto-common-anchor-human-confirmed',alignmentAppliedAt:new Date().toISOString(),alignmentVerified:false}};
  });
  graph.autoAlignmentReviews=[...(Array.isArray(graph.autoAlignmentReviews)?graph.autoAlignmentReviews:[]),{candidateId:proposal.id,action:'APPLY',occurredAt:new Date().toISOString(),reviewRequired:true,verified:false,crossChecks:proposal.crossChecks}];
  await saveGraph(graph);setMessage(`Applied anchor-derived transform to ${changed} object${changed===1?'':'s'} on ${proposal.movingSheet}. Title-block floor/scale were safety cross-checks only and did not create the transform. Original sheet coordinates were preserved. This remains human-confirmed alignment, not Verified infrastructure state.`);
 }

 async function restore(proposal:AlignmentProposal){
  const graph=(await readPrimarySpatialGraph()||{}) as Graph,entities=graph.entities||[];let changed=0;
  graph.entities=entities.map(entity=>{
   const meta={...(entity.meta||{})},original=meta.autoSheetAlignmentOriginal as {x:number;y:number}|undefined;
   if(meta.autoSheetAlignmentCandidateId!==proposal.id||!original)return entity;
   changed++;delete meta.autoSheetAlignmentOriginal;delete meta.autoSheetAlignmentCandidateId;delete meta.alignmentMethod;delete meta.alignmentAppliedAt;delete meta.alignmentVerified;
   return{...entity,x:original.x,y:original.y,meta};
  });
  graph.autoAlignmentReviews=[...(Array.isArray(graph.autoAlignmentReviews)?graph.autoAlignmentReviews:[]),{candidateId:proposal.id,action:'RESTORE',occurredAt:new Date().toISOString(),reviewRequired:true,verified:false}];
  await saveGraph(graph);setMessage(`Restored ${changed} object${changed===1?'':'s'} to original sheet coordinates for ${proposal.movingSheet}.`);
 }

 return <section className="card" style={{marginTop:16}} aria-label="Automatic sheet alignment review">
  <div className="section-head"><div><div className="eyebrow">Automatic multi-sheet alignment · Review required</div><h2>Propose transforms from repeated source-grounded anchors</h2><p className="muted">Only human-confirmed sheet identities are considered. Repeated anchors create the transform. Confirmed discipline/floor and title-block scale + PDF page geometry can only reject or flag a suspicious proposal; they never create or modify the transform. Nothing is applied automatically, every transform is reversible, and <b>alignmentVerified</b> remains false.</p></div><span className="pending">{proposals.filter(item=>item.eligible).length} ELIGIBLE</span></div>
  {message&&<div className="notice" role="status"><strong>ALIGNMENT REVIEW</strong><span>{message}</span></div>}
  {!proposals.length&&<p className="muted" style={{marginBottom:0}}>No automatic alignment proposals yet. Confirm title-block identities on at least two sheets and provide at least three repeated source-grounded anchors.</p>}
  {proposals.length>0&&<div style={{display:'grid',gap:10,marginTop:12}}>{proposals.map(proposal=><article className="card" key={proposal.id} style={{padding:14}}>
   <div className="section-head"><div><strong>{proposal.movingSheet} → {proposal.referenceSheet}</strong><small style={{display:'block'}}>{proposal.anchors.length} shared anchors · confidence {Math.round(proposal.confidence*100)}% · RMS {proposal.transform.rmsResidual.toFixed(3)}</small></div><span className={proposal.eligible?'proof':'pending'}>{proposal.eligible?'REVIEWABLE':'BLOCKED'}</span></div>
   <div className="grid two"><div><div className="label">Anchor-derived transform</div><b>{proposal.transform.scale.toFixed(4)}× · {proposal.transform.rotationDegrees.toFixed(2)}°</b><small style={{display:'block'}}>ΔX {proposal.transform.translateX.toFixed(3)} · ΔY {proposal.transform.translateY.toFixed(3)}</small></div><div><div className="label">Shared anchors</div><b>{proposal.anchors.slice(0,6).map(anchor=>anchor.name).join(' · ')}</b></div><div><div className="label">Identity cross-checks</div><b>Discipline {proposal.crossChecks.discipline} · Floor {proposal.crossChecks.floor}</b><small style={{display:'block'}}>Confirmed title-block metadata can block a mismatch but cannot authorize alignment.</small></div><div><div className="label">Scale cross-check</div><b>{proposal.crossChecks.scale}</b><small style={{display:'block'}}>{proposal.crossChecks.expectedScale!==null?`Expected normalized ratio ${proposal.crossChecks.expectedScale.toFixed(4)}× · deviation factor ${proposal.crossChecks.scaleDeviationFactor?.toFixed(2)}`:'Unavailable/NTS — anchor transform remains independently reviewable.'}</small></div></div>
   {proposal.crossChecks.scale==='REVIEW'&&<div className="notice"><strong>SCALE REVIEW</strong><span>The anchor-derived ratio differs moderately from the title-block/page-geometry expectation. It is not blocked, but review cropping, sheet format and anchor identity before applying.</span></div>}
   {proposal.reasons.length>0&&<p className="muted">Blocked: {proposal.reasons.join(' ')}</p>}
   <div className="button-row"><button type="button" disabled={!proposal.eligible} onClick={()=>apply(proposal)}>Apply reviewed proposal</button><button type="button" onClick={()=>restore(proposal)}>Restore original coordinates</button></div>
  </article>)}</div>}
  <p className="muted" style={{marginBottom:0,marginTop:12}}>Title-block scale remains <b>non-authoritative</b>. Automatic proposals do not create STRATUM Assets, approve lifecycle evidence, finalize DIRs, establish PoVI finality, or establish physical truth.</p>
 </section>;
}
