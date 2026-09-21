import Link from 'next/link';

const tasks=[
 {href:'/compiler',step:'1',title:'Import project sources',description:'Upload PDF, CAD, BIM, imagery or 3D sources. STRATUM surfaces exceptions instead of forcing you through every technical control.',action:'Import'},
 {href:'/spatial',step:'2',title:'Review Spatial',description:'Inspect the project model, click equipment, link registered assets and see trust state without leaving the Spatial workspace.',action:'Open Spatial'},
 {href:'/scan',step:'3',title:'Update in the field',description:'Scan the asset QR, confirm identity, then capture inspection, maintenance or repair evidence from the equipment.',action:'Open field mode'},
 {href:'/dir',step:'4',title:'Review DIR & history',description:'See what has evidence, what still needs approval, and which lifecycle records reached PoVI finality. Asset Passports stay one click away.',action:'Open DIR'}
] as const;

export default function TaskLauncher(){
 return <section className="task-launcher" aria-labelledby="task-launcher-title">
  <div className="task-launcher-head">
   <div><div className="eyebrow">Start here</div><h2 id="task-launcher-title">What are you doing now?</h2></div>
   <p>Pick one task. Detailed engineering, trust and administration controls remain available under More tools.</p>
  </div>
  <div className="task-grid">{tasks.map(task=><Link className="task-card" href={task.href} key={task.href}>
   <span className="task-step">{task.step}</span>
   <div><h3>{task.title}</h3><p>{task.description}</p><strong>{task.action} →</strong></div>
  </Link>)}</div>
 </section>;
}
