export type DrawingSetCompletenessStatus='COMPLETE'|'PARTIAL'|'UNRESOLVED';

export type DrawingSetCompleteness={
 status:DrawingSetCompletenessStatus;
 expectedSheets:string[];
 presentSheets:string[];
 missingSheets:string[];
 indexDetected:boolean;
 prefix:string|null;
 evidence:string[];
};

const normalize=(value:string)=>value
 .toUpperCase()
 .replace(/[–—]/g,'-')
 .replace(/\s+/g,' ')
 .trim();

export function normalizeSheetId(value:string){
 const text=normalize(value);
 const match=text.match(/\b([A-Z]{1,4})\s*[-.]?\s*(\d{1,3}(?:\.\d+)?)\b/);
 if(!match)return null;
 return `${match[1]}-${match[2]}`;
}

function sheetIds(text:string,prefix?:string|null){
 const normalized=normalize(text);
 const out:string[]=[];
 const re=/\b([A-Z]{1,4})\s*[-.]?\s*(\d{1,3}(?:\.\d+)?)\b/g;
 for(const match of normalized.matchAll(re)){
  const id=`${match[1]}-${match[2]}`;
  if(prefix&&match[1]!==prefix)continue;
  out.push(id);
 }
 return [...new Set(out)];
}

function numericPart(id:string){
 const match=id.match(/^[A-Z]{1,4}-(\d{1,3})(?:\.\d+)?$/);
 return match?Number(match[1]):null;
}

function inferPrefix(actualSheetIds:string[]){
 const counts=new Map<string,number>();
 for(const id of actualSheetIds){
  const prefix=id.split('-')[0];
  if(prefix)counts.set(prefix,(counts.get(prefix)||0)+1);
 }
 return [...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0]||null;
}

function sequentialRun(ids:string[],prefix:string){
 const numbers=[...new Set(ids.filter(id=>id.startsWith(prefix+'-')).map(numericPart).filter((value):value is number=>Number.isInteger(value)&&value>0))].sort((a,b)=>a-b);
 if(!numbers.length)return[] as string[];
 const run:number[]=[numbers[0]];
 for(let i=1;i<numbers.length;i++){
  if(numbers[i]===run[run.length-1]+1)run.push(numbers[i]);
  else if(numbers[i]>run[run.length-1]+1)break;
 }
 return run.map(value=>`${prefix}-${value}`);
}

export function analyzeDrawingSetCompleteness(input:{
 pageLabels:string[][];
 sheetNumbers:(string|null|undefined)[];
}):DrawingSetCompleteness{
 const labels=input.pageLabels||[];
 const pageOne=(labels[0]||[]).join(' ');
 const indexDetected=/\bSHEET\s+INDEX\b/i.test(pageOne);
 const present=[...new Set((input.sheetNumbers||[]).map(value=>value?normalizeSheetId(String(value)):null).filter((value):value is string=>Boolean(value)))];
 const prefix=inferPrefix(present);
 if(!indexDetected||!prefix){
  return{status:'UNRESOLVED',expectedSheets:[],presentSheets:present,missingSheets:[],indexDetected,prefix,evidence:[indexDetected?'Sheet index detected but sheet-series prefix is unresolved.':'No sheet-index heading detected.']};
 }
 const indexed=sheetIds(pageOne,prefix);
 const expected=sequentialRun(indexed,prefix);
 if(expected.length<2){
  return{status:'UNRESOLVED',expectedSheets:expected,presentSheets:present,missingSheets:[],indexDetected,prefix,evidence:['Sheet index detected, but a stable sequential sheet run could not be established.']};
 }
 const presentSet=new Set(present);
 const missing=expected.filter(id=>!presentSet.has(id));
 return{
  status:missing.length?'PARTIAL':'COMPLETE',
  expectedSheets:expected,
  presentSheets:present.filter(id=>expected.includes(id)),
  missingSheets:missing,
  indexDetected:true,
  prefix,
  evidence:[
   `Sheet index advertises ${expected[0]} through ${expected[expected.length-1]}.`,
   `Parsed title blocks establish ${present.filter(id=>expected.includes(id)).length} present sheet${present.filter(id=>expected.includes(id)).length===1?'':'s'}.`,
   ...(missing.length?[`Missing from this source file: ${missing.join(', ')}.`]:['All indexed sheets are present in this source file.'])
  ]
 };
}
