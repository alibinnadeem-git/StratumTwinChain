import {Box3,Object3D,Vector3} from 'three';
import {planUniformMeterScale,type MeterDimensions,type UniformMeterScalePlan} from './model-scale';

export type ThreeNormalizationResult=UniformMeterScalePlan&{
  finalSize:MeterDimensions;
};

function boxSize(object:Object3D):{box:Box3;size:Vector3}{
  object.updateMatrixWorld(true);
  const box=new Box3().setFromObject(object);
  const size=box.getSize(new Vector3());
  return{box,size};
}

function recenterAndBase(object:Object3D){
  const {box}=boxSize(object);
  if(box.isEmpty())return;
  const center=box.getCenter(new Vector3());
  object.position.x-=center.x;
  object.position.y-=box.min.y;
  object.position.z-=center.z;
  object.updateMatrixWorld(true);
}

export function normalizeObjectToMeters(
  object:Object3D,
  target:MeterDimensions,
  tolerance=.05
):ThreeNormalizationResult{
  object.updateMatrixWorld(true);
  const initial=boxSize(object);
  if(initial.box.isEmpty()||![initial.size.x,initial.size.y,initial.size.z].every(value=>Number.isFinite(value)&&value>0)){
    throw new Error('3D model has no finite measurable bounds');
  }
  const intrinsic:[number,number,number]=[initial.size.x,initial.size.y,initial.size.z];
  const plan=planUniformMeterScale(intrinsic,target,tolerance);
  object.scale.multiplyScalar(plan.scalar);
  recenterAndBase(object);
  const final=boxSize(object).size;
  return{...plan,finalSize:[final.x,final.y,final.z]};
}

export function fitProceduralObjectToMeters(
  object:Object3D,
  target:MeterDimensions
):{finalSize:MeterDimensions;scale:MeterDimensions}{
  object.updateMatrixWorld(true);
  const initial=boxSize(object);
  if(initial.box.isEmpty()||![initial.size.x,initial.size.y,initial.size.z].every(value=>Number.isFinite(value)&&value>0)){
    throw new Error('Procedural object has no finite measurable bounds');
  }
  const scale:[number,number,number]=[
    target[0]/initial.size.x,
    target[1]/initial.size.y,
    target[2]/initial.size.z
  ];
  object.scale.multiply(new Vector3(...scale));
  recenterAndBase(object);
  const final=boxSize(object).size;
  object.userData.dimensionFitMode='PROCEDURAL_ENVELOPE_NON_UNIFORM';
  return{finalSize:[final.x,final.y,final.z],scale};
}

/**
 * Manufacturer cabinet dimensions describe a rigid enclosure, not the bounding
 * box of its holsters and flexible charging cables. The glTF is already in meters
 * with its physical cabinet-bottom origin, so DO NOT scale or recenter its full
 * scene. Project-specific dimension conflicts remain human-review issues.
 */
export function preserveCabinetAccessoryAssemblyMeters(
  object:Object3D,
  cabinetDimensions:MeterDimensions,
  projectCabinetDimensions:MeterDimensions,
  tolerance=.05,
):ThreeNormalizationResult{
  const initial=boxSize(object);
  if(initial.box.isEmpty()||![initial.size.x,initial.size.y,initial.size.z].every(n=>Number.isFinite(n)&&n>0)){
    throw new Error('Accessory assembly must have measurable finite geometry');
  }
  if(!cabinetDimensions.every(n=>Number.isFinite(n)&&n>0)||!projectCabinetDimensions.every(n=>Number.isFinite(n)&&n>0)){
    throw new Error('Cabinet dimensions must be positive finite meters');
  }
  const intrinsic:MeterDimensions=[initial.size.x,initial.size.y,initial.size.z];
  const ratios=projectCabinetDimensions.map((n,i)=>n/cabinetDimensions[i]) as MeterDimensions;
  const maxRelativeError=Math.max(...projectCabinetDimensions.map((n,i)=>Math.abs(n-cabinetDimensions[i])/n));
  // Do not modify object.position or object.scale. Flexible cables can fall below
  // the cabinet's mounting origin and extend beyond its W/D/H.
  object.userData.dimensionFitMode='CABINET_ENVELOPE_PRESERVE_ACCESSORIES_METERS';
  object.userData.cabinetDimensionsMeters=[...cabinetDimensions];
  object.userData.assemblyBoundingDimensionsMeters=[...intrinsic];
  return{
    intrinsic,
    target:projectCabinetDimensions,
    ratios,
    scalar:1,
    ratioSpread:Math.max(...ratios)-Math.min(...ratios),
    predicted:[...cabinetDimensions] as MeterDimensions,
    maxRelativeError,
    reviewRequired:maxRelativeError>tolerance,
    finalSize:[initial.size.x,initial.size.y,initial.size.z],
  };
}
