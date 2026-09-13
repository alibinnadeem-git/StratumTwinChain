import {assets} from './data';
import {traceAffectedAssets} from './twin-intelligence';

export type TruthState='DESIGNED'|'OBSERVED'|'VERIFIED';
export type ReviewState='MATCHED'|'REVIEW_REQUIRED'|'APPROVED'|'REJECTED';
export type AttributeValue=string|number|boolean|null;
export type EquipmentState={manufacturer:string;model:string;serial:string|null;location:string;attributes:Record<string,AttributeValue>};
export type Observation={id:string;assetId:string;source:'PHONE'|'360_CAMERA'|'LIDAR'|'DRONE'|'ROBOT'|'IOT'|'TEST';capturedAt:string;device:string;modelVersion:string;confidence:number;evidenceHash:string;state:EquipmentState};
export type RealityDiscrepancy={id:string;assetId:string;field:string;designed:AttributeValue;observed:AttributeValue;verified:AttributeValue;confidence:number;severity:'INFO'|'WARNING'|'CRITICAL';reviewState:ReviewState;reason:string;affectedAssets:string[]};

export const oemAliases:Record<string,string>={
 'square d':'Schneider Electric','schneider':'Schneider Electric','schneider electric':'Schneider Electric',
 'eaton':'Eaton','cutler-hammer':'Eaton','siemens':'Siemens','abb':'ABB','ge':'GE Vernova','ge vernova':'GE Vernova',
 'vertiv':'Vertiv','cummins':'Cummins','caterpillar':'Caterpillar','cat':'Caterpillar','generac':'Generac','legrand':'Legrand','panduit':'Panduit','hubbell':'Hubbell'
};
export function normalizeOEM(value:string){const key=value.trim().toLowerCase();return {input:value,canonical:oemAliases[key]||value.trim(),matched:Boolean(oemAliases[key])}}

export const designedStates:Record<string,EquipmentState>=Object.fromEntries(assets.map(asset=>[asset.id,{manufacturer:normalizeOEM(asset.manufacturer).canonical,model:asset.model,serial:asset.serial||null,location:asset.location,attributes:{...asset.specs}}]));
export const verifiedStates:Record<string,EquipmentState>=structuredClone(designedStates);
export const observations:Observation[]=[
 {id:'OBS-2026-0913-001',assetId:'STR-AST-0009281',source:'PHONE',capturedAt:'2026-09-13T17:10:00.000Z',device:'Field iPhone · nameplate capture',modelVersion:'stratum-reality-vision-0.1',confidence:.98,evidenceHash:'sha256:9d0d3c1f8f88a21d',state:{manufacturer:'Square D',model:'MasterPact MTZ2',serial:'SE-MTZ2-928193',location:'Electrical Room 2A',attributes:{Voltage:'480 V',Current:'3000 A',Frequency:'60 Hz','Interrupt Rating':'100 kAIC'}}},
 {id:'OBS-2026-0913-002',assetId:'STR-AST-0009282',source:'360_CAMERA',capturedAt:'2026-09-13T17:22:00.000Z',device:'360 walkthrough',modelVersion:'stratum-reality-vision-0.1',confidence:.94,evidenceHash:'sha256:524d4412e1371880',state:{manufacturer:'Siemens',model:'Dry-Type 2500kVA',serial:'SIE-TX4-118203',location:'Utility Yard B',attributes:{Capacity:'2500 kVA',Primary:'12.47 kV',Secondary:'480 V',Cooling:'AN'}}},
 {id:'OBS-2026-0913-003',assetId:'STR-AST-0009283',source:'DRONE',capturedAt:'2026-09-13T17:38:00.000Z',device:'RTK exterior capture',modelVersion:'stratum-reality-vision-0.1',confidence:.89,evidenceHash:'sha256:73ef0e91a21b58d9',state:{manufacturer:'ABB',model:'Terra 360',serial:'ABB-T360-551908',location:'Charging Yard C · 2.4 m east',attributes:{Power:'360 kW',Connectors:'CCS',Input:'480 V 3Φ',Network:'Ethernet / LTE'}}}
];

const severityFor=(field:string)=>['Current','Voltage','Primary','Secondary','Power','manufacturer','model'].includes(field)?'CRITICAL':field==='location'?'WARNING':'INFO';
export function compareObservedToDesigned(assetId:string):RealityDiscrepancy[]{
 const designed=designedStates[assetId],verified=verifiedStates[assetId],observation=observations.find(item=>item.assetId===assetId);if(!designed||!verified||!observation)return [];
 const identityRows:[string,AttributeValue,AttributeValue,AttributeValue][]=[['manufacturer',designed.manufacturer,normalizeOEM(observation.state.manufacturer).canonical,verified.manufacturer],['model',designed.model,observation.state.model,verified.model],['serial',designed.serial,observation.state.serial,verified.serial],['location',designed.location,observation.state.location,verified.location]];
 const attributeRows:[string,AttributeValue,AttributeValue,AttributeValue][]=[...new Set([...Object.keys(designed.attributes),...Object.keys(observation.state.attributes)])].map(field=>[field,designed.attributes[field]??null,observation.state.attributes[field]??null,verified.attributes[field]??null]);
 const rows=[...identityRows,...attributeRows];
 return rows.filter(([,d,o])=>d!==o).map(([field,d,o,v],index)=>({id:`DISC-${observation.id}-${index+1}`,assetId,field,designed:d,observed:o,verified:v,confidence:observation.confidence,severity:severityFor(field),reviewState:'REVIEW_REQUIRED',reason:`Observed ${field} differs from approved design; Verified state remains unchanged pending authorized review.`,affectedAssets:traceAffectedAssets(assetId).map(asset=>asset.id)}));
}
export const realityDiscrepancies=assets.flatMap(asset=>compareObservedToDesigned(asset.id));
export function realitySummary(){const compared=observations.length,matched=compared-new Set(realityDiscrepancies.map(d=>d.assetId)).size;return {capturedAssets:observations.length,comparedAssets:compared,matchedAssets:matched,discrepancies:realityDiscrepancies.length,critical:realityDiscrepancies.filter(d=>d.severity==='CRITICAL').length,reconciliation:Math.round(matched/Math.max(compared,1)*100)}}
