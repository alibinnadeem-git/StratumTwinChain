import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assembleTextPhrases,compactTextPhrase,drawnRectangles,findDrawnFootprint,rectangleFromPolygon,sharesSide} from '../lib/text-phrases.ts';
import {applyEquipmentRoster,buildEquipmentRoster,normalizeTag,parsePanelSchedule,recognizeRosterOnPlans} from '../lib/equipment-roster.ts';
import {gateEquipmentCandidates} from '../lib/candidate-gating.ts';

// Phase 20 contract (docs/SPATIAL_SOURCE_FIDELITY_PLAN.md): phrases and drawn footprints from the text layer,
// the project equipment roster read from schedules and one-line and checked against their own totals, and
// roster names found on the plans where they label a drawn symbol. Synthetic data only; the real drawing is
// checked by scripts/qa-ocr-brynhurst.mjs.
const ok=(label,condition)=>{assert.ok(condition,label);console.log(`✓ ${label}`)};
const near=(a,b,tolerance=1e-6)=>Math.abs(a-b)<=tolerance;
const run=(text,x,y,{size=.03,span=text.length*.02,dirX=1,dirY=0}={})=>({text,x,y,dirX,dirY,span,size});

// 1. Phrases: runs on a baseline join; a short centred line stacked on another joins; notes stay apart.
const phrases=assembleTextPhrases([
  run('ELEC.',0,1.03,{span:.08}),run('PANEL',-.01,1,{span:.1}),
  run('F.O.',2,0,{span:.08}),run('BOX',2.095,0,{span:.06}),
  run('THIS NOTE IS FAR TOO LONG TO STACK',4,1.03),run('ANOTHER LONG NOTE LINE HERE',4,1),
  run('HP1',6,0,{dirX:0,dirY:1,span:.06}),run('-4',6,.065,{dirX:0,dirY:1,span:.04}),
]);
const texts=phrases.map(phrase=>phrase.text);
ok('"ELEC." over "PANEL" reads as one two-line label',texts.includes('ELEC. PANEL')&&phrases.find(phrase=>phrase.text==='ELEC. PANEL').lines===2);
ok('runs on one baseline join',texts.includes('F.O. BOX'));
ok('long note lines are not stacked into one label',texts.includes('THIS NOTE IS FAR TOO LONG TO STACK')&&texts.includes('ANOTHER LONG NOTE LINE HERE'));
ok('vertical text joins along its own direction',texts.includes('HP1 -4'));
const vertical=phrases.find(phrase=>phrase.text==='HP1 -4');
ok('a vertical phrase box is tall, not wide',(vertical.box.y1-vertical.box.y0)>(vertical.box.x1-vertical.box.x0));

// 2. Drawn rectangles, including a solid fill exported as two triangles (HP1 and HL on the golden fixture).
ok('a closed rectangular path is a rectangle',rectangleFromPolygon([{x:0,y:0},{x:1,y:0},{x:1,y:.2},{x:0,y:.2},{x:0,y:0}])!==null);
ok('a triangle or a skewed quad is not',rectangleFromPolygon([{x:0,y:0},{x:1,y:0},{x:.5,y:1}])===null&&rectangleFromPolygon([{x:0,y:0},{x:1,y:.1},{x:1,y:.3},{x:0,y:.2}])===null);
const rects=drawnRectangles([
  {vertices:[{x:2.8286,y:-.8687},{x:2.746,y:-.8687},{x:2.8286,y:-.8841},{x:2.8286,y:-.8687}],filled:true},
  {vertices:[{x:2.746,y:-.8687},{x:2.8286,y:-.8841},{x:2.746,y:-.8841},{x:2.746,y:-.8687}],filled:true},
  {vertices:[{x:0,y:0},{x:.1,y:0},{x:.1,y:.1},{x:0,y:.1}],filled:false},
  {vertices:[{x:5,y:5},{x:6,y:5},{x:5.5,y:6}],filled:true},
]);
ok('two filled triangles sharing a diagonal become one filled rectangle',rects.some(rect=>rect.filled&&near(rect.x0,2.746)&&near(rect.x1,2.8286)&&near(rect.y0,-.8841)));
ok('a lone triangle is not a rectangle',rects.length===2);

