import assert from 'node:assert/strict';
import fs from 'node:fs';
import {collectImagePlacements,iou,mergeTileLines,ocrRegionEntities,ocrTileCacheKey,planFullPageOcr,planImageOcrRegions,planRasterOcr,readOcrRegions,sortReadingOrder,tileLinesToPage,viewportToSheet,OCR_REGION_LIMITS} from '../lib/ocr-regions.ts';
import {asTesseractResult,linesFromTesseractData,TESSERACT_INIT_CONFIG,TESSERACT_PARAMETERS,TESSERACT_READER_VERSION} from '../lib/ocr-reader.ts';
import {buildPowerIntelligence} from '../lib/power-intelligence.ts';

// Phase 20a contract (docs/SPATIAL_SOURCE_FIDELITY_PLAN.md): read only what has no text layer, at a resolution
// a reader can use, upright as printed, with every failure counted. Synthetic data only; the real-drawing
// check is scripts/qa-ocr-brynhurst.mjs.
const ok=(label,condition)=>{assert.ok(condition,label);console.log(`✓ ${label}`)};
const near=(a,b,tolerance=1e-6)=>Math.abs(a-b)<=tolerance;

// 1. Image placements follow the operator list's transforms, including save/restore and form XObjects.
const OPS={save:10,restore:11,transform:12,paintFormXObjectBegin:74,paintFormXObjectEnd:75,paintImageMaskXObject:83,paintImageXObject:85,paintInlineImageXObject:86};
const toViewport=(x,y)=>[x,612-y];
const placements=collectImagePlacements({page:2,ops:OPS,toViewport,
  fnArray:[OPS.save,OPS.transform,OPS.paintImageXObject,OPS.restore,OPS.paintFormXObjectBegin,OPS.save,OPS.transform,OPS.paintImageMaskXObject,OPS.restore,OPS.paintFormXObjectEnd,OPS.transform,OPS.paintInlineImageXObject],
  argsArray:[[],[0,300,-200,0,400,100],['img_1',2400,1600],[],[[1,0,0,1,50,50],[0,0,100,100]],[],[100,0,0,100,0,0],[{width:500,height:500}],[],[],[10,0,0,10,0,0],[{width:40,height:40}]]});
ok('three image paints are found',placements.length===3);
ok('an image stored rotated 90° lands where it is printed',near(placements[0].box.x0,200)&&near(placements[0].box.x1,400)&&near(placements[0].box.y0,212)&&near(placements[0].box.y1,512));
ok('its rotation is recorded (270°, as on E-2)',placements[0].rotation===270&&placements[0].pixelWidth===2400&&placements[0].pixelHeight===1600);
ok('a form XObject matrix applies, and restore undoes a transform',near(placements[1].box.x0,50)&&near(placements[1].box.x1,150)&&placements[1].kind==='IMAGE_MASK');
ok('a transform after restore starts from the page matrix again',near(placements[2].box.x1,10)&&placements[2].kind==='INLINE_IMAGE');

