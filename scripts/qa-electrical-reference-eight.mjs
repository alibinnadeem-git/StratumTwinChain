import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {Box3,Vector3} from 'three';
import {DEFAULT_ELECTRICAL_MODEL_REGISTRY} from '../lib/electrical-model-registry.ts';
const specs=[["E-01","pad-mount-transformer",[1.8,1.6,1.7],"UTILITY_GREEN",["door","latch","roof","plinth"]],["E-04","main-switchboard",[2.7,2.3,0.9],"LIGHT_GRAY",["door","meter","base"]],["E-07","motor-control-center",[1.7,2.3,0.5],"LIGHT_GRAY",["bucket","handle","light","wireway"]],["E-09","dry-type-transformer",[0.75,1.1,0.65],"LIGHT_GRAY",["vent","door","lug"]],["E-13","automatic-transfer-switch",[0.6,1.2,0.35],"LIGHT_GRAY",["door","handle","lamp","test"]],["E-15","enclosed-diesel-generator",[3.6,2,1.3],"LIGHT_GRAY",["vent","exhaust","stack","roof"]],["E-16","uninterruptible-power-supply",[0.8,1.8,0.8],"DARK_GRAY",["display","vent","base","door"]],["E-17","battery-cabinet",[1.2,2.2,1.1],"WHITE_LIGHT_GRAY",["door","vent","beacon","placard"]]];
const report=[];
for(const [typeId,name,expected,finish,features] of specs){
 const file='public/models/equipment/'+name+'.glb';
 const data=fs.readFileSync(file);
 const scene=(await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'')).scene;
 const actual=new Box3().setFromObject(scene).getSize(new Vector3()).toArray();
 assert.ok(actual.every(value=>Number.isFinite(value)&&value>0));
 // This is glTF Y-up. Report X/Y/Z envelope as W/H/D before comparing.
 const deviations=actual.map((value,i)=>Math.round((value/expected[i]-1)*1000)/10);
 const registryKey={'E-01':'pad-mount-transformer','E-04':'main-switchboard','E-07':'mcc','E-09':'dry-transformer','E-13':'ats','E-15':'generator','E-16':'ups','E-17':'battery-bank'}[typeId];
 const registry=DEFAULT_ELECTRICAL_MODEL_REGISTRY.find(x=>x.componentKey===registryKey);
 const registryDims=registry?.dimensionsMeters||null;
 const nodes=[],colors=[];
 scene.traverse(object=>{
  nodes.push(String(object.name||'').toLowerCase());
  if('isMesh' in object && object.isMesh){
   const mats=Array.isArray(object.material)?object.material:[object.material];
   for(const material of mats)if(material?.color)colors.push('#'+material.color.getHexString().toUpperCase());
  }
 });
 const expectedWords=features.filter(word=>nodes.some(node=>node.includes(word)));
 const nearEnough=deviations.every(delta=>Math.abs(delta)<=10);
 const status=nearEnough?'DIMENSIONAL_PASS_MANUAL_FINISH_REVIEW':'SCALE_MISMATCH_REVIEW_REQUIRED';
 report.push({typeId,file,size_bytes:data.length,expected_m:expected,actual_geometry_m:actual.map(x=>Math.round(x*1000)/1000),
  deviation_pct:deviations,registry_envelope_m:registryDims,referenceFinish:finish,
  meshColors:[...new Set(colors)].slice(0,14),namedFeatureEvidence:expectedWords,
  missingNamedFeatures:features.filter(f=>!expectedWords.includes(f)),
  status,visualSilhouetteStatus:'UNVERIFIED_PENDING_MANUAL_RENDER_REVIEW'});
}
console.log('EXISTING-EIGHT-REFERENCE-QA '+JSON.stringify(report));
console.log('EXISTING-EIGHT-MISMATCH-COUNT '+report.filter(x=>x.status!=='DIMENSIONAL_PASS_MANUAL_FINISH_REVIEW').length);
