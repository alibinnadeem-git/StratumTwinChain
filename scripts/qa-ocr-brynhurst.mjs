import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {collectImagePlacements,ocrRegionEntities,planImageOcrRegions,readOcrRegions} from '../lib/ocr-regions.ts';
import {createTesseractReader} from '../lib/ocr-reader.ts';
import {FOOTPRINT_PHRASE_MAX_CHARACTERS,assembleTextPhrases,compactTextPhrase,drawnRectangles,findDrawnFootprint} from '../lib/text-phrases.ts';
import {applyEquipmentRoster} from '../lib/equipment-roster.ts';
import {detectPlanFrames,resolveDrawingPageRecognition,resolvePlanFrameAtPoint} from '../lib/plan-recognition.ts';
import {inferPdfPageFloor} from '../lib/compiler-source.ts';
import {classifyElectricalLabel} from '../lib/sld-recognition.ts';
import {gateEquipmentCandidates} from '../lib/candidate-gating.ts';

// Phases 20a and 20 on the real drawing. OCR: the same placement, planning and reading code the browser runs,
// with the real Tesseract engine, scored against values typed from the E-2 schedule images. Roster: the
// equipment roster built from those readings and the one-line, then found on the plans, using a Node copy
// of the parser worker's text and closed-path extraction (extractSheet below). The PDF is customer data and
// gitignored; without it this check skips. Takes about 35 s.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pdfPath=path.join(root,'tests/fixtures/spatial/5749 Brynhurst - Electrical - Bid Set 2025.04.17.pdf');
if(!fs.existsSync(pdfPath)){console.log('SKIP qa:ocr-brynhurst: golden PDF not present (gitignored customer drawing).');process.exit(0)}
const ok=(label,condition)=>{assert.ok(condition,label);console.log(`✓ ${label}`)};

const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
const doc=await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(pdfPath)),verbosity:0,wasmUrl:path.join(root,'node_modules/pdfjs-dist/wasm/')}).promise;
const placements=[],pageSizes=new Map(),pages=new Map();
for(let p=1;p<=doc.numPages;p++){
 const page=await doc.getPage(p),viewport=page.getViewport({scale:1});pages.set(p,page);
 pageSizes.set(p,{width:viewport.width,height:viewport.height});
 const ops=await page.getOperatorList();
 placements.push(...collectImagePlacements({page:p,fnArray:ops.fnArray,argsArray:ops.argsArray,ops:pdfjs.OPS,toViewport:(x,y)=>viewport.convertToViewportPoint(x,y)}));
}
ok('17 embedded images found: 10 on E-2, 7 scans on E-7 to E-9',placements.length===17&&placements.filter(item=>item.page===2).length===10&&placements.filter(item=>item.page>=7).length===7);
ok('every one is stored rotated 270° and read upright as printed',placements.every(item=>item.rotation===270));
const plan=planImageOcrRegions(placements,pageSizes);
ok('all 17 are planned, none over budget',plan.regions.length===17&&plan.skipped.length===0);
ok('E-2 images are read at their own 400 dpi; scans stay one tile at 300 dpi or more',plan.regions.filter(region=>region.page===2).every(region=>region.dpi===400&&region.tiles.length===1)&&plan.regions.filter(region=>region.page>=7).every(region=>region.tiles.length===1&&region.dpi>=300));

const reader=await createTesseractReader({langPath:path.join(root,'node_modules/@tesseract.js-data/eng/4.0.0_best_int'),cacheMethod:'none'});
const render=async({page,tile,scale})=>{
 const pdfPage=pages.get(page),width=Math.ceil((tile.x1-tile.x0)*scale),height=Math.ceil((tile.y1-tile.y0)*scale);
 const {canvas,context}=doc.canvasFactory.create(width,height);
 context.fillStyle='#fff';context.fillRect(0,0,width,height);
 await pdfPage.render({canvasContext:context,canvas,viewport:pdfPage.getViewport({scale,offsetX:-tile.x0*scale,offsetY:-tile.y0*scale})}).promise;
 return{pixels:canvas.toBuffer('image/png'),release(){doc.canvasFactory.destroy({canvas,context})}};
};
const started=Date.now();
const readings=await readOcrRegions({regions:plan.regions.filter(region=>region.page===2),reader,render,sourceSha256:'golden'});
await reader.dispose();
console.log(`  read E-2's ${readings.length} images in ${((Date.now()-started)/1000).toFixed(1)} s`);
ok('no tile failed',readings.every(reading=>reading.failedTiles===0));

