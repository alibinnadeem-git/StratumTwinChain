import assert from 'node:assert/strict';
import fs from 'node:fs';
import {dxfRecordZ,dxfUnitInfo} from '../lib/dxf-z-semantics.ts';

const units=dxfUnitInfo([{code:9,value:'$INSUNITS'},{code:70,value:'2'}]);
assert.equal(units.unitName,'ft');assert.ok(Math.abs(units.unitToMeters-.3048)<1e-12);
const line=dxfRecordZ('LINE',{30:['10'],31:['12.5']},units);
assert.equal(line.startExplicit,true);assert.equal(line.endExplicit,true);assert.equal(line.sourceCode,30);assert.equal(line.endSourceCode,31);assert.ok(Math.abs(line.zMeters-3.048)<1e-12);assert.ok(Math.abs(line.z2Meters-3.81)<1e-12);
const lineEndOnly=dxfRecordZ('LINE',{31:['4']},units);
assert.equal(lineEndOnly.startExplicit,false);assert.equal(lineEndOnly.endExplicit,true);assert.equal(lineEndOnly.zMeters,0);assert.ok(Math.abs(lineEndOnly.z2Meters-1.2192)<1e-12);
const lw=dxfRecordZ('LWPOLYLINE',{38:['101.25'],30:['999']},units);
assert.equal(lw.sourceCode,38);assert.ok(Math.abs(lw.zMeters-(101.25*.3048))<1e-12);assert.equal(lw.z2Meters,lw.zMeters);
const explicitZero=dxfRecordZ('INSERT',{30:['0']},units);
assert.equal(explicitZero.startExplicit,true);assert.equal(explicitZero.sourceDesignElevationKnown,true);assert.equal(explicitZero.zMeters,0);
const unitless=dxfRecordZ('LINE',{30:['10'],31:['12']},{unitName:'unitless',unitToMeters:1,insunits:0});
assert.equal(unitless.sourceDesignElevationKnown,false);assert.equal(unitless.zMeters,0);assert.equal(unitless.z2Meters,0);
const usSurvey=dxfUnitInfo([{code:9,value:'$INSUNITS'},{code:70,value:'21'}]);assert.equal(usSurvey.unitName,'us-survey-ft');assert.ok(Math.abs(usSurvey.unitToMeters-(1200/3937))<1e-15);
const usSurveyMile=dxfUnitInfo([{code:9,value:'$INSUNITS'},{code:70,value:'24'}]);assert.equal(usSurveyMile.unitName,'us-survey-mi');assert.ok(Math.abs(usSurveyMile.unitToMeters-((1200/3937)*5280))<1e-10);

const compiler=fs.readFileSync('components/CompilerWorkspace.tsx','utf8');
assert.match(compiler,/dxfRecordZ/);assert.match(compiler,/dxfUnitInfo/);assert.match(compiler,/explicitSourceZ/);assert.match(compiler,/z2:zInfo\.z2Meters/);assert.match(compiler,/rawZ2:zInfo\.rawZ2/);assert.match(compiler,/dxfZ2SourceCode:zInfo\.endSourceCode/);assert.match(compiler,/entity:'LWPOLYLINE'.*rawZ:zInfo\.rawZ/);
console.log('Native DXF Z semantics passed: LINE start/end Z remain distinct, LWPOLYLINE elevation uses group 38, explicit zero is preserved, unitless coordinates fail closed, and U.S. survey units convert deterministically.');
