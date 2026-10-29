import assert from 'node:assert/strict';
import fs from 'node:fs';
import {isNativeUsdFormat,isRenderable3DFormat,NATIVE_USD_EXTENSIONS} from '../lib/spatial-native-usd.ts';

const read=p=>fs.readFileSync(p,'utf8');
for(const ext of NATIVE_USD_EXTENSIONS){
 assert.equal(isNativeUsdFormat(ext),true,ext+' must be a native USD input');
 assert.equal(isRenderable3DFormat(ext.toUpperCase()),true,ext+' must render directly');
 assert.ok(read('components/CompilerWorkspace.tsx').includes("'"+ext+"'"),ext+' must be accepted in compiler');
}
assert.equal(isNativeUsdFormat('glb'),false);
assert.equal(isRenderable3DFormat('GLB'),true);
assert.equal(isRenderable3DFormat('STEP'),false);
const loader=read('lib/spatial-native-usd.ts');
assert.match(loader,/USDLoader/);
assert.ok(!loader.includes('GLTFExporter'),'USD must not require GLB conversion');
const compiler=read('components/CompilerWorkspace.tsx');
assert.match(compiler,/archiveResult\.archived/,'source must be archived before native USD import');
assert.match(compiler,/UNVERIFIED_USD_SCENE_UNITS/,'USD unit scale must remain review-only');
const viewer=read('components/CompiledGraphViewer.tsx');
assert.match(viewer,/readArchivedSource/);
assert.match(viewer,/parseNativeUsd/);
assert.match(viewer,/load3DModelFromUrl/);
assert.match(viewer,/restoreProjectSourceToBrowser/);
assert.match(viewer,/takeoffEligible=false/);
assert.match(viewer,/measurementEligible=false/);
assert.match(viewer,/exportEligible=false/);
const policy=read('lib/spatial-viewer-geometry-policy.ts');
assert.match(policy,/DIMENSIONAL_VISUALIZATION/,'keep geometry safety gate');
assert.match(policy,/simready-assets/,'NVIDIA asset source must retain attribution');
const registry=read('lib/electrical-model-registry.ts');
assert.match(registry,/USDA/);assert.match(registry,/USDC/);
const preview=read('components/ComponentModelPreview.tsx');
assert.match(preview,/load3DModelFromUrl/);
console.log('Native USD integration contract: PASS (static checks only; browser/CI validation still required)');
