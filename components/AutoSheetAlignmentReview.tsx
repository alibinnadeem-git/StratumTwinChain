'use client';

import {useEffect,useState} from 'react';
import {proposeSheetAlignments,type AlignmentProposal,type AlignmentSheet} from '@/lib/auto-sheet-alignment';
import {applyReviewedProjectXYFrameRegistration,restoreReviewedProjectXYFrameRegistration} from '@/lib/project-xy-frame-registration';
import {readPrimarySpatialGraph,writePrimarySpatialGraph} from '@/lib/spatial-browser-recovery';
import {clearCrossSheetElevationForAlignment,enrichCrossSheetElevationSurfaces} from '@/lib/cross-sheet-elevation';

type GraphEntity={id:string;name:string;x:number;y:number;z?:number;x2?:number;y2?:number;vertices?:{x:number;y:number}[];floor?:string;layer?:string;kind:string;confidence:number;meta?:Record<string,unknown>};
type Graph={entities?:GraphEntity[];titleBlocks?:AlignmentSheet[];alignmentCandidates?:AlignmentProposal[];autoAlignmentReviews?:unknown[];projectFrameRegistrations?:unknown[];[key:string]:unknown};
function entityKey(entity:GraphEntity){const sha=String(entity.meta?.sourceSha256||'').toLowerCase(),page=Number(entity.meta?.page||0);return sha&&page?`${sha}:${page}`:null}
async function saveGraph(graph:Graph){await writePrimarySpatialGraph(graph as any);window.dispatchEvent(new Event('stratum:graph-updated'))}

