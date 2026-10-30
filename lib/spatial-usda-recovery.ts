/**
 * Safety-scoped fallback for USDA metadata parsing in Three r186.
 *
 * The original USDZ, payloads and material layers MUST remain in the archive;
 * this only reconstructs the parser's transient AST when the upstream parser
 * crashes because the transient metadata stack underflows.
 *
 * The fallback is not authoritative OpenUSD composition. A render is rejected
 * if it does not produce real mesh geometry, and original source/provenance is
 * retained for full OpenUSD engineering analysis.
 */
type Dict=Record<string,unknown>;
type FallbackParser={_preprocess:(text:string)=>string;_findAssignmentOperator:(line:string)=>number};
export function recoverUnbalancedUSDA(text:string,parser:FallbackParser):Dict{
 const clean=parser._preprocess(text.replace(/^\s*\)\s*\{\s*$/gm,')\n{'));
 const root:Dict={};const stack:Dict[]=[root];let target=root;
 let current='';let rescued=0;
 for(const raw of clean.split('\n')){
  const line=raw.trim();if(!line)continue;
  if(line.includes('=')){
   const eq=parser._findAssignmentOperator(line);
   if(eq<0){current=line;continue;}
   const lhs=line.slice(0,eq).trim(),rhs=line.slice(eq+1).trim();
   if(!lhs)continue;
   if(rhs.endsWith('{')){
    const group:Dict={};target[lhs]=group;stack.push(group);target=group;
   }else if(rhs.endsWith('(')){
    target[lhs]=rhs.slice(0,-1).trim();
    const meta:Dict={};stack.push(meta);target=meta;
   }else target[lhs]=rhs;
  }else if(line.includes(':')&&!line.includes('=')){
   const idx=line.indexOf(':'),k=line.slice(0,idx).trim();
   if(/^[\d.]+$/.test(k))target[k]=line.slice(idx+1).trim();
  }else if(line.endsWith('{')){
   current=line.slice(0,-1).trim()||current;
   const group=(target[current]&&typeof target[current]==='object'?target[current]:{}) as Dict;
   target[current]=group;stack.push(group);target=group;
  }else if(line.endsWith('}')){
   if(stack.length>1)stack.pop();else rescued++;
   target=stack[stack.length-1];
  }else if(line.endsWith('(')){
   current=line.slice(0,-1).trim()||current;
   const meta:Dict={};target[current]=meta;stack.push(meta);target=meta;
  }else if(line.endsWith(')')){
   if(stack.length>1)stack.pop();else rescued++;
   target=stack[stack.length-1];
  }else current=line;
 }
 if(rescued===0)throw new Error('USD metadata fallback was unnecessary; refusing unverified reconstruction.');
 return root;
}
