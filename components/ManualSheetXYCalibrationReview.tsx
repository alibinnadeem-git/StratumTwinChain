'use client';

import {useEffect,useMemo,useState} from 'react';
import {applySheetXYTransform,restoreSheetXYCoordinates,sheetXYValidationResidual,solveSheetXYTransform,type Point} from '@/lib/sheet-alignment';
import {readPrimarySpatialGraph,replaceCurrentSpatialGraph,type SpatialGraphLike} from '@/lib/spatial-browser-recovery';

type Entity={id:string;source:string;x:number;y:number;z?:number;x2?:number;y2?:number;z2?:number;vertices?:Point[];floor?:string;kind:string;name:string;meta?:Record<string,unknown>};
type Graph=SpatialGraphLike&{entities:Entity[];sheetXYCalibrations?:unknown[]};
type Inputs={s1x:string;s1y:string;s2x:string;s2y:string;t1x:string;t1y:string;t2x:string;t2y:string;s3x:string;s3y:string;t3x:string;t3y:string;tolerance:string};
const initial:Inputs={s1x:'',s1y:'',s2x:'',s2y:'',t1x:'',t1y:'',t2x:'',t2y:'',s3x:'',s3y:'',t3x:'',t3y:'',tolerance:'0.25'};

function frameKey(entity:Entity){
 const sha=String(entity.meta?.sourceSha256||'').toLowerCase(),page=Number(entity.meta?.page||0);
 return sha&&Number.isInteger(page)&&page>0?`${sha}:${page}`:null;
}
function n(value:string){const x=Number(value);if(!Number.isFinite(x))throw new Error('All control-point coordinates and the tolerance must be finite numbers.');return x}
function point(x:string,y:string):Point{return{x:n(x),y:n(y)}}

