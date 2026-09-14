import FieldScanner from '@/components/FieldScanner';

export default function CapturePage(){
 return <>
  <div className="page-head">
   <div>
    <div className="eyebrow">STRATUM Verified Field</div>
    <h1 className="title">Capture evidence</h1>
    <p className="subtitle">Identify the equipment first, then continue into the existing inspection session so evidence stays attached to the correct asset and controlled DIR candidate workflow.</p>
   </div>
   <div className="badge">FIELD · CAPTURE</div>
  </div>
  <FieldScanner mode="standalone" intent="capture"/>
 </>;
}
