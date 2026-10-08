import {NextResponse} from 'next/server';
import {ZodError} from 'zod';
import {requireSession} from '@/lib/server/auth';
import {ingestTelemetry,TelemetryIngestSchema,TELEMETRY_TRUTH_BOUNDARY} from '@/lib/server/telemetry';

function status(error:unknown,fallback=400){
 return typeof error==='object'&&error&&'status' in error?Number((error as {status?:number}).status)||fallback:fallback;
}

export async function POST(req:Request){
 try{
  const session=await requireSession(['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER','TECHNICIAN']);
  const body=TelemetryIngestSchema.parse(await req.json());
  const reading=await ingestTelemetry(session.organizationId,body);
  return NextResponse.json({
   reading,
   truthBoundary:TELEMETRY_TRUTH_BOUNDARY,
  },{status:201,headers:{'cache-control':'private, no-store'}});
 }catch(error:any){
  if(error instanceof ZodError)return NextResponse.json({error:'Invalid telemetry payload',issues:error.issues},{status:400});
  return NextResponse.json({error:error.message},{status:status(error,500),headers:{'cache-control':'private, no-store'}});
 }
}
