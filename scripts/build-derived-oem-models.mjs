/**
 * Build derived 3D models (GLB) for four STRATUM component-library assets from
 * published physical dimensions. Eaton v8 pattern: drawing-led reconstruction
 * from published dimensions, NOT an exact replica. Exact surface match is NOT
 * verified. No manufacturer CAD is used or traced; no license is claimed.
 *
 * Sources (see registry entries in lib/electrical-model-registry.ts):
 * - Tesla Supercharger V4 post: Tesla Supercharger System Specifications,
 *   V4 Post datasheet, Dimensions 334 x 891 x 1946 mm.
 * - Tesla Supercharger Power Cabinet 387 kVA (P1450758-55-A): same datasheet,
 *   V3 Cabinet, Depth/Width/Height 1000/1250/2200 mm, 387 kVA at 480 VAC.
 * - ABB Elastimold padmount switchgear: ABB/TNB Elastimold Switching and
 *   Sectionalizing Switchgear catalog, ESV314 15 kV 4-way, 48 x 36 x 22 in.
 * - Hitachi liquid-filled pad-mount transformer: HCAI OSP-0115 certified
 *   matrix, Hitachi Energy 3-phase padmount, 500 kVA representative,
 *   Depth 89 in, Width 102 in, Height 77 in.
 *
 * Usage: node scripts/build-derived-oem-models.mjs
 * Writes public/models/oem/*.glb and self-verifies bounds against the
 * dimensions in lib/electrical-model-registry.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

// GLTFExporter uses FileReader (a browser API) when writing binary GLB.
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    constructor() { this.result = null; this.onload = null; this.onloadend = null; this.onerror = null; }
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buf) => { this.result = buf; this.onload?.(); this.onloadend?.(); }).catch((e) => this.onerror?.(e));
    }
  };
}

const OUT_DIR = 'public/models/oem';

const MATS = {
  white: new THREE.MeshStandardMaterial({color: 0xf2f3f0, roughness: 0.55, metalness: 0.08}),
  lightGray: new THREE.MeshStandardMaterial({color: 0xc9ced1, roughness: 0.6, metalness: 0.15}),
  midGray: new THREE.MeshStandardMaterial({color: 0x8b979c, roughness: 0.6, metalness: 0.2}),
  darkGray: new THREE.MeshStandardMaterial({color: 0x3a4145, roughness: 0.65, metalness: 0.2}),
  black: new THREE.MeshStandardMaterial({color: 0x14181a, roughness: 0.5, metalness: 0.25}),
  green: new THREE.MeshStandardMaterial({color: 0x39543a, roughness: 0.7, metalness: 0.1}),
  darkGreen: new THREE.MeshStandardMaterial({color: 0x2a3f2b, roughness: 0.7, metalness: 0.1}),
  tankGray: new THREE.MeshStandardMaterial({color: 0x556055, roughness: 0.65, metalness: 0.25}),
  darkTank: new THREE.MeshStandardMaterial({color: 0x424c43, roughness: 0.65, metalness: 0.25}),
  steel: new THREE.MeshStandardMaterial({color: 0x9aa2a6, roughness: 0.35, metalness: 0.7}),
  yellow: new THREE.MeshStandardMaterial({color: 0xe8c832, roughness: 0.6, metalness: 0.05}),
};

function box(name, w, h, d, cx, cy, cz, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.name = name;
  mesh.position.set(cx, cy, cz);
  return mesh;
}

function cyl(name, rTop, rBottom, h, cx, cy, cz, material, segments = 20) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), material);
  mesh.name = name;
  mesh.position.set(cx, cy, cz);
  return mesh;
}

function cylX(name, r, len, cx, cy, cz, material) {
  const mesh = cyl(name, r, r, len, cx, cy, cz, material);
  mesh.rotation.z = Math.PI / 2;
  return mesh;
}

/** Tesla Supercharger V4 post. Envelope [W 0.334, H 1.946, D 0.891] m. */
function buildV4Post() {
  const root = new THREE.Group();
  root.name = 'Tesla Supercharger V4';
  // y: -0.973 .. 0.973, x: -0.167 .. 0.167, z: -0.4455 .. 0.4455
  root.add(box('Installation plinth', 0.334, 0.06, 0.891, 0, -0.943, 0, MATS.lightGray));
  root.add(box('Main post body', 0.30, 1.886, 0.891, 0, 0.03, 0, MATS.white));
  root.add(box('Top cap', 0.30, 0.025, 0.891, 0, 0.9605, 0, MATS.lightGray));
  // Front fascia, recessed 1 mm so the display sits 1 mm proud of it.
  root.add(box('Front fascia', 0.26, 1.2, 0.01, 0, 0.25, 0.4395, MATS.darkGray));
  root.add(box('Touch display', 0.13, 0.19, 0.008, 0, 0.62, 0.4415, MATS.black));
  root.add(box('Payment terminal', 0.10, 0.12, 0.008, 0, 0.38, 0.4415, MATS.black));
  // Side-mounted charging cable, flush inside the width envelope.
  root.add(cyl('Charging cable', 0.017, 0.017, 1.2, 0.150, 0.05, 0, MATS.black, 12));
  root.add(box('Connector holster', 0.02, 0.16, 0.10, 0.157, -0.62, 0.1, MATS.black));
  return root;
}

