import Link from 'next/link';

const tasks=[
 {href:'/compiler',step:'1',title:'Start from a drawing',description:'Upload a PDF or DXF and review the Spatial model that STRATUM creates.',action:'Upload & review'},
 {href:'/spatial',step:'2',title:'Review the model',description:'Check rooms, equipment, electrical relationships and anything that still needs human review.',action:'Open model'},
 {href:'/scan',step:'3',title:'Scan & inspect an asset',description:'Scan the asset code, confirm the correct equipment, then capture field evidence.',action:'Start scan'},
 {href:'/assets',step:'4',title:'Find an asset',description:'Open an Asset Passport to see identity, lifecycle, evidence and trust history in one place.',action:'Find asset'}
] as const;

export default function TaskLauncher(){
 return <section className="task-launcher" aria-labelledby="task-launcher-title">
  <div className="task-launcher-head">
   <div><div className="eyebrow">Start here</div><h2 id="task-launcher-title">What do you need to do?</h2></div>
   <p>Choose one task. Advanced engineering, trust and administration tools stay out of the way until you need them.</p>
  </div>
  <div className="task-grid">{tasks.map(task=><Link className="task-card" href={task.href} key={task.href}>
   <span className="task-step">{task.step}</span>
   <div><h3>{task.title}</h3><p>{task.description}</p><strong>{task.action} →</strong></div>
  </Link>)}</div>
 </section>;
}