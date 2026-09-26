import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SOURCE_ARCHIVE_DB,SOURCE_ARCHIVE_STORE,SOURCE_ARCHIVE_MAX_FILE_BYTES,isArchivedSource} from '../lib/source-browser-archive.ts';

assert.equal(SOURCE_ARCHIVE_DB,'stratum-source-archive-v1');
assert.equal(SOURCE_ARCHIVE_STORE,'sources');
assert.equal(SOURCE_ARCHIVE_MAX_FILE_BYTES,250*1024*1024);
assert.equal(isArchivedSource({sha256:'a'.repeat(64),name:'G101.pdf',mimeType:'application/pdf',size:4,ext:'pdf',archivedAt:new Date().toISOString(),bytes:new Uint8Array([1,2,3,4]).buffer}),true);
assert.equal(isArchivedSource({sha256:'not-a-hash',name:'bad.pdf',mimeType:'application/pdf',size:4,ext:'pdf',archivedAt:'x',bytes:new ArrayBuffer(4)}),false);

const archive=fs.readFileSync('lib/source-browser-archive.ts','utf8');
const compiler=fs.readFileSync('components/CompilerWorkspace.tsx','utf8');
const recovery=fs.readFileSync('lib/spatial-browser-recovery.ts','utf8');

assert.match(archive,/indexedDB\.open\(SOURCE_ARCHIVE_DB,1\)/);
assert.match(archive,/navigator\.storage\?\.estimate/,'archive should respect browser quota when estimate is available');
assert.match(archive,/input\.bytes\.byteLength\*1\.2/,'archive should reserve headroom rather than filling browser quota');
assert.match(archive,/SOURCE_ARCHIVE_MAX_FILE_BYTES/);
assert.doesNotMatch(archive,/fetch\(|\/api\//,'browser-local source archive must not upload source bytes to a new network endpoint');
assert.doesNotMatch(recovery,/SOURCE_ARCHIVE_DB|stratum-source-archive-v1/,'raw source bytes must remain separate from portable graph recovery bundles');

assert.match(compiler,/archiveSourceBytes\(\{sha256:digest,name:file\.name,mimeType:file\.type,size:file\.size,ext,bytes:buf\}\)/,'accepted source bytes must be archived after fingerprinting');
assert.match(compiler,/readArchivedSource\(item\.source\.sha256\)/,'stale drawing reprocess must load exact archived SHA');
assert.match(compiler,/archivedSourceToFile\(record\)/,'archived bytes must be reconstructed as the original named File');
assert.match(compiler,/Reprocess archived drawing/,'Import UI must expose explicit archived-source reprocess control');
assert.match(compiler,/Sources archived locally/,'Import UI must disclose local archive coverage');
assert.match(compiler,/Older sources without a protected local copy still require the original file/,'pre-archive sources must retain an honest manual re-upload fallback');

console.log('Browser source archive contract passed: source bytes are preserved in separate same-origin IndexedDB, quota-bounded, never added to graph backups, and available for explicit stale-drawing reprocessing.');
