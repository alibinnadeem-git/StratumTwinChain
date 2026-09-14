import ApprovalCard from '@/components/ui/ApprovalCard';
import WorkStepper,{type WorkStep} from '@/components/ui/WorkStepper';
import FieldScanner from '@/components/FieldScanner';

export default function Workflows(){
 const labels=['Identify asset','Scan serial / QR','Confirm site & location','Capture installation evidence','Run inspection checklist','Record measurements','Technician signature','Supervisor / inspector approval','Canonicalize evidence package','Finalize Digital Immutable Record (DIR)'];
 const steps:WorkStep[]=labels.map((label,index)=>({label,state:index<4?'COMPLETE':index===4?'CURRENT':'LOCKED',detail:index<4?'Complete':index===4?'Inspection is the active controlled step':'Locked until prior controlled step'}));
 return <>
  <div className="eyebrow">Field Workflow</div>
  <h1 className="title">Install & commission</h1>
  <p className="subtitle">A controlled verification workflow separates work performed from independent approval before a record becomes immutable.</p>
  <div className="grid workflow-layout">
   <div className="grid" style={{gap:16}}>
    <div className="card"><WorkStepper steps={steps}/></div>
    <ApprovalCard title="Supervisor / inspector acceptance" authority="Independent approver required before evidence canonicalization" state="PENDING" detail="Completion of field work does not grant approval. The designated authority must independently accept the controlled transition."/>
   </div>
   <div className="card mobile-preview"><FieldScanner/></div>
  </div>
 </>;
}