// 3. Footprints: a box around the label wins; else the nearest bar beside it, filled first; rooms never.
const label=(text,x0,y0,x1,y1,size=.03)=>({text,box:{x0,y0,x1,y1},size,dirX:1,dirY:0,lines:1,anchorX:x0,anchorY:y0+.006});
const hp1=label('HP1',2.753,-.918,2.812,-.889);
const bar={x0:2.746,y0:-.8841,x1:2.8286,y1:-.8687,filled:true},outline={...bar,filled:false};
const room={x0:0,y0:-5,x1:8,y1:5,filled:false};
const hp1Footprint=findDrawnFootprint(hp1,[room,outline,bar]);
ok('a label under a filled bar names the bar',hp1Footprint?.relation==='BESIDE_LABEL'&&hp1Footprint.filled===true);
const ms1=label('MS1',2.352,-1.303,2.428,-1.268,.034);
const ms1Box={x0:2.3146,y0:-1.336,x1:2.4636,y1:-1.238,filled:false};
ok('a label inside a box names the box',findDrawnFootprint(ms1,[room,ms1Box,bar])?.relation==='CONTAINS_LABEL');
ok('a room-sized rectangle is never a footprint',findDrawnFootprint(label('BEDROOM',1,1,1.2,1.03),[room])===null);
ok('boxes of a lineup share a side',sharesSide(ms1Box,{x0:2.4636,y0:-1.336,x1:2.6426,y1:-1.238},.005)&&!sharesSide(ms1Box,{x0:3,y0:-1.336,x1:3.2,y1:-1.238},.005));

// 4. The roster from schedule OCR: fields, garbled phase symbol, and the drawings' own checks.
const hp1Schedule={page:2,regionId:'p2-image-6',lines:['PANEL HP1','(METER ROOM)','SURFACE MOUNTED PANEL','100 AMPERE PANEL - MAIN : LUG ONLY','120 /208V, 1s, 3W','CKT','1','20','1,080','SPACE','6,100','4,720','TOTAL','= 10820 VA = 52 AMPS']};
const hp1Entry=parsePanelSchedule(hp1Schedule);
ok('header fields are read: tag, rating, mounting, location, mains',hp1Entry.tag==='HP1'&&hp1Entry.ratingAmps===100&&hp1Entry.mounting==='SURFACE'&&hp1Entry.location==='METER ROOM'&&hp1Entry.mains==='LUGS');
ok('a garbled phase symbol is resolved from the wire count',hp1Entry.voltage==='120/208V'&&hp1Entry.phases===1&&hp1Entry.wires===3);
ok('subtotals add up and VA gives the printed amps',hp1Entry.checks.find(check=>check.id==='SUBTOTALS_ADD_UP').passed&&hp1Entry.checks.find(check=>check.id==='VA_TO_AMPS').passed);
const hl=parsePanelSchedule({page:2,regionId:'r2',lines:['PANEL HL','(METER ROOM)','FLUSH MOUNTED PANEL','40 AMPERE PANEL - MAIN : LUG ONLY','120 /208V, 12, 3W','SPACE','2,076','1,410','3,486','LCL @25% =872','TOTAL = 4358 VA = 21 AMPS']});
ok('a largest-continuous-load allowance is part of the subtotal check',hl.checks.find(check=>check.id==='SUBTOTALS_ADD_UP').passed);
const hlBrowser=parsePanelSchedule({page:2,regionId:'r2b',lines:['PANEL HL','(METER ROOM)','FLUSH MOUNTED PANEL','40 AMPERE PANEL - MAIN : LUG ONLY','120 /208V, 12, 3W','SPACE','2,076','1,410','3,486 |LCL @25% =872','TOTAL = 4358 VA = 21 AMPS']});
ok('a table rule read into a line ("3,486 |LCL …", the browser read of HL) does not hide the subtotals',hlBrowser.checks.find(check=>check.id==='SUBTOTALS_ADD_UP').passed);
const hp2=parsePanelSchedule({page:2,regionId:'r3',lines:['PANEL HP2','(2ND FLOOR LAUNDRY)','SURFACE MOUNT','150 AMP PANEL','MAIN : LUGS','120 /208V, 3g, 4W','SUB-TOTALS =','15,300','13,400','12,360','TOTAL = 41060 VA = 114 AMPS']});
ok('three-phase amps divide by √3 × 208 V',hp2.phases===3&&hp2.checks.find(check=>check.id==='VA_TO_AMPS').passed);
const wrong=parsePanelSchedule({...hp1Schedule,lines:hp1Schedule.lines.map(line=>line==='4,720'?'4,270':line)});
ok('a misread subtotal fails its check, and the failure is kept for review',wrong.checks.find(check=>check.id==='SUBTOTALS_ADD_UP').passed===false);
const roster=buildEquipmentRoster({ocrRegions:[hp1Schedule,
  {page:2,regionId:'svc',lines:['Service MS1','LOAD','1) ELEV. MOTOR','10,600','10,600','10,600','3) PANEL HP1','6100','4720','SUB-TOTALS','42860']},
  {page:2,regionId:'ms2',lines:['MS2 - 53 UNITS','NEC 220.84','TOTAL','53','924,907 VA','25%','231,227 VA','@ 208V, 3 ¢','640 A']}],
  textLayers:[{page:2,source:'set.pdf',isPlan:false,isSld:true,planType:null,planDiscipline:null,floor:'UNRESOLVED',phrases:[
    {t:'MS2',b:[-8.19,-5.71,-8.04,-5.63],s:.034,d:[1,0],n:1},{t:'MS1',b:[4.45,-5.76,4.61,-5.68],s:.034,d:[1,0],n:1},
    {t:'800A BUS',b:[-3.83,-6.43,-3.43,-6.34],s:.034,d:[1,0],n:1},{t:'400A BUS',b:[5.55,-6.48,5.95,-6.4],s:.034,d:[1,0],n:1}]}]});
