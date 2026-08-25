export type PredictiveInput={
  id:string;asset_code:string;asset_type:string;name:string;site_name:string;status:string;installed_at?:Date|null;specifications?:Record<string,unknown>|null;
};

export type PredictiveState={
  assetId:string;assetCode:string;name:string;assetType:string;site:string;healthScore:number;risk:'LOW'|'MODERATE'|'HIGH'|'CRITICAL';impact:'LOW'|'MODERATE'|'HIGH'|'CRITICAL';confidence:number;remainingUsefulLifeYears:number|null;anomalies:string[];recommendation:string;signals:{label:string;value:string;status:'normal'|'watch'|'alert'}[];
};

const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:null;
const str=(v:unknown)=>typeof v==='string'?v:null;
const clamp=(n:number,min=0,max=100)=>Math.max(min,Math.min(max,n));

export function scorePredictiveAsset(a:PredictiveInput):PredictiveState{
  const s=a.specifications||{};
  const temperature=num(s.temperature_c),baseline=num(s.baseline_temperature_c),load=num(s.load_percent),faults=num(s.fault_count_30d)||0,trips=num(s.trip_count)||0,vibration=num(s.vibration_mm_s),pf=num(s.power_factor),thd=num(s.thd_percent),hours=num(s.operating_hours),expectedLife=num(s.expected_life_years);
  let score=100;const anomalies:string[]=[];const signals:PredictiveState['signals']=[];
  if(temperature!==null){const delta=baseline!==null?temperature-baseline:null;signals.push({label:'Temperature',value:`${temperature.toFixed(1)}°C`,status:delta!==null&&delta>15?'alert':delta!==null&&delta>8?'watch':'normal'});if(delta!==null&&delta>8){score-=delta>15?24:12;anomalies.push(`Temperature ${delta.toFixed(1)}°C above baseline`);}}
  if(load!==null){signals.push({label:'Load',value:`${load.toFixed(0)}%`,status:load>95?'alert':load>85?'watch':'normal'});if(load>85){score-=load>95?18:8;anomalies.push(`Sustained load at ${load.toFixed(0)}%`);}}
  if(vibration!==null){signals.push({label:'Vibration',value:`${vibration.toFixed(2)} mm/s`,status:vibration>7.1?'alert':vibration>4.5?'watch':'normal'});if(vibration>4.5){score-=vibration>7.1?20:10;anomalies.push('Vibration above normal operating band');}}
  if(pf!==null){signals.push({label:'Power factor',value:pf.toFixed(2),status:pf<.85?'alert':pf<.92?'watch':'normal'});if(pf<.92){score-=pf<.85?12:6;anomalies.push('Power factor degradation detected');}}
  if(thd!==null){signals.push({label:'THD',value:`${thd.toFixed(1)}%`,status:thd>8?'alert':thd>5?'watch':'normal'});if(thd>5){score-=thd>8?12:6;anomalies.push('Harmonic distortion elevated');}}
  if(faults>0){score-=Math.min(24,faults*6);anomalies.push(`${faults} fault event${faults===1?'':'s'} in last 30 days`);signals.push({label:'30d faults',value:String(faults),status:faults>2?'alert':'watch'});}
  if(trips>0){score-=Math.min(12,trips*2);signals.push({label:'Trip count',value:String(trips),status:trips>4?'watch':'normal'});}
  score=clamp(Math.round(score));
  const impactRaw=(str(s.criticality)||'MODERATE').toUpperCase();
  const impact=(['LOW','MODERATE','HIGH','CRITICAL'].includes(impactRaw)?impactRaw:'MODERATE') as PredictiveState['impact'];
  let risk:PredictiveState['risk']=score<45?'CRITICAL':score<65?'HIGH':score<82?'MODERATE':'LOW';
  if(impact==='CRITICAL'&&risk==='MODERATE')risk='HIGH';
  let remainingUsefulLifeYears:number|null=null;
  if(expectedLife&&a.installed_at){const age=(Date.now()-new Date(a.installed_at).getTime())/(365.25*24*3600*1000);const usageFactor=hours?Math.max(1,hours/(Math.max(age,1)*8760*.65)):1;remainingUsefulLifeYears=Math.max(0,Number((expectedLife-age*usageFactor).toFixed(1)));}
  const recommendation=risk==='CRITICAL'?'Create immediate inspection work order and engineering review.':risk==='HIGH'?'Schedule targeted inspection within 14 days and capture diagnostic evidence.':risk==='MODERATE'?'Increase monitoring frequency and review during next planned maintenance window.':'Continue normal monitoring and preventive maintenance cadence.';
  return {assetId:a.id,assetCode:a.asset_code,name:a.name,assetType:a.asset_type,site:a.site_name,healthScore:score,risk,impact,confidence:signals.length?Math.min(96,72+signals.length*4):45,remainingUsefulLifeYears,anomalies,recommendation,signals};
}
