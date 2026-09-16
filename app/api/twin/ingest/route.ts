import {NextResponse} from 'next/server';
import {requireSession} from '@/lib/server/auth';

const ALLOWED_ROLES=['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER'] as const;

/**
 * Legacy compatibility endpoint retained only to fail closed.
 *
 * Spatial compiler output is review material. It must not directly create durable
 * STRATUM Assets, lifecycle records, approvals, DIRs, PoVI votes/finality, or
 * establish physical truth. A future governed promotion workflow must validate
 * tenant/project/site authority and require explicit authorized human action.
 */
export async function POST(){
  try{
    await requireSession([...ALLOWED_ROLES]);
    return NextResponse.json({
      error:'Legacy Spatial ingest is disabled. Save and review the Spatial compilation instead.',
      code:'LEGACY_SPATIAL_INGEST_DISABLED',
      replacement:'/api/spatial/compilations',
      truthBoundary:'SPATIAL_REVIEW_DOES_NOT_CREATE_DURABLE_ASSETS_OR_ESTABLISH_VERIFIED_STATE_POVI_FINALITY_OR_PHYSICAL_TRUTH'
    },{status:410});
  }catch(error){
    const e=error as Error&{status?:number};
    return NextResponse.json({error:e.message||'Unauthorized'},{status:e.status||401});
  }
}
