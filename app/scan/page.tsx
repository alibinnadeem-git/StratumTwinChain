import FieldScanner from '@/components/FieldScanner';

export default function ScanPage(){return <>
 <div className="page-head"><div><div className="eyebrow">Field</div><h1 className="title">Scan equipment.</h1><p className="subtitle">Scan a QR or enter an asset code. Once STRATUM resolves the asset, continue directly into its Passport or inspection.</p></div><div className="badge">IDENTITY FIRST</div></div>

 <section className="card field-primary"><FieldScanner/></section>

 <details className="secondary-details card">
  <summary>Field trust details</summary>
  <p className="muted">A scan resolves identity only. It does not approve installation, validate evidence, finalize a DIR, establish PoVI finality, or prove physical truth.</p>
 </details>
 </>}

