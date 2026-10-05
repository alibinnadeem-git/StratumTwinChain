export type RenderXY={x:number;y:number};
export type RenderCoordinateEntity={
  x:number;y:number;
  x2?:number;y2?:number;
  vertices?:RenderXY[];
};
export type RenderLocalOrigin={
  x:number;
  y:number;
  sourcePointCount:number;
  authority:'RENDER_ONLY_VISIBLE_BOUNDS_CENTER';
  translationOnly:true;
  persistedCoordinatesChanged:false;
  physicalTruth:false;
};

function finite(value:unknown){
  const n=Number(value);
  return Number.isFinite(n)?n:null;
}

function pointsFor(entity:RenderCoordinateEntity){
  const points:RenderXY[]=[];
  const x=finite(entity.x),y=finite(entity.y);
  if(x!==null&&y!==null)points.push({x,y});
  const x2=finite(entity.x2),y2=finite(entity.y2);
  if(x2!==null&&y2!==null)points.push({x:x2,y:y2});
  if(Array.isArray(entity.vertices))for(const point of entity.vertices){
    const vx=finite(point?.x),vy=finite(point?.y);
    if(vx!==null&&vy!==null)points.push({x:vx,y:vy});
  }
  return points;
}

export function deriveRenderLocalOrigin(entities:RenderCoordinateEntity[]):RenderLocalOrigin{
  const points=entities.flatMap(pointsFor);
  if(!points.length)return{
    x:0,y:0,sourcePointCount:0,
    authority:'RENDER_ONLY_VISIBLE_BOUNDS_CENTER',
    translationOnly:true,persistedCoordinatesChanged:false,physicalTruth:false
  };
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const point of points){
    minX=Math.min(minX,point.x);maxX=Math.max(maxX,point.x);
    minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y);
  }
  return{
    x:(minX+maxX)/2,
    y:(minY+maxY)/2,
    sourcePointCount:points.length,
    authority:'RENDER_ONLY_VISIBLE_BOUNDS_CENTER',
    translationOnly:true,persistedCoordinatesChanged:false,physicalTruth:false
  };
}

export function toRenderLocalXY(point:RenderXY,origin:RenderLocalOrigin):RenderXY{
  return{x:point.x-origin.x,y:point.y-origin.y};
}

export function fromRenderLocalXY(point:RenderXY,origin:RenderLocalOrigin):RenderXY{
  return{x:point.x+origin.x,y:point.y+origin.y};
}

export function renderLocalSpan(entities:RenderCoordinateEntity[],origin:RenderLocalOrigin){
  const points=entities.flatMap(pointsFor).map(point=>toRenderLocalXY(point,origin));
  if(!points.length)return{maxAbsX:0,maxAbsY:0};
  return{
    maxAbsX:Math.max(...points.map(point=>Math.abs(point.x))),
    maxAbsY:Math.max(...points.map(point=>Math.abs(point.y)))
  };
}
