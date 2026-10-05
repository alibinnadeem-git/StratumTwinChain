export type SpatialSourceIdentity={
 name:string;
 sha256?:string;
 discipline?:string;
 ext?:string;
};

export type SpatialEntitySourceIdentity={
 source:string;
 meta?:Record<string,unknown>;
};

export function spatialSourceKey(source:SpatialSourceIdentity){
 const digest=String(source.sha256||'').trim().toLowerCase();
 return digest||source.name;
}

export function spatialEntitySourceKey(entity:SpatialEntitySourceIdentity){
 const digest=String(entity.meta?.sourceSha256||'').trim().toLowerCase();
 return digest||entity.source;
}

export function spatialSourceLayerLabels(sources:SpatialSourceIdentity[]){
 const counts=new Map<string,number>();
 for(const source of sources)counts.set(source.name,(counts.get(source.name)||0)+1);
 return new Map(sources.map(source=>{
  const key=spatialSourceKey(source);
  const duplicate=(counts.get(source.name)||0)>1;
  const suffix=duplicate&&source.sha256?` · ${source.sha256.slice(0,8)}`:'';
  return[key,source.name+suffix];
 }));
}
