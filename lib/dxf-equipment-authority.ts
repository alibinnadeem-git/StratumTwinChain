export type DxfSpatialEntityType='INSERT'|'TEXT'|'MTEXT';

export type DxfEquipmentSpatialAuthority={
  kind:'cad-block'|'cad-text';
  physicalAnchor:boolean;
  allowEntityZAsEquipmentZ:boolean;
  rotationDegrees?:number;
  meta:Record<string,unknown>;
};

const finiteRotation=(value:unknown)=>{
  const n=Number(value);
  return Number.isFinite(n)?n:0;
};

export function dxfEquipmentSpatialAuthority(
  entityType:DxfSpatialEntityType,
  rotation:unknown,
  metricXY:boolean
):DxfEquipmentSpatialAuthority{
  const sourceRotation=finiteRotation(rotation);
  if(entityType==='INSERT'){
    return{
      kind:'cad-block',
      physicalAnchor:true,
      allowEntityZAsEquipmentZ:true,
      rotationDegrees:sourceRotation,
      meta:{
        cadPhysicalAnchor:true,
        spatialPlacementAuthority:metricXY?'SOURCE_DXF_INSERT':'SOURCE_DXF_INSERT_UNITLESS_REVIEW_ONLY',
        rotationAuthority:'SOURCE_DXF_INSERT_ROTATION',
        rotationConfidence:.98,
        sourceRotationDegrees:sourceRotation,
        physicalTruth:false,
        physicalPositionVerified:false,
        asBuiltAuthority:false,
        reviewRequired:true
      }
    };
  }
  return{
    kind:'cad-text',
    physicalAnchor:false,
    allowEntityZAsEquipmentZ:false,
    meta:{
      cadPhysicalAnchor:false,
      cadTextLabel:true,
      spatialPlacementAuthority:'SOURCE_DXF_TEXT_LABEL_POSITION_ONLY',
      rotationAuthority:'TEXT_ORIENTATION_ONLY_NOT_EQUIPMENT',
      sourceTextRotationDegrees:sourceRotation,
      physicalTruth:false,
      physicalPositionVerified:false,
      asBuiltAuthority:false,
      reviewRequired:true
    }
  };
}
