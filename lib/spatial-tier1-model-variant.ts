import type {Object3D} from "three";
/**
 * Render one specific approved type's generic Tier-1 geometry, not an entire
 * shared family at once. This mutates viewer-only glTF scene nodes, never XYZ,
 * registered assets, confidence, scale, status, or other authority state.
 * Fail closed if there is no uniquely named class variant.
 */
export function selectTier1ModelVariant(scene:Object3D,variantId:string):boolean{
 const variants:Object3D[]=[];
 scene.traverse(node=>{if(node.name.startsWith('variant:'))variants.push(node);});
 const matching=variants.filter(node=>node.name==='variant:'+variantId);
 for(const node of variants)node.visible=matching.length===1&&node===matching[0];
 return matching.length===1;
}
