import Link from 'next/link';

const tasks=[
 {href:'/compiler',step:'1',title:'Import project sources',description:'Upload PDF, CAD, BIM, imagery or 3D sources. Review only the exceptions STRATUM cannot safely resolve.',action:'Import & review'},
 {href:'/spatial',step:'2',title:'Review Spatial & assets',description:'Inspect the compiled model, link equipment to registered assets, and see activity, QR identity and DIR state on click.',action:'Open Spatial'},
 {href:'/scan',step:'3',title:'Update equipment in the field',description:'Scan the printed asset QR, confirm the equipment, then capture inspection or maintenance evidence.',action:'Scan asset'},
 {href:'/assets',step:'4',title:'Passport & DIR history',description:'Open an Asset Passport for lifecycle history, evidence, printable QR and finalized DIR details.',action:'Open passports'}
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