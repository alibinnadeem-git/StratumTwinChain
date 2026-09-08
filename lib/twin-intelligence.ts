import {assets,evidence,type Asset} from './data';

export type ReadinessItem={key:string;label:string;complete:boolean;critical:boolean;reason:string};
export type AssetReadiness={assetId:string;assetName:string;score:number;commissioningScore:number;ready:boolean;items:ReadinessItem[];blockers:string[]};
export type ElectricalRelation={from:string;to:string;type:'FEEDS'|'BACKUP_SOURCE'|'SERVES'|'PROTECTS'};

const evidenceKinds=(assetId:string)=>new Set(evidence.filter(e=>e.assetId===assetId&&e.status==='Verified').map(e=>e.kind.toLowerCase()));
const verifiedStage=(asset:Asset,stage:string)=>asset.stages.some(s=>s.stage===stage&&s.status==='verified');

export function calculateAssetReadiness(asset:Asset):AssetReadiness{
 const kinds=evidenceKinds(asset.id);
 const items:ReadinessItem[]=[
  {key:'identity',label:'Permanent asset identity',complete:Boolean(asset.id&&asset.serial&&asset.qrToken),critical:true,reason:'Asset ID, serial number and QR identity'},
  {key:'engineering',label:'Engineering attributes',complete:Object.keys(asset.specs).length>=4,critical:true,reason:'Minimum equipment rating and specification set'},
  {key:'received',label:'Received and identified',complete:verifiedStage(asset,'Received'),critical:false,reason:'Verified receipt lifecycle event'},
  {key:'installed',label:'Installation complete',complete:verifiedStage(asset,'Installed'),critical:true,reason:'Verified installation lifecycle event'},
  {key:'installationEvidence',label:'Installation evidence',complete:kinds.has('photo')||kinds.has('installation'),critical:true,reason:'Verified photo or installation package'},
  {key:'inspection',label:'Inspection passed',complete:verifiedStage(asset,'Inspected'),critical:true,reason:'Independent inspection approval'},
  {key:'testEvidence',label:'Testing evidence',complete:kinds.has('fat')||kinds.has('testing')||kinds.has('commissioning'),critical:true,reason:'FAT, test report or commissioning evidence'},
  {key:'commissioned',label:'Commissioning complete',complete:verifiedStage(asset,'Commissioned'),critical:true,reason:'Verified commissioning event'},
  {key:'warranty',label:'Warranty recorded',complete:Boolean(asset.warranty),critical:false,reason:'Warranty expiration date'},
  {key:'dir',label:'DIR finalized',complete:Boolean(asset.block&&asset.tx),critical:true,reason:'Approved Digital Immutable Record'},
 ];
 const score=Math.round(items.filter(i=>i.complete).length/items.length*100);
 const commissioningItems=items.filter(i=>['installed','installationEvidence','inspection','testEvidence','commissioned'].includes(i.key));
 const commissioningScore=Math.round(commissioningItems.filter(i=>i.complete).length/commissioningItems.length*100);
 const blockers=items.filter(i=>i.critical&&!i.complete).map(i=>i.label);
 return {assetId:asset.id,assetName:asset.name,score,commissioningScore,ready:blockers.length===0,items,blockers};
}

export const assetReadiness=assets.map(calculateAssetReadiness);
export const electricalRelations:ElectricalRelation[]=[
 {from:'STR-AST-0009282',to:'STR-AST-0009281',type:'FEEDS'},
 {from:'STR-AST-0009281',to:'STR-AST-0009283',type:'SERVES'},
 {from:'STR-AST-0009284',to:'STR-AST-0009281',type:'BACKUP_SOURCE'},
];

export function traceAffectedAssets(assetId:string){
 const seen=new Set<string>();const queue=[assetId];
 while(queue.length){const current=queue.shift()!;for(const edge of electricalRelations.filter(e=>e.from===current&&e.type!=='BACKUP_SOURCE'))if(!seen.has(edge.to)){seen.add(edge.to);queue.push(edge.to)}}
 return [...seen].map(id=>assets.find(a=>a.id===id)).filter((a):a is Asset=>Boolean(a));
}
export function getCommissioningBlockers(assetId?:string){const rows=assetId?assetReadiness.filter(r=>r.assetId===assetId):assetReadiness;return rows.filter(r=>r.blockers.length).map(r=>({assetId:r.assetId,assetName:r.assetName,commissioningScore:r.commissioningScore,blockers:r.blockers}))}
export function projectReadiness(){const score=Math.round(assetReadiness.reduce((sum,a)=>sum+a.score,0)/Math.max(assetReadiness.length,1));return {score,trackedAssets:assets.length,commissioned:assets.filter(a=>verifiedStage(a,'Commissioned')).length,dirVerified:assets.filter(a=>a.block&&a.tx).length,blockedAssets:assetReadiness.filter(a=>!a.ready).length}}
