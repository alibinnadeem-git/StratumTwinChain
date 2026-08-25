import CompilerWorkspace from '@/components/CompilerWorkspace';

export default function CompilerPage(){return <>
  <div className="page-head"><div><div className="eyebrow">STRATUM Twin Compiler</div><h1 className="title">Engineering documents in. Verifiable twin out.</h1><p className="subtitle">Ingest complete drawing sets and engineering sources, fingerprint originals, classify disciplines, build cross-sheet relationships, surface confidence exceptions, and compile the validated project graph that drives STRATUM Twin.</p></div><div className="badge">L0 SOURCE → L4 ASSETS</div></div>
  <CompilerWorkspace/>
  <div className="card" style={{marginTop:16}}><div className="eyebrow">Layer output</div><div className="provenance-map"><div className="prov-step active"><i>L0</i><b>Source</b><span>CAD · PDF · BIM · imagery</span></div><em>→</em><div className="prov-step active"><i>L1</i><b>Architectural</b><span>Rooms · walls · doors · levels</span></div><em>→</em><div className="prov-step active"><i>L2</i><b>Electrical Physical</b><span>Panels · transformers · devices</span></div><em>→</em><div className="prov-step active"><i>L3</i><b>Electrical Logical</b><span>Feeders · circuits · dependencies</span></div><em>→</em><div className="prov-step active"><i>L4</i><b>STRATUM Assets</b><span>Durable tracked identities</span></div></div></div>
</>}
