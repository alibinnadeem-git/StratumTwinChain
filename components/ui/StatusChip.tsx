import SemanticBadge from '@/components/SemanticBadge';
import type {SemanticDomain} from '@/lib/ui/semantic-state';

export default function StatusChip({domain,state,label}:{domain:SemanticDomain;state:string;label?:string}){
 return <SemanticBadge domain={domain} state={state} label={label}/>;
}
