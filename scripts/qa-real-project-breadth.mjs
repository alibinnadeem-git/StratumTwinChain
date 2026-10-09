import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pdfIngestionProfile} from '../lib/pdf-ingestion-profile.ts';
import {drawingScaleDenominator} from '../lib/title-block.ts';
import {parseDimensionMeters} from '../lib/scale-validation.ts';
import {extractZEvidenceFromText} from '../lib/z-resolver.ts';

const fixture=JSON.parse(fs.readFileSync('tests/fixtures/real-project-generalization.json','utf8'));
assert.ok(Array.isArray(fixture.projects)&&fixture.projects.length>=3,'breadth gate requires at least three real source contracts');
assert.ok(new Set(fixture.projects.map(project=>project.projectFamily)).size>=2,'breadth gate requires more than one project/domain family');

const modes=new Set();
for(const project of fixture.projects){
 const profile=pdfIngestionProfile(project.source.sizeBytes);
 assert.equal(profile.accepted,true,`${project.fixtureId} must remain inside the supported protected-ingestion envelope`);
 assert.equal(profile.mode,project.source.expectedIngestionMode,`${project.fixtureId} ingestion mode drifted`);
 modes.add(profile.mode);
 assert.match(project.source.sha256,/^[a-f0-9]{64}$/,'real-source fixture must be hash locked');
}
assert.deepEqual(modes,new Set(['STANDARD','LARGE_SOURCE']),'real-project breadth must exercise both standard and large-source ingestion');

const architectural=fixture.projects.find(project=>project.fixtureId==='REAL-BRYNHURST-ARCHITECTURAL');
const architecturalEvidence=extractZEvidenceFromText(
 architectural.semanticContract.zText.join('\n'),
 {source:architectural.source.fileName,idPrefix:'breadth-arch'}
);
const floorDatums=new Map(architecturalEvidence.filter(item=>item.type==='FLOOR_DATUM'&&item.floor).map(item=>[item.floor,item]));
for(const floor of architectural.semanticContract.expectedFloorDatums){
 const item=floorDatums.get(floor);
 assert.ok(item,`expected source floor datum for ${floor}`);
 assert.ok(Number.isFinite(Number(item.valueMeters)));
 assert.equal(item.physicalTruth,false);
 assert.equal(item.reviewRequired,true);
}
const expectedMeters={L1:(195+1/12)*.3048,L2:(205+1/12)*.3048,L3:(215+1/12)*.3048,L4:(225+1/12)*.3048};
for(const [floor,value] of Object.entries(expectedMeters))assert.ok(Math.abs(Number(floorDatums.get(floor)?.valueMeters)-value)<1e-6,`${floor} elevation must remain source-derived`);

const industrial=fixture.projects.find(project=>project.fixtureId==='REAL-CAMARILLO-FULL-REV-3');
const industrialEvidence=extractZEvidenceFromText(
 industrial.semanticContract.zText.join('\n'),
 {source:industrial.source.fileName,floor:'L1',idPrefix:'breadth-industrial'}
);
const airReel=industrialEvidence.find(item=>item.type==='MOUNTING_HEIGHT_AFF'&&item.evidence[0].includes('AIR REEL'));
assert.ok(airReel);
assert.equal(airReel.referencePoint,'BOTTOM');
assert.ok(Math.abs(Number(airReel.valueMeters)-8*.3048)<1e-6);

const nema=industrialEvidence.find(item=>item.type==='MOUNTING_HEIGHT_AFF'&&item.evidence[0].includes('14-50R'));
assert.ok(nema,'NEMA receptacle shorthand with inch-symbol AFF must be extracted');
assert.equal(nema.tag,'RECEPTACLE 14-50R');
assert.ok(Math.abs(Number(nema.valueMeters)-48*.0254)<1e-6);
assert.equal(nema.physicalTruth,false);

const quad=industrialEvidence.find(item=>item.type==='MOUNTING_HEIGHT_AFF'&&item.evidence[0].includes('5-20R'));
assert.ok(quad);
assert.equal(quad.tag,'RECEPTACLE 5-20R');
assert.ok(Math.abs(Number(quad.valueMeters)-44*.0254)<1e-6);

const denominators=new Map([
 ['1/8" = 1\'',96],
 ['1/4" = 1\'',48],
 ['3/16" = 1\'',64],
 ['1/2" = 1\'-0"',24],
 ['3/4" = 1\'-0"',16]
]);
for(const scale of industrial.semanticContract.expectedScaleStrings){
 assert.equal(drawingScaleDenominator(scale),denominators.get(scale),`scale syntax must parse: ${scale}`);
}
for(const dimension of industrial.semanticContract.dimensionStrings){
 const meters=parseDimensionMeters(dimension);
 assert.ok(Number.isFinite(Number(meters))&&Number(meters)>0,`dimension must be measurable: ${dimension}`);
}

console.log('Real-project breadth passed: exact hash/size contracts span residential and industrial sources, both ingestion modes are exercised, source story datums generalize, Camarillo-style AFF/NEMA shorthand is parsed, and multiple architectural scale syntaxes remain measurable without project-specific runtime logic.');
