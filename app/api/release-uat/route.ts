const allowedStatuses=new Set(['pending','pass','fail']);

function safeCheck(value:any){
 const status=allowedStatuses.has(String(value?.status))?String(value.status):'fail';
 return{status,detail:String(value?.detail||'').slice(0,240)};
}

export async function POST(req:Request){
 try{
  const body=await req.json();
  const sessionId=String(body?.sessionId||'').slice(0,96);
  if(!sessionId)return Response.json({error:'sessionId required'},{status:400});
  const evidence={
   event:'STRATUM_RELEASE_UAT_EVIDENCE',
   sessionId,
   webgl:safeCheck(body?.webgl),
   qrDecoder:safeCheck(body?.qrDecoder),
   camera:safeCheck(body?.camera),
   timestamp:String(body?.timestamp||'').slice(0,64),
   screen:body?.screen&&typeof body.screen==='object'?{
    width:Number(body.screen.width)||0,height:Number(body.screen.height)||0,pixelRatio:Number(body.screen.pixelRatio)||0,
   }:null,
   viewport:body?.viewport&&typeof body.viewport==='object'?{
    width:Number(body.viewport.width)||0,height:Number(body.viewport.height)||0,
   }:null,
   touchPoints:Number(body?.touchPoints)||0,
   userAgent:String(req.headers.get('user-agent')||'').slice(0,300),
   release:process.env.VERCEL_GIT_COMMIT_SHA||'local',
  };
  console.info('STRATUM_RELEASE_UAT_EVIDENCE',JSON.stringify(evidence));
  return Response.json({accepted:true,sessionId,release:evidence.release,allPass:[evidence.webgl,evidence.qrDecoder,evidence.camera].every(check=>check.status==='pass')},{headers:{'cache-control':'no-store'}});
 }catch{
  return Response.json({error:'Invalid UAT evidence'},{status:400});
 }
}
