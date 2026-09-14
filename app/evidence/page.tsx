import EvidenceCard from '@/components/ui/EvidenceCard';
import EvidenceUpload from '@/components/EvidenceUpload';
import {evidence} from '@/lib/data';

export default function Evidence(){
 return <>
  <div className="page-head"><div><div className="eyebrow">Evidence Vault</div><h1 className="title">Private files. Publicly verifiable fingerprints.</h1><p className="subtitle">Evidence stays in controlled storage. SHA-256 fingerprints and minimal proof metadata can become part of Digital Immutable Records (DIR) without exposing private source files.</p></div><a className="action" href="#upload-evidence">+ Upload evidence</a></div>
  <div className="card notice"><strong>Privacy by design</strong><span>Original customer files are never exposed through DIR. Cryptographic fingerprints prove integrity while the underlying files remain in permission-controlled storage.</span></div>
  <div className="shared-evidence-grid">{evidence.map(item=><EvidenceCard key={item.id} evidence={item}/>)}</div>
  <div style={{marginTop:16}}><EvidenceUpload/></div>
 </>;
}
