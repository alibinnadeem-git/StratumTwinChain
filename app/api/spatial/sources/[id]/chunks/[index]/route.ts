import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireSession} from '@/lib/server/auth';
import {query} from '@/lib/server/db';

export async function GET(_:Request,{params}:{params:Promise<{id:string;index:string}>}){
 try{
  const session=await requireSession();
  const {id,index}=await params;
  if(!z.string().uuid().safeParse(id).success)return NextResponse.json({error:'Invalid source id'},{status:400});
  const chunkIndex=Number(index);
  if(!Number.isInteger(chunkIndex)||chunkIndex<0)return NextResponse.json({error:'Invalid chunk index'},{status:400});
  const result=await query<any>(`SELECT
      s.sha256 source_sha256,s.mime_type,c.chunk_sha256,c.byte_size,c.content
    FROM spatial_project_sources s
    JOIN spatial_project_source_verifications v ON v.source_id=s.id
    JOIN spatial_project_source_chunks c ON c.source_id=s.id AND c.chunk_index=$3
    WHERE s.id=$1 AND s.organization_id=$2
    LIMIT 1`,[id,session.organizationId,chunkIndex]);
  const row=result.rows[0];
  if(!row)return NextResponse.json({error:'Verified source chunk not found'},{status:404});
  return new Response(new Uint8Array(row.content),{
   headers:{
    'content-type':'application/octet-stream',
    'content-length':String(row.byte_size),
    'x-stratum-chunk-sha256':String(row.chunk_sha256),
    'x-stratum-source-sha256':String(row.source_sha256),
    'cache-control':'private, no-store',
   }
  });
 }catch(error:any){
  return NextResponse.json({error:error.message},{status:error.status||500});
 }
}
