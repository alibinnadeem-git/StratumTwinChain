export type MeterDimensions=[number,number,number];

export type UniformMeterScalePlan={
  intrinsic:MeterDimensions;
  target:MeterDimensions;
  ratios:MeterDimensions;
  scalar:number;
  ratioSpread:number;
  predicted:MeterDimensions;
  maxRelativeError:number;
  reviewRequired:boolean;
};

function positiveTuple(value:MeterDimensions,label:string):MeterDimensions{
  const tuple=value.map(Number) as MeterDimensions;
  if(!tuple.every(item=>Number.isFinite(item)&&item>0))throw new Error(`${label} dimensions must be finite positive meters`);
  return tuple;
}

export function planUniformMeterScale(
  intrinsicInput:MeterDimensions,
  targetInput:MeterDimensions,
  tolerance=.05
):UniformMeterScalePlan{
  const intrinsic=positiveTuple(intrinsicInput,'Intrinsic');
  const target=positiveTuple(targetInput,'Target');
  const ratios=target.map((value,index)=>value/intrinsic[index]) as MeterDimensions;
  const sorted=[...ratios].sort((a,b)=>a-b);
  const scalar=sorted[1];
  const ratioSpread=(sorted[2]-sorted[0])/Math.max(scalar,Number.EPSILON);
  const predicted=intrinsic.map(value=>value*scalar) as MeterDimensions;
  const relativeErrors=predicted.map((value,index)=>Math.abs(value-target[index])/target[index]);
  const maxRelativeError=Math.max(...relativeErrors);
  return{
    intrinsic,target,ratios,scalar,ratioSpread,predicted,maxRelativeError,
    reviewRequired:ratioSpread>Math.max(0,tolerance)
  };
}
