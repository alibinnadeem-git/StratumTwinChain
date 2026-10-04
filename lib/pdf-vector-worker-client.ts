export type PdfVectorOps={
 save:number;restore:number;transform:number;paintFormXObjectBegin:number;paintFormXObjectEnd:number;
 constructPath:number;moveTo:number;lineTo:number;rectangle:number;closePath:number;
};

export type NormalizedPdfVectors={
 pageOps:number;
 segments:{x:number;y:number;x2:number;y2:number}[];
 polygons:{vertices:{x:number;y:number}[];confidence:number}[];
};

export class PdfVectorWorkerError extends Error{
 constructor(public code:string,message:string){super(message);this.name='PdfVectorWorkerError'}
}

export async function normalizePdfVectorOpsInWorker(input:{
 fnArray:number[];
 argsArray:unknown[][];
 viewport:{width:number;height:number;transform:number[]};
 ops:PdfVectorOps;
 maxOps:number;
 maxSegments:number;
 timeoutMs:number;
 signal?:AbortSignal;
}):Promise<NormalizedPdfVectors>{
 if(input.signal?.aborted)throw new DOMException('PDF parsing cancelled.','AbortError');
 const worker=new Worker(new URL('../workers/pdf-vector-normalizer.worker.ts',import.meta.url),{type:'module'});
 return await new Promise<NormalizedPdfVectors>((resolve,reject)=>{
  let settled=false;
  const finish=(callback:()=>void)=>{if(settled)return;settled=true;clearTimeout(timer);input.signal?.removeEventListener('abort',onAbort);worker.terminate();callback()};
  const onAbort=()=>finish(()=>reject(new DOMException('PDF parsing cancelled.','AbortError')));
  const timer=setTimeout(()=>finish(()=>reject(new PdfVectorWorkerError('VECTOR_TIMEOUT',`PDF vector normalization exceeded ${Math.round(input.timeoutMs/1000)} seconds for one page.`))),input.timeoutMs);
  input.signal?.addEventListener('abort',onAbort,{once:true});
  worker.onerror=event=>finish(()=>reject(new PdfVectorWorkerError('WORKER_ERROR',event.message||'PDF vector worker failed.')));
  worker.onmessage=(event:MessageEvent<any>)=>{
   const data=event.data;
   if(data?.type==='DONE')finish(()=>resolve({pageOps:Number(data.pageOps)||0,segments:data.segments||[],polygons:data.polygons||[]}));
   else if(data?.type==='ERROR')finish(()=>reject(new PdfVectorWorkerError(String(data.code||'WORKER_ERROR'),String(data.message||'PDF vector worker failed.'))));
  };
  worker.postMessage({type:'NORMALIZE',fnArray:input.fnArray,argsArray:input.argsArray,viewport:input.viewport,ops:input.ops,maxOps:input.maxOps,maxSegments:input.maxSegments});
 });
}
