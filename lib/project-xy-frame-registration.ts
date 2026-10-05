import type {AlignmentProposal} from './auto-sheet-alignment.ts';
import {transformSheetPoint} from './sheet-similarity.ts';

export type ProjectXYEntity={
  id:string;
  source?:string;
  x:number;
  y:number;
  x2?:number;
  y2?:number;
  vertices?:{x:number;y:number}[];
  meta?:Record<string,unknown>;
};

export type ProjectXYRegistration={
  id:string;
  frameId:string;
  referenceKey:string;
  movingKey:string;
  coordinateUnits:string;
  metric:boolean;
  transform:AlignmentProposal['transform'];
  transformedEntities:number;
  referenceEntities:number;
  occurredAt:string;
  reviewRequired:true;
  physicalPositionVerified:false;
  physicalTruth:false;
};

type RegistrationOriginal={
  x:number;y:number;
  x2?:number;y2?:number;
  vertices?:{x:number;y:number}[];
  coordinateUnits?:unknown;
};

const text=(value:unknown)=>String(value??'').trim();
const uniq=<T,>(values:T[])=>[...new Set(values)];

function entityKey(entity:ProjectXYEntity){
  const sha=text(entity.meta?.sourceSha256).toLowerCase();
  const page=Number(entity.meta?.page||0);
  return sha&&Number.isInteger(page)&&page>0?sha+':'+page:null;
}
function canonicalUnits(value:unknown){
  const unit=text(value).toLowerCase();
  if(!unit||unit==='none'||unit==='unknown'||unit==='unresolved')return null;
  if(unit==='sheet'||unit==='image_preview'||unit==='image_sheet')return'sheet';
  return unit;
}
function metricUnit(unit:string){
  return unit==='m'||unit==='m_reviewed_pdf'||unit==='m_xy'||unit==='m_dxf_design'||unit.startsWith('m_');
}
function frameUnits(entities:ProjectXYEntity[],key:string){
  const units=uniq(entities.filter(entity=>entityKey(entity)===key).map(entity=>canonicalUnits(entity.meta?.coordinateUnits)).filter((value):value is string=>Boolean(value)));
  if(!units.length)throw new Error('Reference sheet has no explicit coordinate-units authority.');
  if(units.length>1)throw new Error('Reference sheet contains inconsistent coordinate units: '+units.join(', ')+'. Normalize/restore the sheet before project-frame registration.');
  return units[0];
}
function list(meta:Record<string,unknown>,key:string){
  return Array.isArray(meta[key])?meta[key].map(value=>String(value)).filter(Boolean):[];
}
function add(listValues:string[],value:string){return uniq([...listValues,value])}
function remove(listValues:string[],value:string){return listValues.filter(item=>item!==value)}

export function applyReviewedProjectXYFrameRegistration<T extends ProjectXYEntity>(
  entities:T[],
  proposal:AlignmentProposal,
  occurredAt=new Date().toISOString()
):{entities:T[];registration:ProjectXYRegistration}{
  if(!proposal.eligible)throw new Error('Only an eligible reviewed alignment proposal may create a project XY frame.');
  const referenceUnits=frameUnits(entities,proposal.referenceKey);
  const frameId='PROJECT_XY:'+proposal.referenceKey;
  const metric=metricUnit(referenceUnits);
  const reference=entities.filter(entity=>entityKey(entity)===proposal.referenceKey);
  const moving=entities.filter(entity=>entityKey(entity)===proposal.movingKey);
  if(!reference.length||!moving.length)throw new Error('Reference and moving sheet geometry must both be present.');

  for(const entity of reference){
    const existing=text(entity.meta?.projectXYFrameId);
    if(existing&&existing!==frameId)throw new Error('Reference sheet is already registered to a different project XY frame.');
  }
  for(const entity of moving){
    const meta=entity.meta||{};
    if(meta.sheetXYCalibrationId)throw new Error('Restore manual XY calibration on the moving sheet before project-frame registration.');
    if(meta.projectXYFrameId)throw new Error('Moving sheet is already registered to a project XY frame. Restore that registration first.');
    if(meta.autoSheetAlignmentCandidateId&&meta.autoSheetAlignmentCandidateId!==proposal.id)throw new Error('Moving sheet carries another automatic alignment. Restore it first.');
  }

  let transformedEntities=0,referenceEntities=0;
  const next=entities.map(entity=>{
    const key=entityKey(entity),meta={...(entity.meta||{})};
    if(key===proposal.referenceKey){
      referenceEntities++;
      const ids=add(list(meta,'projectXYRegistrationIds'),proposal.id);
      const refs=add(list(meta,'projectXYReferenceForIds'),proposal.id);
      return{...entity,meta:{
        ...meta,
        projectXYFrameId:frameId,
        projectXYFrameCoordinateUnits:referenceUnits,
        projectXYFrameMetric:metric,
        projectXYRegistrationIds:ids,
        projectXYReferenceForIds:refs,
        projectXYRegistrationAuthority:'HUMAN_CONFIRMED_COMMON_ANCHOR_SIMILARITY',
        projectXYReviewRequired:true,
        projectXYPhysicalPositionVerified:false,
        physicalTruth:false
      }} as T;
    }
    if(key!==proposal.movingKey)return entity;

    const original=(meta.projectXYRegistrationOriginal as RegistrationOriginal|undefined)||{
      x:entity.x,y:entity.y,
      ...(Number.isFinite(Number(entity.x2))&&Number.isFinite(Number(entity.y2))?{x2:Number(entity.x2),y2:Number(entity.y2)}:{}),
      ...(Array.isArray(entity.vertices)?{vertices:entity.vertices.map(point=>({x:point.x,y:point.y}))}:{}),
      coordinateUnits:meta.coordinateUnits
    };
    const point=transformSheetPoint({x:original.x,y:original.y},proposal.transform);
    const end=original.x2!==undefined&&original.y2!==undefined?transformSheetPoint({x:original.x2,y:original.y2},proposal.transform):null;
    const vertices=original.vertices?.map(vertex=>transformSheetPoint(vertex,proposal.transform));
    transformedEntities++;
    return{
      ...entity,x:point.x,y:point.y,
      ...(end?{x2:end.x,y2:end.y}:{}),
      ...(vertices?{vertices}:{}),
      meta:{
        ...meta,
        projectXYRegistrationOriginal:original,
        projectXYFrameId:frameId,
        projectXYFrameCoordinateUnits:referenceUnits,
        projectXYFrameMetric:metric,
        projectXYRegistrationIds:add(list(meta,'projectXYRegistrationIds'),proposal.id),
        projectXYMovingRegistrationId:proposal.id,
        projectXYReferenceKey:proposal.referenceKey,
        projectXYMovingKey:proposal.movingKey,
        projectXYRegistrationAuthority:'HUMAN_CONFIRMED_COMMON_ANCHOR_SIMILARITY',
        projectXYReviewRequired:true,
        projectXYPhysicalPositionVerified:false,
        autoSheetAlignmentOriginal:original,
        autoSheetAlignmentCandidateId:proposal.id,
        alignmentMethod:'auto-common-anchor-human-confirmed',
        alignmentAppliedAt:occurredAt,
        alignmentVerified:false,
        coordinateUnits:referenceUnits,
        physicalTruth:false
      }
    } as T;
  });

  return{
    entities:next,
    registration:{
      id:proposal.id,frameId,referenceKey:proposal.referenceKey,movingKey:proposal.movingKey,
      coordinateUnits:referenceUnits,metric,transform:proposal.transform,
      transformedEntities,referenceEntities,occurredAt,
      reviewRequired:true,physicalPositionVerified:false,physicalTruth:false
    }
  };
}

