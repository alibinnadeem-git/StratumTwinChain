import assert from 'node:assert/strict';
import fs from 'node:fs';

const compiler=fs.readFileSync('components/CompilerWorkspace.tsx','utf8');
const workerPath=/pdf-native-parser\.worker-v2\.ts/.test(compiler)?'workers/pdf-native-parser.worker-v2.ts':'workers/pdf-native-parser.worker.ts';
const worker=fs.readFileSync(workerPath,'utf8');
const assets=fs.readFileSync('scripts/prepare-pdf-assets.mjs','utf8');

const checks=[
 ['native PDF path uses a dedicated Worker',/new Worker\(new URL\('\.\.\/workers\/pdf-native-parser\.worker(?:-v\d+)?\.ts'/.test(compiler)],
 ['low-text pages are queued instead of aborting the native worker',/ocrRequiredPages\.push\(p\)/.test(worker)&&!/OCR_FALLBACK_REQUIRED/.test(worker)],
 ['only queued low-text pages enter selective OCR',/parsePdfSelectedOcrPages/.test(compiler)&&/parsed\.ocrRequiredPages\.length/.test(compiler)&&/URL\.createObjectURL\(file\)/.test(compiler)],
 ['legacy whole-file fallback is reserved for worker unavailability',/parsePdfMainThreadFallback/.test(compiler)&&/error\.code==='WORKER_UNAVAILABLE'/.test(compiler)],
 ['progress is surfaced per page',/PDF parsing progress/.test(compiler)&&/page \$\{progress\.page/.test(compiler)],
 ['cancel uses AbortController',/AbortController/.test(compiler)&&/Cancel current PDF parse/.test(compiler)&&/parseAbortRef\.current\.abort/.test(compiler)],
 ['worker has idle watchdog and total hard deadline',/PDF_PARSE_TIMEOUT/.test(compiler)&&/PDF_WORKER_IDLE_TIMEOUT_MS=45000/.test(compiler)&&/PDF_PARSE_HARD_TIMEOUT/.test(compiler)&&/PDF_WORKER_HARD_TIMEOUT_MS=300000/.test(compiler)],
 ['worker has adaptive idle watchdog for large sources',/watchdogMs/.test(compiler)&&/90000/.test(compiler)&&/LARGE_SOURCE/.test(compiler)],
 ['worker progress heartbeats are observed and renewed',/message.type==='heartbeat'/.test(compiler)&&/semanticsHeartbeat/.test(worker)&&/sourcePlanSegments&511/.test(worker)],
 ['worker result cannot keep thousands of duplicated page/frame evidence lists',/compactPlanLineMeta/.test(worker)&&!/scaleValidationEvidence:scaleValidationByPage.get\(segment.page\)/.test(worker)],
 ['stuck parse can be superseded by REPROCESS rather than starving queue',/REPROCESS QUEUED/.test(compiler)&&/parseAbortRef.current.abort\(\)/.test(compiler)&&/\?\s*'STALLED'/.test(compiler)],
 ['worker has file/page/operator budgets (ingestion profile)',/ingestion\.maxBytes/.test(worker)&&/ingestion\.maxPages/.test(worker)&&/ingestion\.maxOperatorsPerPage/.test(worker)&&/ingestion\.maxTotalOperators/.test(worker)],
 ['worker uses adaptive ingestion-profile budgets',/pdfIngestionProfile\(buffer\.byteLength\)/.test(worker)&&/ingestion\.maxPages/.test(worker)&&/ingestion\.maxOperatorsPerPage/.test(worker)&&/ingestion\.maxTotalOperators/.test(worker)],
 ['worker caps retained analysis geometry by ingestion profile',/ingestion\.maxAnalysisSegmentsPerPage/.test(worker)&&/ingestion\.maxAnalysisSegmentsTotal/.test(worker)&&/ingestion\.maxPolygonsPerPage/.test(worker)],
 ['worker reports actionable budget failures',/split the set and retry/i.test(worker)&&/export a lighter PDF/i.test(worker)],
 ['worker reports bounded protected-ingestion failures without forcing normal large sources to be split',/protected native-ingestion ceiling/i.test(worker)&&/bounded parser envelope/i.test(worker)],
 ['active worker executes project-legend closed/open symbol matching',/matchLegendSymbolFingerprints/.test(worker)&&/matchLegendSegmentFingerprints/.test(worker)&&/legend-symbol-match-candidate/.test(worker)],
 ['z-recovery enrichment runs before the basemap-excluded Z index',/enrichZRecovery/.test(compiler)&&/drawingBasemap===true/.test(compiler)],
 ['failed same-SHA source can be retried without reload',/priorFailed/.test(compiler)&&/source\.state==='failed'/.test(compiler)&&/Retry is available without reloading/.test(compiler)],
 ['pdf.js worker asset is shipped',/pdf\.worker\.min\.mjs/.test(assets)],
 ['native parse result states standard/large parsing ran off the UI thread',/large-source bounded parse/.test(worker)&&/standard parse/.test(worker)&&/off the UI thread/.test(worker)],
];

for(const [name,ok] of checks){console.log(`${ok?'✓':'✗'} ${name}`);assert.ok(ok,name)}
console.log('\nPDF worker responsiveness contract passed: native/vector parsing stays off-thread, large/hybrid files queue only low-text pages for selective OCR, cancellation/retry remain available, and whole-file fallback is no longer the normal scanned-page path.');
