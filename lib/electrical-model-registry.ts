import {ELECTRICAL_COMPONENTS} from './electrical-component-library.ts';
import {OEM_SOURCES} from './oem-source-catalog.ts';

export type ElectricalModelFormat='GLB'|'GLTF'|'USD'|'USDZ';
export type ElectricalModelConfig={
  componentKey:string;
  /** Relevant manufacturer research records. An association is not an OEM model license. */
  oemSourceIds?:string[];
  format:ElectricalModelFormat;
  modelUrl:string;
  scale:number;
  rotation:[number,number,number];
  offset:[number,number,number];
  /** Physical width, height and depth in meters. */
  dimensionsMeters?:[number,number,number];
  dimensionsSource?:string;
  dimensionsConfidence?:number;
  lod?:'LOW'|'MEDIUM'|'HIGH';
  source?:string;
  sourceUrl?:string;
  license?:string;
  attribution?:string;
  geometryStatus?:'PROCEDURAL'|'DIMENSIONAL_VISUALIZATION'|'LICENSED_COMMUNITY'|string;
  notes?:string;
};

export const ELECTRICAL_MODEL_REGISTRY_STORAGE_KEY='stratum:electrical-model-registry:v1';

const PRODUCTION_MODEL_DEFAULTS:Record<string,Partial<ElectricalModelConfig>>={
  'adafruit-bme280-2652':{modelUrl:'/models/oem/adafruit-bme280-2652.glb',format:'GLB',dimensionsMeters:[.01778,.01905,.00297],dimensionsConfidence:.98,dimensionsSource:'Adafruit product 2652 manufacturer STL bounds, converted from millimeters to meters',source:'Adafruit_CAD_Parts / Adafruit BME280.stl (SHA-256 c2f70a132cae7d11289bcb4fdb160f8e63b2ce12c7eb31945f1afb96b874aee7)',sourceUrl:'https://github.com/adafruit/Adafruit_CAD_Parts/blob/main/2652%20Adafruit%20BME280/Adafruit%20BME280.stl',license:'MIT; © 2016 Adafruit Industries; see /models/oem/adafruit-bme280-LICENSE.txt',attribution:'Manufacturer CAD by Adafruit Industries, converted from STL to GLB by STRATUM Power.',geometryStatus:'OEM_SUPPLIED',notes:'Exact Adafruit BME280 product 2652 sensor breakout PCB. Board-only CAD geometry; it does not depict a field enclosure, mounting hardware, or an installed device.'},
  'pad-mount-transformer':{modelUrl:'/models/equipment/pad-mount-transformer.glb',dimensionsMeters:[1.45,1.54,1.391],dimensionsConfidence:.6,dimensionsSource:'STRATUM representative equipment envelope; replace with project OEM submittal',source:'STRATUM general equipment model pack',license:'STRATUM-authored geometry',geometryStatus:'DIMENSIONAL_VISUALIZATION',notes:'Representative pad-mounted transformer geometry. Not OEM CAD and not approved for clearance or construction decisions.'},
  'dry-transformer':{modelUrl:'/models/equipment/dry-type-transformer.glb',dimensionsMeters:[1.35,1.485,.882],dimensionsConfidence:.6,dimensionsSource:'STRATUM representative equipment envelope; replace with project OEM submittal',source:'STRATUM general equipment model pack',license:'STRATUM-authored geometry',geometryStatus:'DIMENSIONAL_VISUALIZATION',notes:'Representative ventilated dry-type transformer geometry. Nameplate rating and manufacturer dimensions remain project inputs.'},
  'oil-transformer':{modelUrl:'/models/equipment/oil-filled-transformer.glb',dimensionsMeters:[1.55,1.97,1.28],dimensionsConfidence:.55,dimensionsSource:'STRATUM representative equipment envelope; replace with project OEM submittal',source:'STRATUM general equipment model pack',license:'STRATUM-authored geometry',geometryStatus:'DIMENSIONAL_VISUALIZATION',notes:'Representative oil-filled transformer with cooling fins, bushings and conservator. Not OEM CAD.'},
  'main-switchboard':{modelUrl:'/models/equipment/main-switchboard.glb',dimensionsMeters:[2.4,2.12,.72],dimensionsConfidence:.55,dimensionsSource:'STRATUM representative four-section lineup; replace with approved equipment schedule',source:'STRATUM general equipment model pack',sourceUrl:'https://www.se.com/us/en/work/featured-articles/what-is-switchgear/',license:'STRATUM-authored geometry',geometryStatus:'DIMENSIONAL_VISUALIZATION',notes:'Representative multi-section switchboard with meters and breaker faces. Section count and envelope are configurable project data.'},
  mcc:{modelUrl:'/models/equipment/motor-control-center.glb',dimensionsMeters:[2.08,2.1,.64],dimensionsConfidence:.55,dimensionsSource:'STRATUM representative four-section MCC lineup; replace with approved equipment schedule',source:'STRATUM general equipment model pack',license:'STRATUM-authored geometry',geometryStatus:'DIMENSIONAL_VISUALIZATION',notes:'Representative motor-control-center lineup with starter buckets. Not OEM CAD.'},
  motor:{modelUrl:'/models/equipment/industrial-electric-motor.glb',dimensionsMeters:[1.49,1.16,.96],dimensionsConfidence:.5,dimensionsSource:'STRATUM representative industrial motor envelope; replace with motor datasheet',source:'STRATUM general equipment model pack',sourceUrl:'https://www.energy.gov/cmei/ito/motor-systems',license:'STRATUM-authored geometry',geometryStatus:'DIMENSIONAL_VISUALIZATION',notes:'Representative finned industrial motor with terminal box, fan cover, shaft and mounting rails. Frame size remains unresolved until the OEM datasheet is bound.'},
  pump:{modelUrl:'/models/equipment/end-suction-pump.glb',dimensionsMeters:[1.65,1.155,.9],dimensionsConfidence:.5,dimensionsSource:'STRATUM representative end-suction pump envelope; replace with pump curve/submittal',source:'STRATUM general equipment model pack',license:'STRATUM-authored geometry',geometryStatus:'DIMENSIONAL_VISUALIZATION',notes:'Representative motor-driven end-suction pump and skid. Flange sizes and service envelope require project data.'},
  generator:{modelUrl:'/models/equipment/enclosed-diesel-generator.glb',dimensionsMeters:[3.02,1.99,1.2],dimensionsConfidence:.5,dimensionsSource:'STRATUM representative enclosed genset envelope; replace with OEM submittal',source:'STRATUM general equipment model pack',license:'STRATUM-authored geometry',geometryStatus:'DIMENSIONAL_VISUALIZATION',notes:'Representative acoustic-enclosure generator with access doors, controller, vents, exhaust and skid. Not OEM CAD.'},
  ats:{modelUrl:'/models/equipment/automatic-transfer-switch.glb',dimensionsMeters:[.82,1.42,.425],dimensionsConfidence:.55,dimensionsSource:'STRATUM representative wall-mounted ATS envelope; replace with OEM submittal',source:'STRATUM general equipment model pack',license:'STRATUM-authored geometry',geometryStatus:'DIMENSIONAL_VISUALIZATION',notes:'Representative automatic transfer switch with controller and status indicators. Mounting height remains unresolved.'},
  ups:{modelUrl:'/models/equipment/uninterruptible-power-supply.glb',dimensionsMeters:[.96,1.84,.793],dimensionsConfidence:.5,dimensionsSource:'STRATUM representative floor-standing UPS envelope; replace with OEM submittal',source:'STRATUM general equipment model pack',license:'STRATUM-authored geometry',geometryStatus:'DIMENSIONAL_VISUALIZATION',notes:'Representative floor-standing UPS cabinet. Power module count, rating and service clearances remain project inputs.'},
  'battery-bank':{modelUrl:'/models/equipment/battery-cabinet.glb',dimensionsMeters:[1,1.86,.936],dimensionsConfidence:.5,dimensionsSource:'STRATUM representative battery cabinet envelope; replace with OEM submittal',source:'STRATUM general equipment model pack',license:'STRATUM-authored geometry',geometryStatus:'DIMENSIONAL_VISUALIZATION',notes:'Representative battery cabinet with visible module layout. Chemistry, capacity and hazard classification remain project inputs.'},
  'evse-kempower-satellite-v2':{modelUrl:'/models/oem/kempower-satellite-v2.glb',dimensionsMeters:[.3,1.738,.3],dimensionsConfidence:.98,dimensionsSource:'Kempower Satellite V2 product specification',source:'Kempower product specifications',sourceUrl:'https://kempower.com/solution/kempower-satellite/',license:'STRATUM-authored geometry; OEM trademarks remain property of Kempower',geometryStatus:'DIMENSIONAL_VISUALIZATION',notes:'Browser-optimized external geometry reconstructed to published physical dimensions; not an OEM-supplied CAD file.'},
  'evse-alpitronic-hyc400-s2':{modelUrl:'/models/oem/alpitronic-hyc400-s2.glb',dimensionsMeters:[.732,2.185,.663],dimensionsConfidence:.98,dimensionsSource:'Alpitronic HYC400 Series 2 product page',source:'Alpitronic product specifications',sourceUrl:'https://www.alpitronic.it/en/hypercharger/',license:'STRATUM-authored geometry; OEM trademarks remain property of Alpitronic',geometryStatus:'DIMENSIONAL_VISUALIZATION',notes:'Browser-optimized external geometry reconstructed to published physical dimensions; not an OEM-supplied CAD file.'},
  'evse-delta-dc-wallbox-50':{modelUrl:'/models/oem/delta-dc-wallbox-50kw.glb',dimensionsMeters:[.65,1.02,.25],dimensionsConfidence:.95,dimensionsSource:'Delta DC Wallbox 50 kW product specification',source:'Delta Electronics product specifications',sourceUrl:'https://www.delta-americas.com/en-US/products/EV-Charging/DC-Wallbox-50kW',license:'STRATUM-authored geometry; OEM trademarks remain property of Delta Electronics',geometryStatus:'DIMENSIONAL_VISUALIZATION',notes:'Browser-optimized external geometry reconstructed to published physical dimensions; pedestal shown for spatial context.'},
  'evse-abb-terra-360':{modelUrl:'/models/oem/abb-terra-360.glb',dimensionsMeters:[.72,2.2,.71],dimensionsConfidence:.95,dimensionsSource:'ABB Terra 360 product specification',source:'ABB E-mobility product specifications',sourceUrl:'https://global.abb/group/en/media/press-releases/abb-launches-the-worlds-fastest-electric-car-charger',license:'STRATUM-authored geometry; OEM trademarks remain property of ABB',geometryStatus:'DIMENSIONAL_VISUALIZATION',notes:'Browser-optimized external geometry reconstructed to published physical dimensions; not an OEM-supplied CAD file.'},
  'evse-tesla-supercharger-v3':{modelUrl:'/models/oem/tesla-supercharger-v3-community.glb',dimensionsMeters:[.82,1.73,.23],dimensionsConfidence:.8,dimensionsSource:'Model-space bounds; field dimensions require project verification',source:'Sketchfab community model via TeslaHub',sourceUrl:'https://sketchfab.com/3d-models/tesla-super-charger-low-poly-b9fc975778f542babbb2e861d32b1acd',license:'CC BY 4.0',attribution:'“Tesla Super Charger (low-poly)” by Suyog modak, modified for TeslaHub and reused under CC BY 4.0.',geometryStatus:'LICENSED_COMMUNITY',notes:'Licensed community visualization, not proprietary Tesla CAD. Verify field dimensions before engineering use.'},
};


