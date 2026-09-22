import Link from 'next/link';
import AutoSheetAlignmentReview from '@/components/AutoSheetAlignmentReview';
import CompilerWorkspace from '@/components/CompilerWorkspace';
import RoomReconstructionReview from '@/components/RoomReconstructionReview';
import SpatialCompilationPersistence from '@/components/SpatialCompilationPersistence';
import SpatialProjectionEngine from '@/components/SpatialProjectionEngine';
import SpatialWorkspaceStatus from '@/components/SpatialWorkspaceStatus';
import TitleBlockIntelligence from '@/components/TitleBlockIntelligence';
import {readSession} from '@/lib/server/auth';

export default async function CompilerPage(){const session=await readSession();return <>
  <SpatialProjectionEngine/>

  <div className="page-head"><div><div className="eyebrow">Import</div><h1 className="title">Add project sources.</h1><p className="subtitle">Drop PDF, CAD, BIM, imagery or 3D files. STRATUM keeps the source-grounded result simple and only asks you to review uncertainty.</p></div><Link className="action" href="/spatial">Open Spatial</Link></div>

  <SpatialWorkspaceStatus compact authenticated={Boolean(session)}/>

  <CompilerWorkspace/>

  <details className="secondary-details card">
   <summary>Review exceptions</summary>
   <p className="muted">Open this only when STRATUM flags uncertain rooms, title blocks, alignment or elevation. Automatic proposals remain reviewable and never become Verified state by themselves.</p>
   <RoomReconstructionReview/>
   <TitleBlockIntelligence/>
   <AutoSheetAlignmentReview/>
  </details>

  <details className="secondary-details card">
   <summary>Server sync & review baseline</summary>
   <SpatialCompilationPersistence/>
  </details>
 </>}