/** Tesla Supercharger Power Cabinet 387 kVA. Envelope [W 1.25, H 2.2, D 1.0] m. */
function buildCabinet() {
  const root = new THREE.Group();
  root.name = 'Tesla Supercharger Power Cabinet 387 kVA';
  // y: -1.1 .. 1.1, x: -0.625 .. 0.625, z: -0.5 .. 0.5
  root.add(box('Base plinth', 1.25, 0.10, 1.0, 0, -1.05, 0, MATS.darkGray));
  root.add(box('Cabinet body', 1.25, 2.10, 0.97, 0, 0.05, -0.015, MATS.white));
  root.add(box('Left door', 0.60, 1.85, 0.028, -0.305, 0.075, 0.484, MATS.midGray));
  root.add(box('Right door', 0.60, 1.85, 0.028, 0.305, 0.075, 0.484, MATS.midGray));
  root.add(box('Vent grille', 1.1, 0.18, 0.012, 0, 0.95, 0.494, MATS.darkGray));
  root.add(box('Left door handle', 0.03, 0.18, 0.02, -0.05, 0.1, 0.49, MATS.steel));
  root.add(box('Right door handle', 0.03, 0.18, 0.02, 0.05, 0.1, 0.49, MATS.steel));
  root.add(box('Rear exhaust hood', 0.8, 0.12, 0.06, 0, 0.9, -0.47, MATS.darkGray));
  return root;
}

/** ABB Elastimold padmount switchgear, 4-way. Envelope [W 1.219, H 0.914, D 0.559] m. */
function buildElastimold() {
  const root = new THREE.Group();
  root.name = 'ABB Elastimold Padmount Switchgear';
  // y: -0.457 .. 0.457, x: -0.6095 .. 0.6095, z: -0.2795 .. 0.2795
  root.add(box('Enclosure', 1.219, 0.914, 0.559, 0, 0, 0, MATS.green));
  root.add(box('Left door', 0.58, 0.78, 0.015, -0.295, -0.02, 0.272, MATS.darkGreen));
  root.add(box('Right door', 0.58, 0.78, 0.015, 0.295, -0.02, 0.272, MATS.darkGreen));
  root.add(box('Top lid', 1.219, 0.04, 0.559, 0, 0.437, 0, MATS.darkGreen));
  root.add(box('Base skirt', 1.219, 0.06, 0.559, 0, -0.427, 0, MATS.darkGray));
  root.add(cylX('Parking stand upper', 0.02, 0.06, 0.5795, 0.1, 0.12, MATS.steel));
  root.add(cylX('Parking stand lower', 0.02, 0.06, 0.5795, 0.1, -0.12, MATS.steel));
  root.add(box('Lifting lug left', 0.06, 0.03, 0.06, -0.3, 0.442, 0, MATS.steel));
  root.add(box('Lifting lug right', 0.06, 0.03, 0.06, 0.3, 0.442, 0, MATS.steel));
  return root;
}

/** Hitachi liquid-filled pad-mount transformer, 500 kVA representative.
 *  Envelope [W 2.591, H 1.956, D 2.261] m. */
