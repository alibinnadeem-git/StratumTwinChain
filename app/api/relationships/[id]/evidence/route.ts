import {NextResponse} from 'next/server';
import {ZodError} from 'zod';
import {requireSession} from '@/lib/server/auth';
import {appendRelationshipEvidence} from '@/lib/server/relationship-graph';

export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const session=await requireSession(['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER','INSPECTOR','TECHNICIAN']);
  const {id}=await params;
  const result=await appendRelationshipEvidence(session.organizationId,session.userId,id,await req.json());
  return NextResponse.json(result,{status:result.evidence?.idempotent?200:201,headers:{'cache-control':'private, no-store'}});
 }catch(error:any){
  if(error instanceof ZodError)return NextResponse.json({error:'Invalid relationship evidence payload',issues:error.issues},{status:400});
  return NextResponse.json({error:error?.message||'Unable to append relationship evidence'},{status:error?.status||500});
 }
}
