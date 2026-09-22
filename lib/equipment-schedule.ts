import {poweredEquipmentClass} from './power-intelligence.ts';

export type EquipmentScheduleRecord={
 rowIndex:number;
 rawText:string;
 equipmentClass:string;
 tag:string|null;
 description:string|null;
 manufacturer:string|null;
 model:string|null;
 voltage:number|null;
 phase:number|null;
 frequencyHz:number|null;
 inputKw:number|null;
 inputKva:number|null;
 fla:number|null;
 rla:number|null;
 lra:number|null;
 mca:number|null;
 mocp:number|null;
 motorHp:number|null;
 confidence:number;
};

const aliases={
 tag:['TAG','EQUIPMENTTAG','EQUIPMENTNO','EQUIPMENTNUMBER','MARK','ID','UNIT'],
 description:['DESCRIPTION','EQUIPMENT','EQUIPMENTDESCRIPTION','TYPE','SERVICE','NAME'],
 manufacturer:['MANUFACTURER','MFR','MAKE'],
 model:['MODEL','MODELNO','MODELNUMBER','CATALOG','CATALOGNO'],
 voltage:['VOLTAGE','VOLTS','V'],
 phase:['PHASE','PH','PHASES'],
 frequencyHz:['FREQUENCY','HZ','FREQ'],
 inputKw:['KW','INPUTKW','POWERKW','TOTALKW'],
 inputKva:['KVA','INPUTKVA','POWERKVA'],
 fla:['FLA','FULLLOADAMPS','FULLLOADCURRENT'],
 rla:['RLA','RATEDLOADAMPS'],
 lra:['LRA','LOCKEDROTORAMPS'],
 mca:['MCA','MINIMUMCIRCUITAMPACITY'],
 mocp:['MOCP','MAXOVERCURRENTPROTECTION','MOP'],
 motorHp:['HP','MOTORHP','HORSEPOWER'],
} as const;

const norm=(value:string)=>value.toUpperCase().replace(/[^A-Z0-9]+/g,'');
const finite=(value:unknown)=>{const n=Number(String(value??'').replace(/,/g,'').match(/-?\d+(?:\.\d+)?/)?.[0]);return Number.isFinite(n)?n:null};
const headerIndex=(headers:string[],keys:readonly string[])=>headers.findIndex(header=>keys.includes(norm(header) as never));

function splitDelimitedLine(line:string,delimiter:string){
 const out:string[]=[];let value='',quoted=false;
 for(let i=0;i<line.length;i++){
  const ch=line[i];
  if(ch==='"'){
   if(quoted&&line[i+1]==='"'){value+='"';i++;continue}
   quoted=!quoted;continue;
  }
  if(ch===delimiter&&!quoted){out.push(value.trim());value='';continue}
  value+=ch;
 }
 out.push(value.trim());
 return out;
}

function delimiterFor(text:string){
 const sample=text.split(/\r?\n/).slice(0,8).join('\n');
 const options=[',','\t',';','|'].map(delimiter=>({delimiter,count:sample.split(delimiter).length-1}));
 return options.sort((a,b)=>b.count-a.count)[0]?.count?options.sort((a,b)=>b.count-a.count)[0].delimiter:',';
}