const byTag=Object.fromEntries(roster.map(entry=>[entry.tag,entry]));
ok('the service table makes MS1 feed HP1 and the elevator motor',byTag.HP1.fedFrom==='MS1'&&byTag.MS1.feeds.includes('HP1')&&byTag.MS1.feeds.includes('ELEV. MOTOR'));
ok('the service table load is checked against the panel schedule',byTag.HP1.checks.some(check=>check.id==='SERVICE_TABLE_MATCHES_SCHEDULE'&&check.passed));
ok('the dwelling load table gives MS2 its units and demand',byTag.MS2.servedUnits===53&&byTag.MS2.demandAmps===640);
ok('one-line bus ratings pair with the nearest switchboard both ways',byTag.MS1.busAmps===400&&byTag.MS2.busAmps===800);
ok('tags normalize spacing and hyphens',normalizeTag('hp-1')==='HP1'&&normalizeTag('PANEL HL')==='HL');

// 5. Recognition on plans.
const phrase=(t,box,footprint,extra={})=>({...compactTextPhrase({text:t,box,size:.03,dirX:1,dirY:0,lines:t.includes(' ')?2:1,anchorX:box.x0,anchorY:box.y0},footprint?{...footprint,relation:footprint.relation||'BESIDE_LABEL',gap:0}:null,{floor:extra.floor||'L1',id:extra.frame||'frame-l1'})});
const e4={page:4,source:'set.pdf',isPlan:true,isSld:false,planType:'ELECTRICAL_POWER_PLAN',planDiscipline:'Electrical',floor:'L1',phrases:[
  phrase('HP1',hp1.box,bar),
  phrase('HL',{x0:2.88,y0:-.919,x1:2.918,y1:-.89},{x0:2.8595,y0:-.8841,x1:2.9421,y1:-.8687,filled:true}),
  phrase('ELEC. PANEL',{x0:-1.612,y0:1.309,x1:-1.513,y1:1.372},{x0:-1.604,y0:1.285,x1:-1.522,y1:1.300,filled:true}),
  phrase('MS1',ms1.box,{...ms1Box,relation:'CONTAINS_LABEL'}),
  phrase('DIST',{x0:2.183,y0:-1.303,x1:2.261,y1:-1.268},{x0:2.1356,y0:-1.336,x1:2.3146,y1:-1.238,filled:false,relation:'CONTAINS_LABEL'}),
  phrase('P/S',{x0:2.524,y0:-1.304,x1:2.583,y1:-1.27},{x0:2.4636,y0:-1.336,x1:2.6426,y1:-1.238,filled:false,relation:'CONTAINS_LABEL'}),
  phrase('MAIN',{x0:5,y0:5,x1:5.1,y1:5.03},{x0:4.9,y0:4.9,x1:5.2,y1:5.1,filled:false,relation:'CONTAINS_LABEL'}),
]};
const roof={page:6,source:'set.pdf',isPlan:true,isSld:false,planType:'ELECTRICAL_POWER_PLAN',planDiscipline:'Electrical',floor:'UNRESOLVED',phrases:[
  phrase('HP1',{x0:-2.95,y0:5.3,x1:-2.9,y1:5.33},{x0:-3.02,y0:5.21,x1:-2.8,y1:5.36,filled:false},{floor:'ROOF',frame:'frame-roof'}),
  phrase('HP2',{x0:1,y0:1,x1:1.06,y1:1.03},{x0:.98,y0:1.04,x1:1.06,y1:1.055,filled:true},{floor:'ROOF',frame:'frame-roof'}),
]};
const e5={...roof,page:5,floor:'L2',phrases:[phrase('HP2',{x0:6.2,y0:-1.3,x1:6.26,y1:-1.27},{x0:6.22,y0:-1.27,x1:6.235,y1:-1.19,filled:true},{floor:'L2',frame:'frame-l2'})]};
const unitPlan={page:7,source:'set.pdf',isPlan:true,isSld:false,planType:'ELECTRICAL_POWER_PLAN',planDiscipline:'Electrical',floor:'UNRESOLVED',phrases:[
  {...phrase('ELEC. PANEL',{x0:1,y0:1,x1:1.1,y1:1.06},{x0:1.01,y0:.975,x1:1.093,y1:.99,filled:true}),fl:undefined,fr:'frame-unit-106'},
  {...phrase('HL',{x0:3,y0:3,x1:3.04,y1:3.03},{x0:2.98,y0:3.035,x1:3.06,y1:3.05,filled:true}),fl:undefined,fr:'frame-unit-106'}]};
