import SemanticBadge from '@/components/SemanticBadge';

export type EvidenceCardRecord={id:string;name:string;assetId:string;kind:string;hash:string;privacy:string;status:string;block?:number|string|null};

export default function EvidenceCard({evidence}:{evidence:EvidenceCardRecord}){
 const verified=evidence.status.toLowerCase()==='verified';
 const privacyState=['PUBLIC','INTERNAL','RESTRICTED','PRIVATE'].includes(evidence.privacy.toUpperCase())?evidence.privacy.toUpperCase():'INTERNAL';
 return <article className="shared-evidence-card" data-evidence-id={evidence.id}>
  <header><div><div className="eyebrow">{evidence.kind}</div><h3>{evidence.name}</h3><small>{evidence.id} · {evidence.assetId}</small></div><SemanticBadge domain="privacy" state={privacyState}/></header>
  <div className="shared-evidence-hash"><span>SHA-256</span><code>{evidence.hash}</code></div>
  <footer><SemanticBadge domain="trust" state={verified?'POVI_VERIFIED':'UNVERIFIED'} label={verified?`DIR ${evidence.block??'verified'}`:'Pending verification'}/></footer>
 </article>;
}
