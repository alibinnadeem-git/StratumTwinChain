import {Suspense} from 'react';
import LegacySpatialRecoveryBridge from '@/components/LegacySpatialRecoveryBridge';

export default function RecoveryBridgePage(){
 return <Suspense fallback={<div className="bridge-page"><section className="card bridge-card">Preparing Spatial recovery…</section></div>}><LegacySpatialRecoveryBridge/></Suspense>;
}
