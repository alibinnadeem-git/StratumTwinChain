import {NextResponse} from 'next/server';
import {ZodError} from 'zod';
import {requireSession} from '@/lib/server/auth';
import {createRelationshipCandidate,listAssetRelationships} from '@/lib/server/relationship-graph';

function responseError(error:any){
 if(error instanceof ZodError)return NextResponse.json({error:'Invalid relationship payload',issues:error.issues},{status:400});
 return NextResponse.json({error:error?.message||'Relationship request failed'},{status:error?.status||500});
}

export async function GET(req:Request){
 try{
  const session=await requireSession();
  const assetId=new URL(req.url).searchParams.get('assetId')||'';
  if(!/^[0-9a-f-]{36}$/i.test(assetId))return NextResponse.json({error:'A valid assetId is required'},{status:400});
  const items=await listAssetRelationships(session.organizationId,assetId);
  return NextResponse.json({
   assetId,
   items,
   trustedCount:items.filter(item=>item.trusted).length,
   truthBoundary:'RELATIONSHIP_LIST_INCLUDES_REVIEW_CANDIDATES_ONLY_VERIFIED_OR_MAINTAINED_EDGES_ARE_OPERATIONALLY_TRUSTED',
  },{headers:{'cache-control':'private, no-store'}});
 }catch(error){return responseError(error)}
}

export async function POST(req:Request){
 try{
  const session=await requireSession(['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER','INSPECTOR','TECHNICIAN']);
  const result=await createRelationshipCandidate(session.organizationId,session.userId,await req.json());
  return NextResponse.json(result,{status:result.idempotent?200:201,headers:{'cache-control':'private, no-store'}});
 }catch(error){return responseError(error)}
}
