import {NextResponse} from 'next/server';
import {requireSession} from '@/lib/server/auth';
import {requireMeasureAuthority} from '@/lib/spatial-authority-io';
import {assertRealWritePayload} from '@/lib/spatial-provenance';
export async function POST(req:Request){
 try{
  await requireSession();
  const payload=await req.json();assertRealWritePayload(payload);
  requireMeasureAuthority({
   twin:payload?.graph,sheet_transform_id:payload?.sheet_transform_id??null,
   transform:payload?.transform??null
  });
  // No measured physical result before separately certified measurement implementation.
  return NextResponse.json({error:'Physical measurement computation is not yet certified'},{status:501});
 }catch(e:any){return NextResponse.json({error:e.message},{status:e.status||400})}
}
