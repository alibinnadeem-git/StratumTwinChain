export type PdfAnchorPoint={x:number;y:number};
export type PdfAnchorPolygon={
  id:string;
  page:number;
  vertices:PdfAnchorPoint[];
  confidence:number;
  planFrameId?:string|null;
};
export type PdfAnchorEntity={
  id:string;
  kind:string;
  name:string;
  x:number;
  y:number;
  rotation?:number;
  confidence:number;
  meta?:Record<string,unknown>;
};

type PolygonMetrics={
  centroid:PdfAnchorPoint;
  area:number;
  width:number;
  height:number;
  rotationDegrees:number|null;
  orientationEligible:boolean;
};

const dist=(a:PdfAnchorPoint,b:PdfAnchorPoint)=>Math.hypot(a.x-b.x,a.y-b.y);

function cleanVertices(vertices:PdfAnchorPoint[]){
  if(vertices.length<3)return vertices;
  const out=vertices.filter((point,index,array)=>index===0||dist(point,array[index-1])>1e-6);
  if(out.length>2&&dist(out[0],out[out.length-1])<1e-6)out.pop();
  return out;
}

function polygonMetrics(polygon:PdfAnchorPolygon):PolygonMetrics|null{
  const vertices=cleanVertices(polygon.vertices);
  if(vertices.length<3)return null;
  let twiceArea=0,cx=0,cy=0;
  for(let i=0;i<vertices.length;i++){
    const a=vertices[i],b=vertices[(i+1)%vertices.length],cross=a.x*b.y-b.x*a.y;
    twiceArea+=cross;cx+=(a.x+b.x)*cross;cy+=(a.y+b.y)*cross;
  }
  const signedArea=twiceArea/2,area=Math.abs(signedArea);
  if(area<1e-8)return null;
  const centroid={x:cx/(3*twiceArea),y:cy/(3*twiceArea)};
  const xs=vertices.map(point=>point.x),ys=vertices.map(point=>point.y);
  const width=Math.max(...xs)-Math.min(...xs),height=Math.max(...ys)-Math.min(...ys);

  const edges=vertices.map((a,index)=>{
    const b=vertices[(index+1)%vertices.length],dx=b.x-a.x,dy=b.y-a.y;
    return{dx,dy,length:Math.hypot(dx,dy)};
  }).filter(edge=>edge.length>1e-6);
  const longest=[...edges].sort((a,b)=>b.length-a.length)[0]||null;
  let orientationEligible=false;
  if(vertices.length===4&&edges.length===4){
    const perpendicular=edges.every((edge,index)=>{
      const next=edges[(index+1)%4];
      const denom=edge.length*next.length;
      return denom>0&&Math.abs((edge.dx*next.dx+edge.dy*next.dy)/denom)<.18;
    });
    const oppositeA=Math.abs(edges[0].length-edges[2].length)/Math.max(edges[0].length,edges[2].length);
    const oppositeB=Math.abs(edges[1].length-edges[3].length)/Math.max(edges[1].length,edges[3].length);
    orientationEligible=perpendicular&&oppositeA<.2&&oppositeB<.2;
  }
  const rotationDegrees=orientationEligible&&longest
    ?Math.atan2(longest.dy,longest.dx)*180/Math.PI
    :null;
  return{centroid,area,width,height,rotationDegrees,orientationEligible};
}

function eligibleEntity(entity:PdfAnchorEntity){
  const meta=entity.meta||{};
  if(meta.nonSpatial===true||meta.sldCandidate===true)return false;
  if(meta.nonSldPlan!==true)return false;
  return entity.kind==='text-asset-candidate'||entity.kind==='powered-equipment-candidate'||entity.kind==='annotated-asset-candidate';
}

function eligiblePolygon(metrics:PolygonMetrics){
  if(metrics.area<.003||metrics.area>2.5)return false;
  if(metrics.width<.04||metrics.height<.04)return false;
  if(metrics.width>2.5||metrics.height>2.5)return false;
  return true;
}

