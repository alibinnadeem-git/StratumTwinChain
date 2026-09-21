export type ElectricalComponent={
  key:string;
  name:string;
  category:string;
  aliases:string[];
  twinShape:'transformer'|'cabinet'|'panel'|'breaker'|'meter'|'busduct'|'receptacle'|'junction'|'conduit'|'tray'|'light'|'motor'|'generator'|'battery'|'ground'|'rack'|'sensor'|'evse'|'solar';
  trackAsAsset:boolean;
  manufacturer?:string;
  modelFamily?:string;
};

export const ELECTRICAL_CATEGORIES=[
  'Power Intake & Utility','Distribution Equipment','Circuit Protection','Power Transformation',
  'Power Distribution Devices','Wiring Devices & Outlets','Conduit & Cable Management','Lighting Systems',
  'Motor Control & Drives','Backup Power Systems','Earthing & Bonding','Low Voltage Systems',
  'Renewable & EV Infrastructure','Sensors & Monitoring Devices'
] as const;

export const ELECTRICAL_COMPONENTS:ElectricalComponent[]=[
 {key:'utility-transformer',name:'Utility Transformer',category:'Power Intake & Utility',aliases:['utility transformer','service transformer','xfmr','xfr'],twinShape:'transformer',trackAsAsset:true},
 {key:'pad-mount-transformer',name:'Pad-Mount Transformer',category:'Power Intake & Utility',aliases:['pad mount transformer','pad-mounted transformer'],twinShape:'transformer',trackAsAsset:true},
 {key:'utility-switchgear',name:'Utility Switchgear',category:'Power Intake & Utility',aliases:['utility switchgear','service switchgear','switchgear','swgr','swg'],twinShape:'cabinet',trackAsAsset:true},
 {key:'metering-cabinet',name:'Metering Cabinet',category:'Power Intake & Utility',aliases:['metering cabinet','meter cabinet'],twinShape:'meter',trackAsAsset:true},
 {key:'service-entrance',name:'Service Entrance Equipment',category:'Power Intake & Utility',aliases:['service entrance','service equipment','utility service','incoming service'],twinShape:'cabinet',trackAsAsset:true},

 {key:'main-switchboard',name:'Main Switchboard',category:'Distribution Equipment',aliases:['main switchboard','msb','switchboard','swbd','mdb','mdp'],twinShape:'cabinet',trackAsAsset:true},
 {key:'distribution-panel',name:'Distribution Panel',category:'Distribution Equipment',aliases:['distribution panel','distribution board'],twinShape:'panel',trackAsAsset:true},
 {key:'panelboard',name:'Panelboard',category:'Distribution Equipment',aliases:['panelboard','panel board','panel lp','panel pp','panel','pnl'],twinShape:'panel',trackAsAsset:true},
 {key:'power-distribution-unit',name:'Power Distribution Unit (PDU)',category:'Distribution Equipment',aliases:['power distribution unit','pdu'],twinShape:'cabinet',trackAsAsset:true},
 {key:'lv-switchboard',name:'Low-Voltage Switchboard',category:'Distribution Equipment',aliases:['lv switchboard','low voltage switchboard'],twinShape:'cabinet',trackAsAsset:true},
 {key:'busduct',name:'Busduct / Busway',category:'Distribution Equipment',aliases:['busduct','bus duct','busway'],twinShape:'busduct',trackAsAsset:true},

 {key:'acb',name:'Air Circuit Breaker (ACB)',category:'Circuit Protection',aliases:['air circuit breaker','acb'],twinShape:'breaker',trackAsAsset:true},
 {key:'mccb',name:'Molded Case Circuit Breaker (MCCB)',category:'Circuit Protection',aliases:['molded case circuit breaker','mccb'],twinShape:'breaker',trackAsAsset:true},
 {key:'mcb',name:'Miniature Circuit Breaker (MCB)',category:'Circuit Protection',aliases:['miniature circuit breaker','mcb'],twinShape:'breaker',trackAsAsset:false},
 {key:'circuit-breaker',name:'Circuit Breaker',category:'Circuit Protection',aliases:['circuit breaker','breaker','cb'],twinShape:'breaker',trackAsAsset:true},
 {key:'fused-switch',name:'Fused Switch',category:'Circuit Protection',aliases:['fused switch'],twinShape:'breaker',trackAsAsset:true},
 {key:'spd',name:'Surge Protective Device (SPD)',category:'Circuit Protection',aliases:['surge protective device','spd','surge protection'],twinShape:'breaker',trackAsAsset:true},

 {key:'dry-transformer',name:'Dry-Type Transformer',category:'Power Transformation',aliases:['dry type transformer','dry transformer'],twinShape:'transformer',trackAsAsset:true},
 {key:'oil-transformer',name:'Oil-Filled Transformer',category:'Power Transformation',aliases:['oil filled transformer','oil transformer'],twinShape:'transformer',trackAsAsset:true},
 {key:'isolation-transformer',name:'Isolation Transformer',category:'Power Transformation',aliases:['isolation transformer'],twinShape:'transformer',trackAsAsset:true},
 {key:'autotransformer',name:'Autotransformer',category:'Power Transformation',aliases:['autotransformer','auto transformer'],twinShape:'transformer',trackAsAsset:true},
 {key:'instrument-transformer',name:'Instrument Transformer (CT/PT)',category:'Power Transformation',aliases:['instrument transformer','ct','pt','current transformer','potential transformer'],twinShape:'transformer',trackAsAsset:true},

 {key:'load-center',name:'Load Center',category:'Power Distribution Devices',aliases:['load center'],twinShape:'panel',trackAsAsset:true},
 {key:'disconnect',name:'Safety Switch / Disconnect',category:'Power Distribution Devices',aliases:['safety switch','disconnect','disconnect switch'],twinShape:'cabinet',trackAsAsset:true},
 {key:'fuse',name:'Fuse',category:'Power Distribution Devices',aliases:['fuse'],twinShape:'breaker',trackAsAsset:false},
 {key:'contactor',name:'Contactor',category:'Power Distribution Devices',aliases:['contactor'],twinShape:'breaker',trackAsAsset:false},
 {key:'motor-starter',name:'Motor Starter',category:'Power Distribution Devices',aliases:['motor starter'],twinShape:'cabinet',trackAsAsset:true},

 {key:'duplex-receptacle',name:'Duplex Receptacle',category:'Wiring Devices & Outlets',aliases:['duplex receptacle','receptacle','outlet'],twinShape:'receptacle',trackAsAsset:false},
 {key:'gfci',name:'GFCI Receptacle',category:'Wiring Devices & Outlets',aliases:['gfci','gfi outlet'],twinShape:'receptacle',trackAsAsset:false},
 {key:'ig-outlet',name:'Isolated Ground Receptacle',category:'Wiring Devices & Outlets',aliases:['isolated ground outlet','ig receptacle'],twinShape:'receptacle',trackAsAsset:false},
 {key:'industrial-receptacle',name:'Industrial Receptacle',category:'Wiring Devices & Outlets',aliases:['industrial receptacle','pin sleeve'],twinShape:'receptacle',trackAsAsset:false},
 {key:'junction-box',name:'Junction Box',category:'Wiring Devices & Outlets',aliases:['junction box','j-box','jbox'],twinShape:'junction',trackAsAsset:false},

 {key:'emt',name:'EMT Conduit',category:'Conduit & Cable Management',aliases:['emt','emt conduit'],twinShape:'conduit',trackAsAsset:false},
 {key:'rigid-conduit',name:'Rigid Conduit',category:'Conduit & Cable Management',aliases:['rigid conduit','rigid metal conduit','rmc'],twinShape:'conduit',trackAsAsset:false},
 {key:'flex-conduit',name:'Flexible Conduit',category:'Conduit & Cable Management',aliases:['flexible conduit','flex conduit'],twinShape:'conduit',trackAsAsset:false},
 {key:'cable-tray',name:'Cable Tray',category:'Conduit & Cable Management',aliases:['cable tray'],twinShape:'tray',trackAsAsset:false},
 {key:'wireway',name:'Wireway / Duct',category:'Conduit & Cable Management',aliases:['wireway','wire duct','duct'],twinShape:'tray',trackAsAsset:false},

 {key:'high-bay',name:'LED High-Bay Light',category:'Lighting Systems',aliases:['high bay','high-bay light'],twinShape:'light',trackAsAsset:false},
 {key:'panel-light',name:'LED Panel Light',category:'Lighting Systems',aliases:['led panel light','panel light'],twinShape:'light',trackAsAsset:false},
 {key:'emergency-light',name:'Emergency Light',category:'Lighting Systems',aliases:['emergency light'],twinShape:'light',trackAsAsset:false},
 {key:'exit-sign',name:'Exit Sign',category:'Lighting Systems',aliases:['exit sign'],twinShape:'light',trackAsAsset:false},
 {key:'lighting-control',name:'Lighting Control Panel',category:'Lighting Systems',aliases:['lighting control panel','lighting panel'],twinShape:'panel',trackAsAsset:true},

 {key:'vfd',name:'Variable Frequency Drive (VFD)',category:'Motor Control & Drives',aliases:['vfd','variable frequency drive'],twinShape:'cabinet',trackAsAsset:true},
 {key:'soft-starter',name:'Soft Starter',category:'Motor Control & Drives',aliases:['soft starter'],twinShape:'cabinet',trackAsAsset:true},
 {key:'mcc',name:'Motor Control Center (MCC)',category:'Motor Control & Drives',aliases:['motor control center','mcc'],twinShape:'cabinet',trackAsAsset:true},
 {key:'motor',name:'Electric Motor',category:'Motor Control & Drives',aliases:['electric motor','motor'],twinShape:'motor',trackAsAsset:true},
 {key:'pump',name:'Pump',category:'Motor Control & Drives',aliases:['pump'],twinShape:'motor',trackAsAsset:true},

 {key:'generator',name:'Diesel / Gas Generator',category:'Backup Power Systems',aliases:['generator','genset','gen'],twinShape:'generator',trackAsAsset:true},
 {key:'ats',name:'Automatic Transfer Switch (ATS)',category:'Backup Power Systems',aliases:['automatic transfer switch','ats'],twinShape:'cabinet',trackAsAsset:true},
 {key:'ups',name:'UPS',category:'Backup Power Systems',aliases:['ups','uninterruptible power supply'],twinShape:'cabinet',trackAsAsset:true},
 {key:'battery-bank',name:'Battery Bank',category:'Backup Power Systems',aliases:['battery bank','battery rack','battery','bess','ess'],twinShape:'battery',trackAsAsset:true},
 {key:'dc-power',name:'DC Power System',category:'Backup Power Systems',aliases:['dc power system','rectifier'],twinShape:'cabinet',trackAsAsset:true},

 {key:'ground-rod',name:'Ground Rod',category:'Earthing & Bonding',aliases:['ground rod','earth rod'],twinShape:'ground',trackAsAsset:false},
 {key:'ground-bar',name:'Ground Bar',category:'Earthing & Bonding',aliases:['ground bar','ground bus'],twinShape:'ground',trackAsAsset:false},
 {key:'bonding-jumper',name:'Bonding Jumper',category:'Earthing & Bonding',aliases:['bonding jumper'],twinShape:'ground',trackAsAsset:false},
 {key:'exothermic-weld',name:'Exothermic Weld',category:'Earthing & Bonding',aliases:['exothermic weld','cadweld'],twinShape:'ground',trackAsAsset:false},
 {key:'earth-pit',name:'Earth Pit / Ground Well',category:'Earthing & Bonding',aliases:['earth pit','ground well'],twinShape:'ground',trackAsAsset:false},

 {key:'data-cabinet',name:'Data / Communications Cabinet',category:'Low Voltage Systems',aliases:['data cabinet','communications cabinet','network rack'],twinShape:'rack',trackAsAsset:true},
 {key:'fire-alarm',name:'Fire Alarm Control Panel',category:'Low Voltage Systems',aliases:['fire alarm panel','facp'],twinShape:'panel',trackAsAsset:true},
 {key:'security-panel',name:'Security Panel',category:'Low Voltage Systems',aliases:['security panel'],twinShape:'panel',trackAsAsset:true},
 {key:'access-control',name:'Access Control Panel',category:'Low Voltage Systems',aliases:['access control panel'],twinShape:'panel',trackAsAsset:true},
 {key:'intercom',name:'Intercom / PA System',category:'Low Voltage Systems',aliases:['intercom','pa system','public address'],twinShape:'rack',trackAsAsset:true},

 {key:'solar-inverter',name:'Solar Inverter',category:'Renewable & EV Infrastructure',aliases:['solar inverter','pv inverter'],twinShape:'cabinet',trackAsAsset:true},
 {key:'combiner',name:'PV Combiner Box',category:'Renewable & EV Infrastructure',aliases:['combiner box','pv combiner'],twinShape:'junction',trackAsAsset:true},
 {key:'pv-array',name:'PV Array',category:'Renewable & EV Infrastructure',aliases:['pv array','solar array','solar panel','pv'],twinShape:'solar',trackAsAsset:true},
 {key:'evse-kempower-satellite-v2',name:'Kempower Satellite V2',category:'Renewable & EV Infrastructure',aliases:['kempower satellite v2','kempower satellite','kempower charger'],twinShape:'evse',trackAsAsset:true,manufacturer:'Kempower',modelFamily:'Satellite V2'},
 {key:'evse-alpitronic-hyc400-s2',name:'Alpitronic HYC400 Series 2',category:'Renewable & EV Infrastructure',aliases:['alpitronic hyc400 series 2','alpitronic hyc400s2','alpitronic hyc400','alpitronic hypercharger','hypercharger hyc400'],twinShape:'evse',trackAsAsset:true,manufacturer:'Alpitronic',modelFamily:'HYC400 Series 2'},
 {key:'evse-delta-dc-wallbox-50',name:'Delta DC Wallbox 50 kW',category:'Renewable & EV Infrastructure',aliases:['delta dc wallbox 50kw','delta dc wallbox 50','delta dc wallbox','delta ev charger'],twinShape:'evse',trackAsAsset:true,manufacturer:'Delta Electronics',modelFamily:'DC Wallbox 50 kW'},
 {key:'evse-abb-terra-360',name:'ABB Terra 360',category:'Renewable & EV Infrastructure',aliases:['abb terra 360','terra 360 charger','terra 360'],twinShape:'evse',trackAsAsset:true,manufacturer:'ABB',modelFamily:'Terra 360'},
 {key:'evse-tesla-supercharger-v3',name:'Tesla Supercharger V3',category:'Renewable & EV Infrastructure',aliases:['tesla supercharger v3','tesla supercharger','tesla charger'],twinShape:'evse',trackAsAsset:true,manufacturer:'Tesla',modelFamily:'Supercharger V3'},
 {key:'evse',name:'EV Charging Station',category:'Renewable & EV Infrastructure',aliases:['ev charger','ev charging station','evse'],twinShape:'evse',trackAsAsset:true},
 {key:'charging-panel',name:'EV Charging Distribution Panel',category:'Renewable & EV Infrastructure',aliases:['charging distribution panel','ev panel'],twinShape:'panel',trackAsAsset:true},

 {key:'power-meter',name:'Power Meter',category:'Sensors & Monitoring Devices',aliases:['power meter','meter'],twinShape:'meter',trackAsAsset:true},
 {key:'energy-meter',name:'Energy Meter',category:'Sensors & Monitoring Devices',aliases:['energy meter'],twinShape:'meter',trackAsAsset:true},
 {key:'current-sensor',name:'Current Sensor / CT',category:'Sensors & Monitoring Devices',aliases:['current sensor','ct sensor'],twinShape:'sensor',trackAsAsset:false},
 {key:'temperature-sensor',name:'Temperature Sensor',category:'Sensors & Monitoring Devices',aliases:['temperature sensor','temp sensor'],twinShape:'sensor',trackAsAsset:false},
 {key:'vibration-sensor',name:'Vibration Sensor',category:'Sensors & Monitoring Devices',aliases:['vibration sensor'],twinShape:'sensor',trackAsAsset:false}
];

