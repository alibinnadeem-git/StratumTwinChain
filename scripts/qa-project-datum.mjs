import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildProjectDatumSurfaces,projectDatumSurfaceForEntity,datumSurfaceMetadata} from '../lib/project-datum.ts';
import {extractZEvidenceFromText,resolveEntityZ} from '../lib/z-resolver.ts';

const evidence=extractZEvidenceFromText(
  'LEVEL 2 F.F. EL. 14\'-0"\nPANEL LP-2 CENTERLINE 4\'-0" AFF',
  {source:'A-201.pdf',floor:'L2'}
);
const surfaces=buildProjectDatumSurfaces(evidence);
assert.equal(surfaces.length,1);
assert.equal(surfaces[0].kind,'FINISHED_FLOOR');
assert.ok(Math.abs(surfaces[0].zMeters-4.2672)<1e-6);

const entity={id:'panel',name:'PANEL LP-2',source:'E-201.pdf',floor:'L2',confidence:.8,meta:{}};
const surface=projectDatumSurfaceForEntity(entity,surfaces);
assert.ok(surface);
assert.equal(datumSurfaceMetadata(surface).floorDatumMeters,surface.zMeters);

const withAff=resolveEntityZ(entity,evidence);
assert.equal(withAff.status,'RESOLVED_DESIGN_CANDIDATE');
assert.equal(withAff.authority,'FLOOR_DATUM_PLUS_AFF_REFERENCE');
assert.equal(withAff.referencePoint,'CENTERLINE');
assert.ok(Math.abs(Number(withAff.zMeters)-5.4864)<1e-6);

const datumOnlyEvidence=extractZEvidenceFromText('LEVEL 2 F.F. EL. 14\'-0"',{source:'A-201.pdf',floor:'L2'});
const datumOnly=resolveEntityZ(entity,datumOnlyEvidence);
assert.equal(datumOnly.status,'RELATIVE_ONLY');
assert.equal(datumOnly.authority,'PROJECT_FLOOR_DATUM_ONLY');
assert.equal(datumOnly.zMeters,null);

const ambiguous=extractZEvidenceFromText('FFE 100.00',{source:'C-101.pdf',floor:'L1'});
assert.ok(ambiguous.some(item=>item.evidence.some(line=>/UNITS_REQUIRE_SOURCE_DATUM_REVIEW/.test(line))));
assert.equal(buildProjectDatumSurfaces(ambiguous).length,0);

const grade=extractZEvidenceFromText('FG 12.50 M',{source:'C-101.pdf'});
const gradeSurfaces=buildProjectDatumSurfaces(grade);
assert.equal(gradeSurfaces.length,1);
assert.equal(gradeSurfaces[0].kind,'GRADE');
const outdoor={id:'ev',name:'EVSE',source:'C-101.pdf',floor:'UNRESOLVED',confidence:.7,meta:{}};
assert.equal(projectDatumSurfaceForEntity(outdoor,gradeSurfaces)?.zMeters,12.5);

const structural=extractZEvidenceFromText(
 'TOP OF SLAB ELEVATION = 15\'-0"\nTOP OF STEEL ELEVATION 14\'-6 1/2"\nB.O.D. +18\'-0"',
 {source:'S-201.pdf',floor:'L2'}
);
assert.ok(structural.some(item=>item.type==='SECTION_ELEVATION'),'structural elevations remain preserved as Z evidence');
assert.equal(buildProjectDatumSurfaces(structural).length,0,'structural section elevations must never become generic project floor/support surfaces');
assert.equal(projectDatumSurfaceForEntity(entity,buildProjectDatumSurfaces(structural)),null);

const tcFl=extractZEvidenceFromText('TC 194.61 FT\nFL 193.78 FT',{source:'C-2.pdf'});
assert.ok(tcFl.length>=2,'curb and flowline elevations remain preserved as source Z evidence');
assert.equal(buildProjectDatumSurfaces(tcFl).length,0,'TC/FL must not masquerade as finished grade project surfaces');

const mixedGrade=extractZEvidenceFromText('TC 194.61 FT\nFL 193.78 FT\nFG 194.56 FT',{source:'C-2.pdf'});
const mixedGradeSurfaces=buildProjectDatumSurfaces(mixedGrade);
assert.equal(mixedGradeSurfaces.length,1);
assert.equal(mixedGradeSurfaces[0].kind,'GRADE');
assert.ok(Math.abs(mixedGradeSurfaces[0].zMeters-(194.56*.3048))<1e-6,'only explicit finished-grade evidence seeds the generic grade datum');

assert.deepEqual(datumSurfaceMetadata({
 id:'legacy-section',kind:'SECTION_DATUM',floor:'L2',zMeters:4.572,confidence:.9,source:'S-201.pdf',
 evidence:['TOP OF SLAB ELEVATION = 15\'-0"'],physicalTruth:false,reviewRequired:true,conflict:false
}),{},'legacy SECTION_DATUM values must fail closed instead of emitting floor/support metadata');

const projection=fs.readFileSync('lib/spatial-projection.ts','utf8');
assert.doesNotMatch(projection,/return-4\*Number/);
assert.doesNotMatch(projection,/\)\-1\)\*4/);
assert.doesNotMatch(projection,/ROOF'\)return 12/);
assert.doesNotMatch(projection,/INFERRED_FLOOR_LABEL/);
assert.match(projection,/XY_AND_Z_SHARE_SOURCE_UNITS/);
assert.match(projection,/zScaleGuideMetersPerSourceUnit/);
assert.match(projection,/reviewSurfaceZ/);

const compiler=fs.readFileSync('components/CompilerWorkspace.tsx','utf8');
assert.match(compiler,/buildProjectDatumSurfaces/);
assert.match(compiler,/projectDatumSurfaceForEntity/);
assert.match(compiler,/zScaleGuideMetersPerSourceUnit/);

const viewer=fs.readFileSync('components/CompiledGraphViewer.tsx','utf8');
assert.match(viewer,/PROJECT DATUM REVIEW SURFACE/);
assert.match(viewer,/reviewSurfaceZ/);

const inspector=fs.readFileSync('components/SpatialAssetInspector.tsx','utf8');
assert.match(inspector,/Datum authority/);
assert.match(inspector,/XYZ unit guide/);

console.log('Project datum boundary passed: finished-floor/finished-grade support surfaces remain source-grounded, structural section datums and TC/FL stay typed evidence only, explicit-reference AFF composes safely, ambiguous unitless datums fail closed, and shared XYZ source units guide Z conversion without invented floor heights.');