function representative(
  modelUrl:string,
  dimensionsMeters:[number,number,number],
  dimensionsSource:string,
  notes:string,
  format:ElectricalModelFormat='GLTF',
):Partial<ElectricalModelConfig>{
 return{
  format,modelUrl,dimensionsMeters,dimensionsConfidence:.45,dimensionsSource,
  source:'STRATUM representative equipment family pack',
  license:'STRATUM-authored geometry',
  geometryStatus:'DIMENSIONAL_VISUALIZATION',
  notes
 };
}

const REPRESENTATIVE_FAMILY_DEFAULTS:Record<string,Partial<ElectricalModelConfig>>={
 'utility-transformer':representative('/models/equipment/pad-mount-transformer.glb',[1.45,1.54,1.391],'Representative utility transformer envelope; replace with utility/OEM data','Uses the detailed pad-mounted transformer family as a visual proxy.','GLB'),
 'utility-switchgear':representative('/models/equipment/main-switchboard.glb',[2.4,2.12,.72],'Representative utility switchgear lineup; replace with utility/OEM data','Detailed multi-section metal-enclosed equipment family visualization.','GLB'),
 'metering-cabinet':representative('/models/equipment/panelboard-representative.gltf',[.65,1.2,.22],'Representative metering cabinet envelope; replace with utility schedule','Detailed wall/floor enclosure family; meter arrangement remains project-specific.'),
 'service-entrance':representative('/models/equipment/main-switchboard.glb',[2.4,2.12,.72],'Representative service-entrance lineup; replace with approved equipment schedule','Detailed switchboard-family visualization for service equipment.','GLB'),
 'distribution-panel':representative('/models/equipment/panelboard-representative.gltf',[.65,1.2,.22],'Representative distribution panel envelope; replace with OEM submittal','Detailed panel enclosure with door, breaker rows and operating handle.'),
 panelboard:representative('/models/equipment/panelboard-representative.gltf',[.65,1.2,.22],'Representative panelboard envelope; replace with OEM submittal','Detailed panel enclosure with visible breaker rows.'),
 'lv-switchboard':representative('/models/equipment/main-switchboard.glb',[2.4,2.12,.72],'Representative LV switchboard lineup; replace with OEM submittal','Detailed multi-section switchboard family visualization.','GLB'),
 busduct:representative('/models/equipment/busway-representative.gltf',[3,.9,.85],'Representative busway segment envelope; length is project-configurable','Detailed busway section with joints, tap box and hangers.'),
 acb:representative('/models/equipment/breaker-enclosure-representative.gltf',[.45,.75,.22],'Representative breaker enclosure; breaker frame/rating remains project data','Detailed circuit-breaker enclosure family visualization.'),
 mccb:representative('/models/equipment/breaker-enclosure-representative.gltf',[.38,.62,.2],'Representative MCCB enclosure; replace with OEM dimensions','Detailed circuit-breaker enclosure family visualization.'),
 'fused-switch':representative('/models/equipment/breaker-enclosure-representative.gltf',[.45,.75,.22],'Representative fused-switch enclosure; replace with OEM dimensions','Detailed switching enclosure family visualization.'),
 spd:representative('/models/equipment/breaker-enclosure-representative.gltf',[.32,.48,.18],'Representative SPD enclosure; replace with OEM dimensions','Detailed protective-device enclosure family visualization.'),
 'isolation-transformer':representative('/models/equipment/dry-type-transformer.glb',[1.35,1.485,.882],'Representative isolation transformer envelope; replace with OEM data','Uses detailed dry-type transformer family geometry.','GLB'),
 autotransformer:representative('/models/equipment/dry-type-transformer.glb',[1.35,1.485,.882],'Representative autotransformer envelope; replace with OEM data','Uses detailed dry-type transformer family geometry.','GLB'),
 'instrument-transformer':representative('/models/equipment/oil-filled-transformer.glb',[1.1,1.4,.8],'Representative CT/PT assembly envelope; replace with utility/OEM data','Transformer-family visualization; CT/PT arrangement remains source-specific.','GLB'),
 'load-center':representative('/models/equipment/panelboard-representative.gltf',[.5,.9,.18],'Representative load-center envelope; replace with OEM data','Detailed panel enclosure family visualization.'),
 disconnect:representative('/models/equipment/breaker-enclosure-representative.gltf',[.45,.75,.22],'Representative safety-switch enclosure; replace with OEM data','Detailed disconnect enclosure with operating handle.'),
 'motor-starter':representative('/models/equipment/panelboard-representative.gltf',[.55,.9,.25],'Representative motor-starter enclosure; replace with OEM data','Detailed starter/control enclosure family visualization.'),
 'lighting-control':representative('/models/equipment/panelboard-representative.gltf',[.65,1.2,.22],'Representative lighting-control enclosure; replace with OEM data','Detailed control-panel family visualization.'),
 vfd:representative('/models/equipment/inverter-representative.gltf',[.55,.85,.25],'Representative VFD envelope; replace with drive submittal','Detailed power-electronics enclosure with display, status and ventilation.'),
 'soft-starter':representative('/models/equipment/inverter-representative.gltf',[.55,.85,.25],'Representative soft-starter envelope; replace with OEM data','Detailed motor-control electronics enclosure family visualization.'),
 'dc-power':representative('/models/equipment/uninterruptible-power-supply.glb',[.96,1.84,.793],'Representative DC power cabinet; replace with OEM data','Uses detailed power-conversion cabinet family geometry.','GLB'),
 'data-cabinet':representative('/models/equipment/data-rack-representative.gltf',[.8,2,1],'Representative 42U-style data rack envelope; replace with approved rack schedule','Detailed rack with frame and equipment faces.'),
 'fire-alarm':representative('/models/equipment/panelboard-representative.gltf',[.5,.8,.18],'Representative fire-alarm control enclosure; replace with OEM data','Detailed control-panel enclosure family; device face remains representative.'),
 'security-panel':representative('/models/equipment/panelboard-representative.gltf',[.45,.7,.18],'Representative security-panel enclosure; replace with OEM data','Detailed control-panel enclosure family visualization.'),
 'access-control':representative('/models/equipment/panelboard-representative.gltf',[.45,.7,.18],'Representative access-control enclosure; replace with OEM data','Detailed control-panel enclosure family visualization.'),
 intercom:representative('/models/equipment/data-rack-representative.gltf',[.8,2,1],'Representative PA/intercom rack; replace with approved equipment schedule','Detailed communications-rack family visualization.'),
 'solar-inverter':representative('/models/equipment/inverter-representative.gltf',[.55,.85,.25],'Representative solar inverter envelope; replace with OEM data','Detailed inverter enclosure with display, status and ventilation.'),
 combiner:representative('/models/equipment/breaker-enclosure-representative.gltf',[.5,.7,.22],'Representative PV combiner enclosure; replace with OEM data','Detailed outdoor electrical-enclosure family visualization.'),
 'pv-array':representative('/models/equipment/pv-array-representative.gltf',[3.4,2.1,2.1],'Representative four-module PV array segment; project geometry controls total array size','Detailed tilted module/rail visualization for spatial context.'),
 evse:representative('/models/oem/delta-dc-wallbox-50kw.glb',[.65,1.02,.25],'Representative EVSE envelope; bind manufacturer/model for authoritative dimensions','Uses a detailed DC wallbox family only as a generic EVSE visual proxy.','GLB'),
 'charging-panel':representative('/models/equipment/panelboard-representative.gltf',[.65,1.2,.22],'Representative EV distribution panel; replace with OEM data','Detailed panelboard family visualization.'),
 'power-meter':representative('/models/equipment/power-meter-representative.gltf',[.24,.32,.14],'Representative multifunction power meter envelope; replace with OEM data','Detailed meter face with display and controls.'),
 'energy-meter':representative('/models/equipment/power-meter-representative.gltf',[.24,.32,.14],'Representative energy meter envelope; replace with OEM data','Detailed meter face with display and controls.'),
};

