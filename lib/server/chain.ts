import {MockStratumDevnetAdapter,LedgerAdapter,LedgerRecord,AnchorReceipt} from '../ledger';

export type DirRpcStatus={
 configured:boolean;
 reachable:boolean;
 connected:boolean;
 chainId:string|null;
 height:number|null;
 engineReady:boolean;
 poviConformant:boolean;
 activeValidatorCount:number|null;
 requiredQuorum:number|null;
 validators:Array<{id?:string;name?:string;address?:string;endpoint?:string|null}>;
 limitations:string[];
 error?:string;
};

class StratumChainRpcAdapter implements LedgerAdapter{
 constructor(private rpc:string,private chainId:string,private apiKey?:string){}
 async anchor(record:LedgerRecord):Promise<AnchorReceipt>{
  const res=await fetch(`${this.rpc.replace(/\/$/,'')}/stratum/povi/v1/records`,{
   method:'POST',
   headers:{'content-type':'application/json',...(this.apiKey?{'authorization':`Bearer ${this.apiKey}`}:{})},
   body:JSON.stringify(record),
   cache:'no-store'
  });
  if(!res.ok)throw Object.assign(new Error(`STRATUM DIR/PoVI anchor failed: ${res.status}`),{status:503});
  const j=await res.json() as {
   txHash:string;blockHeight:number;timestamp:string;network?:string;
   protocolVersion?:string;quorum?:number;validatorVotes?:string[];
  };
  if(!j.txHash||!Number.isInteger(Number(j.blockHeight))||Number(j.blockHeight)<0||!j.timestamp){
   throw Object.assign(new Error('STRATUM DIR RPC returned an incomplete finality receipt'),{status:502});
  }
  if(j.protocolVersion!=='POVI/1'){
   throw Object.assign(new Error('STRATUM DIR RPC did not return a PoVI/1 finality receipt'),{status:502});
  }
  const votes=Array.isArray(j.validatorVotes)?new Set(j.validatorVotes).size:0;
  if(Number(j.quorum)!==3||votes<3){
   throw Object.assign(new Error('STRATUM DIR RPC did not prove the required 3-of-3 PoVI compatibility quorum'),{status:502});
  }
  return{network:j.network||this.chainId,txHash:j.txHash,blockHeight:Number(j.blockHeight),timestamp:j.timestamp};
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

export async function probeDirRpc():Promise<DirRpcStatus>{
 const rpc=(process.env.STRATUM_CHAIN_RPC_URL||'').trim().replace(/\/$/,'');
 if(!rpc)return{configured:false,reachable:false,connected:false,chainId:null,height:null,engineReady:false,poviConformant:false,activeValidatorCount:null,requiredQuorum:null,validators:[],limitations:[]};
 try{
  const response=await fetch(`${rpc}/v1/status`,{
   headers:process.env.STRATUM_CHAIN_API_KEY?{'authorization':`Bearer ${process.env.STRATUM_CHAIN_API_KEY}`}:{},
   cache:'no-store',
   signal:AbortSignal.timeout(4500),
  });
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  const body=await response.json() as any;
  return{
   configured:true,
   reachable:true,
   connected:Boolean(body.connected),
   chainId:typeof body.chainId==='string'?body.chainId:null,
   height:Number.isFinite(Number(body.height))?Number(body.height):null,
   engineReady:Boolean(body.povi?.engineReady),
   poviConformant:Boolean(body.povi?.poviConformant),
   activeValidatorCount:Number.isFinite(Number(body.povi?.activeValidatorCount))?Number(body.povi.activeValidatorCount):null,
   requiredQuorum:Number.isFinite(Number(body.povi?.requiredQuorum))?Number(body.povi.requiredQuorum):null,
   validators:Array.isArray(body.validators)?body.validators.map((value:any)=>({id:value.id,name:value.name,address:value.address,endpoint:value.endpoint??null})):[],
   limitations:Array.isArray(body.povi?.limitations)?body.povi.limitations.map(String):[],
  };
 }catch(error){
  return{
   configured:true,reachable:false,connected:false,chainId:null,height:null,engineReady:false,poviConformant:false,
   activeValidatorCount:null,requiredQuorum:null,validators:[],limitations:[],
   error:error instanceof Error?error.message:'DIR RPC probe failed'
  };
 }
}


export type DirExplorerSnapshot={
 state:{chain_id:string;height:string;latest_block_hash:string;genesis_hash:string;updated_at:string}|null;
 blocks:Array<{
  height:string;block_hash:string;prev_hash:string;tx_hash:string;proposer_validator_id:string;finalized_at:string;votes_json:unknown;
  record_id:string|null;event_type:string|null;asset_id:string|null;evidence_hash:string|null;payload_hash:string|null;
 }>;
};

export async function fetchDirExplorer(limit=25):Promise<DirExplorerSnapshot>{
 const rpc=(process.env.STRATUM_CHAIN_RPC_URL||'').trim().replace(/\/$/,'');
 if(!rpc)throw Object.assign(new Error('DIR RPC is not configured'),{status:503});
 const url=new URL(rpc+'/v1/explorer');url.searchParams.set('limit',String(Math.max(1,Math.min(100,limit))));
 const response=await fetch(url,{
  headers:process.env.STRATUM_CHAIN_API_KEY?{'authorization':`Bearer ${process.env.STRATUM_CHAIN_API_KEY}`}:{},
  cache:'no-store',
  signal:AbortSignal.timeout(4500),
 });
 if(!response.ok)throw Object.assign(new Error(`STRATUM DIR explorer failed: ${response.status}`),{status:503});
 const body=await response.json() as DirExplorerSnapshot;
 return{state:body.state||null,blocks:Array.isArray(body.blocks)?body.blocks:[]};
}

export function getLedger():LedgerAdapter{
 const rpc=(process.env.STRATUM_CHAIN_RPC_URL||'').trim();
 if(rpc)return new StratumChainRpcAdapter(rpc,process.env.STRATUM_CHAIN_ID||'stratum-devnet-1',process.env.STRATUM_CHAIN_API_KEY);
 if(process.env.NODE_ENV==='production'){
  throw Object.assign(new Error('DIR RPC is not configured for production; finality is unavailable and no mock receipt will be issued'),{status:503});
 }
 return new MockStratumDevnetAdapter();
}
