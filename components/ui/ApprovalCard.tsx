import SemanticBadge from '@/components/SemanticBadge';

export type ApprovalState='APPROVED'|'PENDING'|'REJECTED'|'NOT_REQUIRED';

export default function ApprovalCard({title,authority,state,detail}:{title:string;authority:string;state:ApprovalState;detail?:string}){
 return <article className="shared-approval-card">
  <div><div className="eyebrow">Approval</div><h3>{title}</h3><p>{detail||'Independent authority state for this controlled transition.'}</p><small>{authority}</small></div>
  <SemanticBadge domain="approval" state={state}/>
 </article>;
}
