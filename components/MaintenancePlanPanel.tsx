'use client';

import {FormEvent,useEffect,useState} from 'react';

type Plan={
 id:string;revision:number;basis:string;interval_days:number|null;interval_hours:number|null;next_due_at:string|null;
 condition_triggers:unknown[];task_summary:string;source_refs:unknown[];status:string;supersedes_plan_id:string|null;created_at:string;
};
type Response={plans:Plan[];latest:Plan|null;error?:string};

const BUSES=['OEM','NFPA_70B','NECA','PROJECT_SPEC','OWNER_STANDARD','CONDITION_BASED','USER_DEFINED'] as const;

function cycle(plan:Plan){if(plan.interval_days)return plan.interval_days+' days';if(plan.interval_hours)return plan.interval_hours+' operating hours';if(plan.next_due_at)return'Calendar due date';return'Condition based'}
function date(value:string|null){return value?new Date(value).toLocaleString():'—'}

export default function MaintenancePlanPanel({assetId,canManage}:{assetId:string;canManage:boolean}){
 const [plans,setPlans]=useState<Plan[]>([]),[latest,setLatest]=useState<Plan|null>(null),[message,setMessage]=useState('Loading maintenance plan…'),[busy,setBusy]=useState(false);

 async function refresh(){
  try{
   const response=await fetch('/api/assets/'+encodeURIComponent(assetId)+'/maintenance-plans',{cache:'no-store'});
   const body=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(body?.error||'Unable to load maintenance plans');
   const data=body as Response;setPlans(data.plans||[]);setLatest(data.latest||null);setMessage(data.latest?'Latest maintenance plan loaded.':'No maintenance plan has been recorded for this asset.');
  }catch(error){setPlans([]);setLatest(null);setMessage(error instanceof Error?error.message:'Unable to load maintenance plans.')}
 }
 useEffect(()=>{void refresh()},[assetId]);

 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;setBusy(true);
  const form=new FormData(event.currentTarget);
  const integer=(name:string)=>{const value=String(form.get(name)||'').trim();return value?Number(value):null};
  const lines=(name:string)=>String(form.get(name)||'').split(/\r?\n/).map(value=>value.trim()).filter(Boolean);
  try{
   const nextDueRaw=String(form.get('nextDueAt')||'').trim();
   const body={
    basis:String(form.get('basis')||'USER_DEFINED'),
    intervalDays:integer('intervalDays'),intervalHours:integer('intervalHours'),
    nextDueAt:nextDueRaw?new Date(nextDueRaw).toISOString():null,
    conditionTriggers:lines('conditionTriggers'),taskSummary:String(form.get('taskSummary')||'').trim(),
    sourceRefs:lines('sourceRefs'),status:String(form.get('status')||'DRAFT')
   };
   const response=await fetch('/api/assets/'+encodeURIComponent(assetId)+'/maintenance-plans',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
   const json=await response.json().catch(()=>({}));if(!response.ok)throw new Error(json?.error||'Unable to create maintenance plan revision');
   event.currentTarget.reset();setMessage('Maintenance plan revision r'+json.revision+' created. Previous revisions remain immutable.');await refresh();
  }catch(error){setMessage(error instanceof Error?error.message:'Unable to create maintenance plan.')}
  finally{setBusy(false)}
 }

 return <section className="card" style={{marginTop:16}} aria-label="Asset maintenance plan">
  <div className="section-head"><div><div className="eyebrow">Maintenance intelligence</div><h2>Versioned maintenance plan</h2></div><span className={latest?.status==='ACTIVE'?'proof':'pending'}>{latest?.status||'UNPLANNED'}</span></div>
  {latest?<div className="spec-grid">
   <div><span>Basis</span><strong>{latest.basis.replaceAll('_',' ')}</strong></div>
   <div><span>Revision</span><strong>{'r'+latest.revision}</strong></div>
   <div><span>Cycle</span><strong>{cycle(latest)}</strong></div>
   <div><span>Next due</span><strong>{date(latest.next_due_at)}</strong></div>
   <div><span>Task</span><strong>{latest.task_summary}</strong></div>
   <div><span>Condition triggers</span><strong>{latest.condition_triggers.length||'—'}</strong></div>
  </div>:<p className="muted">No governed maintenance plan exists yet.</p>}
  <p className="muted">A maintenance plan schedules or recommends work. It does not prove work was physically performed; completion evidence belongs in lifecycle/evidence workflows.</p>

  {canManage&&<details className="secondary-details">
   <summary>Create next maintenance-plan revision</summary>
   <form onSubmit={submit} style={{display:'grid',gap:10,marginTop:12}}>
    <label>Basis<select name="basis" defaultValue="OEM">{BUSES.map(value=><option value={value} key={value}>{value.replaceAll('_',' ')}</option>)}</select></label>
    <div className="grid two"><label>Interval days<input name="intervalDays" type="number" min="1" max="36500"/></label><label>Operating hours<input name="intervalHours" type="number" min="1" max="1000000"/></label></div>
    <label>Next due<input name="nextDueAt" type="datetime-local"/></label>
    <label>Status<select name="status" defaultValue="DRAFT"><option>DRAFT</option><option>REVIEWED</option><option>ACTIVE</option></select></label>
    <label>Task summary<textarea name="taskSummary" minLength={3} maxLength={4000} required rows={3}/></label>
    <label>Condition triggers — one per line<textarea name="conditionTriggers" rows={3} placeholder="Thermal anomaly above approved threshold&#10;Breaker operation count threshold"/></label>
    <label>Source references — one per line<textarea name="sourceRefs" rows={3} placeholder="OEM O&M manual revision&#10;Project specification section"/></label>
    <button className="action" type="submit" disabled={busy}>{busy?'Saving…':'Create maintenance revision'}</button>
   </form>
  </details>}

  {plans.length>0&&<details className="secondary-details"><summary>Maintenance-plan history</summary><div className="vertical-timeline">{plans.map(plan=><div className="life-event" key={plan.id}><i>{plan.status==='ACTIVE'?'✓':'○'}</i><div><strong>{'r'+plan.revision+' · '+plan.basis.replaceAll('_',' ')}</strong><span>{cycle(plan)} · created {date(plan.created_at)}</span><small>{plan.task_summary}</small></div><b>{plan.status}</b></div>)}</div></details>}
  {message&&<div className="notice" role="status" style={{marginTop:12}}><strong>MAINTENANCE</strong><span>{message}</span></div>}
 </section>;
}
