import assert from 'node:assert/strict';
import fs from 'node:fs';
import {extractZEvidenceFromText,resolveEntityZ} from '../lib/z-resolver.ts';

const floor=extractZEvidenceFromText('LEVEL 2 F.F. EL. 14\'-0"\nPANEL LP-2 4\'-0" AFF',{source:'E-201.pdf',floor:'L2'});
const datum=floor.find(item=>item.type==='FLOOR_DATUM');
const aff=floor.find(item=>item.type==='MOUNTING_HEIGHT_AFF');
assert.ok(datum&&Math.abs(Number(datum.valueMeters)-4.2672)<1e-6);
assert.ok(aff&&Math.abs(Number(aff.valueMeters)-1.2192)<1e-6);
assert.equal(aff.referencePoint,'UNSPECIFIED');
const ambiguous=resolveEntityZ({id:'panel',name:'PANEL LP-2',source:'E-201.pdf',floor:'L2',confidence:.8,meta:{}},floor);
assert.equal(ambiguous.status,'RELATIVE_ONLY');
assert.equal(ambiguous.authority,'AFF_REFERENCE_UNSPECIFIED');
assert.equal(ambiguous.referencePoint,'UNSPECIFIED');
assert.equal(ambiguous.zMeters,null);

const explicitFloor=extractZEvidenceFromText('LEVEL 2 F.F. EL. 14\'-0"\nPANEL LP-2 CENTERLINE 4\'-0" AFF',{source:'E-201.pdf',floor:'L2'});
const resolved=resolveEntityZ({id:'panel',name:'PANEL LP-2',source:'E-201.pdf',floor:'L2',confidence:.8,meta:{}},explicitFloor);
assert.equal(resolved.status,'RESOLVED_DESIGN_CANDIDATE');
assert.equal(resolved.authority,'FLOOR_DATUM_PLUS_AFF_REFERENCE');
assert.equal(resolved.referencePoint,'CENTERLINE');
assert.ok(Math.abs(Number(resolved.zMeters)-5.4864)<1e-6);
assert.equal(resolved.physicalTruth,false);
assert.equal(resolved.reviewRequired,true);

const relative=resolveEntityZ({id:'wall-device',name:'DEVICE D-1',source:'E-201.pdf',floor:'L3',confidence:.8,meta:{}},extractZEvidenceFromText('DEVICE D-1 CENTERLINE 48 IN AFF',{source:'E-201.pdf',floor:'L3'}));
assert.equal(relative.status,'RELATIVE_ONLY');
assert.equal(relative.referencePoint,'CENTERLINE');
assert.equal(relative.authority,'AFF_WITHOUT_FLOOR_DATUM');
const unlinked=resolveEntityZ({id:'other',name:'PANEL OTHER',source:'E-201.pdf',floor:'L3',confidence:.8,meta:{}},extractZEvidenceFromText('DEVICE D-1 CENTERLINE 48 IN AFF',{source:'E-201.pdf',floor:'L3'}));
assert.equal(unlinked.status,'UNRESOLVED');
assert.equal(relative.zMeters,null);

const ifc=resolveEntityZ({id:'ifc-1',name:'Transformer',source:'model.ifc',z:8.25,floor:'L3',confidence:.96,meta:{sourceType:'IFC_STEP_PRODUCT',sourceDesignElevationKnown:true,zPlacementAuthority:'SOURCE_IFC_DESIGN_PLACEMENT'}},[]);
assert.equal(ifc.status,'RESOLVED_DESIGN_CANDIDATE');
assert.equal(ifc.zMeters,8.25);
assert.equal(ifc.referencePoint,'SOURCE_ORIGIN');
assert.equal(ifc.authority,'SOURCE_IFC_DESIGN_PLACEMENT');

const conflictEvidence=extractZEvidenceFromText('LEVEL 2 F.F. EL. 14\'-0"\nLEVEL 2 F.F. EL. 16\'-0"',{source:'A-201.pdf',floor:'L2'});
const conflict=resolveEntityZ({id:'x',name:'X',source:'A-201.pdf',floor:'L2',confidence:.5,meta:{}},conflictEvidence);
assert.equal(conflict.status,'CONFLICT');
assert.equal(conflict.zMeters,null);