export function restoreReviewedProjectXYFrameRegistration<T extends ProjectXYEntity>(
  entities:T[],
  registrationId:string
):{entities:T[];restoredEntities:number;referenceEntitiesUpdated:number}{
  let restoredEntities=0,referenceEntitiesUpdated=0;
  const next=entities.map(entity=>{
    const meta={...(entity.meta||{})};
    const ids=list(meta,'projectXYRegistrationIds');
    if(!ids.includes(registrationId))return entity;

    if(text(meta.projectXYMovingRegistrationId)===registrationId){
      const original=meta.projectXYRegistrationOriginal as RegistrationOriginal|undefined;
      if(!original)throw new Error('Project-frame registration original coordinates are missing.');
      restoredEntities++;
      const nextMeta={...meta};
      for(const key of [
        'projectXYRegistrationOriginal','projectXYMovingRegistrationId','projectXYReferenceKey','projectXYMovingKey',
        'projectXYRegistrationAuthority','projectXYReviewRequired','projectXYPhysicalPositionVerified',
        'autoSheetAlignmentOriginal','autoSheetAlignmentCandidateId','alignmentMethod','alignmentAppliedAt','alignmentVerified'
      ])delete nextMeta[key];
      const remaining=remove(ids,registrationId);
      if(remaining.length)nextMeta.projectXYRegistrationIds=remaining;else delete nextMeta.projectXYRegistrationIds;
      delete nextMeta.projectXYFrameId;delete nextMeta.projectXYFrameCoordinateUnits;delete nextMeta.projectXYFrameMetric;
      if(original.coordinateUnits===undefined)delete nextMeta.coordinateUnits;else nextMeta.coordinateUnits=original.coordinateUnits;
      const restored={...entity,x:original.x,y:original.y,meta:nextMeta} as T;
      if(original.x2!==undefined&&original.y2!==undefined){restored.x2=original.x2;restored.y2=original.y2}else{delete restored.x2;delete restored.y2}
      if(original.vertices)restored.vertices=original.vertices.map(point=>({...point}));else delete restored.vertices;
      return restored;
    }

    const refs=remove(list(meta,'projectXYReferenceForIds'),registrationId);
    const remaining=remove(ids,registrationId);
    referenceEntitiesUpdated++;
    if(refs.length)meta.projectXYReferenceForIds=refs;else delete meta.projectXYReferenceForIds;
    if(remaining.length)meta.projectXYRegistrationIds=remaining;else delete meta.projectXYRegistrationIds;
    if(!remaining.length&&!meta.projectXYMovingRegistrationId){
      delete meta.projectXYFrameId;delete meta.projectXYFrameCoordinateUnits;delete meta.projectXYFrameMetric;
      delete meta.projectXYRegistrationAuthority;delete meta.projectXYReviewRequired;delete meta.projectXYPhysicalPositionVerified;
    }
    return{...entity,meta} as T;
  });
  return{entities:next,restoredEntities,referenceEntitiesUpdated};
}
