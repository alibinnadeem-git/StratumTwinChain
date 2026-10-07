import {requireSession} from '@/lib/server/auth';
import {latestTelemetry,telemetrySince,TELEMETRY_TRUTH_BOUNDARY} from '@/lib/server/telemetry';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 const session=await requireSession();
 const assetId=new URL(req.url).searchParams.get('assetId')||'';
 if(!/^[0-9a-f-]{36}$/i.test(assetId))return new Response(JSON.stringify({error:'A valid assetId is required'}),{status:400,headers:{'content-type':'application/json'}});

 const encoder=new TextEncoder();
 const stream=new ReadableStream<Uint8Array>({
  async start(controller){
   let closed=false;
   const close=()=>{if(!closed){closed=true;try{controller.close()}catch{}}};
   req.signal.addEventListener('abort',close,{once:true});
   try{
    const snapshot=await latestTelemetry(session.organizationId,assetId);
    controller.enqueue(encoder.encode(`event: snapshot\ndata: ${JSON.stringify({assetId,readings:snapshot,truthBoundary:TELEMETRY_TRUTH_BOUNDARY})}\n\n`));
    let cursor=new Date().toISOString();
    const deadline=Date.now()+25_000;
    while(!closed&&Date.now()<deadline){
     await new Promise(resolve=>setTimeout(resolve,1500));
     if(closed)break;
     const rows=await telemetrySince(session.organizationId,assetId,cursor);
     if(rows.length){
      cursor=new Date(rows[rows.length-1].received_at).toISOString();
      for(const reading of rows)controller.enqueue(encoder.encode(`event: reading\ndata: ${JSON.stringify(reading)}\n\n`));
     }else{
      controller.enqueue(encoder.encode(': keepalive\n\n'));
     }
    }
   }catch(error){
    if(!closed)controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({error:error instanceof Error?error.message:'Telemetry stream failed'})}\n\n`));
   }finally{close()}
  },
  cancel(){/* Request abort closes the loop. */}
 });
 return new Response(stream,{
  headers:{
   'content-type':'text/event-stream; charset=utf-8',
   'cache-control':'private, no-cache, no-transform',
   'connection':'keep-alive',
   'x-accel-buffering':'no',
  }
 });
}
