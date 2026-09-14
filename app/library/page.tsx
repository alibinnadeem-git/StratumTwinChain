import Link from 'next/link';

const sections=[
 {
  title:'Spatial & engineering',
  description:'Build, inspect and reconcile the spatial model.',
  links:[
   ['/spatial','Spatial workspace','Inspect the governed spatial representation and infrastructure layers.'],
   ['/compiler','Spatial Compiler','Import engineering sources and compile traceable spatial output.'],
   ['/component-library','Component Library','Browse canonical equipment classes and spatial asset models.'],
   ['/reality','Reality Capture','Reconcile field capture and model state.']
  ]
 },
 {
  title:'Infrastructure records',
  description:'Find the canonical project, site and asset records behind the model.',
  links:[
   ['/projects','Projects','Manage project context and delivery scope.'],
   ['/assets','Assets','Open asset identities, passports and lifecycle records.']
  ]
 },
 {
  title:'Evidence & trust',
  description:'Understand why a record is trusted without forcing protocol detail into normal workflows.',
  links:[
   ['/evidence','Evidence','Review source evidence and controlled file records.'],
   ['/provenance','Provenance','Trace source, evidence, approvals and trust history.'],
   ['/dir','DIR Explorer','Inspect Digital Immutable Records and finality evidence.'],
   ['/handover','Handover','Review explainable turnover readiness and closeout.']
  ]
 },
 {
  title:'Operations & administration',
  description:'Specialist tools remain available without crowding the primary navigation.',
  links:[
   ['/maintenance','Maintenance','Plan and review lifecycle maintenance work.'],
   ['/predictive','Predictive Intelligence','Review governed predictive and reliability insights.'],
   ['/simulation','Simulation','Explore bounded infrastructure scenarios.'],
   ['/admin','Administration','Manage access, roles and platform administration.']
  ]
 }
];

export default function Library(){
 return <>
  <div className="page-head">
   <div>
    <div className="eyebrow">Library</div>
    <h1 className="title">Specialist tools, one understandable place.</h1>
    <p className="subtitle">Primary navigation stays focused on Home, Sites, Work, Verify and Library. Engineering, evidence, trust and administrative tools remain available here without becoming separate top-level products.</p>
   </div>
  </div>
  <div className="grid two">
   {sections.map(section=><section className="card" key={section.title}>
    <div className="section-head"><div><div className="eyebrow">{section.title}</div><p className="muted">{section.description}</p></div></div>
    <div className="timeline">
     {section.links.map(([href,label,description])=><Link href={href} className="event" key={href}>
      <i className="event-icon info">→</i>
      <div><strong>{label}</strong><small>{description}</small></div>
     </Link>)}
    </div>
   </section>)}
  </div>
 </>;
}