// 2. Region planning: resolution, size filters, duplicates, skipped pages and budgets.
const pageSizes=new Map([[2,{width:3024,height:2160}],[3,{width:3024,height:2160}],[7,{width:3024,height:2160}]]);
const schedule={page:2,kind:'IMAGE',pixelWidth:2253,pixelHeight:2479,box:{x0:2309,y0:96,x1:2755,y1:501},rotation:270};
const scan={page:7,kind:'IMAGE',pixelWidth:4630,pixelHeight:3598,box:{x0:333,y0:1080,x1:980,y1:1913},rotation:270};
const logo={page:2,kind:'IMAGE',pixelWidth:200,pixelHeight:200,box:{x0:10,y0:10,x1:60,y1:60},rotation:0};
const lowRes={page:2,kind:'IMAGE',pixelWidth:600,pixelHeight:400,box:{x0:100,y0:600,x1:532,y1:888},rotation:0};
const plan=planImageOcrRegions([schedule,{...schedule,box:{...schedule.box,x1:schedule.box.x1+1}},scan,logo,lowRes,{...schedule,page:3}],pageSizes,{skipPages:new Set([3])});
const byPage=page=>plan.regions.filter(region=>region.page===page);
ok('logos and stamps are not read',!plan.regions.some(region=>region.box.x1<=60));
ok('the same picture painted twice is read once',byPage(2).filter(region=>iou(region.box,schedule.box)>.8).length===1);
ok('pages read whole by the scanned-page path are skipped',byPage(3).length===0);
const scheduleRegion=plan.regions.find(region=>iou(region.box,schedule.box)>.8);
ok('a 400 ppi schedule is read at its own 400 dpi in one tile',scheduleRegion.dpi===400&&scheduleRegion.tiles.length===1&&near(scheduleRegion.nativePpi,400,2));
const scanRegion=byPage(7)[0];
ok('a large scan drops toward 300 dpi to stay one tile',scanRegion.tiles.length===1&&scanRegion.dpi>=300&&scanRegion.dpi<400&&scanRegion.pixels<=OCR_REGION_LIMITS.maxTilePixels);
ok('a low-resolution image is read at the 150 dpi floor',plan.regions.some(region=>iou(region.box,lowRes.box)>.8&&region.dpi===150));
ok('regions keep the placement rotation',scheduleRegion.rotation===270);
const tight=planImageOcrRegions([schedule,scan],pageSizes,{limits:{maxFilePixels:6_000_000}});
ok('regions past the file pixel budget are skipped and reported',tight.regions.length===1&&tight.skipped.length===1&&tight.skipped[0].reason==='FILE_PIXEL_BUDGET');

// 3. Whole scanned pages are tiled at 300 dpi and the tiles cover the page exactly.
const full=planFullPageOcr([{page:5,size:{width:3024,height:2160}}]).regions[0];
const tileArea=full.tiles.map(tile=>((tile.x1-tile.x0)*full.scale)*((tile.y1-tile.y0)*full.scale));
ok('a 42" × 30" scanned sheet is read at 300 dpi in tiles',full.dpi===300&&full.tiles.length>1);
ok('every tile fits the canvas and pixel limits',full.tiles.every((tile,index)=>(tile.x1-tile.x0)*full.scale<=OCR_REGION_LIMITS.maxTileSide+1&&tileArea[index]<=OCR_REGION_LIMITS.maxTilePixels*1.001));
ok('tiles stay on the page and reach every edge',full.tiles.every(tile=>tile.x0>=-1e-6&&tile.y0>=-1e-6&&tile.x1<=3024+1e-6&&tile.y1<=2160+1e-6)&&full.tiles.some(tile=>near(tile.x1,3024,1e-3))&&full.tiles.some(tile=>near(tile.y1,2160,1e-3)));
const raster=planRasterOcr({width:6000,height:4000});
ok('an uploaded image is read at its own pixels, tiled when large',raster.scale===1&&raster.tiles.length>1&&raster.tiles.every(tile=>(tile.x1-tile.x0)<=OCR_REGION_LIMITS.maxTileSide+1e-6));

// 4. Tile readings map back to the page; text in an overlap band is kept once.
const region={...full,tiles:[{x0:0,y0:0,x1:1000,y1:500},{x0:600,y0:0,x1:1600,y1:500}],box:{x0:0,y0:0,x1:1600,y1:500},scale:2};
const seam={text:'PANEL HP1',confidence:91,box:{x0:740,y0:100,x1:860,y1:120}};
const merged=mergeTileLines(region,[
  {tile:region.tiles[0],lines:[{text:'LEFT',confidence:90,box:{x0:10,y0:10,x1:60,y1:30}},seam]},
  {tile:region.tiles[1],lines:[{...seam},{text:'RIGHT',confidence:90,box:{x0:1500,y0:10,x1:1590,y1:30}}]},
]);
ok('a line inside a tile overlap is read once',merged.filter(line=>line.text==='PANEL HP1').length===1&&merged.length===3);
const mapped=tileLinesToPage([{text:'X1',confidence:80,box:{x0:100,y0:40,x1:200,y1:60}}],{x0:600,y0:0,x1:1600,y1:500},2);
ok('tile pixels map back to page points',near(mapped[0].box.x0,650)&&near(mapped[0].box.y1,30));
const ordered=sortReadingOrder([{text:'B',confidence:1,box:{x0:50,y0:0,x1:60,y1:10}},{text:'C',confidence:1,box:{x0:0,y0:30,x1:10,y1:40}},{text:'A',confidence:1,box:{x0:0,y0:1,x1:10,y1:11}}]);
ok('lines come back in reading order',ordered.map(line=>line.text).join('')==='ABC');
const centre=viewportToSheet(1512,1080,{width:3024,height:2160}),corner=viewportToSheet(0,0,{width:3024,height:2160});
ok('page points map onto the parser sheet plane (long edge 20, y up)',near(centre.x,0)&&near(centre.y,0)&&near(corner.x,-10)&&near(corner.y,20*1080/3024));

