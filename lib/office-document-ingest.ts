import {strFromU8,unzipSync} from 'fflate';
import {parseEquipmentScheduleText,type ScheduleEntity} from './equipment-schedule';

export type StructuredOfficeResult={
 entities:ScheduleEntity[];
 summary:string;
 details:{format:'XLSX'|'DOCX';sheetCount?:number;tableCount?:number;paragraphCount?:number;rowCount?:number;textBlockCount:number};
};

function decodeXml(value:string){
 return value
  .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&')
  .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)));
}
function textNodes(xml:string){
 const out:string[]=[];
 const re=/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/gi;let match:RegExpExecArray|null;
 while((match=re.exec(xml)))out.push(decodeXml(match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')));
 return out;
}
function attr(attrs:string,name:string){
 const escaped=name.replace(':','\\:');
 const match=attrs.match(new RegExp('(?:^|\\s)'+escaped+'="([^"]*)"','i'));
 return match?decodeXml(match[1]):'';
}
function colIndex(ref:string){
 const letters=(ref.match(/^[A-Z]+/i)?.[0]||'').toUpperCase();let index=0;
 for(const ch of letters)index=index*26+(ch.charCodeAt(0)-64);
 return Math.max(0,index-1);
}
function cleanRows(rows:string[][]){
 return rows.map(row=>{const next=[...row];while(next.length&&String(next[next.length-1]||'').trim()==='')next.pop();return next})
  .filter(row=>row.some(cell=>String(cell||'').trim()!==''));
}
function sourceScoped(entities:ScheduleEntity[],prefix:string,source:string,extra:Record<string,unknown>){
 return entities.map((entity,index)=>({
  ...entity,
  id:(prefix+'-'+index+'-'+entity.id).replace(/[^a-zA-Z0-9:_-]+/g,'-').slice(0,300),
  source,
  meta:{...entity.meta,...extra,officeStructuredSource:true,nonSpatial:true,physicalTruth:false,spatialPlacementAuthority:'NON_SPATIAL_OFFICE_SOURCE',reviewRequired:true}
 }));
}
function asSchedule(rows:string[][],source:string,discipline:string,floor:string,prefix:string,extra:Record<string,unknown>){
 const text=cleanRows(rows).map(row=>row.map(cell=>String(cell??'').replace(/\t/g,' ')).join('\t')).join('\n');
 const parsed=parseEquipmentScheduleText(text,source,discipline,floor);
 return{entities:sourceScoped(parsed.entities,prefix,source,extra),summary:parsed.summary};
}

function sharedStrings(xml:string){
 const strings:string[]=[];const re=/<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/gi;let match:RegExpExecArray|null;
 while((match=re.exec(xml)))strings.push(textNodes(match[1]).join(''));
 return strings;
}
function sheetRelations(workbookXml:string,relsXml:string){
 const rels=new Map<string,string>();let match:RegExpExecArray|null;
 const relRe=/<Relationship\b([^>]*)\/?>/gi;
 while((match=relRe.exec(relsXml))){
  const id=attr(match[1],'Id'),target=attr(match[1],'Target');
  if(id&&target)rels.set(id,target.replace(/^\//,''));
 }
 const sheets:{name:string;path:string}[]=[];const sheetRe=/<sheet\b([^>]*)\/?>/gi;
 while((match=sheetRe.exec(workbookXml))){
  const name=attr(match[1],'name')||'Sheet '+(sheets.length+1);
  const id=attr(match[1],'r:id')||attr(match[1],'id');
  const target=rels.get(id)||'worksheets/sheet'+(sheets.length+1)+'.xml';
  const path=target.startsWith('xl/')?target:'xl/'+target.replace(/^\.\//,'');
  sheets.push({name,path});
 }
 return sheets;
}
function worksheetRows(xml:string,strings:string[]){
 const rows:string[][]=[];let match:RegExpExecArray|null;
 const cellRe=/<c\b([^>]*)>([\s\S]*?)<\/c>/gi;
 while((match=cellRe.exec(xml))){
  const attrs=match[1],body=match[2],ref=attr(attrs,'r'),type=attr(attrs,'t');
  const index=ref?colIndex(ref):0;
  const rowNumber=Number(ref.match(/\d+/)?.[0]||1)-1;
  const valueMatch=body.match(/<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/i);
  let value='';
  if(type==='inlineStr')value=textNodes(body).join('');
  else if(valueMatch){
   const raw=decodeXml(valueMatch[1]);
   value=type==='s'?strings[Number(raw)]??raw:type==='b'?(raw==='1'?'TRUE':'FALSE'):raw;
  }else value=textNodes(body).join('');
  while(rows.length<=rowNumber)rows.push([]);
  while(rows[rowNumber].length<=index)rows[rowNumber].push('');
  rows[rowNumber][index]=value;
 }
 return cleanRows(rows);
}
export function parseXlsxBytes(bytes:Uint8Array,source:string,discipline:string,floor='UNRESOLVED'):StructuredOfficeResult{
 const files=unzipSync(bytes);
 const workbook=files['xl/workbook.xml'],rels=files['xl/_rels/workbook.xml.rels'];
 if(!workbook||!rels)throw new Error('XLSX workbook structure is incomplete');
 const strings=files['xl/sharedStrings.xml']?sharedStrings(strFromU8(files['xl/sharedStrings.xml'])):[];
 const sheets=sheetRelations(strFromU8(workbook),strFromU8(rels));
 const all:ScheduleEntity[]=[];let rowCount=0,usedSheets=0;
 sheets.forEach((sheet,index)=>{
  const file=files[sheet.path];if(!file)return;
  const rows=worksheetRows(strFromU8(file),strings);rowCount+=rows.length;if(rows.length)usedSheets++;
  const parsed=asSchedule(rows,source,discipline,floor,'xlsx-'+index,{officeFormat:'XLSX',workbookSheet:sheet.name,workbookSheetIndex:index+1});
  all.push(...parsed.entities);
 });
 return{
  entities:all,
  summary:String(usedSheets)+' worksheet(s) · '+String(rowCount)+' populated row(s) · '+String(all.length)+' powered equipment candidate(s) extracted · non-spatial until drawing/BIM geometry is reconciled.',
  details:{format:'XLSX',sheetCount:usedSheets,rowCount,textBlockCount:rowCount}
 };
}

function docxTables(xml:string){
 const tables:string[][][]=[];let tableMatch:RegExpExecArray|null;
 const tableRe=/<(?:\w+:)?tbl\b[^>]*>([\s\S]*?)<\/(?:\w+:)?tbl>/gi;
 while((tableMatch=tableRe.exec(xml))){
  const rows:string[][]=[];let rowMatch:RegExpExecArray|null;
  const rowRe=/<(?:\w+:)?tr\b[^>]*>([\s\S]*?)<\/(?:\w+:)?tr>/gi;
  while((rowMatch=rowRe.exec(tableMatch[1]))){
   const cells:string[]=[];let cellMatch:RegExpExecArray|null;
   const cellRe=/<(?:\w+:)?tc\b[^>]*>([\s\S]*?)<\/(?:\w+:)?tc>/gi;
   while((cellMatch=cellRe.exec(rowMatch[1])))cells.push(textNodes(cellMatch[1]).join(' ').replace(/\s+/g,' ').trim());
   if(cells.length)rows.push(cells);
  }
  if(rows.length)tables.push(rows);
 }
 return tables;
}
function docxParagraphs(xml:string){
 const out:string[]=[];let match:RegExpExecArray|null;
 const re=/<(?:\w+:)?p\b[^>]*>([\s\S]*?)<\/(?:\w+:)?p>/gi;
 while((match=re.exec(xml))){
  const text=textNodes(match[1]).join(' ').replace(/\s+/g,' ').trim();
  if(text)out.push(text);
 }
 return out;
}
export function parseDocxBytes(bytes:Uint8Array,source:string,discipline:string,floor='UNRESOLVED'):StructuredOfficeResult{
 const files=unzipSync(bytes),document=files['word/document.xml'];
 if(!document)throw new Error('DOCX document.xml is missing');
 const xml=strFromU8(document),tables=docxTables(xml),paragraphs=docxParagraphs(xml);
 const all:ScheduleEntity[]=[];
 tables.forEach((rows,index)=>{
  const parsed=asSchedule(rows,source,discipline,floor,'docx-table-'+index,{officeFormat:'DOCX',documentTable:index+1});
  all.push(...parsed.entities);
 });
 const paragraphParsed=parseEquipmentScheduleText(paragraphs.join('\n'),source,discipline,floor);
 all.push(...sourceScoped(paragraphParsed.entities,'docx-paragraph',source,{officeFormat:'DOCX',documentSection:'PARAGRAPH_TEXT'}));
 const unique=[...new Map(all.map(entity=>[entity.id,entity])).values()];
 return{
  entities:unique,
  summary:String(tables.length)+' table(s) · '+String(paragraphs.length)+' paragraph(s) · '+String(unique.length)+' powered equipment/spec candidate(s) extracted · non-spatial until drawing/BIM geometry is reconciled.',
  details:{format:'DOCX',tableCount:tables.length,paragraphCount:paragraphs.length,textBlockCount:tables.length+paragraphs.length}
 };
}
