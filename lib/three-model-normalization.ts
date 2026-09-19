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
