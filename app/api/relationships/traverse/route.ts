import {NextResponse} from 'next/server';
import {requireSession} from '@/lib/server/auth';
import {traceTrustedRelationships} from '@/lib/server/relationship-graph';

export async function GET(req:Request){
 try{
  const session=await requireSession();
  const url=new URL(req.url);
  const assetId=url.searchParams.get('assetId')||'';
  if(!/^[0-9a-f-]{36}$/i.test(assetId))return NextResponse.json({error:'A valid assetId is required'},{status:400});
  const rawDepth=Number(url.searchParams.get('depth')||8);
  if(!Number.isFinite(rawDepth))return NextResponse.json({error:'depth must be numeric'},{status:400});
  const result=await traceTrustedRelationships(session.organizationId,assetId,rawDepth);
  return NextResponse.json(result,{headers:{'cache-control':'private, no-store'}});
 }catch(error:any){
  return NextResponse.json({error:error?.message||'Unable to traverse relationships'},{status:error?.status||500});
 }
}