function tagFromText(text:string){
 const match=text.toUpperCase().match(/\b(?:AHU|RTU|MAU|FCU|VAV|EF|SF|RF|PF|FP|JP|SMF|PMP|CH|CHLR|CT|CU|HP|WH|UH|HWP|CHWP|FACP|NAC|BMS|DDC|ELEV|EL|EVSE)[-_ ]?#?[A-Z0-9]+(?:[-_.][A-Z0-9]+)*\b/);
 return match?.[0]?.replace(/\s+/g,'-')||null;
}
function phaseValue(value:string){
 const n=finite(value);if(n===1||n===3)return n;
 if(/\b3\s*(?:PH|PHASE)/i.test(value))return 3;
 if(/\b1\s*(?:PH|PHASE)/i.test(value))return 1;
 return null;
}

function recordFromRow(rowIndex:number,cells:string[],headers:string[]|null):EquipmentScheduleRecord|null{
 const rawText=cells.filter(Boolean).join(' | ').trim();
 if(!rawText)return null;
 const equipmentClass=poweredEquipmentClass(rawText);
 if(!equipmentClass)return null;
 const get=(key:keyof typeof aliases)=>{
  if(!headers)return'';
  const index=headerIndex(headers,aliases[key]);
  return index>=0?String(cells[index]||'').trim():'';
 };
 const explicitFields=headers?Object.keys(aliases).some(key=>get(key as keyof typeof aliases).length>0):false;
 const tag=get('tag')||tagFromText(rawText);
 const description=get('description')||null;
 const manufacturer=get('manufacturer')||null;
 const model=get('model')||null;
 const voltage=finite(get('voltage'))??finite(rawText.match(/\b(\d{2,5}(?:\.\d+)?)\s*V(?:OLT)?S?\b/i)?.[1]);
 const phase=phaseValue(get('phase')||rawText);
 const frequencyHz=finite(get('frequencyHz'))??finite(rawText.match(/\b(\d{2,3})\s*HZ\b/i)?.[1]);
 const inputKw=finite(get('inputKw'))??finite(rawText.match(/\b(\d+(?:\.\d+)?)\s*KW\b/i)?.[1]);
 const inputKva=finite(get('inputKva'))??finite(rawText.match(/\b(\d+(?:\.\d+)?)\s*KVA\b/i)?.[1]);
 const fla=finite(get('fla'))??finite(rawText.match(/\bFLA\s*[:=]?\s*(\d+(?:\.\d+)?)/i)?.[1]);
 const rla=finite(get('rla'))??finite(rawText.match(/\bRLA\s*[:=]?\s*(\d+(?:\.\d+)?)/i)?.[1]);
 const lra=finite(get('lra'))??finite(rawText.match(/\bLRA\s*[:=]?\s*(\d+(?:\.\d+)?)/i)?.[1]);
 const mca=finite(get('mca'))??finite(rawText.match(/\bMCA\s*[:=]?\s*(\d+(?:\.\d+)?)/i)?.[1]);
 const mocp=finite(get('mocp'))??finite(rawText.match(/\b(?:MOCP|MOP)\s*[:=]?\s*(\d+(?:\.\d+)?)/i)?.[1]);
 const motorHp=finite(get('motorHp'))??finite(rawText.match(/\b(\d+(?:\.\d+)?)\s*HP\b/i)?.[1]);
 const electricalEvidence=[voltage,phase,frequencyHz,inputKw,inputKva,fla,rla,lra,mca,mocp,motorHp].filter(v=>v!==null).length;
 const confidence=Math.min(.97,.66+(explicitFields?.08:0)+(tag?.08:0)+Math.min(.15,electricalEvidence*.025));
 return{rowIndex,rawText,equipmentClass,tag:tag||null,description,manufacturer,model,voltage,phase,frequencyHz,inputKw,inputKva,fla,rla,lra,mca,mocp,motorHp,confidence};
}

export function parseEquipmentScheduleText(text:string):{records:EquipmentScheduleRecord[];delimiter:string;hasHeader:boolean}{
 const clean=text.replace(/^\uFEFF/,'').trim();
 if(!clean)return{records:[],delimiter:',',hasHeader:false};
 const delimiter=delimiterFor(clean);
 const rows=clean.split(/\r?\n/).map(line=>splitDelimitedLine(line,delimiter)).filter(cells=>cells.some(Boolean));
 if(!rows.length)return{records:[],delimiter,hasHeader:false};
 const first=rows[0].map(norm);
 const known=new Set(Object.values(aliases).flat());
 const headerHits=first.filter(value=>known.has(value as never)).length;
 const hasHeader=headerHits>=2;
 const headers=hasHeader?rows[0]:null;
 const data=hasHeader?rows.slice(1):rows;
 const records=data.map((cells,index)=>recordFromRow(index+(hasHeader?2:1),cells,headers)).filter((record):record is EquipmentScheduleRecord=>Boolean(record));
 return{records,delimiter,hasHeader};
}