const e2={page:2,source:'set.pdf',isPlan:false,isSld:true,planType:null,planDiscipline:null,floor:'UNRESOLVED',phrases:[{t:'MS1',b:[4.45,-5.76,4.61,-5.68],s:.034,d:[1,0],n:1}]};
const existing=[
  {id:'ms1-e4',name:'MS1',layer:'L2',kind:'text-asset-candidate',x:2.352,y:-1.296,source:'set.pdf',meta:{page:4}},
  {id:'ms1-e2',name:'MS1',layer:'L2',kind:'text-asset-candidate',x:4.454,y:-5.7,source:'set.pdf',meta:{page:2}},
  {id:'panel-word',name:'PANEL',layer:'L2',kind:'text-asset-candidate',x:-1.612,y:1.315,source:'set.pdf',meta:{page:4}},
];
const rosterForPlans=[...roster,hl,hp2,{...parsePanelSchedule({page:2,regionId:'r4',lines:['PANEL HP3','(1ST FLOOR LAUNDRY)','FLUSH MOUNTED PANEL','150 AMPERE PANEL','120 /208V, 12, 3W','10,660','9,360','TOTAL = 20020 VA = 96 AMPS']})}];
const {created,patches}=recognizeRosterOnPlans({roster:rosterForPlans,textLayers:[e2,e4,roof,e5,unitPlan],entities:existing});
const named=name=>created.filter(candidate=>candidate.name===name);
ok('HP1 and HL are placed on their bars, not on their labels',named('HP1').length===1&&near(named('HP1')[0].x,(2.746+2.8286)/2,1e-3)&&named('HL').length===1);
ok('a roster panel carries its schedule identity and library model',named('HP1')[0].meta.rosterRatingAmps===100&&named('HP1')[0].meta.rosterFedFrom==='MS1'&&named('HP1')[0].meta.libraryComponentKey==='panelboard');
ok('a roof box labelled HP1 (a heat pump, not a thin wall panel) is not taken for panel HP1',!named('HP1').some(candidate=>candidate.meta.page===6));
ok('a panel named on two plans is placed on the floor its schedule names',named('HP2').length===1&&named('HP2')[0].meta.page===5&&named('HP2')[0].meta.rosterLocationFloorAgrees===true);
ok('a unit load centre is placed from its class phrase and filled bar',named('ELEC. PANEL').length===1&&named('ELEC. PANEL')[0].meta.libraryComponentKey==='load-center'&&named('ELEC. PANEL')[0].meta.rosterFedFrom==='MS2');
ok('the parser\'s bare "PANEL" word points at the assembled load centre',patches.get('panel-word')?.assembledPhrase==='ELEC. PANEL');
ok('MS1 on the plan keeps its position and gains its box and lineup',patches.get('ms1-e4')?.drawnFootprint&&JSON.stringify(patches.get('ms1-e4').lineupSections)===JSON.stringify(['DIST','MS1','P/S']));
ok('DIST and P/S are sections of MS1; a boxed word elsewhere is not',named('DIST')[0]?.meta.lineupSectionOf==='MS1'&&named('P/S')[0]?.meta.lineupSectionOf==='MS1'&&named('MAIN').length===0);
ok('an enlarged typical-unit plan (no floor) places nothing: its panels are already on the floor plans',!created.some(candidate=>candidate.meta.page===7));
ok('on a one-line a roster name gains identity only, never a footprint',patches.get('ms1-e2')?.rosterBacked===true&&!patches.get('ms1-e2')?.drawnFootprint);

