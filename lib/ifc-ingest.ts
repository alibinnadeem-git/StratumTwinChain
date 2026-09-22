import {poweredEquipmentClass} from './power-intelligence.ts';

export type IfcEntity={
 id:string;source:string;layer:'L1'|'L2'|'L3'|'L4';kind:string;name:string;
 x:number;y:number;z:number;floor?:string;zone?:string;confidence:number;meta:Record<string,unknown>;
};
export type IfcIngestResult={
 entities:IfcEntity[];summary:string;
 unitName:string;unitToMeters:number|null;
 details:{stepEntities:number;products:number;placed:number;nonSpatial:number;storeys:number;propertySets:number};
};

type StepRecord={id:number;type:string;args:string[];raw:string};
type Transform={r:number[][];t:[number,number,number]};
const I:Transform={r:[[1,0,0],[0,1,0],[0,0,1]],t:[0,0,0]};

function splitArgs(value:string){
 const out:string[]=[];let token='',depth=0,quoted=false;
 for(let i=0;i<value.length;i++){
  const ch=value[i];
  if(ch==="'"){
   token+=ch;
   if(quoted&&value[i+1]==="'"){token+="'";i++;continue}
   quoted=!quoted;continue;
  }
  if(!quoted){
   if(ch==='(')depth++;
   else if(ch===')')depth=Math.max(0,depth-1);
   else if(ch===','&&depth===0){out.push(token.trim());token='';continue}
  }
  token+=ch;
 }
 if(token.trim()||value.endsWith(','))out.push(token.trim());
 return out;
}
function parseStep(text:string){
 const stripped=text.replace(/\/\*[\s\S]*?\*\//g,'');
 const records=new Map<number,StepRecord>();let current='';
 for(const rawLine of stripped.split(/\r?\n/)){
  const line=rawLine.trim();if(!line||line.startsWith('ISO-')||line.startsWith('HEADER')||line.startsWith('DATA')||line.startsWith('ENDSEC')||line.startsWith('END-'))continue;
  current+=(current?' ':'')+line;
  if(!line.endsWith(';'))continue;
  const match=current.match(/^#(\d+)\s*=\s*([A-Z0-9_]+)\s*\(([\s\S]*)\)\s*;$/i);
  if(match){const id=Number(match[1]),type=match[2].toUpperCase();records.set(id,{id,type,args:splitArgs(match[3]),raw:current})}
  current='';
 }
 return records;
}
const ref=(value:string|undefined)=>{const m=String(value||'').match(/^#(\d+)$/);return m?Number(m[1]):null};
const refs=(value:string|undefined)=>[...String(value||'').matchAll(/#(\d+)/g)].map(m=>Number(m[1]));
function str(value:string|undefined){
 const v=String(value||'').trim();if(v==='$'||v==='*'||!v)return'';
 if(v.startsWith("'")&&v.endsWith("'"))return v.slice(1,-1).replace(/''/g,"'");
 return v.replace(/^\.(.*)\.$/,'$1');
}
function num(value:string|undefined){
 const m=String(value||'').match(/[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:E[-+]?\d+)?/i);if(!m)return null;
 const n=Number(m[0]);return Number.isFinite(n)?n:null;
}
function normalize(v:number[]){const length=Math.hypot(...v)||1;return v.map(n=>n/length)}
function cross(a:number[],b:number[]){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function mul(a:Transform,b:Transform):Transform{
 const r=Array.from({length:3},(_,i)=>Array.from({length:3},(_,j)=>a.r[i][0]*b.r[0][j]+a.r[i][1]*b.r[1][j]+a.r[i][2]*b.r[2][j]));
 const bt=b.t;
 const t:[number,number,number]=[
  a.t[0]+a.r[0][0]*bt[0]+a.r[0][1]*bt[1]+a.r[0][2]*bt[2],
  a.t[1]+a.r[1][0]*bt[0]+a.r[1][1]*bt[1]+a.r[1][2]*bt[2],
  a.t[2]+a.r[2][0]*bt[0]+a.r[2][1]*bt[1]+a.r[2][2]*bt[2]
 ];
 return{r,t};
}
function listNumbers(value:string|undefined){
 const body=String(value||'').replace(/^\(/,'').replace(/\)$/,'');
 return splitArgs(body).map(num).filter((v):v is number=>v!==null);
}
function point(record:StepRecord|undefined){
 if(!record||record.type!=='IFCCARTESIANPOINT')return[0,0,0] as [number,number,number];
 const n=listNumbers(record.args[0]);return[n[0]||0,n[1]||0,n[2]||0] as [number,number,number];
}
function direction(record:StepRecord|undefined,otherwise:number[]){
 if(!record||record.type!=='IFCDIRECTION')return otherwise;
 const n=listNumbers(record.args[0]);return normalize([n[0]||0,n[1]||0,n[2]||0]);
}
function axisTransform(record:StepRecord|undefined,records:Map<number,StepRecord>):Transform{
 if(!record)return I;
 if(record.type==='IFCAXIS2PLACEMENT3D'){
  const origin=point(records.get(ref(record.args[0])||-1));
  const z=direction(records.get(ref(record.args[1])||-1),[0,0,1]);
  let x=direction(records.get(ref(record.args[2])||-1),[1,0,0]);
  const dot=x[0]*z[0]+x[1]*z[1]+x[2]*z[2];x=normalize([x[0]-dot*z[0],x[1]-dot*z[1],x[2]-dot*z[2]]);
  const y=normalize(cross(z,x));
  return{r:[[x[0],y[0],z[0]],[x[1],y[1],z[1]],[x[2],y[2],z[2]]],t:origin};
 }
 if(record.type==='IFCAXIS2PLACEMENT2D'){
  const origin=point(records.get(ref(record.args[0])||-1));
  const x2=direction(records.get(ref(record.args[1])||-1),[1,0,0]);const x=normalize([x2[0],x2[1],0]);const y=[-x[1],x[0],0];
  return{r:[[x[0],y[0],0],[x[1],y[1],0],[0,0,1]],t:origin};
 }
 return I;
}
function localTransform(id:number|null,records:Map<number,StepRecord>,cache=new Map<number,Transform>(),visiting=new Set<number>()):Transform|null{
 if(!id)return null;if(cache.has(id))return cache.get(id)!;if(visiting.has(id))return null;
 const record=records.get(id);if(!record||record.type!=='IFCLOCALPLACEMENT')return null;
 visiting.add(id);
 const parentId=ref(record.args[0]),axisId=ref(record.args[1]);
 const local=axisTransform(records.get(axisId||-1),records);
 const parent=parentId?localTransform(parentId,records,cache,visiting):I;
 visiting.delete(id);if(!parent)return null;
 const result=mul(parent,local);cache.set(id,result);return result;
}
function siUnit(records:Map<number,StepRecord>){
 const prefixScale:Record<string,number>={EXA:1e18,PETA:1e15,TERA:1e12,GIGA:1e9,MEGA:1e6,KILO:1e3,HECTO:1e2,DECA:1e1,DECI:1e-1,CENTI:1e-2,MILLI:1e-3,MICRO:1e-6,NANO:1e-9,PICO:1e-12,FEMTO:1e-15,ATTO:1e-18};
 for(const record of records.values()){
  if(record.type!=='IFCSIUNIT'||str(record.args[1]).toUpperCase()!=='LENGTHUNIT')continue;
  const prefix=str(record.args[2]).toUpperCase(),name=str(record.args[3]).toUpperCase();
  if(name==='METRE')return{unitName:prefix?prefix.toLowerCase()+'metre':'m',unitToMeters:prefix?prefixScale[prefix]??null:1};
 }
 for(const record of records.values()){
  if(record.type!=='IFCCONVERSIONBASEDUNIT'||str(record.args[1]).toUpperCase()!=='LENGTHUNIT')continue;
  const name=str(record.args[2]);const measure=records.get(ref(record.args[3])||-1);
  if(!measure||measure.type!=='IFCMEASUREWITHUNIT')continue;
  const factor=num(measure.args[0]);if(factor!==null)return{unitName:name||'conversion-based',unitToMeters:factor};
 }
 return{unitName:'unresolved',unitToMeters:null as number|null};
}
function nominal(value:string|undefined){
 const v=String(value||'').trim();if(!v||v==='$')return null;
 const typed=v.match(/^[A-Z0-9_]+\(([\s\S]*)\)$/i);if(typed){
  const inner=typed[1].trim();
  if(inner.startsWith("'"))return str(inner);
  const n=num(inner);return n===null?str(inner):n;
 }
 const n=num(v);return n===null?str(v):n;
}
const propertyAliases:Record<string,string>={
 RATEDVOLTAGE:'voltage',VOLTAGE:'voltage',NOMINALVOLTAGE:'voltage',
 NUMBEROFPHASES:'phase',PHASE:'phase',PHASES:'phase',
 INPUTPOWER:'inputKw',POWERINPUT:'inputKw',RATEDPOWER:'inputKw',
 APPARENTPOWER:'inputKva',
 FULLLOADCURRENT:'fla',FULLLOADAMPS:'fla',FLA:'fla',
 RATEDLOADCURRENT:'rla',RLA:'rla',LOCKEDROTORCURRENT:'lra',LRA:'lra',
 MINIMUMCIRCUITAMPACITY:'mca',MCA:'mca',MAXIMUMOVERCURRENTPROTECTION:'mocp',MOCP:'mocp',
 MOTORPOWER:'motorHp',HORSEPOWER:'motorHp',
 MANUFACTURER:'manufacturer',MANUFACTURERNAME:'manufacturer',MODEL:'model',MODELNUMBER:'model'
};
function propertyData(records:Map<number,StepRecord>){
 const singles=new Map<number,{key:string;value:unknown}>();
 for(const rec of records.values()){
  if(rec.type!=='IFCPROPERTYSINGLEVALUE')continue;
  const key=propertyAliases[str(rec.args[0]).toUpperCase().replace(/[^A-Z0-9]/g,'')];if(!key)continue;
  let value=nominal(rec.args[2]);
  if(typeof value==='number'&&key==='inputKw'){const raw=String(rec.args[2]||'').toUpperCase();if(raw.includes('POWERMEASURE')&&Math.abs(value)>1000)value=value/1000}
  singles.set(rec.id,{key,value});
 }
 const psets=new Map<number,Record<string,unknown>>();
 for(const rec of records.values()){
  if(rec.type!=='IFCPROPERTYSET')continue;
  const data:Record<string,unknown>={};for(const id of refs(rec.args[4])){const p=singles.get(id);if(p&&p.value!==null)data[p.key]=p.value}
  if(Object.keys(data).length)psets.set(rec.id,data);
 }
 const byObject=new Map<number,Record<string,unknown>>();
 for(const rec of records.values()){
  if(rec.type!=='IFCRELDEFINESBYPROPERTIES')continue;
  const pset=psets.get(ref(rec.args[5])||-1);if(!pset)continue;
  for(const id of refs(rec.args[4]))byObject.set(id,{...(byObject.get(id)||{}),...pset});
 }
 return{byObject,propertySetCount:psets.size};
}
const architectural=/^IFC(?:WALL|WALLSTANDARDCASE|SLAB|ROOF|DOOR|WINDOW|STAIR|STAIRFLIGHT|RAMP|RAMPFLIGHT|CURTAINWALL|BUILDINGELEMENTPROXY)$/;
const structural=/^IFC(?:COLUMN|BEAM|MEMBER|PLATE|FOOTING|PILE|REINFORCINGBAR|REINFORCINGMESH)$/;
const electrical=/^IFC(?:ELECTRIC|SWITCH|PROTECTIVE|TRANSFORMER|DISTRIBUTIONBOARD|CABLE|OUTLET|LIGHTFIXTURE|LAMP|JUNCTIONBOX|MOTOR)/;
const logical=/^IFC(?:CABLECARRIERSEGMENT|CABLESEGMENT)$/;
const mep=/^IFC(?:AIR|BOILER|CHILLER|COIL|CONDENSER|COOLEDBEAM|FAN|HEATEXCHANGER|HUMIDIFIER|UNITARYEQUIPMENT|PUMP|FLOW|ENERGYCONVERSION|FIRESUPPRESSION|SANITARY|VALVE|DAMPER|SENSOR|ACTUATOR|CONTROLLER|DISTRIBUTIONCONTROL|TANK|SPACEHEATER)/;
function layer(type:string):IfcEntity['layer']{if(architectural.test(type)||structural.test(type))return'L1';if(logical.test(type))return'L3';if(electrical.test(type))return'L2';return'L4'}
function discipline(type:string,fallback:string){if(electrical.test(type)||logical.test(type))return'Electrical';if(structural.test(type))return'Structural';if(architectural.test(type))return'Architectural';if(/FIRE/.test(type))return'Fire Protection';if(mep.test(type))return'Mechanical';return fallback||'Unclassified'}
function product(type:string){return architectural.test(type)||structural.test(type)||electrical.test(type)||logical.test(type)||mep.test(type)||/^IFC(?:FURNISHINGELEMENT|TRANSPORTELEMENT|ELEMENTASSEMBLY)$/.test(type)}
function storeyMap(records:Map<number,StepRecord>){
 const storeys=new Map<number,{name:string;elevation:number|null}>();
 for(const rec of records.values())if(rec.type==='IFCBUILDINGSTOREY')storeys.set(rec.id,{name:str(rec.args[2])||str(rec.args[7])||'UNRESOLVED',elevation:num(rec.args[9])});
 const objectStorey=new Map<number,number>();
 for(const rec of records.values())if(rec.type==='IFCRELCONTAINEDINSPATIALSTRUCTURE'){const sid=ref(rec.args[5]);if(sid&&storeys.has(sid))for(const id of refs(rec.args[4]))objectStorey.set(id,sid)}
 return{storeys,objectStorey};
}

export function parseIfcText(text:string,source:string,fallbackDiscipline='Unclassified'):IfcIngestResult{
 const records=parseStep(text),units=siUnit(records),props=propertyData(records),spatial=storeyMap(records),cache=new Map<number,Transform>(),entities:IfcEntity[]=[];
 let placed=0,nonSpatial=0;
 for(const rec of records.values()){
  if(!product(rec.type))continue;
  const globalId=str(rec.args[0]),name=str(rec.args[2]),objectType=str(rec.args[4]),placementRef=ref(rec.args[5]),tag=str(rec.args[7]);
  const data=props.byObject.get(rec.id)||{},assetTag=tag||String(data.assetTag||'').trim();
  const label=[assetTag,name||objectType||rec.type].filter(Boolean).join(' · ');
  const transform=localTransform(placementRef,records,cache),hasUnit=units.unitToMeters!==null,hasPlacement=Boolean(transform);
  const canPlace=hasUnit&&hasPlacement;
  const factor=units.unitToMeters||1;
  const x=(transform?.t[0]||0)*factor,y=(transform?.t[1]||0)*factor,z=(transform?.t[2]||0)*factor;
  const sid=spatial.objectStorey.get(rec.id),storey=sid?spatial.storeys.get(sid):null;
  const d=discipline(rec.type,fallbackDiscipline),powered=poweredEquipmentClass(label);
  if(canPlace)placed++;else nonSpatial++;
  entities.push({
   id:'ifc-'+rec.id,source,layer:layer(rec.type),kind:canPlace?'ifc-product-placement':'ifc-product-nonspatial',name:label||rec.type,
   x,y,z,floor:storey?.name||undefined,zone:storey?.name||undefined,confidence:canPlace?.96:.76,
   meta:{
    sourceType:'IFC_STEP_PRODUCT',ifcExpressId:rec.id,ifcType:rec.type,ifcGlobalId:globalId||null,ifcObjectType:objectType||null,
    ...(assetTag?{assetTag}:{}),...(powered?{poweredEquipmentClass:powered}:{}),...data,
    discipline:d,ifcUnitName:units.unitName,ifcUnitToMeters:units.unitToMeters,
    ifcPlacementRef:placementRef,ifcPlacementResolved:canPlace,
    coordinateUnits:canPlace?'m_ifc_design':'ifc_project_unit_unresolved',
    sourceDesignCoordinate:true,sourceDesignElevationKnown:canPlace,physicalTruth:false,reviewRequired:true,
    cadMetricXY:canPlace,geometryAuthority:'IFC_PLACEMENT_ONLY_NO_SHAPE_MESH',
    nonSpatial:!canPlace,
    zPlacementAuthority:canPlace?'SOURCE_IFC_DESIGN_PLACEMENT':'UNRESOLVED',
    spatialPlacementAuthority:canPlace?'IFC_LOCAL_PLACEMENT':'IFC_PLACEMENT_OR_UNIT_UNRESOLVED',
    ...(storey?{ifcStorey:storey.name,ifcStoreyElevation:storey.elevation}:{}),
    registrationState:'CANDIDATE'
   }
  });
 }
 return{
  entities,
  summary:String(records.size)+' IFC STEP records · '+String(entities.length)+' supported products · '+String(placed)+' placement(s) resolved · '+String(nonSpatial)+' non-spatial/review · '+String(spatial.storeys.size)+' storey(s) · units '+units.unitName+' · shape meshes not yet triangulated',
  unitName:units.unitName,unitToMeters:units.unitToMeters,
  details:{stepEntities:records.size,products:entities.length,placed,nonSpatial,storeys:spatial.storeys.size,propertySets:props.propertySetCount}
 };
}
