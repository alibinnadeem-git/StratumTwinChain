export type PositionedSheetText={text:string;x:number;y:number;width?:number;height?:number};
export type SheetField={value:string|null;confidence:number;evidence:string[];method:string};
export type SheetIdentityCandidate={
  page:number;
  sourceName:string;
  sourceSha256:string;
  region:'LOWER_RIGHT'|'FULL_PAGE_FALLBACK';
  sheetNumber:SheetField;
  sheetTitle:SheetField;
  revision:SheetField;
  issueDate:SheetField;
  discipline:SheetField;
  confidence:number;
  reviewRequired:true;
  reviewState:'CANDIDATE'|'CONFIRMED';
  alignmentEligible:false;
  confirmedAt?:string;
};

const compact=(value:string)=>value.replace(/\s+/g,' ').trim();
const upper=(value:string)=>compact(value).toUpperCase();
const isLabel=(value:string)=>/^(SHEET|SHEET NO|SHEET NO\.|SHEET NUMBER|DRAWING|DRAWING NO|DRAWING NO\.|DRAWING NUMBER|TITLE|SHEET TITLE|DRAWING TITLE|REV|REVISION|DATE|ISSUE DATE|DRAWING DATE)$/i.test(compact(value));
const field=(value:string|null,confidence:number,evidence:string[],method:string):SheetField=>({value,confidence:value?Math.max(0,Math.min(1,confidence)):0,evidence:evidence.slice(0,8),method});

function nearbyValue(label:PositionedSheetText,items:PositionedSheetText[],predicate:(value:string)=>boolean){
  const ranked=items
    .filter(item=>item!==label&&!isLabel(item.text)&&predicate(compact(item.text)))
    .map(item=>{const dx=item.x-label.x,dy=item.y-label.y;const right=dx>=-.02&&dx<=.32&&Math.abs(dy)<=.08;const below=dy>=-.02&&dy<=.14&&Math.abs(dx)<=.28;const distance=Math.hypot(dx,dy);return{item,score:(right?2:0)+(below?1.5:0)-distance};})
    .filter(candidate=>candidate.score>-.2)
    .sort((a,b)=>b.score-a.score);
  return ranked[0]?.item||null;
}

