/** Source-authored OpenUSD stage metrics. This is NOT project installation
 * registration, placement-Z evidence, or a model geometry verification.
 * USD binary roots require a full OpenUSD reader and must fail closed here.
 */
export type UsdAuthoredStageMetrics={
  authoredMetersPerUnit:number|null;
  authoredUpAxis:'Y'|'Z'|null;
  authority:'SOURCE_HEADER'|'UNRESOLVED_BINARY_OR_MISSING';
  evidence:'USDA_ROOT_LAYER_ONLY'|'NOT_READABLE_WITHOUT_OPENUSD';
};
export function readUsdaAuthoredStageMetrics(bytes:ArrayBuffer):UsdAuthoredStageMetrics{
  const unresolved:UsdAuthoredStageMetrics={
    authoredMetersPerUnit:null,authoredUpAxis:null,
    authority:'UNRESOLVED_BINARY_OR_MISSING',evidence:'NOT_READABLE_WITHOUT_OPENUSD'
  };
  if(!bytes.byteLength)return unresolved;
  const src=new TextDecoder('utf-8',{fatal:false}).decode(new Uint8Array(bytes,0,Math.min(bytes.byteLength,32768)));
  // File format signature and a root-stage metadata block are mandatory.
  if(!/^\uFEFF?#usda\s+\d+(?:\.\d+)?\s*(?:\r?\n|$)/.test(src))return unresolved;
  const body=src.replace(/^\uFEFF?#usda[^\n]*\n/,'');
  const match=body.match(/^\s*\(([\s\S]*?)\)\s*(?=\r?\n|$)/);
  if(!match)return unresolved;
  const clean=match[1].split(/\r?\n/).map(line=>line.replace(/#.*$/,'')).join('\n');
  const units=[...clean.matchAll(/\bmetersPerUnit\s*=\s*([+\-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+\-]?\d+)?)/g)];
  const axes=[...clean.matchAll(/\bupAxis\s*=\s*"([A-Za-z]+)"/g)];
  if(units.length>1||axes.length>1)return unresolved;
  const n=units.length===1?Number(units[0][1]):null;
  const unit=n!==null&&Number.isFinite(n)&&n>0&&n<=10000?n:null;
  const axis=axes.length===1&&(axes[0][1]==='Y'||axes[0][1]==='Z')
    ?axes[0][1] as 'Y'|'Z':null;
  if(unit===null&&axis===null)return unresolved;
  return{authoredMetersPerUnit:unit,authoredUpAxis:axis,authority:'SOURCE_HEADER',evidence:'USDA_ROOT_LAYER_ONLY'};
}
