export type RegisteredSpatialAsset={
 id:string;asset_code:string;asset_type?:string;name:string;model:string|null;serial_number:string|null;location_label:string|null;status:string;project_name?:string;site_name?:string;system_name:string|null;manufacturer_name:string|null;latest_event_type:string|null;ledger_network:string|null;ledger_tx_hash:string|null;ledger_block_height:string|null;
};

export type SpatialAssetEntity={id:string;name:string;layer:string;meta?:Record<string,unknown>};
export type SpatialAssetBinding={asset:RegisteredSpatialAsset;method:'EXPLICIT_ID'|'EXPLICIT_CODE'|'EXPLICIT_SERIAL'|'IDENTIFIER_IN_LABEL';confidence:number};

const text=(value:unknown)=>typeof value==='string'?value.trim():'';
const upper=(value:string)=>value.trim().toUpperCase();
const escaped=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const containsIdentifier=(label:string,identifier:string)=>{
 const id=identifier.trim();if(!id)return false;
 return new RegExp(`(^|[^A-Z0-9])${escaped(id.toUpperCase())}([^A-Z0-9]|$)`).test(label.toUpperCase());
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

 return null;
}

export function spatialAssetDirState(binding:SpatialAssetBinding|null){
 const asset=binding?.asset;
 const finalized=Boolean(asset?.ledger_block_height&&asset?.ledger_tx_hash);
 return{finalized,blockHeight:asset?.ledger_block_height||null,transaction:asset?.ledger_tx_hash||null,network:asset?.ledger_network||null};
}
