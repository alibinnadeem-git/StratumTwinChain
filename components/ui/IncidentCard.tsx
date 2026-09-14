import StatusChip from '@/components/ui/StatusChip';

export type IncidentSeverity='ADVISORY'|'WARNING'|'CRITICAL';

export default function IncidentCard({title,asset,location,severity,status='ACTIVE',summary}:{title:string;asset?:string;location?:string;severity:IncidentSeverity;status?:'ACTIVE'|'INACTIVE';summary:string}){
 return <article className="shared-incident-card">
  <header><div><div className="eyebrow">Incident</div><h3>{title}</h3><small>{[asset,location].filter(Boolean).join(' · ')||'Infrastructure scope pending'}</small></div><StatusChip domain="hazard" state={severity}/></header>
  <p>{summary}</p>
  <footer><StatusChip domain="operation" state={status} label={status==='ACTIVE'?'Open':'Closed'}/></footer>
 </article>;
}
