export type RenderOriginPoint={x:number;y:number};
export type RenderOriginEntity={
  x:number;y:number;
  x2?:number;y2?:number;
  vertices?:Array<{x:number;y:number}>;
};

export type RenderLocalOrigin={
  x:number;
  y:number;
  authority:'RENDER_ONLY_BOUNDING_CENTER';
  sourcePointCount:number;
};

const finite=(value:unknown)=>typeof value==='number'&&Number.isFinite(value);

export function deriveRenderLocalOrigin(entities:RenderOriginEntity[]):RenderLocalOrigin{
  const points:RenderOriginPoint[]=[];
  for(const entity of entities){
    if(finite(entity.x)&&finite(entity.y))points.push({x:entity.x,y:entity.y});
    if(finite(entity.x2)&&finite(entity.y2))points.push({x:entity.x2 as number,y:entity.y2 as number});
    if(Array.isArray(entity.vertices))for(const vertex of entity.vertices){
      if(finite(vertex.x)&&finite(vertex.y))points.push({x:vertex.x,y:vertex.y});
    }
  }
  if(!points.length)return{x:0,y:0,authority:'RENDER_ONLY_BOUNDING_CENTER',sourcePointCount:0};
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const point of points){
    minX=Math.min(minX,point.x);maxX=Math.max(maxX,point.x);
    minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y);
  }
  return{
    x:(minX+maxX)/2,
    y:(minY+maxY)/2,
    authority:'RENDER_ONLY_BOUNDING_CENTER',
    sourcePointCount:points.length
  };
}

export function toRenderLocalXY(point:RenderOriginPoint,origin:RenderLocalOrigin):RenderOriginPoint{
  return{x:point.x-origin.x,y:point.y-origin.y};
}

export function fromRenderLocalXY(point:RenderOriginPoint,origin:RenderLocalOrigin):RenderOriginPoint{
  return{x:point.x+origin.x,y:point.y+origin.y};
}