// 6. The gate: roster or class-phrase symbols are instances, even letter-only; sections fold into the lineup.
const gated=gateEquipmentCandidates([...created,
  {id:'hl-no-symbol',name:'HL',layer:'L2',kind:'text-asset-candidate',meta:{rosterBacked:true}},
  {id:'ms1-plan',name:'MS1',layer:'L2',kind:'text-asset-candidate',meta:{...patches.get('ms1-e4')}}]);
const role=(name,extra=()=>true)=>gated.find(entity=>entity.name===name&&extra(entity))?.meta?.candidateRole;
ok('HL with its drawn symbol is an instance despite having no digit',role('HL',entity=>entity.meta.drawnFootprint)==='INSTANCE');
ok('HL without a drawn symbol stays a label',role('HL',entity=>entity.id==='hl-no-symbol')==='LABEL');
ok('a unit load centre is an instance',role('ELEC. PANEL')==='INSTANCE');
ok('lineup sections stay labels; their switchboard is the instance',role('DIST')==='LABEL'&&role('P/S')==='LABEL'&&role('MS1')==='INSTANCE');

// 7. The import step: roster records, known roster from earlier files, stats.
const applied=applyEquipmentRoster({fileName:'plans.pdf',
  entities:[{id:'pdf-text-layer-4',name:'layer',layer:'L0',kind:'pdf-text-layer',x:0,y:0,floor:'L1',source:'plans.pdf',meta:{page:4,isPlan:true,isSld:false,planType:'ELECTRICAL_POWER_PLAN',textPhrases:[phrase('HP1',hp1.box,bar)]}}],
  knownEntities:[{id:'roster-HP1',name:'HP1 · panelboard',layer:'L0',kind:'equipment-roster-entry',x:0,y:0,meta:{rosterEntry:hp1Entry}}]});
ok('a roster read from another file finds its panel on this file\'s plan',applied.entities.some(entity=>entity.name==='HP1'&&entity.meta?.rosterBacked===true));
const ownRoster=applyEquipmentRoster({fileName:'set.pdf',entities:hp1Schedule.lines.map((line,index)=>({id:`l${index}`,name:line,layer:'L0',kind:'ocr-text-line',x:0,y:0,meta:{page:2,ocrRegionId:'p2-image-6'}}))});
const record=ownRoster.entities.find(entity=>entity.kind==='equipment-roster-entry');
ok('each roster entry is kept as a non-spatial, reference-only review record',record&&record.meta.nonSpatial===true&&record.meta.referenceOnly===true&&record.meta.physicalTruth===false&&record.meta.rosterEntry.tag==='HP1');
ok('stats count entries and checks',ownRoster.stats.entries===1&&ownRoster.stats.panels===1&&ownRoster.stats.checksFailed===0&&ownRoster.stats.checksPassed>=3);

// 8. Wiring.
const worker=fs.readFileSync('workers/pdf-native-parser.worker-v2.ts','utf8');
const compiler=fs.readFileSync('components/CompilerWorkspace.tsx','utf8');
ok('the worker records text direction as printed (page rotation included) and font size',/sheetDirX:aheadX\/aheadMag,sheetDirY:-aheadY\/aheadMag,size:/.test(worker));
ok('the worker records which closed paths are filled',/pathFilled=fillOps\.has\(a\[0\]\)/.test(worker)&&/filled:pathFilled/.test(worker));
ok('the worker keeps one text-layer record per drawing page, with footprints',/kind:'pdf-text-layer'/.test(worker)&&/findDrawnFootprint\(phrase,rects\)/.test(worker)&&/drawnRectangles\(footprintShapes\.filter/.test(worker)&&/FOOTPRINT_SHAPES_PER_PAGE/.test(worker));
ok('the import builds the roster after OCR and before candidates are duplicated and scoped',/applyEquipmentRoster\(\{fileName:file\.name,entities:parsed\.entities,knownEntities:nextEntities\}\)/.test(compiler)&&compiler.indexOf('applyEquipmentRoster({')<compiler.indexOf('withAssetCandidates(scopeSourceEntities(parsed.entities'));

console.log('\nText phrases, drawn footprints, equipment roster and plan recognition contract passed.');
