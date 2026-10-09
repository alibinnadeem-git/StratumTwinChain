import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PDF_NATIVE_ABSOLUTE_MAX_BYTES,PDF_NATIVE_STANDARD_MAX_BYTES,pdfIngestionProfile} from '../lib/pdf-ingestion-profile.ts';

const brynhurstElectrical=pdfIngestionProfile(5_472_602);
assert.equal(brynhurstElectrical.accepted,true);
assert.equal(brynhurstElectrical.mode,'STANDARD');

const brynhurstArchitectural=pdfIngestionProfile(85_715_172);
assert.equal(brynhurstArchitectural.accepted,true);
assert.equal(brynhurstArchitectural.mode,'LARGE_SOURCE');
assert.ok(brynhurstArchitectural.maxPages>=120);
assert.ok(brynhurstArchitectural.maxSourcePlanSegmentsTotal<40_000,'large-source mode must bound retained geometry more aggressively than standard parsing');

const camarilloFullRev3=pdfIngestionProfile(193_705_494);
assert.equal(camarilloFullRev3.accepted,true);
assert.equal(camarilloFullRev3.mode,'LARGE_SOURCE');

assert.equal(PDF_NATIVE_STANDARD_MAX_BYTES,64*1024*1024);
assert.equal(PDF_NATIVE_ABSOLUTE_MAX_BYTES,250*1024*1024);
assert.equal(pdfIngestionProfile(PDF_NATIVE_ABSOLUTE_MAX_BYTES+1).accepted,false);

const worker=fs.readFileSync('workers/pdf-native-parser.worker.ts','utf8');
assert.match(worker,/pdfIngestionProfile\(buffer\.byteLength\)/);
assert.match(worker,/ingestion\.maxTextItems/);
assert.match(worker,/ingestion\.maxTotalOperators/);
assert.match(worker,/ingestion\.maxSourcePlanSegmentsTotal/);
assert.doesNotMatch(worker,/const MAX_FILE_BYTES=64\*1024\*1024/);
assert.match(worker,/large-source bounded parse/);

const compiler=fs.readFileSync('components/CompilerWorkspace.tsx','utf8');
assert.match(compiler,/const ingestion=pdfIngestionProfile\(buffer\.byteLength\)/);
assert.match(compiler,/ingestion\.mode==='LARGE_SOURCE'\?90000:35000/);
assert.doesNotMatch(compiler,/const transferable=buffer\.slice\(0\)/);
assert.match(compiler,/const transferable=buffer;/);

console.log('Large PDF ingestion passed: real 85.7 MB Brynhurst Architectural and 193.7 MB Camarillo Full Rev 3 sizes enter bounded off-thread large-source mode, original source limits remain 250 MB, and duplicate pre-worker buffer allocation is removed.');
