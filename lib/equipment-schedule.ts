import {poweredEquipmentClass} from './power-intelligence.ts';

export type ScheduleEntity={
 id:string;source:string;layer:'L4';kind:'schedule-powered-equipment-candidate';name:string;x:number;y:number;z:number;
 floor?:string;zone?:string;confidence:number;meta:Record<string,unknown>;
};

const ALIASES:Record<string,string[]>={
 tag:['tag','equipment tag','unit','unit tag','equipment id','equipment no','mark'],
 description:['description','equipment','equipment type','type','name','service'],
 manufacturer:['manufacturer','mfr','make'],model:['model','model no','model number'],
 location:['location','room','area','space','zone'],voltage:['voltage','volts','volt','v'],
 phase:['phase','phases','ph'],frequencyHz:['frequency','hz','frequency hz'],
 inputKw:['input kw','kw','power kw','electrical kw'],inputKva:['input kva','kva','power kva','electrical kva'],
 fla:['fla','full load amps'],rla:['rla','rated load amps'],lra:['lra','locked rotor amps'],
 mca:['mca','minimum circuit ampacity'],mocp:['mocp','maximum overcurrent protection','max overcurrent protection'],
 motorHp:['hp','motor hp','horsepower'],electricHeatKw:['electric heat kw','heat kw','heater kw','reheat kw']
};
const norm=(v:string)=>v.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const LOOKUP=new Map(Object.entries(ALIASES).flatMap(([key,values])=>values.map(value=>[norm(value),key] as const)));
const num=(value:unknown)=>{const m=String(value??'').replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);if(!m)return null;const n=Number(m[0]);return Number.isFinite(n)?n:null};
const phase=(value:unknown)=>{const s=String(value??'').toLowerCase();if(/\b3\s*(?:ph|phase)/.test(s)||s.trim()==='3')return 3;if(/\b1\s*(?:ph|phase)/.test(s)||s.trim()==='1')return 1;return num(value)};
function split(line:string,delimiter:string){const out:string[]=[];let value='',quoted=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++}else quoted=!quoted}else if(ch===delimiter&&!quoted){out.push(value.trim());value=''}else value+=ch}out.push(value.trim());return out}
function delimiter(lines:string[]){const sample=lines.slice(0,8).join('\n');const options=[',','\t',';'].map(d=>[d,sample.split(d).length-1] as const).sort((a,b)=>b[1]-a[1]);return options[0][1]>0?options[0][0]:null}
function mapHeaders(row:string[]){const map=new Map<string,number>();row.forEach((cell,index)=>{const key=LOOKUP.get(norm(cell));if(key&&!map.has(key))map.set(key,index)});return map}
const value=(row:string[],headers:Map<string,number>,key:string)=>{const index=headers.get(key);return index===undefined?'':String(row[index]??'').trim()};
function entityFromRow(source:string,discipline:string,floor:string,rowNumber:number,row:string[],headers:Map<string,number>):ScheduleEntity|null{
 const tag=value(row,headers,'tag'),description=value(row,headers,'description'),manufacturer=value(row,headers,'manufacturer'),model=value(row,headers,'model'),location=value(row,headers,'location');
 const values={voltage:num(value(row,headers,'voltage')),phase:phase(value(row,headers,'phase')),frequencyHz:num(value(row,headers,'frequencyHz')),inputKw:num(value(row,headers,'inputKw')),inputKva:num(value(row,headers,'inputKva')),fla:num(value(row,headers,'fla')),rla:num(value(row,headers,'rla')),lra:num(value(row,headers,'lra')),mca:num(value(row,headers,'mca')),mocp:num(value(row,headers,'mocp')),motorHp:num(value(row,headers,'motorHp')),electricHeatKw:num(value(row,headers,'electricHeatKw'))};
 const hasRating=Object.values(values).some(v=>v!==null),cls=poweredEquipmentClass(tag+' '+description);
 if((!cls&&!hasRating)||(!tag&&!description))return null;
 const rating=[values.voltage!==null?values.voltage+'V':'',values.phase!==null?values.phase+'PH':'',values.inputKw!==null?values.inputKw+' kW':'',values.inputKva!==null?values.inputKva+' kVA':'',values.fla!==null?'FLA '+values.fla:'',values.rla!==null?'RLA '+values.rla:'',values.lra!==null?'LRA '+values.lra:'',values.mca!==null?'MCA '+values.mca:'',values.mocp!==null?'MOCP '+values.mocp:'',values.motorHp!==null?values.motorHp+' HP':''].filter(Boolean).join(' ');
 const label=[tag||description,tag&&description?description:'',rating].filter(Boolean).join(' ');
 const rawId='schedule-'+rowNumber+'-'+(tag||description);
 return{id:rawId.replace(/[^a-zA-Z0-9:_-]+/g,'-').slice(0,280),source,layer:'L4',kind:'schedule-powered-equipment-candidate',name:label,x:0,y:0,z:0,floor,zone:location||undefined,confidence:hasRating&&tag?.length?0.9:hasRating?0.82:0.68,meta:{sourceType:'EQUIPMENT_SCHEDULE',scheduleRow:rowNumber,discipline,nonSpatial:true,physicalTruth:false,reviewRequired:true,spatialPlacementAuthority:'NON_SPATIAL_SCHEDULE',registrationState:'CANDIDATE',...(tag?{assetTag:tag}:{}),...(description?{scheduleDescription:description}:{}),...(manufacturer?{manufacturer}:{}),...(model?{model}:{}),...(location?{scheduleLocation:location}:{}),...(cls?{poweredEquipmentClass:cls}:{}),...Object.fromEntries(Object.entries(values).filter(([,v])=>v!==null))}};
}
function plain(text:string,source:string,discipline:string,floor:string){
 const entities:ScheduleEntity[]=[];
 text.split(/\r?\n/).forEach((raw,index)=>{const line=raw.trim();if(!line||line.length>1000)return;const cls=poweredEquipmentClass(line),hasRating=/\b\d+(?:\.\d+)?\s*(?:V|KV|KW|KVA|HP|A|AMP|AMPS)\b|\b(?:FLA|RLA|LRA|MCA|MOCP)\s*[:=]?\s*\d/i.test(line);if(!cls&&!hasRating)return;entities.push({id:('schedule-line-'+(index+1)+'-'+line).replace(/[^a-zA-Z0-9:_-]+/g,'-').slice(0,280),source,layer:'L4',kind:'schedule-powered-equipment-candidate',name:line,x:0,y:0,z:0,floor,confidence:cls&&hasRating?0.8:cls?0.68:0.58,meta:{sourceType:'TEXT_EQUIPMENT_SCHEDULE',scheduleRow:index+1,discipline,nonSpatial:true,physicalTruth:false,reviewRequired:true,spatialPlacementAuthority:'NON_SPATIAL_SCHEDULE',registrationState:'CANDIDATE',...(cls?{poweredEquipmentClass:cls}:{})}})});
 return entities;
}
export function parseEquipmentScheduleText(text:string,source:string,discipline:string,floor='UNRESOLVED'){
 const lines=text.split(/\r?\n/).filter(line=>line.trim());const d=delimiter(lines);
 if(!d){const entities=plain(text,source,discipline,floor);return{entities,summary:entities.length+' powered equipment candidate(s) extracted from text; non-spatial until linked to drawing/BIM geometry.'}}
 const rows=lines.map(line=>split(line,d));let headerIndex=0,best=-1;
 for(let i=0;i<Math.min(rows.length,10);i++){const h=mapHeaders(rows[i]);const score=h.size+(h.has('tag')?3:0)+(h.has('description')?2:0);if(score>best){best=score;headerIndex=i}}
 const headers=mapHeaders(rows[headerIndex]||[]);
 if(headers.size<2){const entities=plain(text,source,discipline,floor);return{entities,summary:'Delimited source found but schedule headers were not confidently mapped; '+entities.length+' text candidate(s) retained for review.'}}
 const entities:ScheduleEntity[]=[];for(let i=headerIndex+1;i<rows.length;i++){const entity=entityFromRow(source,discipline,floor,i+1,rows[i],headers);if(entity)entities.push(entity)}
 return{entities,summary:entities.length+' powered equipment candidate(s) extracted from schedule · '+headers.size+' recognized columns · non-spatial until geometry is reconciled.'};
}
