"use client";
import {DEFAULT_ELECTRICAL_MODEL_REGISTRY} from '@/lib/electrical-model-registry';
type SyntheticEntity={id:string;name:string;source:string;meta?:Record<string,unknown>};
const toList=(value:unknown):string[]=>Array.isArray(value)?value.filter((v):v is string=>typeof v==='string'):[];
export default function PreviewDemoAssetInspector({selected}:{selected:SyntheticEntity|null}){
 if(!selected)return <div className="card" aria-label="DEMO inspector" style={{marginTop:8}}>
   <strong>DEMO / SYNTHETIC · SELECT AN ASSET</strong>
   <p className="muted">Choose a solid stated-Z model, an amber derived-Z candidate, a blue unresolved ghost or an amber source-sheet pin. No authority is granted by viewing.</p>
 </div>;
 const m=selected.meta||{},tier=String(m.demoPlacementTier||'SOURCE_ONLY');
 const model=DEFAULT_ELECTRICAL_MODEL_REGISTRY.find(c=>c.componentKey===m.demoComponentKey);
 const evidence=Array.isArray(m.evidence)?m.evidence as Array<Record<string,unknown>>:[];
 return <section className="card" aria-label="DEMO asset inspector" data-demo-readonly="true" style={{marginTop:8}}>
   <div className="eyebrow">DEMO / SYNTHETIC · READ-ONLY RECORD</div>
   <h3 style={{margin:"8px 0"}}>{selected.name}</h3>
   <div className="notice" role="status">
     <strong>{tier.replaceAll('_',' ')} · {String(m.status||'UNRESOLVED')}</strong>
     <span>physicalTruth:false · reviewRequired:true · No human verification, commissioning or installed asset is asserted.</span>
   </div>
   <dl>
     <div><dt>Demo ID</dt><dd>{selected.id}</dd></div>
     <div><dt>Source</dt><dd>{selected.source}</dd></div>
     <div><dt>Representative 3D library asset</dt><dd>{model?.modelUrl||'No identified component — source pin only'} {model&&'· STRATUM-authored visualization, not exact OEM/as-built geometry'}</dd></div>
     <div><dt>Sheet / page</dt><dd>{String(evidence[0]?.sheet_number||'DEMO E-101')} · p1</dd></div>
     <div><dt>Source observation</dt><dd>{String(m.sourceElevationNote||evidence[0]?.note||'Synthetic drawing observation')}</dd></div>
     <div><dt>Z authority</dt><dd>{tier==='STATED_Z'?'Stated in synthetic source; not verified as built':tier==='DERIVED_Z_CANDIDATE'?'Review-only candidate; never canonical':'UNRESOLVED · canonical Z null'}</dd></div>
     {tier==='DERIVED_Z_CANDIDATE'&&<div><dt>Proposed Z</dt><dd>{String(m.zCandidateMeters??'?')} m · physicalTruth:false / reviewRequired:true</dd></div>}
     {tier==='UNRESOLVED_Z'&&<div><dt>Unblock with</dt><dd>{toList(m.missing_inputs).join(' · ')}</dd></div>}
   </dl>
   <p className="muted">Synthetic only. This inspector has no promotion, takeoff, measurement, export, persistence or API controls.</p>
 </section>;
}