// 5. Reader output: noise is dropped, and the legacy tesseract.js result shape is rebuilt for old callers.
const lines=linesFromTesseractData({blocks:[{paragraphs:[{lines:[
  {text:'PANEL  HP1',confidence:93,bbox:{x0:1,y0:2,x1:50,y1:12}},
  {text:'|',confidence:95,bbox:{x0:1,y0:2,x1:3,y1:12}},
  {text:'M',confidence:40,bbox:{x0:1,y0:2,x1:9,y1:12}},
  {text:'T',confidence:88,bbox:{x0:1,y0:2,x1:9,y1:12}},
  {text:'BAD BOX',confidence:90,bbox:{x0:5,y0:2,x1:5,y1:12}},
]}]}]});
ok('line-art specks, weak single letters and empty boxes are dropped',lines.map(line=>line.text).join(',')==='PANEL HP1,T');
const legacy=asTesseractResult(lines,2);
ok('the legacy result shape carries text, mean confidence and scaled boxes',legacy.data.text==='PANEL HP1\nT'&&near(legacy.data.confidence,90.5)&&legacy.data.blocks[0].paragraphs[0].lines[0].bbox.x1===100);
ok('Tesseract is tuned for drawings: sparse text, no dictionary',TESSERACT_PARAMETERS.tessedit_pageseg_mode==='11'&&TESSERACT_INIT_CONFIG.load_system_dawg==='0'&&TESSERACT_INIT_CONFIG.load_freq_dawg==='0');

// 6. The orchestrator: cache hits skip reading, a failed tile is counted and reported, cancel stops at once.
const store=new Map();const cache={get:async key=>store.get(key)||null,put:async(key,value)=>{store.set(key,value)}};
let reads=0,renders=0,releases=0;const errors=[];
const reader={id:'fake',version:'fake-1',async read(pixels){reads++;if(pixels==='bad')throw new Error('engine crashed');return[{text:`T${reads}`,confidence:80,box:{x0:1,y0:1,x1:20,y1:10}}]},async dispose(){}};
const regions=[scheduleRegion,{...scheduleRegion,id:'p2-image-bad',box:{x0:0,y0:0,x1:100,y1:100},tiles:[{x0:0,y0:0,x1:100,y1:100}]}];
const render=async({tile})=>{renders++;return{pixels:tile.x1===100?'bad':'ok',release(){releases++}}};
const first=await readOcrRegions({regions,reader,render,sourceSha256:'a'.repeat(64),cache,onTileError:(failedRegion)=>errors.push(failedRegion.id)});
ok('each tile is rendered, read and released',renders===2&&releases===2&&reads===2);
ok('a failed tile is counted and reported, not dropped silently',first[1].failedTiles===1&&first[1].lines.length===0&&errors[0]==='p2-image-bad'&&/engine crashed/.test(first[1].error));
const second=await readOcrRegions({regions:[scheduleRegion],reader,render,sourceSha256:'a'.repeat(64),cache});
ok('a re-parse of the same source reads from the cache',second[0].cachedTiles===1&&reads===2&&second[0].lines[0].text==='T1');
ok('cache keys change with the reader version',ocrTileCacheKey('a',scheduleRegion,scheduleRegion.tiles[0],'v1')!==ocrTileCacheKey('a',scheduleRegion,scheduleRegion.tiles[0],'v2'));
const controller=new AbortController();controller.abort();
await assert.rejects(readOcrRegions({regions,reader,render,sourceSha256:'b',signal:controller.signal}),error=>error.name==='AbortError');
ok('cancellation stops OCR at once',true);

