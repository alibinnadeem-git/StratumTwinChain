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

const relative=resolveEntityZ({id:'wall-device',name:'DEVICE',source:'E-201.pdf',floor:'L3',confidence:.8,meta:{}},extractZEvidenceFromText('48 IN AFF',{source:'E-201.pdf',floor:'L3'}));
assert.equal(relative.status,'RELATIVE_ONLY');
assert.equal(relative.zMeters,null);

const ifc=resolveEntityZ({id:'ifc-1',name:'Transformer',source:'model.ifc',z:8.25,floor:'L3',confidence:.96,meta:{sourceType:'IFC_STEP_PRODUCT',sourceDesignElevationKnown:true,zPlacementAuthority:'SOURCE_IFC_DESIGN_PLACEMENT'}},[]);
assert.equal(ifc.status,'RESOLVED_DESIGN_CANDIDATE');
assert.equal(ifc.zMeters,8.25);
assert.equal(ifc.authority,'SOURCE_IFC_DESIGN_PLACEMENT');

const conflictEvidence=extractZEvidenceFromText('LEVEL 2 F.F. EL. 14\'-0"\nLEVEL 2 F.F. EL. 16\'-0"',{source:'A-201.pdf',floor:'L2'});
const conflict=resolveEntityZ({id:'x',name:'X',source:'A-201.pdf',floor:'L2',confidence:.5,meta:{}},conflictEvidence);
assert.equal(conflict.status,'CONFLICT');
assert.equal(conflict.zMeters,null);

const civil=extractZEvidenceFromText('FG 194.56\nTC 195.08',{source:'C-2.pdf'});
assert.ok(civil.some(item=>item.type==='GRADE_ELEVATION'||item.type==='SPOT_ELEVATION'));
assert.ok(civil.every(item=>item.physicalTruth===false&&item.reviewRequired===true));

const compiler=fs.readFileSync('components/CompilerWorkspace.tsx','utf8');
assert.doesNotMatch(compiler,/elevation:\s*12/);
assert.doesNotMatch(compiler,/elevation:\s*-4/);
assert.doesNotMatch(compiler,/\(f-1\)\*4/);
assert.match(compiler,/extractZEvidenceFromText/);
assert.match(compiler,/zCandidateMeters/);
assert.match(compiler,/physicalElevationKnown:false/);

const viewer=fs.readFileSync('components/CompiledGraphViewer.tsx','utf8');
assert.match(viewer,/Z CANDIDATE · REVIEW REQUIRED/);
assert.match(viewer,/design\/drawing candidate, not field-verified physical elevation/);

console.log('Evidence-based Z resolver passed: source design Z, floor datum + AFF, relative-only, conflict, civil elevation evidence, and no guessed floor heights.');
