export type RegisteredSpatialAsset={
 id:string;
 project_id?:string;
 asset_code:string;
 asset_type?:string;
 name:string;
 model:string|null;
 serial_number:string|null;
 location_label:string|null;
 status:string;
 qr_token?:string|null;
 project_code?:string;
 project_name?:string;
 site_name?:string;
 system_name:string|null;
 manufacturer_name:string|null;
 latest_event_id?:string|null;
 latest_event_type:string|null;
 latest_event_status?:string|null;
 ledger_network:string|null;
 ledger_tx_hash:string|null;
 ledger_block_height:string|null;
 anchored_at?:string|Date|null;
 maintenance_plan_id?:string|null;
 maintenance_revision?:number|null;
 maintenance_basis?:string|null;
 maintenance_interval_days?:number|null;
 maintenance_interval_hours?:number|null;
 maintenance_next_due_at?:string|Date|null;
 maintenance_condition_triggers?:unknown[];
 maintenance_task_summary?:string|null;
 maintenance_source_refs?:unknown[];
 maintenance_status?:string|null;
};

export type SpatialAssetEntity={id:string;name:string;layer:string;meta?:Record<string,unknown>};
export type SpatialAssetBinding={
 asset:RegisteredSpatialAsset;
 method:'EXPLICIT_ID'|'EXPLICIT_CODE'|'EXPLICIT_SERIAL'|'IDENTIFIER_IN_LABEL'|'EXACT_NORMALIZED_NAME';
 confidence:number;
};

const text=(value:unknown)=>typeof value==='string'?value.trim():'';
const upper=(value:string)=>value.trim().toUpperCase();
const normalizeName=(value:string)=>value.toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const containsIdentifier=(label:string,identifier:string)=>{
 const id=normalizeName(identifier);if(!id)return false;
 return (' '+normalizeName(label)+' ').includes(' '+id+' ');
};
const firstMeta=(entity:SpatialAssetEntity,keys:string[])=>{for(const key of keys){const value=text(entity.meta?.[key]);if(value)return value}return''};

export function resolveRegisteredSpatialAsset(entity:SpatialAssetEntity|null|undefined,assets:RegisteredSpatialAsset[]):SpatialAssetBinding|null{
 if(!entity||!assets.length)return null;
 const explicitId=firstMeta(entity,['registeredAssetId','registryAssetId','assetId']);
 if(explicitId){const asset=assets.find(item=>item.id===explicitId);if(asset)return{asset,method:'EXPLICIT_ID',confidence:1};}

 const explicitCode=firstMeta(entity,['registeredAssetCode','registryAssetCode','assetCode','asset_code']);
 if(explicitCode){const matches=assets.filter(item=>upper(item.asset_code)===upper(explicitCode));if(matches.length===1)return{asset:matches[0],method:'EXPLICIT_CODE',confidence:1};}

 const explicitSerial=firstMeta(entity,['serialNumber','serial_number','assetSerial']);
 if(explicitSerial){const matches=assets.filter(item=>item.serial_number&&upper(item.serial_number)===upper(explicitSerial));if(matches.length===1)return{asset:matches[0],method:'EXPLICIT_SERIAL',confidence:.99};}

 const codeMatches=assets.filter(item=>containsIdentifier(entity.name,item.asset_code));
 if(codeMatches.length===1)return{asset:codeMatches[0],method:'IDENTIFIER_IN_LABEL',confidence:.97};
 const serialMatches=assets.filter(item=>item.serial_number&&containsIdentifier(entity.name,item.serial_number));
 if(serialMatches.length===1)return{asset:serialMatches[0],method:'IDENTIFIER_IN_LABEL',confidence:.96};

 // Exact normalized equipment names are safe enough to use only when unique.
 // We intentionally do not do fuzzy/substring name matching because that can bind
 // a generic source label such as "PANELBOARD" to the wrong tenant asset.
 const normalized=normalizeName(entity.name);
 if(normalized){
  const exactNameMatches=assets.filter(item=>normalizeName(item.name)===normalized);
  if(exactNameMatches.length===1)return{asset:exactNameMatches[0],method:'EXACT_NORMALIZED_NAME',confidence:.9};
 }

 return null;
}

export function spatialAssetDirState(binding:SpatialAssetBinding|null){
 const asset=binding?.asset;
 const finalized=Boolean(asset?.ledger_block_height&&asset?.ledger_tx_hash);
 return{
  finalized,
  blockHeight:asset?.ledger_block_height||null,
  transaction:asset?.ledger_tx_hash||null,
  network:asset?.ledger_network||null,
  latestEventType:asset?.latest_event_type||null,
  latestEventStatus:asset?.latest_event_status||null,
  anchoredAt:asset?.anchored_at||null,
 };
}
