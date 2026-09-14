export type PdfSpatialTextItem={
 str:string;
 x:number;
 y:number;
 page:number;
};

export type PdfSheetMetadata={
 page:number;
 sheetNumber?:string;
 sheetTitle?:string;
 revision?:string;
 floor:'UNRESOLVED'|string;
 discipline:'Architectural'|'Electrical'|'Mechanical'|'Plumbing'|'Civil'|'Unclassified';
 scaleText?:string;
 scaleRatio?:number;
 titleBlockDetected:boolean;
 alignmentKey?:string;
 confidence:number;
 evidence:string[];
};

const clean=(value:string)=>value.replace(/\s+/g,' ').trim();
const upper=(value:string)=>clean(value).toUpperCase();

export function inferPdfFloor(text:string[],fileName=''):'UNRESOLVED'|string{
 const hints=new Set<string>();
 for(const raw of text){
  const value=upper(raw);
  let match=value.match(/^(?:PROPOSED |EXISTING |NEW )?(?:LEVEL|FLOOR)\s*[-:]?\s*(\d{1,2})(?:\s+(?:FLOOR |ELECTRICAL |LIGHTING |POWER |ARCHITECTURAL )?PLAN)?$/);
  if(match)hints.add(`L${Number(match[1])}`);
  match=value.match(/\b(?:LEVEL|FLOOR|LVL)\s*[-:]?\s*(\d{1,2})\b/);
  if(match)hints.add(`L${Number(match[1])}`);
  if(/^(?:GROUND|FIRST) FLOOR(?: PLAN)?$/.test(value))hints.add('L1');
  if(/^SECOND FLOOR(?: PLAN)?$/.test(value))hints.add('L2');
  if(/^THIRD FLOOR(?: PLAN)?$/.test(value))hints.add('L3');
  if(/\bROOF(?: PLAN)?\b/.test(value))hints.add('ROOF');
  if(/\bBASEMENT(?: LEVEL)?\b|\bB1\b/.test(value))hints.add('B1');
 }
 if(hints.size===1)return [...hints][0];
 if(hints.size>1)return 'UNRESOLVED';
 const file=upper(fileName);
 const match=file.match(/(?:LEVEL|FLOOR|LVL|FL)[-_ ]?(\d{1,2})/);
 if(match)return `L${Number(match[1])}`;
 if(/ROOF|PENTHOUSE/.test(file))return'ROOF';
 if(/BASEMENT|\bB1\b|PARKING/.test(file))return'B1';
 return'UNRESOLVED';
}

export function inferPdfDiscipline(text:string[],sheetNumber?:string,fileName=''):PdfSheetMetadata['discipline']{
 const corpus=upper(`${sheetNumber||''} ${fileName} ${text.join(' ')}`);
 if(/\bE[-.]?\d|ELECTRICAL|POWER|LIGHTING|ONE[- ]?LINE|PANEL/.test(corpus))return'Electrical';
 if(/\bA[-.]?\d|ARCHITECTURAL|FLOOR PLAN|REFLECTED CEILING/.test(corpus))return'Architectural';
 if(/\bM[-.]?\d|MECHANICAL|HVAC/.test(corpus))return'Mechanical';
 if(/\bP[-.]?\d|PLUMBING/.test(corpus))return'Plumbing';
 if(/\bC[-.]?\d|CIVIL|GRADING|DRAINAGE/.test(corpus))return'Civil';
 return'Unclassified';
}

export function parsePdfScale(value:string):{text:string;ratio:number}|null{
 const text=clean(value);
 let match=text.match(/\b1\s*:\s*(\d+(?:\.\d+)?)\b/);
 if(match){const ratio=Number(match[1]);return ratio>0?{text,ratio}:null;}
 match=text.match(/(\d+)\s*\/\s*(\d+)\s*["”]\s*=\s*(\d+(?:\.\d+)?)\s*['’](?:\s*-\s*(\d+(?:\.\d+)?)\s*["”])?/i);
 if(match){
  const drawingInches=Number(match[1])/Number(match[2]);
  const realInches=Number(match[3])*12+Number(match[4]||0);
  const ratio=realInches/drawingInches;
  return Number.isFinite(ratio)&&ratio>0?{text,ratio}:null;
 }
 match=text.match(/(\d+(?:\.\d+)?)\s*["”]\s*=\s*(\d+(?:\.\d+)?)\s*['’](?:\s*-\s*(\d+(?:\.\d+)?)\s*["”])?/i);
 if(match){
  const drawingInches=Number(match[1]);
  const realInches=Number(match[2])*12+Number(match[3]||0);
  const ratio=realInches/drawingInches;
  return Number.isFinite(ratio)&&ratio>0?{text,ratio}:null;
 }
 return null;
}

