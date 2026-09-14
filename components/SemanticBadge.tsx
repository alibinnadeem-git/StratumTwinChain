import {getSemanticState} from '@/lib/ui/semantic-state';
import type {SemanticDomain} from '@/lib/ui/semantic-state';

export default function SemanticBadge(props:{domain:SemanticDomain;state:string;label?:string}){
 const definition=getSemanticState(props.domain,props.state);
 return <span className={'semantic-badge semantic-tone-'+definition.tone} data-semantic-domain={props.domain} data-semantic-state={props.state}>{props.label||definition.label}</span>;
}
