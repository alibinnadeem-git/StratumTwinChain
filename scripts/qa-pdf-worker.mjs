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
 ['worker has watchdog timeout',/PDF_PARSE_TIMEOUT/.test(compiler)&&/35000/.test(compiler)],
 ['worker has file/page/operator budgets',/MAX_FILE_BYTES/.test(worker)&&/MAX_PAGES/.test(worker)&&/MAX_OPERATORS_PER_PAGE/.test(worker)&&/MAX_TOTAL_OPERATORS/.test(worker)],
 ['worker caps retained analysis geometry',/MAX_ANALYSIS_SEGMENTS_PER_PAGE/.test(worker)&&/MAX_ANALYSIS_SEGMENTS_TOTAL/.test(worker)&&/MAX_POLYGONS_PER_PAGE/.test(worker)],
 ['worker reports actionable budget failures',/split the set and retry/i.test(worker)&&/export a lighter PDF/i.test(worker)],
 ['failed same-SHA source can be retried without reload',/priorFailed/.test(compiler)&&/source\.state==='failed'/.test(compiler)&&/Retry is available without reloading/.test(compiler)],
 ['pdf.js worker asset is shipped',/pdf\.worker\.min\.mjs/.test(assets)],
 ['native parse result states it ran off the UI thread',/parsed off the UI thread/.test(worker)],
];

for(const [name,ok] of checks){console.log(`${ok?'✓':'✗'} ${name}`);assert.ok(ok,name)}
console.log('\nPDF worker responsiveness contract passed.');
