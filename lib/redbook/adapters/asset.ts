import {assetSchema,type CanonicalAsset} from '../schema/domain';
import {STRATUM_SCHEMA_VERSION} from '../schema/common';

export type LegacyAssetRow={
 id:string;
 organization_id:string;
 project_id:string;
 site_id:string;
 system_id?:string|null;
 manufacturer_id?:string|null;
 asset_code:string;
 asset_type:string;
 name:string;
 model?:string|null;
 serial_number?:string|null;
 location_label?:string|null;
 status?:string|null;
 specifications?:Record<string,unknown>|null;
 created_at?:Date|string|null;
 updated_at?:Date|string|null;
 created_by?:string|null;
};

const iso=(value:Date|string|null|undefined,fallback:string)=>{
 if(!value)return fallback;
 return value instanceof Date?value.toISOString():new Date(value).toISOString();
};

export function projectCanonicalAsset(row:LegacyAssetRow,options?:{createdBy?:string;DIRRefs?:string[]}):CanonicalAsset{
 const now=new Date().toISOString();
 const createdAt=iso(row.created_at,now);
 const updatedAt=iso(row.updated_at,createdAt);
 const properties=Object.entries(row.specifications||{}).flatMap(([propertyName,value])=>{
  if(!['string','number','boolean'].includes(typeof value))return [];
  const primitive=value as string|number|boolean;
  return[{propertyName,sourceValue:primitive,sourceUnit:null,normalizedValue:primitive,normalizedUnit:null,conversionVersion:null,sourceRef:null}];
 });
 return assetSchema.parse({
  objectId:row.id,
  objectType:'Asset',
  schemaVersion:STRATUM_SCHEMA_VERSION,
  tenantId:row.organization_id,
  organizationId:row.organization_id,
  projectId:row.project_id,
  createdAt,
  createdBy:options?.createdBy||row.created_by||'legacy:unknown',
  updatedAt,
  status:'RECEIVED',
  trustClass:'UNVERIFIED',
  sourceRefs:[],
  DIRRefs:options?.DIRRefs||[],
  assetId:row.id,
  assetCode:row.asset_code,
  assetType:row.asset_type,
  name:row.name,
  portfolioRef:null,
  campusRef:null,
  siteRef:row.site_id,
  buildingRef:null,
  levelRef:null,
  roomZoneRef:null,
  systemRef:row.system_id||null,
  SpatialRef:null,
  manufacturerRef:row.manufacturer_id||null,
  model:row.model||null,
  serialNumber:row.serial_number||null,
  lifecycleState:row.status||'UNREGISTERED',
  properties,
  relationships:[],
 });
}
