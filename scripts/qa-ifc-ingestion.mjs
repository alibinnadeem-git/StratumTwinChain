import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseIfcText} from '../lib/ifc-ingest.ts';
import {buildPowerIntelligence} from '../lib/power-intelligence.ts';
import {enrichSpatialProjection} from '../lib/spatial-projection.ts';

const ifc=[
"ISO-10303-21;","HEADER;","FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');","ENDSEC;","DATA;",
"#1=IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.);",
"#10=IFCCARTESIANPOINT((1000.,2000.,0.));",
"#11=IFCAXIS2PLACEMENT3D(#10,$,$);",
"#12=IFCLOCALPLACEMENT($,#11);",
"#20=IFCBUILDINGSTOREY('STOREY',$,'Level 1',$,$,#12,$,'L1',.ELEMENT.,0.);",
"#21=IFCCARTESIANPOINT((3000.,4000.,1000.));",
"#22=IFCAXIS2PLACEMENT3D(#21,$,$);",
"#23=IFCLOCALPLACEMENT(#12,#22);",
"#30=IFCPUMP('PUMP-GID',$,'CHW Pump',$,$,#23,$,'P-1',.CIRCULATOR.);",
"#31=IFCCARTESIANPOINT((5000.,0.,0.));",
"#32=IFCAXIS2PLACEMENT3D(#31,$,$);",
"#33=IFCLOCALPLACEMENT(#12,#32);",
"#34=IFCWALL('WALL-GID',$,'Mechanical Room Wall',$,$,#33,$,'W-1',$);",
"#40=IFCRELCONTAINEDINSPATIALSTRUCTURE('REL',$,$,$,(#30,#34),#20);",
"#50=IFCPROPERTYSINGLEVALUE('Voltage',$,IFCELECTRICVOLTAGEMEASURE(480.),$);",
"#51=IFCPROPERTYSINGLEVALUE('NumberOfPhases',$,IFCINTEGER(3),$);",
"#52=IFCPROPERTYSINGLEVALUE('FLA',$,IFCELECTRICCURRENTMEASURE(12.),$);",
"#53=IFCPROPERTYSINGLEVALUE('Manufacturer',$,IFCLABEL('Bell & Gossett'),$);",
"#54=IFCPROPERTYSINGLEVALUE('Model',$,IFCLABEL('1510'),$);",
"#55=IFCPROPERTYSET('PSET',$,'Pset_EquipmentElectrical',$,(#50,#51,#52,#53,#54));",
"#56=IFCRELDEFINESBYPROPERTIES('PSETREL',$,$,$,(#30),#55);",
"ENDSEC;","END-ISO-10303-21;"
].join('\n');

const result=parseIfcText(ifc,'M-201 Mechanical.ifc','Mechanical');
assert.equal(result.unitToMeters,.001);assert.equal(result.unitName,'millimetre');
assert.equal(result.details.storeys,1);assert.equal(result.details.products,2);assert.equal(result.details.placed,2);
const pump=result.entities.find(e=>e.meta.assetTag==='P-1');
assert.ok(pump);assert.equal(pump.layer,'L4');assert.equal(pump.floor,'Level 1');
assert.equal(pump.x,4);assert.equal(pump.y,6);assert.equal(pump.z,1);
assert.equal(pump.meta.manufacturer,'Bell & Gossett');assert.equal(pump.meta.model,'1510');
assert.equal(pump.meta.voltage,480);assert.equal(pump.meta.phase,3);assert.equal(pump.meta.fla,12);
assert.equal(pump.meta.physicalTruth,false);assert.equal(pump.meta.sourceDesignElevationKnown,true);
assert.equal(pump.meta.zPlacementAuthority,'SOURCE_IFC_DESIGN_PLACEMENT');
assert.equal(pump.meta.geometryAuthority,'IFC_PLACEMENT_ONLY_NO_SHAPE_MESH');
const wall=result.entities.find(e=>e.meta.ifcType==='IFCWALL');assert.ok(wall);assert.equal(wall.layer,'L1');

const projected=enrichSpatialProjection({entities:result.entities,links:[],sources:[{name:'M-201 Mechanical.ifc',discipline:'Mechanical'}]});
const projectedPump=projected.entities.find(e=>e.id===pump.id);
assert.ok(projectedPump);assert.equal(projectedPump.x,4);assert.equal(projectedPump.y,6);assert.equal(projectedPump.z,1);
assert.equal(projectedPump.meta?.physicalTruth,false);

const power=buildPowerIntelligence({version:'fixture',createdAt:new Date().toISOString(),sources:[{name:'M-201 Mechanical.ifc',discipline:'Mechanical'}],entities:result.entities,links:[]});
const req=power.requirements.find(r=>r.tag==='P-1');assert.ok(req);assert.equal(req.voltage,480);assert.equal(req.phase,3);assert.equal(req.fla,12);assert.equal(req.status,'MISSING');

const compiler=fs.readFileSync('components/CompilerWorkspace.tsx','utf8');
assert.match(compiler,/parseIfcText/);assert.doesNotMatch(compiler,/NATIVE_ADAPTER=\['dwg','ifc','rvt'\]/);
console.log('IFC units, nested placements, storey containment, equipment properties and source-design truth boundaries passed');