function buildHitachi() {
  const root = new THREE.Group();
  root.name = 'Hitachi Pad-Mount Transformer';
  // y: -0.978 .. 0.978, x: -1.2955 .. 1.2955, z: -1.1305 .. 1.1305
  root.add(box('Tank', 2.591, 1.70, 1.50, 0, -0.128, -0.3805, MATS.tankGray));
  root.add(box('Front compartment', 2.591, 1.70, 0.761, 0, -0.128, 0.75, MATS.darkTank));
  root.add(box('Compartment door left', 1.24, 1.5, 0.018, -0.635, -0.128, 1.1195, MATS.darkTank));
  root.add(box('Compartment door right', 1.24, 1.5, 0.018, 0.635, -0.128, 1.1195, MATS.darkTank));
  for (const side of [-1, 1]) {
    for (const z of [-0.93, -0.38, 0.17]) {
      root.add(box(`Cooling fin ${side > 0 ? 'right' : 'left'} ${z}`, 0.02, 1.5, 0.4, side * 1.2855, -0.128, z, MATS.darkTank));
    }
  }
  for (const x of [-0.8, 0, 0.8]) {
    root.add(cyl('HV bushing', 0.05, 0.06, 0.256, x, 0.85, -0.38, MATS.steel));
    root.add(cyl('LV bushing', 0.035, 0.04, 0.18, x, 0.812, 0.15, MATS.steel));
  }
  root.add(box('Warning placard', 0.3, 0.2, 0.01, 0, 0.3, 1.1255, MATS.yellow));
  root.add(box('Mounting rail front', 2.4, 0.06, 0.12, 0, -0.948, 0.8, MATS.darkGray));
  root.add(box('Mounting rail rear', 2.4, 0.06, 0.12, 0, -0.948, -0.8, MATS.darkGray));
  return root;
}

const MODELS = [
  {file: 'tesla-supercharger-v4.glb', key: 'evse-tesla-supercharger-v4', dims: [0.334, 1.946, 0.891], build: buildV4Post},
  {file: 'tesla-supercharger-cabinet-387kva.glb', key: 'evse-tesla-supercharger-cabinet-387kva', dims: [1.25, 2.2, 1.0], build: buildCabinet},
  {file: 'abb-elastimold-padmount-switchgear.glb', key: 'padmount-switchgear-abb-elastimold', dims: [1.219, 0.914, 0.559], build: buildElastimold},
  {file: 'hitachi-pad-mount-transformer.glb', key: 'pad-mount-transformer-hitachi', dims: [2.591, 1.956, 2.261], build: buildHitachi},
];

async function main() {
  // GLTFExporter resolves through FileReader callbacks; keep the event loop
  // alive while top-level await is pending.
  const keepAlive = setInterval(() => {}, 1000);
  try {
  const exporter = new GLTFExporter();
  const loader = new GLTFLoader();
  fs.mkdirSync(OUT_DIR, {recursive: true});
  for (const model of MODELS) {
    const scene = new THREE.Scene();
    scene.name = model.key;
    scene.add(model.build());
    const out = await exporter.parseAsync(scene, {binary: true});
    const target = path.join(OUT_DIR, model.file);
    fs.writeFileSync(target, Buffer.from(out));
    // Self-verify: reload and measure bounds against the registry dimensions.
    const bytes = fs.readFileSync(target);
    const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    const size = new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3()).toArray();
    let meshes = 0, triangles = 0;
    gltf.scene.traverse((o) => { if (o.isMesh) { meshes++; triangles += (o.geometry.index?.count || o.geometry.attributes.position.count) / 3; } });
    const deltas = size.map((v, i) => Math.abs(v - model.dims[i]));
    const ok = deltas.every((d) => d < 0.00001) && meshes > 0 && triangles > 30;
    console.log(JSON.stringify({file: model.file, bytes: bytes.length, meshes, triangles: Math.floor(triangles), size: size.map((v) => +v.toFixed(4)), expected: model.dims, boundsMatch: ok}));
    if (!ok) throw new Error(`${model.file}: bounds or geometry check failed`);
  }
  console.log('Derived OEM models built and verified.');
  } finally {
    clearInterval(keepAlive);
  }
}

await main();
