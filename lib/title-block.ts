export type PositionedSheetText={text:string;x:number;y:number;width?:number;height?:number};
export type SheetField={value:string|null;confidence:number;evidence:string[];method:string};
export type SheetPageGeometry={widthPoints:number|null;heightPoints:number|null;maxDimensionPoints:number|null};
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
  floor:SheetField;
  drawingScale:SheetField;
  pageGeometry:SheetPageGeometry;
  confidence:number;
  reviewRequired:true;
  reviewState:'CANDIDATE'|'CONFIRMED';
  alignmentEligible:false;
  geometryScaleAuthority:false;
  confirmedAt?:string;
};

const compact=(value:string)=>value.replace(/\s+/g,' ').trim();
const upper=(value:string)=>compact(value).toUpperCase();
const isLabel=(value:string)=>/^(SHEET|SHEET NO|SHEET NO\.|SHEET NUMBER|DRAWING|DRAWING NO|DRAWING NO\.|DRAWING NUMBER|TITLE|SHEET TITLE|DRAWING TITLE|REV|REVISION|DATE|ISSUE DATE|DRAWING DATE|SCALE|DRAWING SCALE|FLOOR|LEVEL)$/i.test(compact(value));
const field=(value:string|null,confidence:number,evidence:string[],method:string):SheetField=>({value,confidence:value?Math.max(0,Math.min(1,confidence)):0,evidence:evidence.slice(0,8),method});
const finitePositive=(value:unknown)=>{const n=Number(value);return Number.isFinite(n)&&n>0?n:null};

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
const architecturalScalePattern=/^(?:\d+\s+)?(?:\d+\/\d+|\d+(?:\.\d+)?)?\s*["”]\s*=\s*\d+(?:\.\d+)?\s*['’](?:\s*-\s*\d+(?:\.\d+)?\s*["”])?$/i;
const metricScalePattern=/^1\s*:\s*\d{1,5}(?:\.\d+)?$/i;
const ntsPattern=/^(?:NTS|NOT TO SCALE)$/i;
const scalePattern=(value:string)=>architecturalScalePattern.test(compact(value))||metricScalePattern.test(compact(value))||ntsPattern.test(compact(value));

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
  const candidates=items.filter(item=>{const value=compact(item.text);return value.length>=6&&value.length<=140&&!isLabel(value)&&!sheetPattern.test(upper(value))&&!datePattern.test(upper(value))&&!scalePattern(value)&&!/^(?:REV|REVISION)\b/i.test(value);}).sort((a,b)=>((b.width||0)*(b.height||0))-((a.width||0)*(a.height||0))||b.text.length-a.text.length);
  return candidates[0]?field(compact(candidates[0].text),.58,[compact(candidates[0].text)],'TITLE_BLOCK_TEXT_HEURISTIC'):field(null,0,[],'UNRESOLVED');
}

const disciplineMap:Record<string,string>={A:'Architectural',C:'Civil',E:'Electrical',M:'Mechanical',P:'Plumbing',S:'Structural',T:'Telecommunications',G:'General',L:'Landscape',FP:'Fire Protection',FA:'Fire Alarm'};
function inferDiscipline(sheetNumber:SheetField,title:SheetField,items:PositionedSheetText[]){
  const combined=upper(`${title.value||''} ${items.map(item=>item.text).join(' ')}`);
  const keyword:[RegExp,string][]=[[/\bFIRE ALARM\b/,'Fire Alarm'],[/\bFIRE PROTECTION\b|\bSPRINKLER\b/,'Fire Protection'],[/\bELECTRICAL\b|\bPOWER\b|\bLIGHTING\b|\bONE[- ]?LINE\b/,'Electrical'],[/\bARCHITECTURAL\b|\bFLOOR PLAN\b/,'Architectural'],[/\bMECHANICAL\b|\bHVAC\b/,'Mechanical'],[/\bPLUMBING\b/,'Plumbing'],[/\bCIVIL\b|\bGRADING\b/,'Civil'],[/\bSTRUCTURAL\b/,'Structural'],[/\b(?:TELECOM|TELECOMMUNICATION|LOW VOLTAGE)\b/,'Telecommunications']];
  for(const [pattern,value] of keyword)if(pattern.test(combined))return field(value,.86,[title.value||pattern.source],'TITLE_KEYWORD');
  const prefix=sheetNumber.value?.match(/^([A-Z]{1,2})/i)?.[1]?.toUpperCase();
  return prefix&&disciplineMap[prefix]?field(disciplineMap[prefix],.78,[sheetNumber.value!],'SHEET_PREFIX'):field(null,0,[],'UNRESOLVED');
}