export function anchorPdfEquipmentToVectorSymbols<T extends PdfAnchorEntity>(
  entities:T[],
  polygons:PdfAnchorPolygon[],
  options?:{maxDistance?:number;uniquenessMargin?:number;uniquenessRatio?:number}
):T[]{
  const maxDistance=options?.maxDistance??.7;
  const uniquenessMargin=options?.uniquenessMargin??.18;
  const uniquenessRatio=options?.uniquenessRatio??1.55;
  const prepared=polygons.map(polygon=>({polygon,metrics:polygonMetrics(polygon)}))
    .filter((item):item is {polygon:PdfAnchorPolygon;metrics:PolygonMetrics}=>Boolean(item.metrics&&eligiblePolygon(item.metrics)));

  return entities.map(entity=>{
    if(!eligibleEntity(entity))return entity;
    const page=Number(entity.meta?.page||0);if(!page)return entity;
    const frame=String(entity.meta?.planFrameId||'').trim()||null;
    const candidates=prepared
      .filter(item=>item.polygon.page===page)
      .filter(item=>!frame||!item.polygon.planFrameId||item.polygon.planFrameId===frame)
      .map(item=>({...item,distance:dist({x:entity.x,y:entity.y},item.metrics.centroid)}))
      .filter(item=>item.distance<=maxDistance)
      .sort((a,b)=>a.distance-b.distance);

    if(!candidates.length){
      return{...entity,meta:{...(entity.meta||{}),symbolAnchorStatus:'UNRESOLVED',symbolAnchorAuthority:'TEXT_LABEL_POSITION_ONLY'}};
    }
    const best=candidates[0],second=candidates[1];
    const unique=!second||(
      second.distance-best.distance>=uniquenessMargin&&
      second.distance/Math.max(best.distance,.03)>=uniquenessRatio
    );
    if(!unique){
      return{
        ...entity,
        meta:{
          ...(entity.meta||{}),
          symbolAnchorStatus:'AMBIGUOUS',
          symbolAnchorAuthority:'TEXT_LABEL_POSITION_ONLY',
          symbolAnchorCandidateIds:candidates.slice(0,3).map(item=>item.polygon.id),
          symbolAnchorCandidateDistances:candidates.slice(0,3).map(item=>Number(item.distance.toFixed(6))),
          sourceLabelX:entity.x,sourceLabelY:entity.y,
          physicalTruth:false,reviewRequired:true
        }
      };
    }

    const confidence=Math.max(0,Math.min(1,Math.min(entity.confidence,best.polygon.confidence)*Math.max(.72,1-best.distance/maxDistance*.25)));
    const nextMeta={
      ...(entity.meta||{}),
      sourceLabelX:entity.x,sourceLabelY:entity.y,
      symbolAnchorStatus:'RESOLVED_REVIEW_CANDIDATE',
      symbolAnchorAuthority:'UNIQUE_NEAREST_CLOSED_VECTOR_SYMBOL',
      symbolAnchorPolygonId:best.polygon.id,
      symbolAnchorDistance:best.distance,
      symbolAnchorArea:best.metrics.area,
      symbolAnchorWidth:best.metrics.width,
      symbolAnchorHeight:best.metrics.height,
      symbolAnchorConfidence:confidence,
      spatialPlacementAuthority:'SOURCE_VECTOR_SYMBOL_ANCHOR',
      geometryAuthority:'UNIQUE_NEAREST_CLOSED_VECTOR_SYMBOL',
      physicalTruth:false,reviewRequired:true,
      ...(best.metrics.orientationEligible&&best.metrics.rotationDegrees!==null?{
        sourceLabelRotation:entity.rotation??0,
        rotationAuthority:'SOURCE_VECTOR_RECTANGLE_LONG_EDGE',
        rotationConfidence:Math.min(confidence,.86)
      }:{rotationAuthority:'UNRESOLVED'})
    };
    return{
      ...entity,
      x:best.metrics.centroid.x,
      y:best.metrics.centroid.y,
      ...(best.metrics.orientationEligible&&best.metrics.rotationDegrees!==null?{rotation:best.metrics.rotationDegrees}:{}),
      confidence:Math.min(1,Math.max(entity.confidence,confidence)),
      meta:nextMeta
    };
  });
}