export const DEFAULT_ELECTRICAL_MODEL_REGISTRY:ElectricalModelConfig[]=ELECTRICAL_COMPONENTS.map(component=>({
  componentKey:component.key,
  oemSourceIds:OEM_SOURCES.filter(source=>source.componentKeys.includes(component.key)).map(source=>source.id),
  format:'GLB',
  modelUrl:'',
  scale:1,
  rotation:[0,0,0],
  offset:[0,0,0],
  lod:'MEDIUM',
  source:'STRATUM procedural fallback',
  geometryStatus:'PROCEDURAL',
  notes:'',
  ...(REPRESENTATIVE_FAMILY_DEFAULTS[component.key]||{}),
  ...(PRODUCTION_MODEL_DEFAULTS[component.key]||{}),
}));

function tuple(value:unknown):[number,number,number]{
  return Array.isArray(value)&&value.length===3?[Number(value[0])||0,Number(value[1])||0,Number(value[2])||0]:[0,0,0];
}

export function normalizeElectricalModelRegistry(input:unknown):ElectricalModelConfig[]{
  if(!Array.isArray(input))return DEFAULT_ELECTRICAL_MODEL_REGISTRY;
  const byKey=new Map(input.filter(Boolean).map((item:any)=>[item.componentKey,item]));
  return DEFAULT_ELECTRICAL_MODEL_REGISTRY.map(base=>{
    const stored:any=byKey.get(base.componentKey)||{};
    const storedHasAuthoredModel=Boolean(
      (typeof stored.modelUrl==='string'&&stored.modelUrl.trim())||
      (typeof stored.geometryStatus==='string'&&stored.geometryStatus!=='PROCEDURAL')||
      (typeof stored.source==='string'&&stored.source!=='STRATUM procedural fallback')
    );
    // Old browser registries stored blank procedural defaults. Newly shipped production
    // mappings must supersede those stale blank defaults without overwriting real user/OEM edits.
    const value:any=!base.modelUrl||storedHasAuthoredModel?stored:{...stored,...base};
    const dimensions=Array.isArray(value.dimensionsMeters)&&value.dimensionsMeters.length===3&&value.dimensionsMeters.every((item:any)=>Number(item)>0)
      ?[Number(value.dimensionsMeters[0]),Number(value.dimensionsMeters[1]),Number(value.dimensionsMeters[2])] as [number,number,number]
      :base.dimensionsMeters;
    return {
      ...base,
      format:['GLB','GLTF','USD','USDZ'].includes(value.format)?value.format:base.format,
      modelUrl:typeof value.modelUrl==='string'?value.modelUrl:base.modelUrl,
      scale:Number(value.scale)>0?Number(value.scale):base.scale,
      rotation:tuple(value.rotation),
      offset:tuple(value.offset),
      dimensionsMeters:dimensions,
      dimensionsSource:typeof value.dimensionsSource==='string'?value.dimensionsSource:base.dimensionsSource,
      dimensionsConfidence:Number.isFinite(Number(value.dimensionsConfidence))?Math.max(0,Math.min(1,Number(value.dimensionsConfidence))):base.dimensionsConfidence,
      lod:['LOW','MEDIUM','HIGH'].includes(value.lod)?value.lod:base.lod,
      source:typeof value.source==='string'?value.source:base.source,
      oemSourceIds:[...new Set([...(base.oemSourceIds||[]),...(Array.isArray(value.oemSourceIds)?value.oemSourceIds.filter((id:unknown)=>typeof id==='string'&&OEM_SOURCES.some(source=>source.id===id)):[])])],
      sourceUrl:typeof value.sourceUrl==='string'?value.sourceUrl:base.sourceUrl,
      license:typeof value.license==='string'?value.license:base.license,
      attribution:typeof value.attribution==='string'?value.attribution:base.attribution,
      geometryStatus:typeof value.geometryStatus==='string'?value.geometryStatus:base.geometryStatus,
      notes:typeof value.notes==='string'?value.notes:base.notes
    };
  });
}

export function getElectricalModelConfig(componentKey:string,registry:ElectricalModelConfig[]){
  return registry.find(item=>item.componentKey===componentKey)||null;
}

export function oemModelBinding(sourceId:string,registry:ElectricalModelConfig[]){
 const source=OEM_SOURCES.find(item=>item.id===sourceId);
 if(!source)return null;
 const models=source.componentKeys.map(key=>registry.find(model=>model.componentKey===key)).filter((model):model is ElectricalModelConfig=>Boolean(model));
 return {source,models,status:source.componentKeys.length===0?'CLASS_PENDING':models.some(model=>model.modelUrl.trim())?'MODEL_MAPPED':'MODEL_PENDING'} as const;
}