export default function ManualSheetXYCalibrationReview(){
 const [graph,setGraph]=useState<Graph|null>(null);
 const [selected,setSelected]=useState('');
 const [inputs,setInputs]=useState<Inputs>(initial);
 const [message,setMessage]=useState('');

 useEffect(()=>{
  let active=true;
  const load=async()=>{const next=await readPrimarySpatialGraph() as Graph|null;if(active)setGraph(next)};
  const refresh=()=>{void load()};
  void load();window.addEventListener('stratum:graph-updated',refresh);
  return()=>{active=false;window.removeEventListener('stratum:graph-updated',refresh)};
 },[]);

 const frames=useMemo(()=>{
  const map=new Map<string,{key:string;label:string;count:number;autoAligned:boolean;manualAligned:boolean}>();
  for(const entity of graph?.entities||[]){
   const key=frameKey(entity);if(!key)continue;
   const units=String(entity.meta?.coordinateUnits||'');
   if(units!=='sheet'&&units!=='m_xy'&&!entity.meta?.sheetXYOriginal)continue;
   const prior=map.get(key),page=Number(entity.meta?.page||0),label=`${entity.source} · page ${page}`;
   map.set(key,{key,label,count:(prior?.count||0)+1,autoAligned:Boolean(prior?.autoAligned||entity.meta?.autoSheetAlignmentCandidateId),manualAligned:Boolean(prior?.manualAligned||entity.meta?.sheetXYCalibrationId)});
  }
  return [...map.values()].sort((a,b)=>a.label.localeCompare(b.label));
 },[graph]);
 const active=frames.find(item=>item.key===selected)||null;

 async function apply(){
  try{
   if(!selected)throw new Error('Select a source sheet frame first.');
   if(active?.autoAligned)throw new Error('Restore the automatic alignment for this sheet before applying a manual XY calibration.');
   const source:[Point,Point]=[point(inputs.s1x,inputs.s1y),point(inputs.s2x,inputs.s2y)];
   const target:[Point,Point]=[point(inputs.t1x,inputs.t1y),point(inputs.t2x,inputs.t2y)];
   const validationSource=point(inputs.s3x,inputs.s3y),validationTarget=point(inputs.t3x,inputs.t3y),tolerance=n(inputs.tolerance);
   if(tolerance<=0)throw new Error('Validation tolerance must be greater than zero.');
   const transform=solveSheetXYTransform(source,target);
   const residual=sheetXYValidationResidual(validationSource,validationTarget,transform);
   const current=await readPrimarySpatialGraph() as Graph|null;if(!current)throw new Error('No Spatial graph is available.');
   const calibrationId=`xy:${selected}:${Date.now()}`;let changed=0;
   current.entities=current.entities.map(entity=>{
    if(frameKey(entity)!==selected)return entity;
    if(entity.meta?.autoSheetAlignmentCandidateId)throw new Error('This sheet contains an automatic alignment. Restore it before manual calibration.');
    const calibrated=applySheetXYTransform(entity,transform,{residualMeters:residual,toleranceMeters:tolerance});
    changed++;
    return {...calibrated,meta:{...(calibrated.meta||{}),sheetXYCalibrationId:calibrationId,sheetXYCalibrationAppliedAt:new Date().toISOString(),sheetXYCalibrationReviewRequired:residual>tolerance}};
   });
   current.sheetXYCalibrations=[...(Array.isArray(current.sheetXYCalibrations)?current.sheetXYCalibrations:[]),{id:calibrationId,frameKey:selected,action:'APPLY',transform,controlPoints:{source,target,validationSource,validationTarget},residualMeters:residual,toleranceMeters:tolerance,validated:residual<=tolerance,occurredAt:new Date().toISOString(),physicalPositionVerified:false,zChanged:false}];
   await replaceCurrentSpatialGraph(current);
   setMessage(`Applied XY transform to ${changed} object${changed===1?'':'s'}. Third-point residual ${residual.toFixed(3)} m ${residual<=tolerance?'passes':'exceeds'} the ${tolerance.toFixed(3)} m tolerance. Z and elevation authority were not changed.`);
  }catch(error){setMessage(error instanceof Error?error.message:'Unable to apply XY calibration.')}
 }

 async function restore(){
  try{
   if(!selected)throw new Error('Select a source sheet frame first.');
   const current=await readPrimarySpatialGraph() as Graph|null;if(!current)throw new Error('No Spatial graph is available.');
   let changed=0;
   current.entities=current.entities.map(entity=>{
    if(frameKey(entity)!==selected||!entity.meta?.sheetXYOriginal)return entity;
    const restored=restoreSheetXYCoordinates(entity);const meta={...(restored.meta||{})};delete meta.sheetXYCalibrationId;delete meta.sheetXYCalibrationAppliedAt;delete meta.sheetXYCalibrationReviewRequired;changed++;
    return {...restored,meta};
   });
   current.sheetXYCalibrations=[...(Array.isArray(current.sheetXYCalibrations)?current.sheetXYCalibrations:[]),{frameKey:selected,action:'RESTORE',occurredAt:new Date().toISOString(),physicalPositionVerified:false,zChanged:false}];
   await replaceCurrentSpatialGraph(current);
   setMessage(`Restored ${changed} object${changed===1?'':'s'} to original sheet XY. Z was unchanged.`);
  }catch(error){setMessage(error instanceof Error?error.message:'Unable to restore sheet coordinates.')}
 }

 const field=(key:keyof Inputs,label:string)=><label><span>{label}</span><input inputMode="decimal" value={inputs[key]} onChange={event=>setInputs(current=>({...current,[key]:event.target.value}))}/></label>;

 return <section className="card" style={{marginTop:16}} aria-label="Manual sheet XY calibration review">
  <div className="section-head"><div><div className="eyebrow">Manual plan calibration · XY only</div><h2>Calibrate sheet coordinates without inventing elevation</h2><p className="muted">Two control pairs establish scale, rotation and translation. A third pair independently validates the transform. Passing XY validation does not establish Z, installed condition, asset identity or as-built truth.</p></div><span className="pending">HUMAN REVIEW</span></div>
  <label><span>Source sheet frame</span><select aria-label="Manual XY calibration sheet" value={selected} onChange={event=>setSelected(event.target.value)}><option value="">Select sheet</option>{frames.map(frame=><option key={frame.key} value={frame.key}>{frame.label} · {frame.count} objects{frame.autoAligned?' · auto-aligned':''}{frame.manualAligned?' · manually calibrated':''}</option>)}</select></label>
  <div className="grid two" style={{marginTop:12}}>
   <div className="card" style={{padding:12}}><div className="eyebrow">Control A</div><div className="grid two">{field('s1x','Sheet X')}{field('s1y','Sheet Y')}{field('t1x','Model X (m)')}{field('t1y','Model Y (m)')}</div></div>
   <div className="card" style={{padding:12}}><div className="eyebrow">Control B</div><div className="grid two">{field('s2x','Sheet X')}{field('s2y','Sheet Y')}{field('t2x','Model X (m)')}{field('t2y','Model Y (m)')}</div></div>
   <div className="card" style={{padding:12}}><div className="eyebrow">Independent validation C</div><div className="grid two">{field('s3x','Sheet X')}{field('s3y','Sheet Y')}{field('t3x','Expected X (m)')}{field('t3y','Expected Y (m)')}</div></div>
   <div className="card" style={{padding:12}}><div className="eyebrow">Acceptance</div>{field('tolerance','Max residual (m)')}<p className="muted" style={{marginBottom:0}}>If validation exceeds tolerance, the transform may still be used as reviewed visualization, but it remains explicitly unvalidated.</p></div>
  </div>
  {active?.autoAligned&&<div className="notice" style={{marginTop:12}}><strong>RESTORE AUTO ALIGNMENT FIRST</strong><span>Manual calibration is blocked while this sheet carries an automatic alignment transform, preventing compounded coordinate transforms.</span></div>}
  <div className="button-row" style={{marginTop:12}}><button type="button" className="action" onClick={apply} disabled={!selected||Boolean(active?.autoAligned)}>Apply XY calibration</button><button type="button" className="ghost" onClick={restore} disabled={!selected}>Restore original XY</button></div>
  {message&&<div className="notice" role="status" style={{marginTop:12}}><strong>XY CALIBRATION</strong><span>{message}</span></div>}
  <small className="spatial-review-boundary">XY calibration is a reviewed drawing transform only. It does not change Z, mark physical position Verified, create a STRATUM Asset, approve evidence, finalize a DIR, or establish PoVI finality.</small>
 </section>;
}
