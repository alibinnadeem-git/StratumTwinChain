import SemanticBadge from '@/components/SemanticBadge';
import type {TrustState} from '@/lib/redbook/terminology';

export default function TrustBadge({state}:{state:TrustState}){
 return <SemanticBadge domain="trust" state={state}/>;
}
