import CompilerWorkspace from '@/components/CompilerWorkspace';
import TitleBlockIntelligence from '@/components/TitleBlockIntelligence';
import AutoSheetAlignmentReview from '@/components/AutoSheetAlignmentReview';
import SpatialCompilationPersistence from '@/components/SpatialCompilationPersistence';

export default function CompilerPage(){return <>
  <div className="page-head"><div><div className="eyebrow">STRATUM Spatial Compiler</div><h1 className="title">Engineering sources in. Traceable Spatial model out.</h1><p className="subtitle">Ingest drawing sets and engineering sources, fingerprint originals, classify disciplines, preserve revisions and source transforms, build cross-document relationships, surface confidence exceptions, and compile the reviewed project graph that drives STRATUM Spatial Verified. Inference remains inference until reviewed.</p></div><div className="badge">SOURCE → SPATIAL → ASSET</div></div>
  <CompilerWorkspace/>
  <TitleBlockIntelligence/>
  <AutoSheetAlignmentReview/>
  <SpatialCompilationPersistence/>
  <div className="card" style={{marginTop:16}}><div className="eyebrow">Current compiler output</div><div className="provenance-map"><div className="prov-step active"><i>L0</i><b>Source</b><span>CAD · PDF · BIM · imagery</span></div><em>→</em><div className="prov-step active"><i>L1</i><b>Architectural</b><span>Rooms · walls · doors · levels</span></div><em>→</em><div className="prov-step active"><i>L2</i><b>Electrical Physical</b><span>Panels · transformers · devices</span></div><em>→</em><div className="prov-step active"><i>L3</i><b>Electrical Logical</b><span>Feeders · circuits · dependencies</span></div><em>→</em><div className="prov-step active"><i>L4</i><b>STRATUM Assets</b><span>Durable canonical identities</span></div></div><p className="muted" style={{marginBottom:0}}>L4 compiler candidates remain source-derived review objects until an authorized downstream asset workflow establishes durable STRATUM Asset identity. Spatial review acceptance does not perform that promotion.</p></div>
</>}
