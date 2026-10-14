import {NextResponse} from 'next/server';
import {requireSession} from '@/lib/server/auth';
import {requireExportAuthority} from '@/lib/spatial-authority-io';
import {assertRealWritePayload} from '@/lib/spatial-provenance';
export async function POST(req:Request){
 try{
  await requireSession(['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER','INSPECTOR']);
  const payload=await req.json();assertRealWritePayload(payload);
  requireExportAuthority(payload?.graph);
  // No authoritative exporter is yet implemented: never silently serialize the unapproved graph.
  return NextResponse.json({error:'Authoritative exports require a separately certified release'},{status:501});
 }catch(e:any){return NextResponse.json({error:e.message},{status:e.status||400})}
}