const norm=token=>token.toUpperCase().replace(/^[^A-Z0-9#]+|[^A-Z0-9%]+$/g,'').replace(/(\d),(\d)/g,'$1$2');
const tokens=text=>text.split(/\s+/).map(norm).filter(Boolean);
const found=(key,text)=>{const pool=new Map();for(const token of tokens(text))pool.set(token,(pool.get(token)||0)+1);let hits=0;for(const token of tokens(key))if(pool.get(token)){hits++;pool.set(token,pool.get(token)-1)}return hits};
const regionText=pattern=>readings.map(reading=>reading.lines.map(line=>line.text).join('\n')).find(text=>pattern.test(text))||'';
for(const panel of ['HL','HP1','HP2','HP3','HWH'])ok(`panel ${panel} schedule header is read`,new RegExp(`PANEL ${panel}\\b`).test(regionText(new RegExp(`PANEL ${panel}\\b`))));
ok('the MS2 dwelling-load table is read',/MS2 - 53 UNITS/.test(regionText(/MS2 - 53/)));

// Answer keys typed from the images (docs/SPATIAL_SOURCE_FIDELITY_PLAN.md, Phase 20a).
const hp1=regionText(/PANEL HP1\b/);
const HP1_WORDS='PANEL HP1 METER ROOM SURFACE MOUNTED PANEL 100 AMPERE PANEL MAIN LUG ONLY 208V CORRIDOR RECEPTACLES CORRIDOR RECEPTACLES CORRIDOR RECEPTACLES CORRIDOR RECEPTACLES CORRIDOR RECEPTACLES FIRE ALARM PANEL REC RM A/C 3 FANS 3 FANS ELEC & BIKE RM TELEPHONE TV ELEVATOR PIT MACHINE RM ELEVATOR CAB LIGHT REC RM FCU';
const HP1_VALUES='1,080 900 900 720 720 720 720 1,400 1,400 600 500 280 280 200 200 200 6,100 4,720 10820 52';
const hp1Words=found(HP1_WORDS,hp1),hp1Values=found(HP1_VALUES,hp1);
ok(`HP1 schedule words: ${hp1Words}/49 (at least 47)`,hp1Words>=47);
ok(`HP1 schedule values: ${hp1Values}/20 (all)`,hp1Values===20);
const ms1=regionText(/L\.C\.L/);
const MS1_VALUES='10,600 10,600 10,600 2076 1410 872 6100 4720 15,300 13,400 12,360 10,660 9360 6,300 9,300 3,500 42860 41476 41950 872';
const ms1Values=found(MS1_VALUES,ms1);
ok(`Service MS1 table values inside the image: ${ms1Values}/20 (all)`,ms1Values===20);
// The MS1 totals (127,158 VA, 352 A, 374 A) are stroked vector text beside the image, not part of it: that
// is the stroked-text step of Phase 20a, not this one.


// ---- Phase 20: equipment roster and plan recognition ----
// Node copy of the worker's per-page extraction (workers/pdf-native-parser.worker-v2.ts): text runs with the
// direction as printed and font size, and closed paths with their fill flag.
async function extractSheet(page){
 const pdfPage=pages.get(page),viewport=pdfPage.getViewport({scale:1}),unit=20/Math.max(viewport.width,viewport.height,1);
 const toSheet=(x,y)=>{const point=viewport.convertToViewportPoint(x,y);return{x:(point[0]-viewport.width/2)*unit,y:(viewport.height/2-point[1])*unit}};
 const items=[];
 for(const item of (await pdfPage.getTextContent()).items){
  if(!item?.str?.trim())continue;
  const t=item.transform,magnitude=Math.hypot(t[0],t[1])||1,start=toSheet(t[4],t[5]),ahead=toSheet(t[4]+t[0]/magnitude,t[5]+t[1]/magnitude),length=Math.hypot(ahead.x-start.x,ahead.y-start.y)||1;
  items.push({text:item.str.trim(),x:start.x,y:start.y,dirX:(ahead.x-start.x)/length,dirY:(ahead.y-start.y)/length,span:Math.abs(item.width)*unit,size:Math.hypot(t[2],t[3])*unit});
 }
 const ops=await pdfPage.getOperatorList(),O=pdfjs.OPS,fills=new Set([O.fill,O.eoFill,O.fillStroke,O.eoFillStroke,O.closeFillStroke,O.closeEOFillStroke]);
 const polygons=[],stack=[],active=[];let matrix=[1,0,0,1,0,0],filled=false;
 const multiply=b=>{const a=matrix;matrix=[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]]};
 const add=(x,y)=>active.push(toSheet(matrix[0]*x+matrix[2]*y+matrix[4],matrix[1]*x+matrix[3]*y+matrix[5]));
 // Footprint shapes as the worker keeps them: closed, at most 8 points, no side over 1.2 sheet units.
 const finish=()=>{if(active.length>=3&&active.length<=8&&Math.hypot(active[0].x-active.at(-1).x,active[0].y-active.at(-1).y)<.08){const xs=active.map(point=>point.x),ys=active.map(point=>point.y);if(Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys))<=1.2)polygons.push({vertices:[...active],filled})}active.length=0};
 for(let k=0;k<ops.fnArray.length;k++){
  const fn=ops.fnArray[k],a=ops.argsArray[k]||[];
  if(fn===O.save)stack.push([...matrix]);else if(fn===O.restore)matrix=stack.pop()||[1,0,0,1,0,0];else if(fn===O.transform)multiply(a.map(Number));
  else if(fn===O.paintFormXObjectBegin){stack.push([...matrix]);if(a[0])multiply(Array.from(a[0]))}else if(fn===O.paintFormXObjectEnd)matrix=stack.pop()||[1,0,0,1,0,0];
  else if(fn===O.constructPath){filled=fills.has(a[0]);for(const command of a[1]||[]){const c=Array.from(command);for(let j=0;j<c.length;){const code=c[j++];if(code===0){finish();add(c[j++],c[j++])}else if(code===1)add(c[j++],c[j++]);else if(code===2){const x1=c[j++],y1=c[j++],x2=c[j++],y2=c[j++],x=c[j++],y=c[j++];add((x1+x2+x)/3,(y1+y2+y)/3);add(x,y)}else if(code===3){const x1=c[j++],y1=c[j++],x=c[j++],y=c[j++];add((x1+x)/2,(y1+y)/2);add(x,y)}else if(code===4){if(active.length>=2)active.push(active[0]);finish()}else{active.length=0;break}}}finish();filled=false}
 }
 return{items,polygons,opCount:ops.fnArray.length};
}
const entities=ocrRegionEntities({fileName:'set.pdf',readings,pageSizes,readerId:'tesseract',readerVersion:'qa'}).map(entity=>({...entity,source:'set.pdf'}));
for(const page of [2,3,4,5,6,7,8,9]){
 const {items,polygons,opCount}=await extractSheet(page);
 const labels=items.map(item=>item.text),recognition=resolveDrawingPageRecognition(labels,opCount),pageFloor=inferPdfPageFloor(labels)||'UNRESOLVED';
 const frames=detectPlanFrames(items.map(item=>({text:item.text,x:item.x,y:item.y})),recognition.plan),rects=drawnRectangles(polygons);
 const textPhrases=assembleTextPhrases(items).map(phrase=>{const cx=(phrase.box.x0+phrase.box.x1)/2,cy=(phrase.box.y0+phrase.box.y1)/2,frame=resolvePlanFrameAtPoint(frames,cx,cy),floor=frame?.floor||pageFloor;
  return compactTextPhrase(phrase,phrase.text.length<=FOOTPRINT_PHRASE_MAX_CHARACTERS?findDrawnFootprint(phrase,rects):null,{floor:floor==='UNRESOLVED'?null:floor,id:frame?.id||null})});
 entities.push({id:`pdf-text-layer-${page}`,source:'set.pdf',layer:'L0',kind:'pdf-text-layer',name:'layer',x:0,y:0,floor:pageFloor,meta:{page,isPlan:recognition.plan.isPlan,isSld:recognition.sld.isSld,planType:recognition.plan.planType,planDiscipline:recognition.plan.discipline,textPhrases}});
 // The parser's own classifier candidates (MS1, MS2, bare PANEL), as the worker emits them.
 for(const item of items)if(classifyElectricalLabel(item.text))entities.push({id:`pdf-${page}-${entities.length}`,source:'set.pdf',layer:'L2',kind:'text-asset-candidate',name:item.text,x:item.x,y:item.y,meta:{page}});
}
const {entities:rostered,roster,stats}=applyEquipmentRoster({fileName:'set.pdf',entities});
const entry=Object.fromEntries(roster.map(item=>[item.tag,item]));
console.log(`  roster: ${roster.map(item=>item.tag).join(', ')} · ${stats.checksPassed}/${stats.checksPassed+stats.checksFailed} checks`);
ok('the roster holds the five scheduled panels and both switchboards',['HL','HP1','HP2','HP3','HWH'].every(tag=>entry[tag]?.kind==='PANELBOARD')&&['MS1','MS2'].every(tag=>entry[tag]?.kind==='SWITCHBOARD'));
ok(`every roster self-check passes (${stats.checksPassed}, at least 20)`,stats.checksFailed===0&&stats.checksPassed>=20);
ok('HP1: 100 A surface panel in the meter room, 120/208 V 1ø, 10,820 VA = 52 A, fed from MS1',entry.HP1.ratingAmps===100&&entry.HP1.mounting==='SURFACE'&&entry.HP1.location==='METER ROOM'&&entry.HP1.phases===1&&entry.HP1.totalVa===10820&&entry.HP1.totalAmps===52&&entry.HP1.fedFrom==='MS1');
ok('HP2 and HWH are three-phase; HL, HP1 and HP3 single-phase',entry.HP2.phases===3&&entry.HWH.phases===3&&[entry.HL,entry.HP1,entry.HP3].every(item=>item.phases===1));
ok('MS1 feeds the elevator motor and all five panels; MS2 serves 53 units at 640 A',['ELEV. MOTOR','HL','HP1','HP2','HP3','HWH'].every(tag=>entry.MS1.feeds.includes(tag))&&entry.MS2.servedUnits===53&&entry.MS2.demandAmps===640);
ok('the one-line gives MS1 its 400 A bus and MS2 its 800 A bus',entry.MS1.busAmps===400&&entry.MS2.busAmps===800);