const ordinalLevel:Record<string,number>={FIRST:1,SECOND:2,THIRD:3,FOURTH:4,FIFTH:5,SIXTH:6,SEVENTH:7,EIGHTH:8,NINTH:9,TENTH:10};
function normalizeFloor(value:string):string|null{
  const text=upper(value);
  if(/\b(?:GROUND|GROUND FLOOR)\b/.test(text))return'GROUND';
  if(/\bROOF\b/.test(text))return'ROOF';
  if(/\bPENTHOUSE\b/.test(text))return'PENTHOUSE';
  const basement=text.match(/\bBASEMENT(?:\s+(\d{1,2}))?\b|\bB(\d{1,2})\b/);if(basement)return`B${Number(basement[1]||basement[2]||1)}`;
  const level=text.match(/\b(?:LEVEL|LVL|FLOOR)\s*[-#:]?\s*(\d{1,2})\b/);if(level)return`L${Number(level[1])}`;
  const numericFloor=text.match(/\b(\d{1,2})(?:ST|ND|RD|TH)\s+FLOOR\b/);if(numericFloor)return`L${Number(numericFloor[1])}`;
  for(const [word,number] of Object.entries(ordinalLevel))if(new RegExp(`\\b${word}\\s+FLOOR\\b`).test(text))return`L${number}`;
  return null;
}
function inferFloor(title:SheetField,items:PositionedSheetText[]){
  if(title.value){const fromTitle=normalizeFloor(title.value);if(fromTitle)return field(fromTitle,.9,[title.value],'SHEET_TITLE_LEVEL');}
  const labeled=labeledField(items,/^(?:FLOOR|LEVEL)\b/i,value=>normalizeFloor(value)!==null,.9);if(labeled){const normalized=normalizeFloor(labeled.value||'');return field(normalized,.88,labeled.evidence,'LABELED_LEVEL');}
  const candidates=[...new Map(items.map(item=>[normalizeFloor(item.text),item]).filter(([value])=>Boolean(value)) as [string,PositionedSheetText][]).values()];
  return candidates.length===1?field(normalizeFloor(candidates[0].text),.62,[compact(candidates[0].text)],'STANDALONE_LEVEL'):field(null,0,candidates.slice(0,4).map(item=>compact(item.text)),candidates.length>1?'AMBIGUOUS_LEVEL':'UNRESOLVED');
}

function normalizeScale(value:string){
  const text=upper(value).replace(/[”]/g,'"').replace(/[’]/g,"'").replace(/\s+/g,' ').trim();
  if(ntsPattern.test(text))return'NTS';
  const metric=text.match(/^1\s*:\s*(\d{1,5}(?:\.\d+)?)$/);if(metric)return`1:${Number(metric[1])}`;
  return text;
}
function inferScale(items:PositionedSheetText[]){
  const labeled=labeledField(items,/^(?:SCALE|DRAWING SCALE)\b/i,value=>scalePattern(value),.94);if(labeled)return field(normalizeScale(labeled.value||''),labeled.confidence,labeled.evidence,labeled.method);
  const unique=[...new Map(items.filter(item=>scalePattern(item.text)).map(item=>[normalizeScale(item.text),item])).entries()];
  if(unique.length===1)return field(unique[0][0],.62,[compact(unique[0][1].text)],'STANDALONE_SCALE');
  if(unique.length>1)return field(null,0,unique.slice(0,4).map(([,item])=>compact(item.text)),'AMBIGUOUS_SCALE');
  return field(null,0,[],'UNRESOLVED');
}
function mixedNumber(value:string){
  const parts=value.trim().split(/\s+/).filter(Boolean);let total=0;
  for(const part of parts){if(part.includes('/')){const [a,b]=part.split('/').map(Number);if(!Number.isFinite(a)||!Number.isFinite(b)||b===0)return null;total+=a/b}else{const n=Number(part);if(!Number.isFinite(n))return null;total+=n}}
  return total>0?total:null;
}
export function drawingScaleDenominator(value:string|null|undefined){
  if(!value)return null;const text=normalizeScale(value);if(text==='NTS')return null;
  const metric=text.match(/^1:(\d+(?:\.\d+)?)$/);if(metric){const denominator=Number(metric[1]);return denominator>0?denominator:null}
  const architectural=text.match(/^(.+?)"\s*=\s*(\d+(?:\.\d+)?)\s*'(?:\s*-\s*(\d+(?:\.\d+)?)\s*")?$/);if(!architectural)return null;
  const paperInches=mixedNumber(architectural[1]);const realInches=Number(architectural[2])*12+Number(architectural[3]||0);if(!paperInches||!Number.isFinite(realInches)||realInches<=0)return null;
  return realInches/paperInches;
}

export function extractSheetIdentity(input:{page:number;sourceName:string;sourceSha256:string;items:PositionedSheetText[];pageWidthPoints?:number;pageHeightPoints?:number}):SheetIdentityCandidate{
  const clean=input.items.map(item=>({...item,text:compact(item.text)})).filter(item=>item.text);
  const titleRegion=clean.filter(item=>item.x>=.48||item.y>=.72);
  const items=titleRegion.length>=3?titleRegion:clean;
  const region=titleRegion.length>=3?'LOWER_RIGHT':'FULL_PAGE_FALLBACK';
  const sheetNumber=inferSheetNumber(items),sheetTitle=inferTitle(items),revision=inferRevision(items),issueDate=inferDate(items),discipline=inferDiscipline(sheetNumber,sheetTitle,items),floor=inferFloor(sheetTitle,items),drawingScale=inferScale(items);
  const weighted=[[sheetNumber.confidence,.29],[sheetTitle.confidence,.2],[revision.confidence,.08],[issueDate.confidence,.08],[discipline.confidence,.15],[floor.confidence,.1],[drawingScale.confidence,.1]] as const;
  const confidence=Number(weighted.reduce((sum,[score,weight])=>sum+score*weight,0).toFixed(3));
  const widthPoints=finitePositive(input.pageWidthPoints),heightPoints=finitePositive(input.pageHeightPoints),maxDimensionPoints=widthPoints&&heightPoints?Math.max(widthPoints,heightPoints):widthPoints||heightPoints;
  const pageGeometry={widthPoints,heightPoints,maxDimensionPoints};
  return{page:input.page,sourceName:input.sourceName,sourceSha256:input.sourceSha256,region,sheetNumber,sheetTitle,revision,issueDate,discipline,floor,drawingScale,pageGeometry,confidence,reviewRequired:true,reviewState:'CANDIDATE',alignmentEligible:false,geometryScaleAuthority:false};
}
