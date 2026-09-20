export const dynamic='force-dynamic';

function safeKeys(value:unknown){
 if(!value||typeof value!=='object')return[];
 const root=value as Record<string,unknown>;
 const list=Array.isArray(root.envs)?root.envs:Array.isArray(root.env)?root.env:Array.isArray(root.configurations)?root.configurations:[];
 return list.slice(0,50).map((item:any)=>({
  id:typeof item?.id==='string'?item.id:null,
  key:typeof item?.key==='string'?item.key:null,
  name:typeof item?.name==='string'?item.name:null,
  slug:typeof item?.slug==='string'?item.slug:null,
  type:typeof item?.type==='string'?item.type:null,
 })).filter((item:any)=>item.id||item.key||item.name||item.slug);
}

async function probe(url:string,token:string){
 try{
  const response=await fetch(url,{headers:{authorization:`Bearer ${token}`,accept:'application/json'},cache:'no-store'});
  const contentType=response.headers.get('content-type')||'';
  let body:unknown=null;
  if(contentType.includes('application/json'))body=await response.json().catch(()=>null);
  return{status:response.status,ok:response.ok,metadata:safeKeys(body)};
 }catch(error){
  return{status:0,ok:false,error:error instanceof Error?error.message:'probe failed',metadata:[]};
 }
}

export async function GET(){
 if(process.env.VERCEL_ENV==='production')return Response.json({error:'Not found'},{status:404});
 const token=process.env.VERCEL_OIDC_TOKEN||'';
 const projectId=process.env.VERCEL_PROJECT_ID||'';
 const teamId=process.env.VERCEL_ORG_ID||'';
 if(!token||!projectId||!teamId)return Response.json({
  oidcPresent:Boolean(token),projectIdPresent:Boolean(projectId),teamIdPresent:Boolean(teamId),
  truthBoundary:'CAPABILITY_PROBE_EXPOSES_NO_CREDENTIAL_MATERIAL',
 });
 const team=encodeURIComponent(teamId),project=encodeURIComponent(projectId);
 const [projectRead,environmentRead,integrationRead]=await Promise.all([
  probe(`https://api.vercel.com/v9/projects/${project}?teamId=${team}`,token),
  probe(`https://api.vercel.com/v10/projects/${project}/env?teamId=${team}`,token),
  probe(`https://api.vercel.com/v1/integrations/configurations?view=account&teamId=${team}`,token),
 ]);
 return Response.json({
  oidcPresent:true,
  projectRead,
  environmentRead,
  integrationRead,
  truthBoundary:'CAPABILITY_PROBE_EXPOSES_NO_CREDENTIAL_MATERIAL',
 },{headers:{'cache-control':'no-store'}});
}
