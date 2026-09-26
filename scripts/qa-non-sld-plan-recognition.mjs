import assert from 'node:assert/strict';
import fs from 'node:fs';
import {detectNonSldPlanPage,resolveDrawingPageRecognition} from '../lib/plan-recognition.ts';

const cases=[
 ['ELECTRICAL POWER PLAN','ELECTRICAL_POWER_PLAN','Electrical'],
 ['NEW ELECTRICAL LIGHTING PLAN','ELECTRICAL_LIGHTING_PLAN','Electrical'],
 ['UTILITY PLAN','UTILITY_PLAN','Multi-discipline / Utilities'],
 ['SITE PLAN','SITE_PLAN','Civil / Site'],
 ['MEZZANINE FRAMING PLAN','STRUCTURAL_FRAMING_PLAN','Structural'],
 ['ROOF FRAMING PLAN','STRUCTURAL_FRAMING_PLAN','Structural'],
 ['DUMPSTER FOUNDATION PLAN','FOUNDATION_PLAN','Structural'],
 ['FIRE SUPPRESSION','FIRE_PROTECTION_PLAN','Fire Protection'],
 ['C1D1 & C1D2 HAZARDOUS LOCATIONS','HAZARDOUS_AREA_PLAN','Electrical / Life Safety'],
 ['MECHANICAL FLOOR PLAN','MECHANICAL_PLAN','Mechanical'],
 ['PLUMBING PLAN','PLUMBING_PLAN','Plumbing'],
 ['REFLECTED CEILING PLAN','REFLECTED_CEILING_PLAN','Architectural'],
 ['GENERAL LAYOUT','GENERAL_LAYOUT_PLAN','General / Equipment'],
 ['SHOP LAYOUT','SHOP_LAYOUT_PLAN','Equipment'],
 ['PIT LAYOUT','PIT_LAYOUT_PLAN','Equipment / Structural'],
 ['FLOOR ANCHOR PLAN','FLOOR_ANCHOR_PLAN','Equipment / Structural'],
 ['TITAN BOOTH PERMIT 1 PLAN AND ELEVATION VIEWS','PERMIT_PLAN_ELEVATION','Equipment / Permit'],
];
for(const [title,type,discipline] of cases){
 const result=detectNonSldPlanPage([title,'GRID A','1/8" = 1\''],120);
 assert.equal(result.isPlan,true,title);
 assert.equal(result.planType,type,title);
 assert.equal(result.discipline,discipline,title);
}

const generic=detectNonSldPlanPage(['PLAN VIEW','GRID A','DIMENSIONS'],120);
assert.equal(generic.isPlan,true);
assert.equal(generic.planType,'PLAN_VIEW_UNCLASSIFIED');

const notes=detectNonSldPlanPage(['GENERAL NOTES','SEE PLAN FOR LOCATIONS','DETAIL 3/S5.04'],220);
assert.equal(notes.isPlan,false,'notes/detail sheets must not become plan frames merely because they say plan');
const revisionOnly=detectNonSldPlanPage(['REV-H UPDATED ANCHOR PLAN AND XCELERATORS','REV-I REVISED ADDRESS'],180);
assert.equal(revisionOnly.isPlan,false,'revision references to an anchor plan must not turn unrelated sheets into floor-anchor plan frames');

const compiler=fs.readFileSync('components/CompilerWorkspace.tsx','utf8');
const viewer=fs.readFileSync('components/CompiledGraphViewer.tsx','utf8');

assert.match(compiler,/resolveDrawingPageRecognition/);
const powerPlanResolution=resolveDrawingPageRecognition(['ELECTRICAL POWER PLAN','TRANSFORMER T1','MAIN SWITCHBOARD MSB'],180);
assert.equal(powerPlanResolution.plan.planType,'ELECTRICAL_POWER_PLAN');
assert.equal(powerPlanResolution.sld.isSld,false,'explicit power-plan title must override equipment-density SLD heuristic');
const trueSld=resolveDrawingPageRecognition(['SINGLE LINE DIAGRAM','UTILITY SERVICE','TRANSFORMER T1','MAIN SWITCHBOARD MSB'],180);
assert.equal(trueSld.sld.isSld,true,'explicit single-line title must remain SLD');
assert.equal(trueSld.plan.isPlan,false,'SLD page must not also enter the non-SLD plan path');
assert.match(compiler,/nonSldPlan:true/);
assert.match(compiler,/planRecognition:'CONTENT_PLAN_V1'/);
assert.match(compiler,/PDF_RASTER_UNDERLAY/,'image-only PDF plan pages must retain a review-only raster underlay');
assert.match(compiler,/pageCount>=4000\|\|sourcePlanSegments>=40000/,'large drawing sets must be bounded per page and globally');
assert.match(compiler,/pageEvidence\.get\(segment\.page\)\?\.isSld\|\|!planEvidence\.get\(segment\.page\)\?\.isPlan/,'vector retention must be restricted to recognized non-SLD plan pages');
assert.match(compiler,/parsed\.disciplines\.length>1\?'Multi-discipline'/,'multi-discipline sets must not be mislabeled as electrical only');
assert.match(compiler,/OCR_CONTENT_PLAN_V1/,'standalone JPG\/PNG plans must also receive non-SLD plan recognition');

assert.match(viewer,/Sheet page isolation/,'Spatial viewer must provide sheet/page isolation');
assert.match(viewer,/Auto-safe sheet isolation/,'multi-sheet drawing sets must default to safe isolation');
assert.match(viewer,/frame&&frame!==activeSheetFrame/,'unrelated sheet frames must not stack by default');
assert.match(viewer,/Review overlay is showing multiple source sheets together/,'explicit all-frame overlay must disclose the alignment truth boundary');
assert.match(viewer,/NON-SLD PLANS/,'HUD must surface recognized plan count');
assert.match(viewer,/meta\?\.planDiscipline/,'discipline isolation must support per-page plan disciplines in multi-discipline PDFs');

console.log('Non-SLD plan recognition passed: electrical power, utility, structural, fire, hazardous-area, MEP, architectural and equipment plan families are classified without treating notes/detail sheets as plans; multi-page Spatial views isolate source frames by default.');