function escapeRegex(value:string){return value.replace(/[.*+?^${}()|[\]\\]/g,'\\function escapeRegex(value:string){return value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
function aliasMatches(name:string,alias:string){
 const a=alias.trim().toLowerCase();
 if(!a)return false;
 if(a.length<=4&&/^[a-z0-9]+$/.test(a))return new RegExp(`(^|[^a-z0-9])${escapeRegex(a)}([^a-z0-9]|$)`,'i').test(name);
 return name.includes(a);
}

export function resolveElectricalComponent(name:string){
 const n=name.toLowerCase();
 return ELECTRICAL_COMPONENTS.find(c=>c.aliases.some(a=>aliasMatches(n,a)))||null;
}')}
function normalized(value:string){return value.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ')}
function aliasMatches(name:string,alias:string){
 const n=normalized(name),a=normalized(alias);
 if(!a)return false;
 if(a.length<=4&&/^[a-z0-9]+$/.test(a))return new RegExp(`(^| )${escapeRegex(a)}( |$)`,'i').test(n);
 return n.includes(a);
}

export function resolveElectricalComponent(name:string){
 let best:ElectricalComponent|null=null,bestScore=-1;
 for(const component of ELECTRICAL_COMPONENTS)for(const alias of component.aliases){
  if(!aliasMatches(name,alias))continue;
  const a=normalized(alias),n=normalized(name),score=a.length+(n===a?1000:0);
  if(score>bestScore){best=component;bestScore=score}
 }
 return best;
}
