import records from './spatial-3d-model-registry.v1.json';
export type GenericSource={type:'in-house'|'procedural'|'cc0';url:string|null};
export type Generic3dModel={model_id:string;serves_classes:string[];tier:'hero'|'instanced';
 source:GenericSource;license:string;file:{path:string;sha256:string;git_blob_sha:string};
 dims_w_h_d:{w:number;h:number;d:number};dimensions_basis:string;version:number;
 supersedes:string|null;status:'LEGACY_GENERIC_VISUALIZATION'|'CANDIDATE_PENDING_SEVEN_CHECK_GATE';
 legacy_file:string;variant_by_class:Record<string,string>};
export type LicensedOemModel={model_id:string;license_ref:string;license_expiry:string;
 source:{type:'oem';url:string};file:{path:string;sha256:string};version:number;
 supersedes:string|null;serves_classes:string[]};
/** OEM namespace reserved: no unlicensed OEM records are minted in generic registry. */
export function validateLicensedOemModel(model:LicensedOemModel):boolean{
 return /^oem-[a-z0-9]+(?:-[a-z0-9]+)*-v[1-9][0-9]*$/.test(model.model_id)&&
  model.source.type==='oem'&&Boolean(model.source.url)&&
  Boolean(model.license_ref.trim())&&/^\d{4}-\d{2}-\d{2}$/.test(model.license_expiry)&&
  !Number.isNaN(Date.parse(model.license_expiry))&&
  /^\/models\/oem\//.test(model.file.path)&&/^[0-9a-f]{64}$/.test(model.file.sha256);
}
export const SPATIAL_GENERIC_3D_MODELS=records.models as Generic3dModel[];
export const GENERIC_3D_MODEL_BY_ID=new Map(SPATIAL_GENERIC_3D_MODELS.map(m=>[m.model_id,m]));
export const GENERIC_3D_MODEL_BY_CLASS=new Map(SPATIAL_GENERIC_3D_MODELS.flatMap(m=>m.serves_classes.map(c=>[c,m] as const)));
const byPath=new Map(SPATIAL_GENERIC_3D_MODELS.flatMap(m=>[[m.file.path,m.model_id],[m.legacy_file,m.model_id]] as const));
/** Generic bytes only, and NEVER an OEM license or placement/verification decision. */
export function genericModelIdForPath(path:string):string|null{
 return byPath.get(path)||null;
}
export function generic3dModelForClass(typeId:string):Generic3dModel|null{
 return GENERIC_3D_MODEL_BY_CLASS.get(typeId)||null;
}
export function generic3dModelById(id:string):Generic3dModel|null{
 return GENERIC_3D_MODEL_BY_ID.get(id)||null;
}
/** Strict publication rule: no edited/purged older ID; add version n+1 + supersedes. */
export function assertAppendOnlyGenericRegistry(previous:readonly Generic3dModel[],next:readonly Generic3dModel[]):void{
 const index=new Map(next.map(m=>[m.model_id,m]));
 for(const old of previous){
  const item=index.get(old.model_id);
  if(!item)throw Error('Published model ID removed: '+old.model_id);
  if(JSON.stringify(item)!==JSON.stringify(old))throw Error('Published model ID mutated: '+old.model_id);
 }
 for(const item of next){
  if(previous.some(p=>p.model_id===item.model_id))continue;
  if(item.version>1){
   const prior=index.get(item.supersedes||'');
   if(!prior)throw Error('Version missing previous model: '+item.model_id);
   const stem=(id:string)=>id.replace(/-v\d+$/,'');
   if(stem(item.model_id)!==stem(prior.model_id)||item.version!==prior.version+1)throw Error('Invalid supersedes chain: '+item.model_id);
  }else if(item.supersedes!==null)throw Error('v1 cannot supersede: '+item.model_id);
 }
}
