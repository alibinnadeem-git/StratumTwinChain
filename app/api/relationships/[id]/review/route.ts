import {NextResponse} from 'next/server';
import {ZodError} from 'zod';
import {requireSession} from '@/lib/server/auth';
import {reviewRelationship} from '@/lib/server/relationship-graph';

export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const session=await requireSession(['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER','INSPECTOR']);
  const {id}=await params;
  const result=await reviewRelationship(session.organizationId,session.userId,id,await req.json());
  return NextResponse.json(result,{headers:{'cache-control':'private, no-store'}});
 }catch(error:any){
  if(error instanceof ZodError)return NextResponse.json({error:'Invalid relationship review payload',issues:error.issues},{status:400});
  return NextResponse.json({error:error?.message||'Unable to review relationship'},{status:error?.status||500});
 }
}
