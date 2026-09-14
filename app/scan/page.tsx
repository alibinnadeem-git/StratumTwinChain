import FieldScanner from '@/components/FieldScanner';

export default function ScanPage(){
 return <>
  <div className="page-head">
   <div>
    <div className="eyebrow">STRATUM Verified Field</div>
    <h1 className="title">Scan equipment</h1>
    <p className="subtitle">Identify an installed asset by QR code, barcode, asset code or serial number, then continue into the controlled inspection workflow.</p>
   </div>
   <div className="badge">FIELD · IDENTIFY</div>
  </div>
  <FieldScanner mode="standalone" intent="inspection"/>
 </>;
}
