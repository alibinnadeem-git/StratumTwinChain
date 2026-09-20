import {MockStratumDevnetAdapter,LedgerAdapter,LedgerRecord,AnchorReceipt} from '../ledger';

class StratumChainRpcAdapter implements LedgerAdapter{
 constructor(private rpc:string,private chainId:string,private apiKey?:string){}
 async anchor(record:LedgerRecord):Promise<AnchorReceipt>{
  const res=await fetch(`${this.rpc.replace(/\/$/,'')}/stratum/verified/v1/records`,{
   method:'POST',
   headers:{'content-type':'application/json',...(this.apiKey?{'authorization':`Bearer ${this.apiKey}`}:{})},
   body:JSON.stringify(record),
   cache:'no-store'
  });
  if(!res.ok)throw Object.assign(new Error(`STRATUM DIR anchor failed: ${res.status}`),{status:503});
  const j=await res.json() as {txHash:string;blockHeight:number;timestamp:string};
  if(!j.txHash||!Number.isInteger(Number(j.blockHeight))||Number(j.blockHeight)<0||!j.timestamp){
   throw Object.assign(new Error('STRATUM DIR RPC returned an incomplete finality receipt'),{status:502});
  }
  return{network:this.chainId,txHash:j.txHash,blockHeight:Number(j.blockHeight),timestamp:j.timestamp};
 }
 async verify(recordId:string,evidenceHash:string){
  const u=new URL(`${this.rpc.replace(/\/$/,'')}/stratum/verified/v1/records/${encodeURIComponent(recordId)}`);
  u.searchParams.set('evidenceHash',evidenceHash);
  const r=await fetch(u,{headers:this.apiKey?{'authorization':`Bearer ${this.apiKey}`}:{},cache:'no-store'});
  if(r.status===404)return{valid:false,network:this.chainId};
  if(!r.ok)throw Object.assign(new Error(`STRATUM DIR verify failed: ${r.status}`),{status:503});
  const j=await r.json() as {valid:boolean;blockHeight?:number;txHash?:string};
  return{...j,network:this.chainId};
 }
}

export function dirRpcConfigured(){return Boolean((process.env.STRATUM_CHAIN_RPC_URL||'').trim())}

export function getLedger():LedgerAdapter{
 const rpc=(process.env.STRATUM_CHAIN_RPC_URL||'').trim();
 if(rpc)return new StratumChainRpcAdapter(rpc,process.env.STRATUM_CHAIN_ID||'stratum-devnet-1',process.env.STRATUM_CHAIN_API_KEY);
 if(process.env.NODE_ENV==='production'){
  throw Object.assign(new Error('DIR RPC is not configured for production; finality is unavailable and no mock receipt will be issued'),{status:503});
 }
 return new MockStratumDevnetAdapter();
}
