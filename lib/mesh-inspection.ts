import { Box3, Mesh, Object3D, Vector3 } from "three";

export type MeshDetail = {
  id: string;
  name: string;
  triangles: number;
  materials: string[];
};

function meshBounds(node: Mesh) {
  try { return new Box3().setFromObject(node); }
  catch {
    // Incomplete skin data must not prevent inspection of the rest of a model.
    node.geometry.computeBoundingBox();
    return node.geometry.boundingBox?.clone().applyMatrix4(node.matrixWorld) || new Box3();
  }
}

/** Display-only inspection: never reparent meshes or change geometry buffers. */
export function createMeshInspection(root: Object3D) {
  root.updateWorldMatrix(true, true);
  const meshes: Mesh[] = [];
  root.traverse(node => { if ((node as Mesh).isMesh) meshes.push(node as Mesh); });
  const meshSet = new Set<Object3D>(meshes);
  const nested = meshes.some(mesh => {
    for (let parent = mesh.parent; parent && parent !== root.parent; parent = parent.parent) {
      if (meshSet.has(parent)) return true;
    }
    return false;
  });
  const canExplode = !nested && !meshes.some(mesh =>
    "isSkinnedMesh" in mesh || "isInstancedMesh" in mesh || !mesh.matrixAutoUpdate);
  const entries = meshes.map((node, index) => {
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const box = meshBounds(node);
    return {
      node, box, base: node.position.clone(), mask: node.layers.mask,
      offset: new Vector3(),
      detail: {
        id: `mesh-${index + 1}`, name: node.name || `Unnamed mesh ${index + 1}`,
        triangles: Math.floor((node.geometry.index?.count ?? node.geometry.getAttribute("position")?.count ?? 0) / 3),
        materials: materials.map(material => material.name || material.type),
      } satisfies MeshDetail,
    };
  });
  const valid = entries.filter(entry => !entry.box.isEmpty());
  const bounds = new Box3();
  valid.forEach(entry => bounds.union(entry.box));
  const center = bounds.isEmpty() ? new Vector3() : bounds.getCenter(new Vector3());
  const stride = Math.max(0.1, ...valid.map(entry => entry.box.getSize(new Vector3()).length())) * 1.2;
  const columns = Math.max(1, Math.ceil(Math.sqrt(entries.length)));
  const rows = Math.ceil(entries.length / columns);
  entries.forEach((entry, index) => {
    if (entry.box.isEmpty() || !entry.node.parent) return;
    const target = center.clone().add(new Vector3(
      (index % columns - (columns - 1) / 2) * stride,
      0, (Math.floor(index / columns) - (rows - 1) / 2) * stride));
    const delta = target.sub(entry.box.getCenter(new Vector3()));
    const inverse = entry.node.parent.matrixWorld.clone().invert();
    entry.offset.copy(delta.applyMatrix4(inverse).sub(new Vector3().applyMatrix4(inverse)));
  });
  let lastAmount = -1, lastIsolated = "";
  return {
    details: entries.map(entry => entry.detail),
    canExplode,
    apply(amount: number, isolatedMesh = "") {
      if (!entries.some(entry => entry.detail.id === isolatedMesh)) isolatedMesh = "";
      const fraction = canExplode && Number.isFinite(amount) ? Math.max(0, Math.min(1, amount)) : 0;
      if (fraction === lastAmount && isolatedMesh === lastIsolated) return;
      lastAmount = fraction; lastIsolated = isolatedMesh;
      for (const entry of entries) {
        entry.node.position.copy(entry.base).addScaledVector(entry.offset, fraction);
        // Layer masks hide only this mesh, preserving the hierarchy and children.
        entry.node.layers.mask = isolatedMesh && entry.detail.id !== isolatedMesh ? 0 : entry.mask;
      }
      root.updateWorldMatrix(true, true);
    },
    mesh(id: string) { return entries.find(entry => entry.detail.id === id)?.node; },
    bounds(id = "") {
      const result = new Box3();
      for (const entry of entries) {
        if ((!id || entry.detail.id === id) && entry.node.layers.mask !== 0) result.union(meshBounds(entry.node));
      }
      return result;
    },
    restore() {
      lastAmount = -1; lastIsolated = "";
      for (const entry of entries) { entry.node.position.copy(entry.base); entry.node.layers.mask = entry.mask; }
      root.updateWorldMatrix(true, true);
    },
  };
}
