import assert from 'node:assert/strict';
import fs from 'node:fs';

const compiler=fs.readFileSync('components/CompilerWorkspace.tsx','utf8');
const viewer=fs.readFileSync('components/CompiledGraphViewer.tsx','utf8');
const library=fs.readFileSync('lib/electrical-component-library.ts','utf8');

assert.match(compiler,/pageEvidence\.get\(segment\.page\)\?\.isSld\|\|!planEvidence\.get\(segment\.page\)\?\.isPlan/,'recognized non-SLD source-plan segments must have a dedicated retention path while notes/detail sheets remain excluded');
assert.match(compiler,/kind:'line'.*drawingBasemap:true/s,'retained PDF plan vectors must become renderable line entities');
assert.match(compiler,/sourceType:'PDF source-plan vector line'/);
assert.match(compiler,/coordinateUnits:'sheet'/);
assert.match(compiler,/physicalElevationKnown:false/);
assert.match(compiler,/zPlacementAuthority:'UNVERIFIED_DRAWING_PLANE'/);
assert.match(compiler,/spatialPlacementAuthority:'SOURCE_SHEET_POSITION_ONLY'/);
assert.match(compiler,/physicalTruth:false/);
assert.match(compiler,/pageCount>=4000\|\|sourcePlanSegments>=40000/,'source-plan retention must remain bounded per page and globally for browser safety');
assert.match(compiler,/retained source-plan vector segment/,'import summary must disclose retained source-plan geometry');
assert.match(compiler,/kind:'source-raster-underlay'/,'JPG/PNG drawings must create a review-only Spatial underlay');
assert.match(compiler,/embeddedRasterDataUrl/,'raster drawing underlay must preserve a bounded derivative preview');
assert.match(compiler,/geometryAuthority:'RASTER_PREVIEW_ONLY'/);
assert.match(compiler,/spatialPlacementAuthority:'SOURCE_IMAGE_PLANE_ONLY'/);
assert.match(compiler,/raster drawing underlay retained for source-plane review/);
assert.match(compiler,/toDataURL\('image\/jpeg',\.76\)/,'raster preview must be bounded/compressed rather than embedding the original image bytes');

assert.match(viewer,/meta\?\.drawingBasemap===true/,'Spatial must disclose when a source-plan basemap is present');
assert.match(viewer,/Source drawing basemap is shown on the drawing plane/);
assert.match(viewer,/plural\(visibleLines,'drawing line'\)/,'Spatial header must expose drawing-line count');
assert.match(viewer,/e\.kind==="line".*THREE\.Line/s,'Spatial WebGL path must render line entities');
assert.match(viewer,/e\.kind==="source-raster-underlay"/,'Spatial must recognize raster drawing underlays');
assert.match(viewer,/new THREE\.TextureLoader\(\)\.load\(source/,'WebGL must render the retained raster preview as a texture');
assert.match(viewer,/DRAWING UNDERLAYS/,'HUD must disclose raster drawing underlay count');
assert.match(viewer,/e\.kind!=="source-raster-underlay"/,'raster underlays must not masquerade as selectable project equipment');

assert.match(library,/aliases:\['tesla supercharger v3','tesla supercharger','tesla charger','supercharger'\]/,'Tesla Supercharger callouts with intervening PSU text must resolve to the Tesla library class');

console.log('Site-plan Spatial basemap contract passed: non-SLD PDF vectors survive compilation, render as source-grounded linework, remain Z-unverified, and Tesla Supercharger callouts resolve without asserting installed identity.');