function labeledField(items:PositionedSheetText[],labels:RegExp,predicate:(value:string)=>boolean,confidence=.92){
  for(const label of items){if(!labels.test(upper(label.text)))continue;const direct=upper(label.text).match(/[:#-]\s*(.+)$/)?.[1];if(direct&&predicate(direct))return field(compact(direct),confidence,[compact(label.text)],'LABELED_INLINE');const near=nearbyValue(label,items,predicate);if(near)return field(compact(near.text),confidence-.04,[compact(label.text),compact(near.text)],'LABELED_NEARBY');}
  return null;
}

const sheetPattern=/^[A-Z]{1,4}(?:[-.]?[A-Z]{0,2})?[-.]?\d{1,3}(?:[.-]\d{1,3})?[A-Z]?$/i;
const revisionPattern=/^(?:[A-Z]|\d{1,3}|P\d{1,2}|R\d{1,2})$/i;
const datePattern=/^(?:\d{1,2}[\/-]\d{1,2}[\/-](?:\d{2}|\d{4})|(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|SEPT|OCT|NOV|DEC)[A-Z]*[ .-]+\d{1,2}[, .-]+\d{2,4}|\d{4}-\d{2}-\d{2})$/i;

function inferSheetNumber(items:PositionedSheetText[]){
  const labeled=labeledField(items,/^(?:SHEET(?: NO\.?| NUMBER)?|DRAWING(?: NO\.?| NUMBER)?)\b/i,value=>sheetPattern.test(value),.97);if(labeled)return labeled;
  const candidates=items.filter(item=>sheetPattern.test(upper(item.text))&&/\d/.test(item.text)).sort((a,b)=>(b.x+b.y)-(a.x+a.y));
  return candidates[0]?field(upper(candidates[0].text),.72,[compact(candidates[0].text)],'STANDALONE_PATTERN'):field(null,0,[],'UNRESOLVED');
}

function inferRevision(items:PositionedSheetText[]){
  const labeled=labeledField(items,/^(?:REV|REVISION)\b/i,value=>revisionPattern.test(value),.94);if(labeled)return labeled;
  const explicit=items.map(item=>compact(item.text).match(/^(?:REV|REVISION)\s*[:#-]?\s*([A-Z0-9]{1,4})$/i)).find(Boolean);
  return explicit?field(explicit![1],.84,[explicit![0]],'INLINE_PATTERN'):field(null,0,[],'UNRESOLVED');
}

function inferDate(items:PositionedSheetText[]){
  const labeled=labeledField(items,/^(?:DATE|ISSUE DATE|DRAWING DATE)\b/i,value=>datePattern.test(value),.9);if(labeled)return labeled;
  const candidates=items.filter(item=>datePattern.test(upper(item.text))).sort((a,b)=>(b.x+b.y)-(a.x+a.y));
  return candidates[0]?field(compact(candidates[0].text),.65,[compact(candidates[0].text)],'STANDALONE_DATE'):field(null,0,[],'UNRESOLVED');
}

function inferTitle(items:PositionedSheetText[]){
  const labeled=labeledField(items,/^(?:SHEET TITLE|DRAWING TITLE|TITLE)\b/i,value=>value.length>=4&&!sheetPattern.test(value)&&!datePattern.test(value),.92);if(labeled)return labeled;
  const candidates=items.filter(item=>{const value=compact(item.text);return value.length>=6&&value.length<=140&&!isLabel(value)&&!sheetPattern.test(upper(value))&&!datePattern.test(upper(value))&&!/^(?:REV|REVISION)\b/i.test(value);}).sort((a,b)=>((b.width||0)*(b.height||0))-((a.width||0)*(a.height||0))||b.text.length-a.text.length);
  return candidates[0]?field(compact(candidates[0].text),.58,[compact(candidates[0].text)],'TITLE_BLOCK_TEXT_HEURISTIC'):field(null,0,[],'UNRESOLVED');
}

const disciplineMap:Record<string,string>={A:'Architectural',C:'Civil',E:'Electrical',M:'Mechanical',P:'Plumbing',S:'Structural',T:'Telecommunications',G:'General',L:'Landscape',FP:'Fire Protection',FA:'Fire Alarm'};
function inferDiscipline(sheetNumber:SheetField,title:SheetField,items:PositionedSheetText[]){
  const combined=upper(`${title.value||''} ${items.map(item=>item.text).join(' ')}`);
  const keyword:[RegExp,string][]=[[/\bELECTRICAL\b|\bPOWER\b|\bLIGHTING\b|\bONE[- ]?LINE\b/,'Electrical'],[/\bARCHITECTURAL\b|\bFLOOR PLAN\b/,'Architectural'],[/\bMECHANICAL\b|\bHVAC\b/,'Mechanical'],[/\bPLUMBING\b/,'Plumbing'],[/\bCIVIL\b|\bGRADING\b/,'Civil'],[/\bSTRUCTURAL\b/,'Structural'],[/\bFIRE ALARM\b/,'Fire Alarm'],[/\bFIRE PROTECTION\b|\bSPRINKLER\b/,'Fire Protection'],[/\bTELECOM|TELECOMMUNICATION|LOW VOLTAGE\b/,'Telecommunications']];
  for(const [pattern,value] of keyword)if(pattern.test(combined))return field(value,.86,[title.value||pattern.source],'TITLE_KEYWORD');
  const prefix=sheetNumber.value?.match(/^([A-Z]{1,2})/i)?.[1]?.toUpperCase();
  return prefix&&disciplineMap[prefix]?field(disciplineMap[prefix],.78,[sheetNumber.value!],'SHEET_PREFIX'):field(null,0,[],'UNRESOLVED');
}

export function extractSheetIdentity(input:{page:number;sourceName:string;sourceSha256:string;items:PositionedSheetText[]}):SheetIdentityCandidate{
  const clean=input.items.map(item=>({...item,text:compact(item.text)})).filter(item=>item.text);
  const titleRegion=clean.filter(item=>item.x>=.48||item.y>=.72);
  const items=titleRegion.length>=3?titleRegion:clean;
  const region=titleRegion.length>=3?'LOWER_RIGHT':'FULL_PAGE_FALLBACK';
  const sheetNumber=inferSheetNumber(items),sheetTitle=inferTitle(items),revision=inferRevision(items),issueDate=inferDate(items),discipline=inferDiscipline(sheetNumber,sheetTitle,items);
  const weighted=[[sheetNumber.confidence,.35],[sheetTitle.confidence,.25],[revision.confidence,.1],[issueDate.confidence,.1],[discipline.confidence,.2]] as const;
  const confidence=Number(weighted.reduce((sum,[score,weight])=>sum+score*weight,0).toFixed(3));
  return{page:input.page,sourceName:input.sourceName,sourceSha256:input.sourceSha256,region,sheetNumber,sheetTitle,revision,issueDate,discipline,confidence,reviewRequired:true,reviewState:'CANDIDATE',alignmentEligible:false};
}
