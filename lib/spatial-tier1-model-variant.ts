import type {Object3D} from "three";
/**
 * Render one specific approved type's generic Tier-1 geometry, not an entire
 * shared family at once. This mutates viewer-only glTF scene nodes, never XYZ,
 * registered assets, confidence, scale, status, or other authority state.
 * Fail closed if there is no uniquely named class variant.
 */
export function selectTier1ModelVariant(scene:Object3D,variantId:string):boolean{
 const variants:Object3D[]=[];
 const isVariant=(node:Object3D)=>{
  const id=node.userData?.variantId;
  return typeof id==='string'||/variant[_:-]/i.test(node.name);
 };
 const id=(node:Object3D)=>{
  if(typeof node.userData?.variantId==='string')return node.userData.variantId;
  return node.name.replace(/^variant[_:-]/i,'');
 };
 scene.traverse(node=>{if(isVariant(node))variants.push(node);});
 const matching=variants.filter(node=>id(node)===variantId);
 for(const node of variants)node.visible=matching.length===1&&node===matching[0];
 return matching.length===1;
}
