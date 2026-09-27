export const SPATIAL_SOURCE_VAULT_CHUNK_BYTES=2*1024*1024;
export const SPATIAL_SOURCE_VAULT_MAX_BYTES=250*1024*1024;
export const SPATIAL_SOURCE_VAULT_TRUTH_BOUNDARY='SOURCE_BYTES_PRESERVED_FOR_PROJECT_RECOVERY_NOT_VERIFIED_INFRASTRUCTURE_STATE';

export function spatialSourceVaultChunkCount(byteSize:number){
 if(!Number.isFinite(byteSize)||byteSize<=0)return 0;
 return Math.ceil(byteSize/SPATIAL_SOURCE_VAULT_CHUNK_BYTES);
}