const gated=gateEquipmentCandidates(rostered);
const symbols=gated.filter(entity=>entity.meta?.rosterBacked===true&&entity.meta?.drawnFootprint).map(entity=>`${entity.name}@${entity.meta.page}`).sort();
console.log(`  roster symbols on plans: ${symbols.join(', ')}`);
ok('roster names found on their drawn symbols: HL, HP1, HP3, MS1, MS2 on E-4; HP2 on E-5',JSON.stringify(symbols)===JSON.stringify(['HL@4','HP1@4','HP2@5','HP3@4','MS1@4','MS2@4']));
ok('every one of them is an instance',gated.filter(entity=>entity.meta?.rosterBacked===true&&entity.meta?.drawnFootprint).every(entity=>entity.meta.candidateRole==='INSTANCE'));
ok('HP3 and HP2 sit on the floors their schedules name (1st and 2nd floor laundries)',gated.filter(entity=>['HP2','HP3'].includes(entity.name)&&entity.meta?.drawnFootprint).every(entity=>entity.meta.rosterLocationFloorAgrees===true));
ok('the roof box labelled HP1 (a heat pump) is not taken for the panel',!symbols.includes('HP1@6'));
const loadCentres=gated.filter(entity=>entity.meta?.footprintClassPhrase===true);
ok(`unit load centres: ${loadCentres.filter(entity=>entity.meta.page===4).length} on E-4, ${loadCentres.filter(entity=>entity.meta.page===5).length} on E-5, all instances on filled bars`,loadCentres.filter(entity=>entity.meta.page===4).length===11&&loadCentres.filter(entity=>entity.meta.page===5).length===14&&loadCentres.every(entity=>entity.meta.candidateRole==='INSTANCE'&&entity.meta.drawnFootprint.filled));
ok('the enlarged typical-unit plans on E-7 to E-9 add no load centres (their panels are on the floor plans)',loadCentres.length===25&&!loadCentres.some(entity=>entity.meta.page>=7));
const ms1Lineup=gated.find(entity=>entity.name==='MS1'&&entity.meta?.page===4&&entity.meta?.drawnFootprint);
ok('MS1 on E-4 is the lineup DIST | MS1 | P/S; DIST and P/S stay labels of it',JSON.stringify(ms1Lineup.meta.lineupSections)===JSON.stringify(['DIST','MS1','P/S'])&&gated.filter(entity=>entity.meta?.lineupSectionOf==='MS1').every(entity=>entity.meta.candidateRole==='LABEL'));
// Cross-sheet: at E-4's printed 1/8" scale (5.121 m per sheet unit) the lineup boxes match the section widths
// on E-2's service elevation (36" | 30" | 36") and a 20" switchboard depth.
const widthsInches=['DIST','MS1','P/S'].map(name=>{const box=name==='MS1'?ms1Lineup.meta.drawnFootprint:gated.find(entity=>entity.name===name&&entity.meta?.lineupSectionOf==='MS1').meta.drawnFootprint;return(box.x1-box.x0)*5.121/.0254});
const depthInches=(ms1Lineup.meta.drawnFootprint.y1-ms1Lineup.meta.drawnFootprint.y0)*5.121/.0254;
console.log(`  lineup widths at 1/8" scale: ${widthsInches.map(value=>value.toFixed(1)).join('" | ')}" · depth ${depthInches.toFixed(1)}"`);
ok('the drawn lineup measures 36" | 30" | 36" by 20" deep, as on E-2',[36,30,36].every((expected,index)=>Math.abs(widthsInches[index]-expected)<1)&&Math.abs(depthInches-20)<1);

console.log('\nEmbedded-image OCR and the equipment roster on the golden drawing passed.');
process.exit(0);
