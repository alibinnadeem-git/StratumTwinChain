import Link from 'next/link';

const layers=[
 ['L0','Source','Original engineering-source identity and retained source evidence.'],
 ['L1','Architectural','Rooms, walls, boundaries, source drawing geometry and review surfaces.'],
 ['L2','Electrical Physical','Physical electrical/equipment candidates extracted from sources.'],
 ['L3','Electrical Logical','Electrical topology, feeders, circuits and logical relationships.'],
 ['L4','STRATUM Assets','Project asset candidates/registered asset context; registration and verification remain separate states.'],
] as const;

export default function DocsPage(){
 return <>
  <div className="page-head">
   <div><div className="eyebrow">Product guide</div><h1 className="title">How STRATUM reasons about trust.</h1><p className="subtitle">A compact glossary and review tour for Spatial, elevation, electrical topology, DIR and PoVI. The product should expose uncertainty rather than make it disappear.</p></div>
   <div className="button-row"><Link className="action" href="/import">Import</Link><Link className="ghost" href="/spatial">Spatial</Link></div>
  </div>

  <section className="card">
   <div className="eyebrow">Trust vocabulary</div>
   <div className="grid two" style={{marginTop:10}}>
    <div className="card" style={{padding:14}}><strong>PoVI · Proof of Verified Infrastructure</strong><p className="muted">STRATUM's consensus target. PoVI finality concerns the trust/finality of governed records; the interface does not equate finality with physical truth by itself.</p></div>
    <div className="card" style={{padding:14}}><strong>DIR · Digital Immutable Record</strong><p className="muted">The canonical record term in STRATUM. The record hierarchy also includes Nano DIR and Micro DIR. DIR finality and physical verification are deliberately shown as separate concepts.</p></div>
    <div className="card" style={{padding:14}}><strong>HITL · Human-in-the-loop</strong><p className="muted">Governed human review of automated proposals. Parsed or inferred geometry, scale, Z and identity remain candidates until the relevant review/verification boundary is satisfied.</p></div>
    <div className="card" style={{padding:14}}><strong>Physical truth</strong><p className="muted">A source drawing, model visualization, approved design chain or finalized record is not automatically proof of installed/as-built condition. STRATUM keeps those authorities separate.</p></div>
   </div>
  </section>

  <section className="card" style={{marginTop:16}}>
   <div className="section-head"><div><div className="eyebrow">Spatial provenance</div><h2>L0–L4 layers</h2></div></div>
   <div className="provenance-map">{layers.map(([code,name,description],index)=><span key={code} style={{display:'contents'}}><div className="prov-step active"><i>{code}</i><b>{name}</b><span>{description}</span></div>{index<layers.length-1&&<em>→</em>}</span>)}</div>
  </section>

  <section id="z-method" className="card" style={{marginTop:16}}>
   <div className="eyebrow">Elevation / Z methodology</div><h2>From source datum to review placement.</h2>
   <div className="grid two">
    <div className="card" style={{padding:14}}><strong>1 · Detect source controls</strong><p className="muted">FFE/FF and finished-floor labels are floor-datum evidence. FG/grade and FS/finished-surface labels are grade/surface controls. Top-of-curb and flowline evidence may be retained without automatically becoming triangulation controls.</p></div>
    <div className="card" style={{padding:14}}><strong>2 · Build a review surface</strong><p className="muted">Suitable positioned controls can support a local triangulated review surface. Cross-sheet use requires reviewed alignment. Structural top/bottom elevations are not silently treated as terrain vertices.</p></div>
    <div className="card" style={{padding:14}}><strong>3 · Resolve object reference</strong><p className="muted">Object-linked AFF or mounting height needs a reference point such as base, bottom, centerline, top or mounting point. Without that semantic, STRATUM keeps the height relative/unresolved.</p></div>
    <div className="card" style={{padding:14}}><strong>4 · Reconcile independent chains</strong><p className="muted">Source Z, support-surface + offset, floor datum + AFF and other defensible chains are compared. Conflicts fail closed. Human review can choose a design chain for review placement without asserting field-verified Z.</p></div>
   </div>
   <div className="notice" style={{marginTop:12}}><strong>XY IS A SCALE GUIDE, NOT A Z DATUM</strong><span>Validated X/Y units can keep vertical source-unit conversion consistent, but X/Y scale alone cannot establish where zero/elevation is in the physical project.</span></div>
   <div className="button-row" style={{marginTop:12}}><Link className="action" href="/spatial#z-resolution-review">Open Z resolution</Link><Link className="ghost" href="/import#z-review">Review elevation sources</Link></div>
  </section>

  <section id="sld-example" className="card" style={{marginTop:16}}>
   <div className="section-head"><div><div className="eyebrow">Bundled reference example · Not project data</div><h2>Electrical / SLD story</h2></div><span className="pending">REFERENCE ONLY</span></div>
   <p className="muted">This example demonstrates the logical hierarchy STRATUM expects from a one-line. It is never injected into a project and never contributes to project counts.</p>
   <div className="workflow-steps">
    {[
     ['1','Utility / service','Source'],
     ['2','Transformer','Voltage transformation'],
     ['3','Main switchboard','Primary distribution'],
     ['4','Panel / feeder','Downstream distribution'],
     ['5','Load / equipment','Connected endpoint'],
    ].map(([n,title,detail])=><div className="workflow-step done" key={n}><i>{n}</i><div><strong>{title}</strong><span>{detail}</span></div></div>)}
   </div>
   <div className="notice" style={{marginTop:12}}><strong>SLD Z IS LOGICAL</strong><span>Vertical separation in Electrical mode can express logical hierarchy. It is not an as-built physical elevation unless independent design/field evidence establishes Z.</span></div>
   <div className="button-row" style={{marginTop:12}}><Link className="action" href="/import">Import an SLD</Link><Link className="ghost" href="/spatial">Return to Spatial</Link></div>
  </section>
 </>;
}