// 7. Readings become non-spatial, review-only records on the sheet plane: never drawn, never equipment.
const entities=ocrRegionEntities({fileName:'set.pdf',readings:first,pageSizes,readerId:'fake',readerVersion:'fake-1'});
ok('one region record per region and one line record per line',entities.filter(entity=>entity.kind==='ocr-region').length===2&&entities.filter(entity=>entity.kind==='ocr-text-line').length===1);
ok('OCR records are non-spatial, review-only and not physical truth',entities.every(entity=>entity.layer==='L0'&&entity.meta.nonSpatial===true&&entity.meta.ocrAuthority==='REVIEW_ONLY'&&entity.meta.physicalTruth===false&&entity.meta.reviewRequired===true));
ok('OCR records carry reader, version, dpi and sheet box',entities.every(entity=>entity.meta.ocrReaderVersion==='fake-1'&&Array.isArray(entity.meta.ocrBoxSheet)&&entity.meta.ocrBoxSheet.length===4)&&entities.find(entity=>entity.kind==='ocr-region').meta.ocrRenderDpi===400);
ok('a failed region keeps its error for review',entities.some(entity=>entity.kind==='ocr-region'&&entity.meta.ocrFailedTiles===1&&/engine crashed/.test(entity.meta.ocrError)));
ok('record ids are unique',new Set(entities.map(entity=>entity.id)).size===entities.length);
const scheduleRow=ocrRegionEntities({fileName:'set.pdf',pageSizes,readerId:'fake',readerVersion:'fake-1',readings:[{region:scheduleRegion,failedTiles:0,cachedTiles:0,ms:1,
  lines:[{text:'WATER HEATER 1',confidence:90,box:{x0:2400,y0:200,x1:2500,y1:210}},{text:'EXHAUST FAN ON ROOF',confidence:90,box:{x0:2400,y0:220,x1:2500,y1:230}}]}]});
ok('raw OCR lines are reference-only: Expected Power does not read schedule rows as missing loads',scheduleRow.every(entity=>entity.meta.referenceOnly===true)&&buildPowerIntelligence({version:'t',createdAt:'t',sources:[],entities:scheduleRow,links:[]}).requirements.length===0);

// 8. Wiring: one shared, self-hosted, tuned engine everywhere; the worker reports image placements.
const compiler=fs.readFileSync('components/CompilerWorkspace.tsx','utf8');
const worker=fs.readFileSync('workers/pdf-native-parser.worker-v2.ts','utf8');
const runtime=fs.readFileSync('lib/client/ocr-runtime.ts','utf8');
const assets=fs.readFileSync('scripts/prepare-pdf-assets.mjs','utf8');
ok('no OCR call site starts its own Tesseract engine',!/createWorker\(|import\('tesseract\.js'\)/.test(compiler));
ok('scanned pages, image files, the fallback and embedded images use the shared reader',(compiler.match(/sharedTesseractReader\(\)/g)||[]).length>=4);
ok('embedded images are read after the native pass, with the cache and cancel signal',/readPdfEmbeddedImageText\(file,digest,parsed,scannedPages,controller\.signal/.test(compiler)&&/cache:ocrTileCache\(\)/.test(compiler));
ok('the worker reports image placements and page sizes for every page',/collectImagePlacements\(\{page:p/.test(worker)&&/imagePlacements,pageSizes:/.test(worker));
ok('the engine loads from this app, not a CDN',/OCR_ASSET_BASE="\/ocr\/tesseract"/.test(runtime)&&!/https?:\/\//.test(runtime));
ok('a hung or failed read recycles the engine and is reported',/READ_TIMEOUT_MS/.test(runtime)&&/disposeEngine\(/.test(runtime)&&/OCR_ENGINE_FAILED/.test(runtime));
ok('the asset script copies the worker, engine builds and pinned language data',/worker\.min\.js/.test(assets)&&/tesseract-core-relaxedsimd-lstm\.wasm\.js/.test(assets)&&/@tesseract\.js-data\/eng\/4\.0\.0_best_int\/eng\.traineddata\.gz/.test(assets));
ok('the reader version names the engine, data and settings',/tesseract\.js-7\/eng-4\.0\.0_best_int\/psm11-nodict/.test(TESSERACT_READER_VERSION));

console.log('\nOCR region planning, tiling, reading and wiring contract passed.');