export default function AutoSheetAlignmentReview(){
 const [proposals,setProposals]=useState<AlignmentProposal[]>([]),[message,setMessage]=useState('');
 async function refresh(){const graph=(await readPrimarySpatialGraph()||{}) as Graph,next=proposeSheetAlignments(graph.entities||[],graph.titleBlocks||[]);setProposals(next);if(JSON.stringify(graph.alignmentCandidates||[])!==JSON.stringify(next)){graph.alignmentCandidates=next;await writePrimarySpatialGraph(graph as any)}}
 useEffect(()=>{const run=()=>{void refresh()};run();window.addEventListener('stratum:graph-updated',run);return()=>window.removeEventListener('stratum:graph-updated',run)},[]);

 async function apply(proposal:AlignmentProposal){
  try{
   if(!proposal.eligible)throw new Error('This proposal is not eligible for application. Resolve its anchor, residual, discipline, floor or scale cross-check blockers first.');
   const graph=(await readPrimarySpatialGraph()||{}) as Graph,entities=graph.entities||[];
   const result=applyReviewedProjectXYFrameRegistration(entities,proposal);
   graph.entities=enrichCrossSheetElevationSurfaces(result.entities,{candidateId:proposal.id,referenceKey:proposal.referenceKey,movingKey:proposal.movingKey,confidence:proposal.confidence});
   graph.projectFrameRegistrations=[...(Array.isArray(graph.projectFrameRegistrations)?graph.projectFrameRegistrations:[]),{...result.registration,action:'APPLY'}];
   graph.autoAlignmentReviews=[...(Array.isArray(graph.autoAlignmentReviews)?graph.autoAlignmentReviews:[]),{candidateId:proposal.id,action:'APPLY',occurredAt:result.registration.occurredAt,projectXYFrameId:result.registration.frameId,projectXYCoordinateUnits:result.registration.coordinateUnits,projectXYMetric:result.registration.metric,reviewRequired:true,verified:false,crossChecks:proposal.crossChecks,warnings:proposal.warnings}];
   await saveGraph(graph);
   setMessage('Registered '+result.registration.transformedEntities+' moving object'+(result.registration.transformedEntities===1?'':'s')+' and '+result.registration.referenceEntities+' reference object'+(result.registration.referenceEntities===1?'':'s')+' into '+result.registration.frameId+'. Coordinates now explicitly inherit '+result.registration.coordinateUnits+(result.registration.metric?' metric':' non-metric')+' reference-frame units. Boundary overlap '+proposal.crossChecks.boundary+(proposal.crossChecks.boundaryOverlapRatio!==null?' at '+Math.round(proposal.crossChecks.boundaryOverlapRatio*100)+'%':'')+'. Eligible cross-sheet elevation surfaces were sampled for review. Original source coordinates remain reversible; alignment-derived Z and physical truth remain review-only.');
  }catch(error){setMessage(error instanceof Error?error.message:'Unable to register the reviewed project XY frame.')}
 }

 async function restore(proposal:AlignmentProposal){
  try{
   const graph=(await readPrimarySpatialGraph()||{}) as Graph,entities=graph.entities||[];
   const result=restoreReviewedProjectXYFrameRegistration(entities,proposal.id);
   graph.entities=clearCrossSheetElevationForAlignment(result.entities,proposal.id);
   graph.projectFrameRegistrations=[...(Array.isArray(graph.projectFrameRegistrations)?graph.projectFrameRegistrations:[]),{id:proposal.id,frameId:'PROJECT_XY:'+proposal.referenceKey,referenceKey:proposal.referenceKey,movingKey:proposal.movingKey,action:'RESTORE',occurredAt:new Date().toISOString(),reviewRequired:true,physicalPositionVerified:false,physicalTruth:false}];
   graph.autoAlignmentReviews=[...(Array.isArray(graph.autoAlignmentReviews)?graph.autoAlignmentReviews:[]),{candidateId:proposal.id,action:'RESTORE',occurredAt:new Date().toISOString(),reviewRequired:true,verified:false}];
   await saveGraph(graph);
   setMessage('Restored '+result.restoredEntities+' moving object'+(result.restoredEntities===1?'':'s')+' and updated '+result.referenceEntitiesUpdated+' reference object'+(result.referenceEntitiesUpdated===1?'':'s')+'. Original coordinates and coordinate-unit metadata were restored exactly.');
  }catch(error){setMessage(error instanceof Error?error.message:'Unable to restore project XY frame registration.')}
 }

 return <section className="card" style={{marginTop:16}} aria-label="Automatic sheet alignment review">
  <div className="section-head"><div><div className="eyebrow">Automatic multi-sheet alignment · Review required</div><h2>Propose transforms from anchors, then verify drawing-footprint overlap</h2><p className="muted">Only human-confirmed sheet identities are considered. Repeated anchors create the transform. Source-grounded drawing geometry independently checks whether the transformed Architectural/Civil/Electrical footprints actually overlap. A reviewed application now registers both sheets into one durable project XY frame and the moving sheet explicitly inherits the reference frame's coordinate units. Confirmed discipline/floor and title-block scale + PDF page geometry can only reject or flag a suspicious proposal; they never create or modify the transform. Nothing is applied automatically, every transform is reversible, and <b>alignmentVerified</b> remains false.</p></div><span className="pending">{proposals.filter(item=>item.eligible).length} ELIGIBLE</span></div>
  {message&&<div className="notice" role="status"><strong>ALIGNMENT REVIEW</strong><span>{message}</span></div>}
  {!proposals.length&&<p className="muted" style={{marginBottom:0}}>No automatic alignment proposals yet. Confirm title-block identities on at least two sheets and provide at least three repeated source-grounded anchors.</p>}
  {proposals.length>0&&<div style={{display:'grid',gap:10,marginTop:12}}>{proposals.map(proposal=><article className="card" key={proposal.id} style={{padding:14}}>
   <div className="section-head"><div><strong>{proposal.movingSheet} → {proposal.referenceSheet}</strong><small style={{display:'block'}}>{proposal.anchors.length} shared anchors · confidence {Math.round(proposal.confidence*100)}% · RMS {proposal.transform.rmsResidual.toFixed(3)}</small></div><span className={proposal.eligible?'proof':'pending'}>{proposal.eligible?'REVIEWABLE':'BLOCKED'}</span></div>
   <div className="grid two"><div><div className="label">Anchor-derived transform</div><b>{proposal.transform.scale.toFixed(4)}× · {proposal.transform.rotationDegrees.toFixed(2)}°</b><small style={{display:'block'}}>ΔX {proposal.transform.translateX.toFixed(3)} · ΔY {proposal.transform.translateY.toFixed(3)}</small></div><div><div className="label">Shared anchors</div><b>{proposal.anchors.slice(0,6).map(anchor=>anchor.name).join(' · ')}</b></div><div><div className="label">Identity cross-checks</div><b>Discipline {proposal.crossChecks.discipline} · Floor {proposal.crossChecks.floor}</b><small style={{display:'block'}}>Confirmed title-block metadata can block a mismatch but cannot authorize alignment.</small></div><div><div className="label">Scale cross-check</div><b>{proposal.crossChecks.scale}</b><small style={{display:'block'}}>{proposal.crossChecks.expectedScale!==null?`Expected normalized ratio ${proposal.crossChecks.expectedScale.toFixed(4)}× · deviation factor ${proposal.crossChecks.scaleDeviationFactor?.toFixed(2)}`:'Unavailable/NTS — anchor transform remains independently reviewable.'}</small></div><div><div className="label">Drawing footprint overlap</div><b>{proposal.crossChecks.boundary}</b><small style={{display:'block'}}>{proposal.crossChecks.boundaryOverlapRatio!==null?`${Math.round(proposal.crossChecks.boundaryOverlapRatio*100)}% of smaller footprint · IoU ${Math.round((proposal.crossChecks.boundaryIou||0)*100)}% · ${proposal.crossChecks.referenceBoundaryVertices}/${proposal.crossChecks.movingBoundaryVertices} hull vertices`:'Unavailable — visual coordination review remains required.'}</small><small style={{display:'block'}}>Plan-frame scope: {proposal.crossChecks.referencePlanFrameId||'sheet'} ↔ {proposal.crossChecks.movingPlanFrameId||'sheet'}</small></div></div>
   {proposal.crossChecks.scale==='REVIEW'&&<div className="notice"><strong>SCALE REVIEW</strong><span>The anchor-derived ratio differs moderately from the title-block/page-geometry expectation. It is not blocked, but review cropping, sheet format and anchor identity before applying.</span></div>}
   {proposal.warnings.length>0&&<div className="notice"><strong>COORDINATION REVIEW</strong><span>{proposal.warnings.join(' ')}</span></div>}
   {proposal.reasons.length>0&&<p className="muted">Blocked: {proposal.reasons.join(' ')}</p>}
   <div className="button-row"><button type="button" disabled={!proposal.eligible} onClick={()=>apply(proposal)}>Apply reviewed proposal</button><button type="button" onClick={()=>restore(proposal)}>Restore original coordinates</button></div>
  </article>)}</div>}
  <p className="muted" style={{marginBottom:0,marginTop:12}}>Title-block scale remains <b>non-authoritative</b>. Automatic proposals do not create STRATUM Assets, approve lifecycle evidence, finalize DIRs, establish PoVI finality, or establish physical truth.</p>
 </section>;
}
