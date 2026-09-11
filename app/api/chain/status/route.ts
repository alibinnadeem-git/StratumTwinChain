import {NextResponse} from 'next/server';
import {POVI_PROTOCOL_VERSION} from '@/lib/redbook/schema/common';

export async function GET(){
 const rpc=(process.env.STRATUM_CHAIN_RPC_URL||'').replace(/\/$/,'');
 const network=process.env.STRATUM_CHAIN_ID||'stratum-devnet-1';
 if(!rpc)return NextResponse.json({
  connected:false,
  network,
  mode:'mock',
  protocolConformance:'NOT_CONNECTED',
  targetProtocol:POVI_PROTOCOL_VERSION,
 });
 try{
  const r=await fetch(`${rpc}/v1/status`,{cache:'no-store'});
  if(!r.ok)throw new Error(`RPC ${r.status}`);
  const data=await r.json() as Record<string,unknown>;
  const reportedProtocol=typeof data.protocolVersion==='string'?data.protocolVersion:null;
  const reportedMode=typeof data.mode==='string'?data.mode:null;
  const poviConformant=reportedProtocol===POVI_PROTOCOL_VERSION&&data.poviConformant===true;
  return NextResponse.json({
   connected:true,
   mode:reportedMode||'stratum-rpc',
   protocolConformance:poviConformant?'POVI_CONFORMANT':'PRE_POVI_COMPATIBILITY',
   targetProtocol:POVI_PROTOCOL_VERSION,
   ...data,
   // The application will not infer PoVI finality from connectivity alone.
   poviConformant,
  });
 }catch(e){
  return NextResponse.json({
   connected:false,
   network,
   mode:'stratum-rpc',
   protocolConformance:'UNAVAILABLE',
   targetProtocol:POVI_PROTOCOL_VERSION,
   error:e instanceof Error?e.message:'RPC unavailable',
  },{status:503});
 }
}
