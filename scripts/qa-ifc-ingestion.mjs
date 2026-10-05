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

const geoIfc=[
"ISO-10303-21;","HEADER;","FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');","ENDSEC;","DATA;",
"#1=IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.);",
"#60=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);",
"#70=IFCPROJECTEDCRS('EPSG:26910',$,'NAD83','NAVD88','UTM','10N',#60);",
"#71=IFCMAPCONVERSION(#999,#70,500000.,4100000.,100.,0.,1.,.001);",
"#10=IFCCARTESIANPOINT((1000.,2000.,0.));",
"#11=IFCAXIS2PLACEMENT3D(#10,$,$);",
"#12=IFCLOCALPLACEMENT($,#11);",
"#20=IFCBUILDINGSTOREY('STOREY',$,'Level 1',$,$,#12,$,'L1',.ELEMENT.,0.);",
"#21=IFCCARTESIANPOINT((3000.,4000.,1000.));",
"#22=IFCAXIS2PLACEMENT3D(#21,$,$);",
"#23=IFCLOCALPLACEMENT(#12,#22);",
"#30=IFCPUMP('PUMP-GEO',$,'Geo Pump',$,$,#23,$,'P-GEO',.CIRCULATOR.);",
"#40=IFCRELCONTAINEDINSPATIALSTRUCTURE('REL',$,$,$,(#30),#20);",
"ENDSEC;","END-ISO-10303-21;"
].join('\n');

const geo=parseIfcText(geoIfc,'Geo Mechanical.ifc','Mechanical');
const geoPump=geo.entities.find(e=>e.meta.assetTag==='P-GEO');
assert.ok(geoPump);
assert.equal(geoPump.x,4,'render/local engineering X remains near-origin meters');
assert.equal(geoPump.y,6,'render/local engineering Y remains near-origin meters');
assert.equal(geoPump.z,1,'render/local engineering Z remains local design meters');
assert.equal(geoPump.meta.ifcCoordinateFrame,'LOCAL_ENGINEERING');
assert.equal(geoPump.meta.zResolutionStatus,'RESOLVED_DESIGN_CANDIDATE');
assert.equal(geoPump.meta.zCandidateMeters,1);
assert.equal(geoPump.meta.zCandidateReferencePoint,'SOURCE_ORIGIN');
assert.equal(geoPump.meta.zResolutionCoordinateFrame,'IFC_LOCAL_ENGINEERING:Geo Mechanical.ifc');
assert.equal(geoPump.meta.ifcMapCrsName,'EPSG:26910');
assert.equal(geoPump.meta.ifcMapVerticalDatum,'NAVD88');
assert.equal(geoPump.meta.ifcMapConversionAuthority,'IFC_MAP_CONVERSION');
assert.equal(geoPump.meta.ifcMapUnitName,'m');
assert.equal(geoPump.meta.ifcMapCoordinateKnown,true);
assert.ok(Math.abs(Number(geoPump.meta.ifcMapEastingMeters)-499994)<1e-9);
assert.ok(Math.abs(Number(geoPump.meta.ifcMapNorthingMeters)-4100004)<1e-9);
assert.ok(Math.abs(Number(geoPump.meta.ifcMapZCandidateMeters)-101)<1e-9);
assert.equal(geoPump.meta.ifcMapZAuthority,'SOURCE_IFC_MAP_CONVERSION');
assert.equal(geoPump.meta.ifcMapPhysicalTruth,false);
assert.ok(Math.abs(Number(geoPump.meta.ifcMapOriginOrthogonalHeightMeters)-100)<1e-12);
assert.ok(Math.abs(Number(geoPump.meta.zScaleGuideMetersPerSourceUnit)-.001)<1e-12);
assert.match(geo.summary,/map CRS EPSG:26910/);
assert.match(geo.summary,/vertical datum NAVD88/);

const scaledGeoIfc=geoIfc.replace(
 "#71=IFCMAPCONVERSION(#999,#70,500000.,4100000.,100.,0.,1.,.001);",
 "#71=IFCMAPCONVERSIONSCALED(#999,#70,500000.,4100000.,100.,0.,1.,.001,1.,1.,1.1);"
);
const scaledGeo=parseIfcText(scaledGeoIfc,'Geo Scaled.ifc','Mechanical');
const scaledPump=scaledGeo.entities.find(e=>e.meta.assetTag==='P-GEO');
assert.ok(scaledPump);
assert.equal(scaledPump.meta.ifcMapConversionAuthority,'IFC_MAP_CONVERSION_SCALED');
assert.ok(Math.abs(Number(scaledPump.meta.ifcMapZCandidateMeters)-101.1)<1e-9,'IfcMapConversionScaled FactorZ must apply after common scale and before orthogonal-height translation');
assert.ok(Math.abs(Number(scaledPump.meta.zScaleGuideMetersPerSourceUnit)-.0011)<1e-12);

const compiler=fs.readFileSync('components/CompilerWorkspace.tsx','utf8');
assert.match(compiler,/parseIfcText/);assert.doesNotMatch(compiler,/NATIVE_ADAPTER=\['dwg','ifc','rvt'\]/);
console.log('IFC units, nested placements, storey containment, equipment properties, map CRS/orthogonal-height evidence, scaled XYZ conversion and source-design truth boundaries passed');