function sheetNumberCandidate(value:string){
 const normalized=upper(value).replace(/\s/g,'');
 if(!/^[A-Z]{1,3}[-.]?\d{2,4}(?:\.\d{1,2})?$/.test(normalized))return null;
 if(/^REV/i.test(normalized))return null;
 return normalized;
}

function revisionCandidate(value:string){
 const normalized=upper(value);
 const match=normalized.match(/^(?:REV(?:ISION)?\s*[:#-]?\s*)?([A-Z]|\d{1,2})$/);
 return match?.[1];
}

function titleCandidate(value:string){
 const normalized=upper(value);
 if(normalized.length<5||normalized.length>120)return false;
 return /PLAN|DIAGRAM|SCHEDULE|DETAIL|ELEVATION|RISER|ONE[- ]?LINE|POWER|LIGHTING|ELECTRICAL|ARCHITECTURAL|MECHANICAL|PLUMBING|SITE/.test(normalized);
}

export function inferPdfSheetMetadata(items:PdfSpatialTextItem[],page:number,fileName=''):PdfSheetMetadata{
 const pageItems=items.filter(item=>item.page===page&&clean(item.str));
 const text=pageItems.map(item=>clean(item.str));
 const titleBlock=pageItems.filter(item=>item.x>=.55&&item.y>=.68);
 const preferred=titleBlock.length?titleBlock:pageItems;
 const evidence:string[]=[];

 let sheetNumber:string|undefined;
 for(const item of preferred){const candidate=sheetNumberCandidate(item.str);if(candidate){sheetNumber=candidate;break;}}
 if(sheetNumber)evidence.push(`sheet-number:${sheetNumber}`);

 let sheetTitle:string|undefined;
 const titles=preferred.filter(item=>titleCandidate(item.str)).sort((a,b)=>b.str.length-a.str.length);
 if(titles[0])sheetTitle=clean(titles[0].str);
 if(sheetTitle)evidence.push(`sheet-title:${sheetTitle}`);

 let revision:string|undefined;
 const revLabelIndex=preferred.findIndex(item=>/^REV(?:ISION)?$/i.test(clean(item.str)));
 if(revLabelIndex>=0){
  const nearby=preferred.slice(revLabelIndex+1,revLabelIndex+4).map(item=>revisionCandidate(item.str)).find(Boolean);
  if(nearby)revision=nearby;
 }
 if(revision)evidence.push(`revision:${revision}`);

 let parsedScale:{text:string;ratio:number}|null=null;
 for(const item of preferred){parsedScale=parsePdfScale(item.str);if(parsedScale)break;}
 if(parsedScale)evidence.push(`scale:${parsedScale.text}`);

 const floor=inferPdfFloor(text,fileName);
 if(floor!=='UNRESOLVED')evidence.push(`floor:${floor}`);
 const discipline=inferPdfDiscipline(text,sheetNumber,fileName);
 if(discipline!=='Unclassified')evidence.push(`discipline:${discipline}`);
 const titleBlockDetected=titleBlock.length>=2&&(Boolean(sheetNumber)||Boolean(sheetTitle));
 if(titleBlockDetected)evidence.push('title-block:position-supported');

 const alignmentKey=sheetNumber&&floor!=='UNRESOLVED'?`${sheetNumber}|${floor}|${discipline}`:undefined;
 if(alignmentKey)evidence.push(`alignment-key:${alignmentKey}`);

 let confidence=.2;
 if(sheetNumber)confidence+=.2;
 if(sheetTitle)confidence+=.15;
 if(floor!=='UNRESOLVED')confidence+=.15;
 if(discipline!=='Unclassified')confidence+=.1;
 if(parsedScale)confidence+=.1;
 if(titleBlockDetected)confidence+=.1;
 confidence=Math.min(.95,Number(confidence.toFixed(2)));

 return{
  page,
  sheetNumber,
  sheetTitle,
  revision,
  floor,
  discipline,
  scaleText:parsedScale?.text,
  scaleRatio:parsedScale?.ratio,
  titleBlockDetected,
  alignmentKey,
  confidence,
  evidence
 };
}

export function pdfBoundaryCanBecomeRoom(input:{
 area:number;
 containingRoomLabels:number;
 metadata:PdfSheetMetadata;
 closed:boolean;
}):boolean{
 return input.closed&&input.area>=.25&&input.area<=160&&input.containingRoomLabels===1&&input.metadata.floor!=='UNRESOLVED'&&input.metadata.confidence>=.55;
}
