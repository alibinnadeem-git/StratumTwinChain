import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {parseIfcText} from '../lib/ifc-ingest.ts';
import {identifyLibraryComponents} from '../lib/library-component-identity.ts';
import {gateEquipmentCandidates} from '../lib/candidate-gating.ts';
import {auditParsedGraph} from '../lib/spatial-parse-audit.ts';

// #6 golden-fixture breadth: a synthetic IFC (committed, non-customer) exercises the accuracy pipeline
// on a NON-PDF source that actually carries a metric scale — the path Brynhurst can't (PDF, no units).
function ok(label,condition){if(!condition)throw new Error('FAIL: '+label);console.log('✓ '+label)}

const text=fs.readFileSync(path.join(process.cwd(),'tests/fixtures/spatial/sample-electrical.ifc'),'utf8');
const parsed=parseIfcText(text,'sample-electrical.ifc','Electrical');

ok('IFC declares a metric length unit (millimetre → 0.001 m)',parsed.unitName==='millimetre'&&Math.abs((parsed.unitToMeters??0)-0.001)<1e-9);
ok('two placed electrical products parsed',parsed.entities.length===2&&parsed.entities.every(e=>e.kind==='ifc-product-placement'));
ok('placements converted to metres (mm→m)',parsed.entities.some(e=>Math.abs(e.x-3)<1e-9)&&parsed.entities.some(e=>Math.abs(e.x-9)<1e-9));

const source={name:'sample-electrical.ifc',ext:'ifc',unitName:parsed.unitName,unitToMeters:parsed.unitToMeters};
const enriched=gateEquipmentCandidates(identifyLibraryComponents(parsed.entities));
const audit=auditParsedGraph(enriched,[source]);

ok('IFC source has a known metric scale (unlike the Brynhurst PDF)',audit.sources[0].metricScaleKnown===true);
ok('both products are equipment candidates',audit.classLinkage.equipment===2);
ok('both identify to a library component',audit.classLinkage.identified===2);
ok('both gate to real INSTANCEs (tagged T-1 / LP-1)',audit.candidates.instances===2&&audit.candidates.labels===0);
ok('both identified instances',audit.classLinkage.identifiedInstances===2);
ok('coordinates all finite',audit.coordinates.nonFiniteXY===0);

console.log('\nIFC fixture breadth contract passed (metric scale + identification + gating generalize beyond the PDF).');
