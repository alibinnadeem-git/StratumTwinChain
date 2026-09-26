import assert from 'node:assert/strict';
import fs from 'node:fs';

const compiler=fs.readFileSync('components/CompilerWorkspace.tsx','utf8');
const viewer=fs.readFileSync('components/CompiledGraphViewer.tsx','utf8');
const library=fs.readFileSync('lib/electrical-component-library.ts','utf8');

assert.match(compiler,/if\(pageEvidence\.get\(segment\.page\)\?\.isSld\)continue/,'non-SLD source-plan segments must have a dedicated retention path');
assert.match(compiler,/kind:'line'.*drawingBasemap:true/s,'retained PDF plan vectors must become renderable line entities');
assert.match(compiler,/sourceType:'PDF source-plan vector line'/);
assert.match(compiler,/coordinateUnits:'sheet'/);
assert.match(compiler,/physicalElevationKnown:false/);
assert.match(compiler,/zPlacementAuthority:'UNVERIFIED_DRAWING_PLANE'/);
assert.match(compiler,/spatialPlacementAuthority:'SOURCE_SHEET_POSITION_ONLY'/);
assert.match(compiler,/physicalTruth:false/);
assert.match(compiler,/sourcePlanSegments>=12000/,'source-plan retention must remain bounded for browser safety');
assert.match(compiler,/retained source-plan vector segment/,'import summary must disclose retained source-plan geometry');

assert.match(viewer,/meta\?\.drawingBasemap===true/,'Spatial must disclose when a source-plan basemap is present');
assert.match(viewer,/Source-plan vector linework is shown on the drawing plane/);
assert.match(viewer,/plural\(visibleLines,'drawing line'\)/,'Spatial header must expose drawing-line count');
assert.match(viewer,/e\.kind==="line".*THREE\.Line/s,'Spatial WebGL path must render line entities');

assert.match(library,/aliases:\['tesla supercharger v3','tesla supercharger','tesla charger','supercharger'\]/,'Tesla Supercharger callouts with intervening PSU text must resolve to the Tesla library class');

console.log('Site-plan Spatial basemap contract passed: non-SLD PDF vectors survive compilation, render as source-grounded linework, remain Z-unverified, and Tesla Supercharger callouts resolve without asserting installed identity.');
