import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readPdfTextContent} from '../lib/pdf-text-content.ts';

const nativeIterator=ReadableStream.prototype[Symbol.asyncIterator];
function pageFor(stream,onParams=()=>{}){
 return{isPureXfa:false,getTextContent:()=>{throw new Error('The native async-iterator path must not run')},
  // Safari's stream supports getReader() while lacking an async iterator.
  streamTextContent:params=>{onParams(params);return{getReader:()=>stream.getReader()}}};
}

const params={includeMarkedContent:true,disableNormalization:true};
let forwarded;
const items=[{str:'FIRST FLOOR PLAN'},{type:'beginMarkedContent',id:'mc-1'},{str:'PANEL LP-1'}];
const stream=new ReadableStream({start(c){
 c.enqueue({items:items.slice(0,2),styles:{fontA:{fontFamily:'sans-serif'}},lang:null});
 c.enqueue({items:items.slice(2),styles:{fontB:{fontFamily:'serif'}},lang:'en-US'});c.close();
}});
const content=await readPdfTextContent(pageFor(stream,value=>{forwarded=value}),params);
assert.deepEqual(content.items,items,'text and marked-content chunks retain their order');
assert.deepEqual({...content.styles},{fontA:{fontFamily:'sans-serif'},fontB:{fontFamily:'serif'}});
assert.equal(content.lang,'en-US');
assert.equal(forwarded,params,'PDF.js extraction options reach the stream');
assert.equal(stream.locked,false,'the reader is released after successful extraction');

const empty=new ReadableStream({start(c){c.close()}});
assert.deepEqual((await readPdfTextContent(pageFor(empty))).items,[]);
assert.equal(empty.locked,false);

const original=new Error('Synthetic font/text extraction failure');
const failed=new ReadableStream({pull(){throw original}});
await assert.rejects(readPdfTextContent(pageFor(failed)),error=>error===original);
assert.equal(failed.locked,false,'an extraction failure releases the reader and preserves its cause');

let cancellation;
const malformed=new ReadableStream({start(c){c.enqueue({items:null,styles:{},lang:null})},cancel(reason){cancellation=reason;throw new Error('Synthetic cancellation failure')}});
await assert.rejects(readPdfTextContent(pageFor(malformed)),error=>error instanceof TypeError);
assert.ok(cancellation instanceof TypeError,'invalid chunks cancel the producer');
assert.equal(malformed.locked,false,'a failed cancellation cannot leave the stream locked');

const xfa={items:[{str:'XFA field'}],styles:{},lang:'en'};
assert.equal(await readPdfTextContent({isPureXfa:true,getTextContent:async value=>{assert.equal(value,params);return xfa},streamTextContent:()=>{throw new Error('XFA must retain its native getXfa path')}},params),xfa);
assert.equal(ReadableStream.prototype[Symbol.asyncIterator],nativeIterator,'compatibility must not modify global stream prototypes');

for(const file of ['workers/pdf-native-parser.worker-v2.ts','workers/pdf-native-parser.worker.ts','components/CompilerWorkspace.tsx','components/TitleBlockIntelligence.tsx']){
 const source=fs.readFileSync(file,'utf8');
 assert.match(source,/readPdfTextContent\(page\)/,file+' must use the portable text reader');
 assert.doesNotMatch(source,/\.getTextContent\(/,file+' must not reintroduce the unsupported stream iteration');
}
console.log('PDF text compatibility passed: non-async-iterable streams, ordered text/styles/language, options, empty pages, errors/cancellation/lock release, XFA, and all extraction entry points.');
