export type ScanNormalization={query:string;kind:'RAW'|'URL'|'STRATUM_URI'};

const MAX_SCAN_LENGTH=2048;
const MAX_QUERY_LENGTH=512;
const acceptedPathParents=new Set(['asset','assets','passport']);

export function normalizeScanValue(input:string):ScanNormalization|null{
 const raw=input.trim();
 if(!raw||raw.length>MAX_SCAN_LENGTH)return null;

 if(/^stratum:\/\//i.test(raw)){
  try{
   const url=new URL(raw);
   if(url.protocol.toLowerCase()!=='stratum:')return null;
   const parts=[url.hostname,...url.pathname.split('/').filter(Boolean)];
   const assetIndex=parts.findIndex(part=>part.toLowerCase()==='asset');
   const value=(assetIndex>=0?parts[assetIndex+1]:parts.at(-1))?.trim();
   return value&&value.length<=MAX_QUERY_LENGTH?{query:decodeURIComponent(value),kind:'STRATUM_URI'}:null;
  }catch{return null;}
 }

 if(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)){
  try{
   const url=new URL(raw);
   if(url.protocol!=='https:'&&url.protocol!=='http:')return null;
   const fromQuery=url.searchParams.get('q')?.trim();
   if(fromQuery&&fromQuery.length<=MAX_QUERY_LENGTH)return{query:fromQuery,kind:'URL'};
   const parts=url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
   if(parts.length>=2&&acceptedPathParents.has(parts.at(-2)!.toLowerCase())){
    const value=parts.at(-1)!.trim();
    return value&&value.length<=MAX_QUERY_LENGTH?{query:value,kind:'URL'}:null;
   }
   return null;
  }catch{return null;}
 }

 return raw.length<=MAX_QUERY_LENGTH?{query:raw,kind:'RAW'}:null;
}
