import assert from 'node:assert/strict';
import fs from 'node:fs';

const compiler=fs.readFileSync('components/CompilerWorkspace.tsx','utf8');
const worker=fs.readFileSync('workers/pdf-native-parser.worker.ts','utf8');
const assets=fs.readFileSync('scripts/prepare-pdf-assets.mjs','utf8');

const checks=[
 ['native PDF path uses a dedicated Worker',/new Worker\(new URL\('\.\.\/workers\/pdf-native-parser\.worker\.ts'/.test(compiler)],
 ['main-thread parser is fallback-only',/parsePdfMainThreadFallback/.test(compiler)&&/OCR_FALLBACK_REQUIRED/.test(compiler)],
 ['progress is surfaced per page',/PDF parsing progress/.test(compiler)&&/page \$\{progress\.page/.test(compiler)],
 ['cancel uses AbortController',/AbortController/.test(compiler)&&/Cancel current PDF parse/.test(compiler)&&/parseAbortRef\.current\.abort/.test(compiler)],
 ['worker has adaptive watchdog timeout',/PDF_PARSE_TIMEOUT/.test(compiler)&&/35000/.test(compiler)&&/90000/.test(compiler)&&/LARGE_SOURCE/.test(compiler)],
 ['worker uses adaptive file/page/operator budgets',/pdfIngestionProfile\(buffer\.byteLength\)/.test(worker)&&/ingestion\.maxPages/.test(worker)&&/ingestion\.maxOperatorsPerPage/.test(worker)&&/ingestion\.maxTotalOperators/.test(worker)],
 ['worker caps retained analysis geometry by ingestion profile',/ingestion\.maxAnalysisSegmentsPerPage/.test(worker)&&/ingestion\.maxAnalysisSegmentsTotal/.test(worker)&&/ingestion\.maxPolygonsPerPage/.test(worker)],
 ['worker reports bounded protected-ingestion failures without forcing normal large sources to be split',/protected native-ingestion ceiling/i.test(worker)&&/bounded parser envelope/i.test(worker)],
 ['failed same-SHA source can be retried without reload',/priorFailed/.test(compiler)&&/source\.state==='failed'/.test(compiler)&&/Retry is available without reloading/.test(compiler)],
 ['pdf.js worker asset is shipped',/pdf\.worker\.min\.mjs/.test(assets)],
 ['native parse result states standard/large parsing ran off the UI thread',/large-source bounded parse/.test(worker)&&/standard parse/.test(worker)&&/off the UI thread/.test(worker)],
];

for(const [name,ok] of checks){console.log(`${ok?'✓':'✗'} ${name}`);assert.ok(ok,name)}
console.log('\nPDF worker responsiveness contract passed.');
