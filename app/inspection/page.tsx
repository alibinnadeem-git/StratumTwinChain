import {Suspense} from 'react';
import InspectionSession from '@/components/InspectionSession';

export default function InspectionPage(){return <>
 <div className="page-head"><div><div className="eyebrow">Field</div><h1 className="title">Inspect equipment.</h1><p className="subtitle">Four required steps: confirm location, pass the checklist, record measurements and attach evidence.</p></div><div className="badge">4 STEPS</div></div>
 <Suspense fallback={<div className="card">Loading inspection…</div>}><InspectionSession/></Suspense>
 </>}
