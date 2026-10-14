/** A production build has no demo rendering implementation. */
export function makePreviewEquipmentRenderer(_:unknown):(_:unknown)=>void{
 return()=>{throw Error('Preview-only model rendering is not present in this build');};
}
