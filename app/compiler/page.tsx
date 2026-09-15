import Link from 'next/link';
import CompilerWorkspace from '@/components/CompilerWorkspace';
import RoomReconstructionReview from '@/components/RoomReconstructionReview';
import TitleBlockIntelligence from '@/components/TitleBlockIntelligence';
import AutoSheetAlignmentReview from '@/components/AutoSheetAlignmentReview';
import SpatialCompilationPersistence from '@/components/SpatialCompilationPersistence';
import SpatialProjectionEngine from '@/components/SpatialProjectionEngine';

export default function CompilerPage(){return <>
  <SpatialProjectionEngine/>
  <div className="page-head"><div><div className="eyebrow">STRATUM Spatial Compiler</div><h1 className="title">Import. Review exceptions. Open Spatial.</h1><h2 className="subtitle" style={{fontSize:16,margin:'6px 0'}}>Engineering sources in. Traceable Spatial model out.</h2><p className="subtitle">Drop the drawing set once. STRATUM extracts source-grounded geometry and electrical objects, proposes rooms, Z placement and SLD hierarchy, then asks for human review only where authority is missing.</p></div><Link className="action" href="/spatial">Open Spatial viewer</Link></div>

  <div className="grid three" style={{marginBottom:16}}>
   <div className="card"><div className="eyebrow">1 · Import</div><strong>CAD · PDF · BIM · imagery</strong><p className="muted">Original source fingerprint and extraction provenance are preserved.</p></div>
   <div className="card"><div className="eyebrow">2 · Review</div><strong>Only uncertain geometry or identity</strong><p className="muted">Room boundaries, title blocks, alignment and inferred Z stay reviewable.</p></div>
   <div className="card"><div className="eyebrow">3 · View</div><strong>Model · Electrical · Review</strong><p className="muted">Physical Z and logical SLD Z stay visibly distinct.</p></div>
  </div>

  <CompilerWorkspace/>

  <details className="card" style={{marginTop:16}}>
   <summary style={{cursor:'pointer',fontWeight:700}}>Review drawing intelligence and alignment</summary>
   <p className="muted">Open this only when STRATUM flags uncertainty. Automatic proposals never become Verified state by themselves.</p>
   <RoomReconstructionReview/>
   <TitleBlockIntelligence/>
   <AutoSheetAlignmentReview/>
  </details>

  <details className="card" style={{marginTop:16}}>
   <summary style={{cursor:'pointer',fontWeight:700}}>Save or load a reviewed compiler snapshot</summary>
   <p className="muted">Server persistence is append-only review storage. Saving or accepting a snapshot does not create STRATUM Assets, DIR finality or physical truth.</p>
   <SpatialCompilationPersistence/>
  </details>
</>}
