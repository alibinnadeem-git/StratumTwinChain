import type {TrustState} from '@/lib/redbook/terminology';

const labels:Record<TrustState,string>={
 POVI_VERIFIED:'PoVI Verified',
 FIELD_VERIFIED:'Field Verified',
 SURVEYED:'Surveyed',
 SCANNED:'Scanned',
 OEM_VERIFIED:'OEM Verified',
 SOURCE_VERIFIED:'Source Verified',
 LIVE:'Live',
 STALE:'Stale',
 UNCERTAIN:'Uncertain',
 CONFLICTED:'Conflicted',
 INFERRED:'Inferred',
 PREDICTED:'Predicted',
 AI_GENERATED:'AI Generated',
 UNVERIFIED:'Unverified',
};

export default function TrustBadge({state}:{state:TrustState}){
 return <span className={`trust-badge trust-${state.toLowerCase().replaceAll('_','-')}`}>{labels[state]}</span>;
}
