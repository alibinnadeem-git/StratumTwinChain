export type DxfPair={code:number;value:string};
export type DxfUnitInfo={unitName:string;unitToMeters:number;insunits:number};
export type DxfRecordValues=Record<number,string[]|undefined>;
export type DxfRecordZ={
 rawZ:number;
 rawZ2:number;
 zMeters:number;
 z2Meters:number;
 startExplicit:boolean;
 endExplicit:boolean;
 sourceDesignElevationKnown:boolean;
 sourceCode:number|null;
 endSourceCode:number|null;
};

const US_SURVEY_FOOT=1200/3937;
const UNIT_MAP:Record<number,[string,number]>={
 0:['unitless',1],1:['in',.0254],2:['ft',.3048],3:['mi',1609.344],4:['mm',.001],5:['cm',.01],6:['m',1],7:['km',1000],
 8:['microin',2.54e-8],9:['mil',2.54e-5],10:['yd',.9144],11:['angstrom',1e-10],12:['nm',1e-9],13:['micron',1e-6],14:['dm',.1],
 15:['dam',10],16:['hm',100],17:['gm',1e9],18:['au',149597870700],19:['lightyear',9.4607304725808e15],20:['parsec',3.085677581491367e16],
 21:['us-survey-ft',US_SURVEY_FOOT],22:['us-survey-in',US_SURVEY_FOOT/12],23:['us-survey-yd',US_SURVEY_FOOT*3],24:['us-survey-mi',US_SURVEY_FOOT*5280]
};

export function dxfUnitInfo(pairs:DxfPair[]):DxfUnitInfo{
 let code=0;
 for(let i=0;i<pairs.length-1;i++){
  if(pairs[i].code!==9||pairs[i].value!=='$INSUNITS')continue;
  const n=Number(pairs[i+1].value);if(Number.isFinite(n))code=n;break;
 }
 const [unitName,unitToMeters]=UNIT_MAP[code]||['unitless',1];
 return{unitName,unitToMeters,insunits:code};
}

function explicit(values:string[]|undefined,units:DxfUnitInfo){
 if(!Array.isArray(values)||values.length===0||units.insunits===0)return null;
 const raw=Number(values[0]);return Number.isFinite(raw)?raw:null;
}

export function dxfRecordZ(type:string,values:DxfRecordValues,units:DxfUnitInfo):DxfRecordZ{
 const normalized=String(type||'').toUpperCase();
 const primaryCode=normalized==='LWPOLYLINE'?38:30;
 const start=explicit(values[primaryCode],units);
 const lineEnd=normalized==='LINE'?explicit(values[31],units):null;
 const rawZ=start??0,rawZ2=lineEnd??rawZ;
 return{rawZ,rawZ2,zMeters:start===null?0:start*units.unitToMeters,z2Meters:lineEnd===null?(start===null?0:start*units.unitToMeters):lineEnd*units.unitToMeters,startExplicit:start!==null,endExplicit:lineEnd!==null,sourceDesignElevationKnown:start!==null||lineEnd!==null,sourceCode:start!==null?primaryCode:null,endSourceCode:lineEnd!==null?31:null};
}