const structural=extractZEvidenceFromText(
  'TOP OF SLAB ELEVATION = 15\'-0"\nTOP OF STEEL ELEVATION 14\'-6 1/2"\nB.O.D. +18\'-0"',
  {source:'S-201.pdf',floor:'L2'}
);
const slab=structural.find(item=>/TOP OF SLAB/.test(item.evidence[0]));
const steel=structural.find(item=>/TOP OF STEEL/.test(item.evidence[0]));
const bod=structural.find(item=>/B\.O\.D\./.test(item.evidence[0]));
assert.ok(slab&&slab.type==='SECTION_ELEVATION'&&Math.abs(Number(slab.valueMeters)-4.572)<1e-6);
assert.ok(steel&&steel.type==='SECTION_ELEVATION'&&Math.abs(Number(steel.valueMeters)-4.4323)<1e-4);
assert.ok(bod&&bod.type==='SECTION_ELEVATION'&&Math.abs(Number(bod.valueMeters)-5.4864)<1e-6);
const unrelatedStructural=resolveEntityZ({id:'panel-struct',name:'PANEL LP-2',source:'E-201.pdf',floor:'L2',confidence:.8,meta:{}},structural);
assert.equal(unrelatedStructural.status,'UNRESOLVED');
assert.equal(unrelatedStructural.zMeters,null);

const realStructuralSplit=extractZEvidenceFromText(
  'LEVEL 1 SLAB ELEV.\n0\'-0"\nB.O.D.=\n27\'-11 5/8"\n28\'-0" - B.O.D. BEYOND',
  {source:'Full Rev 3 Set.pdf'}
);
const level1=realStructuralSplit.find(item=>item.type==='FLOOR_DATUM'&&item.floor==='L1'&&item.evidence.includes('SPLIT_LINE_STRUCTURAL_DATUM'));
assert.ok(level1&&Math.abs(Number(level1.valueMeters)-0)<1e-9);
const splitBod=realStructuralSplit.find(item=>item.type==='SECTION_ELEVATION'&&item.evidence.includes('SPLIT_LINE_STRUCTURAL_DATUM')&&Math.abs(Number(item.valueMeters)-(27+11.625/12)*.3048)<1e-5);
assert.ok(splitBod);
const suffixBod=realStructuralSplit.find(item=>item.type==='SECTION_ELEVATION'&&item.evidence.includes('SUFFIX_STRUCTURAL_DATUM')&&Math.abs(Number(item.valueMeters)-28*.3048)<1e-6);
assert.ok(suffixBod);
assert.ok(realStructuralSplit.every(item=>item.physicalTruth===false&&item.reviewRequired===true));

const civil=extractZEvidenceFromText(
  'FG 194.56 FT\nFS 194.62 FT\nTC 195.08 FT\nFL 194.10 FT\nTOP OF CURB 15\'-0"',
  {source:'C-2.pdf'}
);
const fg=civil.find(item=>item.evidence[0]==='FG 194.56 FT');
const fsGrade=civil.find(item=>item.evidence[0]==='FS 194.62 FT');
const tc=civil.find(item=>item.evidence[0]==='TC 195.08 FT');
const fl=civil.find(item=>item.evidence[0]==='FL 194.10 FT');
const topCurbFeet=civil.find(item=>item.evidence[0]==='TOP OF CURB 15\'-0"');
assert.equal(fg?.type,'GRADE_ELEVATION');
assert.equal(fsGrade?.type,'GRADE_ELEVATION');
assert.equal(tc?.type,'TOP_OF_CURB_ELEVATION');
assert.equal(fl?.type,'FLOWLINE_ELEVATION');
assert.equal(topCurbFeet?.type,'TOP_OF_CURB_ELEVATION');
assert.ok(Math.abs(Number(topCurbFeet?.valueMeters)-4.572)<1e-6);
assert.ok(!civil.some(item=>item.evidence[0]==='TOP OF CURB 15\'-0"'&&item.type==='SECTION_ELEVATION'),'top-of-curb must remain civil breakline evidence, never structural section datum');
assert.ok(civil.every(item=>item.physicalTruth===false&&item.reviewRequired===true));

const unitlessCivil=extractZEvidenceFromText('FG 194.56\nTC 195.08\nFL 194.10',{source:'C-2.pdf'});
assert.equal(unitlessCivil.find(item=>item.evidence[0]==='FG 194.56')?.type,'SPOT_ELEVATION');
assert.equal(unitlessCivil.find(item=>item.evidence[0]==='TC 195.08')?.type,'TOP_OF_CURB_ELEVATION');
assert.equal(unitlessCivil.find(item=>item.evidence[0]==='FL 194.10')?.type,'FLOWLINE_ELEVATION');
assert.ok(unitlessCivil.every(item=>item.evidence.includes('UNITS_REQUIRE_SOURCE_DATUM_REVIEW')));

