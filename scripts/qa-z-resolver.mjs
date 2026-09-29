import assert from 'node:assert/strict';
import fs from 'node:fs';
import {extractZEvidenceFromText,resolveEntityZ} from '../lib/z-resolver.ts';

const floor=extractZEvidenceFromText('LEVEL 2 F.F. EL. 14\'-0"\nPANEL LP-2 4\'-0" AFF',{source:'E-201.pdf',floor:'L2'});
const datum=floor.find(item=>item.type==='FLOOR_DATUM');
const aff=floor.find(item=>item.type==='MOUNTING_HEIGHT_AFF');
assert.ok(datum&&Math.abs(Number(datum.valueMeters)-4.2672)<1e-6);
assert.ok(aff&&Math.abs(Number(aff.valueMeters)-1.2192)<1e-6);
const resolved=resolveEntityZ({id:'panel',name:'PANEL LP-2',source:'E-201.pdf',floor:'L2',confidence:.8,meta:{}},floor);
assert.equal(resolved.status,'RESOLVED_DESIGN_CANDIDATE');
assert.equal(resolved.authority,'FLOOR_DATUM_PLUS_AFF');
assert.ok(Math.abs(Number(resolved.zMeters)-5.4864)<1e-6);
assert.equal(resolved.physicalTruth,false);
assert.equal(resolved.reviewRequired,true);

const relative=resolveEntityZ({id:'wall-device',name:'DEVICE D-1',source:'E-201.pdf',floor:'L3',confidence:.8,meta:{}},extractZEvidenceFromText('DEVICE D-1 48 IN AFF',{source:'E-201.pdf',floor:'L3'}));
assert.equal(relative.status,'RELATIVE_ONLY');
const unlinked=resolveEntityZ({id:'other',name:'PANEL OTHER',source:'E-201.pdf',floor:'L3',confidence:.8,meta:{}},extractZEvidenceFromText('DEVICE D-1 48 IN AFF',{source:'E-201.pdf',floor:'L3'}));
assert.equal(unlinked.status,'UNRESOLVED');
assert.equal(relative.zMeters,null);

const ifc=resolveEntityZ({id:'ifc-1',name:'Transformer',source:'model.ifc',z:8.25,floor:'L3',confidence:.96,meta:{sourceType:'IFC_STEP_PRODUCT',sourceDesignElevationKnown:true,zPlacementAuthority:'SOURCE_IFC_DESIGN_PLACEMENT'}},[]);
assert.equal(ifc.status,'RESOLVED_DESIGN_CANDIDATE');
assert.equal(ifc.zMeters,8.25);
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

const civil=extractZEvidenceFromText('FG 194.56\nTC 195.08',{source:'C-2.pdf'});
assert.ok(civil.some(item=>item.type==='GRADE_ELEVATION'||item.type==='SPOT_ELEVATION'));
assert.ok(civil.every(item=>item.physicalTruth===false&&item.reviewRequired===true));

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
assert.match(viewer,/Z CANDIDATE · REVIEW REQUIRED/);
assert.match(viewer,/design\/drawing candidate, not field-verified physical elevation/);

console.log('Evidence-based Z resolver passed: IFC/DXF source design Z, tagged floor datum + AFF, inline/split-line/suffix structural datum parsing with fractional inches, structural evidence kept from arbitrary asset Z, civil elevation evidence, conflict handling, and no guessed floor heights.');
