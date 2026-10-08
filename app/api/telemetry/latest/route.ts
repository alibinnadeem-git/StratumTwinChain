import {NextResponse} from 'next/server';
import {requireSession} from '@/lib/server/auth';
import {latestTelemetry,TELEMETRY_TRUTH_BOUNDARY} from '@/lib/server/telemetry';

function status(error:unknown,fallback=500){
 return typeof error==='object'&&error&&'status' in error?Number((error as {status?:number}).status)||fallback:fallback;
}

export async function GET(req:Request){
 try{
  const session=await requireSession();
  const assetId=new URL(req.url).searchParams.get('assetId')||'';
  if(!/^[0-9a-f-]{36}$/i.test(assetId))return NextResponse.json({error:'A valid assetId is required'},{status:400});
  const readings=await latestTelemetry(session.organizationId,assetId);
  return NextResponse.json({assetId,readings,truthBoundary:TELEMETRY_TRUTH_BOUNDARY},{headers:{'cache-control':'private, no-store'}});
 }catch(error:any){
  return NextResponse.json({error:error.message},{status:status(error),headers:{'cache-control':'private, no-store'}});
 }
}
