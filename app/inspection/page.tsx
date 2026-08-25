import {Suspense} from 'react';
import InspectionSession from '@/components/InspectionSession';

export default function InspectionPage(){return <><div className="page-head"><div><div className="eyebrow">STRATUM Verified Field</div><h1 className="title">Inspection & commissioning session</h1><p className="subtitle">A gated field workflow for asset identity, location confirmation, measurements, evidence, technician attribution, supervisor review and creation of a Digital Immutable Record (DIR) candidate.</p></div><div className="badge">FIELD · DIR READY</div></div><Suspense fallback={<div className="card">Loading inspection session…</div>}><InspectionSession/></Suspense></>}
