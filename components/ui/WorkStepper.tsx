import SemanticBadge from '@/components/SemanticBadge';

export type WorkStepState='COMPLETE'|'CURRENT'|'LOCKED';
export type WorkStep={label:string;state:WorkStepState;detail?:string};

export default function WorkStepper({steps}:{steps:WorkStep[]}){
 return <div className="shared-work-stepper" aria-label="Work progress">
  {steps.map((step,index)=>{
   const semantic=step.state==='COMPLETE'?{domain:'approval' as const,state:'APPROVED'}:step.state==='CURRENT'?{domain:'operation' as const,state:'ACTIVE'}:{domain:'operation' as const,state:'INACTIVE'};
   return <div className={`shared-work-step shared-work-step-${step.state.toLowerCase()}`} key={`${index}-${step.label}`}>
    <div className="shared-work-index" aria-hidden="true">{step.state==='COMPLETE'?'✓':index+1}</div>
    <div className="shared-work-copy"><strong>{step.label}</strong><span>{step.detail||step.state.toLowerCase()}</span></div>
    <SemanticBadge domain={semantic.domain} state={semantic.state} label={step.state==='CURRENT'?'In progress':step.state==='LOCKED'?'Locked':'Complete'}/>
   </div>;
  })}
 </div>;
}