const brynhurstArchitectural=extractZEvidenceFromText(
  [
    '1st Story',"195' - 1\"",
    '2nd Story',"205' - 1\"",
    '3rd Story',"215' - 1\"",
    '4th Story',"225' - 1\"",
    'Grade Plane',"196' - 3\"",
    'LAG',"194' - 9 1/8\"",
    "LOWEST ADJACENT GRADE= 194.76'",
    "GRADE PLANE= 196.33'",
    "TOP OF ROOF= 239.08'",
    'Top of Parapet',"239' - 1\""
  ].join('\n'),
  {source:'5749 Brynhurst - Architectural - 2025-04-04.pdf'}
);
for(const [floorName,feet,inches] of [['L1',195,1],['L2',205,1],['L3',215,1],['L4',225,1]]){
  const datum=brynhurstArchitectural.find(item=>item.type==='FLOOR_DATUM'&&item.floor===floorName);
  assert.ok(datum,`expected Brynhurst ${floorName} story datum`);
  assert.ok(Math.abs(Number(datum.valueMeters)-(Number(feet)+Number(inches)/12)*.3048)<1e-6);
}
const gradePlaneValues=brynhurstArchitectural.filter(item=>item.type==='CODE_GRADE_PLANE');
assert.ok(gradePlaneValues.length>=2);
assert.ok(gradePlaneValues.some(item=>Math.abs(Number(item.valueMeters)-196.25*.3048)<1e-6));
assert.ok(gradePlaneValues.some(item=>Math.abs(Number(item.valueMeters)-196.33*.3048)<1e-6));
assert.ok(!gradePlaneValues.some(item=>item.type==='GRADE_ELEVATION'||item.type==='SPOT_ELEVATION'));
const lagValues=brynhurstArchitectural.filter(item=>item.type==='LOWEST_ADJACENT_GRADE');
assert.ok(lagValues.length>=2);
assert.ok(lagValues.some(item=>Math.abs(Number(item.valueMeters)-(194+9.125/12)*.3048)<1e-6));
assert.ok(lagValues.some(item=>Math.abs(Number(item.valueMeters)-194.76*.3048)<1e-6));
assert.ok(brynhurstArchitectural.some(item=>item.type==='SECTION_ELEVATION'&&/TOP OF ROOF/.test(item.evidence[0])));
assert.ok(brynhurstArchitectural.some(item=>item.type==='SECTION_ELEVATION'&&/Top of Parapet/i.test(item.evidence[0])));

const brynhurstGradePoints=extractZEvidenceFromText(
  'EG 197.70 FT\nFG 197.96 FT\n197.65 FT EG\n197.96 FT FG\n194.61 FT TC\n193.78 FT FL',
  {source:'A106 Grade Plane Exhibit'}
);
assert.equal(brynhurstGradePoints.find(item=>item.evidence[0]==='EG 197.70 FT')?.type,'EXISTING_GRADE_ELEVATION');
assert.equal(brynhurstGradePoints.find(item=>item.evidence[0]==='FG 197.96 FT')?.type,'GRADE_ELEVATION');
assert.equal(brynhurstGradePoints.find(item=>item.evidence[0]==='197.65 FT EG')?.type,'EXISTING_GRADE_ELEVATION');
assert.equal(brynhurstGradePoints.find(item=>item.evidence[0]==='197.96 FT FG')?.type,'GRADE_ELEVATION');
assert.equal(brynhurstGradePoints.find(item=>item.evidence[0]==='194.61 FT TC')?.type,'TOP_OF_CURB_ELEVATION');
assert.equal(brynhurstGradePoints.find(item=>item.evidence[0]==='193.78 FT FL')?.type,'FLOWLINE_ELEVATION');
for(const label of ['197.65 FT EG','197.96 FT FG','194.61 FT TC','193.78 FT FL']){
  const item=brynhurstGradePoints.find(entry=>entry.evidence[0]===label);
  assert.ok(item&&Math.abs(Number(item.valueMeters)-Number(label.split(' ')[0])*.3048)<1e-6,`suffix civil elevation value failed for ${label}`);
}

const compiler=fs.readFileSync('components/CompilerWorkspace.tsx','utf8');
assert.doesNotMatch(compiler,/elevation:\s*12/);
assert.doesNotMatch(compiler,/elevation:\s*-4/);
assert.doesNotMatch(compiler,/\(f-1\)\*4/);
assert.match(compiler,/extractZEvidenceFromText/);
assert.match(compiler,/zCandidateMeters/);
assert.match(compiler,/SOURCE_DXF_DESIGN_Z/);
assert.match(compiler,/explicitSourceZ/);
assert.match(compiler,/physicalElevationKnown:false/);

const viewer=fs.readFileSync('components/CompiledGraphViewer.tsx','utf8');
assert.match(viewer,/Z REFERENCE CANDIDATE · REVIEW REQUIRED/);
assert.match(viewer,/source reference Z|Source evidence places the/);

console.log('Evidence-based Z resolver passed: source-origin Z, explicit AFF reference semantics, ambiguous AFF fail-closed behavior, structural datum parsing, typed finished/existing-grade, curb/flowline and Brynhurst story/code-datum evidence, conflict handling, and no guessed floor heights.');
