import assert from 'node:assert/strict';
import fs from 'node:fs';
import {strToU8,zipSync} from 'fflate';
import {parseDocxBytes,parseXlsxBytes} from '../lib/office-document-ingest.ts';
import {buildPowerIntelligence} from '../lib/power-intelligence.ts';

const workbook='<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Mechanical Equipment" sheetId="1" r:id="rId1"/></sheets></workbook>';
const rels='<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>';
const shared=['TAG','DESCRIPTION','MANUFACTURER','MODEL','VOLTAGE','PHASE','FLA','MCA','MOCP','LOCATION','AHU-12','Air Handling Unit','Trane','TX12','480','3','15','18','25','Mechanical Room','P-8','CHW Pump','Bell & Gossett','1510','460','3','','20','30','Mechanical Room'];
const sharedXml='<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+shared.map(v=>'<si><t>'+v+'</t></si>').join('')+'</sst>';
const cell=(ref,index)=>'<c r="'+ref+'" t="s"><v>'+index+'</v></c>';
const cols=['A','B','C','D','E','F','G','H','I','J'];
const row1='<row r="1">'+cols.map((col,i)=>cell(col+'1',i)).join('')+'</row>';
const row2='<row r="2">'+cols.map((col,i)=>cell(col+'2',10+i)).join('')+'</row>';
const row3='<row r="3">'+cols.map((col,i)=>i===6?'<c r="'+col+'3"></c>':cell(col+'3',20+i)).join('')+'</row>';
const sheet='<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+row1+row2+row3+'</sheetData></worksheet>';
const xlsx=zipSync({'xl/workbook.xml':strToU8(workbook),'xl/_rels/workbook.xml.rels':strToU8(rels),'xl/sharedStrings.xml':strToU8(sharedXml),'xl/worksheets/sheet1.xml':strToU8(sheet)});
const x=parseXlsxBytes(xlsx,'M-601 Equipment Matrix.xlsx','Mechanical','L2');
assert.equal(x.details.format,'XLSX');assert.equal(x.details.sheetCount,1);assert.equal(x.entities.length,2);
const ahu=x.entities.find(e=>e.meta.assetTag==='AHU-12');
assert.ok(ahu);assert.equal(ahu.meta.officeFormat,'XLSX');assert.equal(ahu.meta.workbookSheet,'Mechanical Equipment');
assert.equal(ahu.meta.nonSpatial,true);assert.equal(ahu.meta.voltage,480);assert.equal(ahu.meta.phase,3);assert.equal(ahu.meta.fla,15);
const pump=x.entities.find(e=>e.meta.assetTag==='P-8');assert.ok(pump);assert.equal(pump.meta.mca,20);assert.equal(pump.meta.mocp,30);

const documentXml='<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Equipment electrical requirements</w:t></w:r></w:p><w:p><w:r><w:t>RTU-4 Rooftop Unit 208V 3PH FLA 22</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>TAG</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>DESCRIPTION</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>VOLTAGE</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>PHASE</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>HP</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>EF-3</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Exhaust Fan</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>480</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>3</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>5</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>';
const docx=zipSync({'word/document.xml':strToU8(documentXml)});
const d=parseDocxBytes(docx,'23 73 00 HVAC Specs.docx','Mechanical','UNRESOLVED');
assert.equal(d.details.format,'DOCX');assert.equal(d.details.tableCount,1);assert.ok(d.details.paragraphCount>=2);
assert.ok(d.entities.some(e=>e.name.includes('RTU-4')));
const fan=d.entities.find(e=>e.meta.assetTag==='EF-3');assert.ok(fan);assert.equal(fan.meta.officeFormat,'DOCX');assert.equal(fan.meta.voltage,480);assert.equal(fan.meta.phase,3);assert.equal(fan.meta.motorHp,5);

const power=buildPowerIntelligence({version:'fixture',createdAt:new Date().toISOString(),sources:[{name:'M-601 Equipment Matrix.xlsx',discipline:'Mechanical'}],entities:x.entities,links:[]});
assert.ok(power.requirements.some(r=>r.tag==='AHU-12'&&r.status==='MISSING'));
assert.ok(power.requirements.some(r=>r.tag==='P-8'&&r.status==='MISSING'));

const compiler=fs.readFileSync('components/CompilerWorkspace.tsx','utf8');
assert.match(compiler,/parseXlsxBytes/);assert.match(compiler,/parseDocxBytes/);assert.match(compiler,/Legacy XLS fingerprinted/);
console.log('Structured XLSX/DOCX extraction, non-spatial truth boundary and Expected Power integration passed');
