export type EquipmentIdentityEntity={
  id:string;
  name:string;
  source:string;
  kind:string;
  confidence:number;
  meta?:Record<string,unknown>;
};

const TAG_PATTERN=/\b(?:AHU|RTU|MAU|FCU|VAV|EF|SF|RF|PF|FP|JP|SMF|PMP|P|CH|CHLR|CT|CU|HP|WH|UH|HWP|CHWP|FACP|NAC|BMS|DDC|ELEV|EL|EVSE|ATS|UPS|MCC|PDU|MDP|MDB|MSB|XFMR|TX|GEN)[-_ ]?#?[A-Z0-9]+(?:[-_.][A-Z0-9]+)*\b/i;

const norm=(value:unknown)=>String(value??'').trim().toUpperCase().replace(/\s+/g,' ');
const clean=(value:unknown)=>String(value??'').trim();

function equipmentTag(entity:EquipmentIdentityEntity){
  const explicit=norm(entity.meta?.assetTag||entity.meta?.equipmentTag||entity.meta?.tag);
  if(explicit)return explicit.replace(/\s+/g,'-');
  const match=entity.name.toUpperCase().match(TAG_PATTERN);
  return match?.[0]?.replace(/\s+/g,'-')||null;
}

function scheduleEvidence(entity:EquipmentIdentityEntity){
  const type=String(entity.meta?.sourceType||'').toUpperCase();
  return entity.meta?.nonSpatial===true&&(type==='EQUIPMENT_SCHEDULE'||type==='TEXT_EQUIPMENT_SCHEDULE');
}

function distinct(values:string[]){
  return [...new Set(values.map(value=>norm(value)).filter(Boolean))];
}

function sourceProductRecord(entity:EquipmentIdentityEntity){
  return{
    id:entity.id,
    source:entity.source,
    manufacturer:clean(entity.meta?.manufacturer||entity.meta?.manufacturerName)||null,
    model:clean(entity.meta?.model||entity.meta?.modelNumber)||null,
    description:clean(entity.meta?.scheduleDescription)||null,
    confidence:Math.max(0,Math.min(1,Number(entity.confidence||0)))
  };
}

export function reconcileSpatialEquipmentIdentity<T extends EquipmentIdentityEntity>(entities:T[]):T[]{
  const schedulesByTag=new Map<string,T[]>();
  for(const entity of entities){
    if(!scheduleEvidence(entity))continue;
    const tag=equipmentTag(entity);if(!tag)continue;
    schedulesByTag.set(tag,[...(schedulesByTag.get(tag)||[]),entity]);
  }

  return entities.map(entity=>{
    if(entity.meta?.nonSpatial===true)return entity;
    const tag=equipmentTag(entity);if(!tag)return entity;
    const schedules=schedulesByTag.get(tag)||[];if(!schedules.length)return entity;

    const records=schedules.map(sourceProductRecord);
    const scheduleManufacturers=distinct(records.map(record=>record.manufacturer||''));
    const scheduleModels=distinct(records.map(record=>record.model||''));
    const existingManufacturer=norm(entity.meta?.manufacturer||entity.meta?.manufacturerName);
    const existingModel=norm(entity.meta?.model||entity.meta?.modelNumber);
    const manufacturerConflict=scheduleManufacturers.length>1||Boolean(existingManufacturer&&scheduleManufacturers.length&& !scheduleManufacturers.includes(existingManufacturer));
    const modelConflict=scheduleModels.length>1||Boolean(existingModel&&scheduleModels.length&&!scheduleModels.includes(existingModel));
    const conflict=manufacturerConflict||modelConflict;
    const evidenceIds=records.map(record=>record.id);
    const evidenceSources=[...new Set(records.map(record=>record.source))];
    const confidence=Math.max(0,Math.min(1,Math.min(entity.confidence||0,...records.map(record=>record.confidence||0))));

    if(conflict){
      return{
        ...entity,
        meta:{
          ...(entity.meta||{}),
          assetTag:clean(entity.meta?.assetTag)||tag,
          productIdentityStatus:'CONFLICT',
          productIdentityAuthority:'SAME_TAG_SCHEDULE_RECONCILIATION',
          productIdentityTag:tag,
          productIdentityEvidenceIds:evidenceIds,
          productIdentityEvidenceSources:evidenceSources,
          productIdentityManufacturers:scheduleManufacturers,
          productIdentityModels:scheduleModels,
          productIdentityConfidence:confidence,
          productIdentityPhysicalAssetVerified:false,
          physicalTruth:false,
          reviewRequired:true
        }
      };
    }

    const manufacturer=clean(entity.meta?.manufacturer||entity.meta?.manufacturerName)||records.find(record=>record.manufacturer)?.manufacturer||null;
    const model=clean(entity.meta?.model||entity.meta?.modelNumber)||records.find(record=>record.model)?.model||null;
    if(!manufacturer&&!model){
      return{
        ...entity,
        meta:{
          ...(entity.meta||{}),
          assetTag:clean(entity.meta?.assetTag)||tag,
          productIdentityStatus:'TAG_LINKED_NO_PRODUCT_IDENTITY',
          productIdentityAuthority:'SAME_TAG_SCHEDULE_RECONCILIATION',
          productIdentityTag:tag,
          productIdentityEvidenceIds:evidenceIds,
          productIdentityEvidenceSources:evidenceSources,
          productIdentityConfidence:confidence,
          productIdentityPhysicalAssetVerified:false,
          physicalTruth:false,
          reviewRequired:true
        }
      };
    }

    return{
      ...entity,
      meta:{
        ...(entity.meta||{}),
        ...(manufacturer?{manufacturer}:{}),
        ...(model?{model}:{}),
        assetTag:clean(entity.meta?.assetTag)||tag,
        productIdentityStatus:'SOURCE_RECONCILED_CANDIDATE',
        productIdentityAuthority:'SAME_TAG_SCHEDULE_RECONCILIATION',
        productIdentityTag:tag,
        productIdentityEvidenceIds:evidenceIds,
        productIdentityEvidenceSources:evidenceSources,
        productIdentityConfidence:confidence,
        productIdentityPhysicalAssetVerified:false,
        physicalTruth:false,
        reviewRequired:true
      }
    };
  });
}
