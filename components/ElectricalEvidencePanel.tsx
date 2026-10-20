"use client";

import {useEffect,useState} from "react";
import {readPrimarySpatialGraph} from "@/lib/spatial-browser-recovery";
import {buildElectricalDesignIntelligence,type ElectricalDesignIntelligence} from "@/lib/electrical-design-intelligence";

type Graph={entities:any[];electricalIntelligence?:ElectricalDesignIntelligence};

export default function ElectricalEvidencePanel(){
 const [intel,setIntel]=useState<ElectricalDesignIntelligence|null>(null);
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const graph=await readPrimarySpatialGraph() as Graph|null;
    if(!active||!graph?.entities)return;
    setIntel(graph.electricalIntelligence||buildElectricalDesignIntelligence(graph.entities));
   }catch{}
  };
  void load();
  const refresh=()=>void load();
  window.addEventListener("stratum:graph-updated",refresh);
  window.addEventListener("storage",refresh);
  return()=>{active=false;window.removeEventListener("stratum:graph-updated",refresh);window.removeEventListener("storage",refresh)};
 },[]);
 if(!intel||(!intel.summary.physicalEquipment&&!intel.summary.legendEntries&&!intel.summary.specRequirements))return null;
 return <details className="secondary-details card" aria-label="Electrical evidence compiler" style={{marginBottom:18}}>
  <summary>Electrical evidence compiler · {intel.summary.readiness.replaceAll("_"," ")} · {intel.summary.physicalEquipment} physical item{intel.summary.physicalEquipment===1?'':'s'} · {intel.summary.findings} review finding{intel.summary.findings===1?'':'s'}</summary>
  <div style={{marginTop:10,fontSize:12}}>Evidence coverage · Set {intel.summary.coverage.drawingSet?'✓':'PARTIAL'} · Legend {intel.summary.coverage.legend?'✓':'—'} · Plans {intel.summary.coverage.physicalPlans?'✓':'—'} · Matrix {intel.summary.coverage.equipmentMatrix?'✓':'—'} · SLD {intel.summary.coverage.sld?'✓':'—'} · Specs {intel.summary.coverage.specifications?'✓':'—'}</div>
  <div className="grid two" style={{marginTop:12}}>
   <div><div className="label">Project legend</div><b>{intel.summary.legendEntries} entries</b><small style={{display:"block"}}>{intel.legend.pages.length?'Pages '+intel.legend.pages.join(", "):"No electrical legend page structured yet"}</small></div>
   <div><div className="label">Specifications</div><b>{intel.summary.specRequirements} requirements</b><small style={{display:"block"}}>{intel.specifications.pages.length?'Pages '+intel.specifications.pages.join(", "):"Specification comparison remains review-gated"}</small></div>
   <div><div className="label">Physical takeoff</div><b>{intel.summary.physicalEquipment} items · {intel.summary.takeoffRows} groups</b><small style={{display:"block"}}>{intel.takeoff.floors.length?'Floors '+intel.takeoff.floors.join(", "):"No located physical equipment"}</small></div>
   <div><div className="label">Blocking conflicts</div><b>{intel.summary.blocking}</b><small style={{display:"block"}}>Model resolution is never promoted by this panel; all evidence remains review-controlled.</small></div>
  </div>
  {intel.takeoff.rows.length>0&&<div style={{overflowX:"auto",marginTop:14}}>
   <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
    <thead><tr><th align="left">Floor / Unit</th><th align="left">Plan</th><th align="left">Class</th><th align="right">Qty</th><th align="right">Legend</th><th align="right">Matrix</th><th align="right">SLD</th><th align="right">Spec</th></tr></thead>
    <tbody>{intel.takeoff.rows.slice(0,80).map(row=><tr key={row.key}><td>{row.unitId ? "Unit "+row.unitId : row.floor}</td><td>{row.planType.replaceAll("_"," ")}</td><td>{row.componentClass}</td><td align="right">{row.count}</td><td align="right">{row.legendBacked}</td><td align="right">{row.scheduleRefs}</td><td align="right">{row.sldRefs}</td><td align="right">{row.specRefs}</td></tr>)}</tbody>
   </table>
  </div>}
  {intel.findings.length>0&&<div style={{marginTop:14}}>
   <div className="eyebrow">Reconciliation findings</div>
   <ul style={{margin:"8px 0 0",paddingLeft:18}}>{intel.findings.slice(0,40).map(finding=><li key={finding.id}><strong>{finding.severity} · {finding.title}</strong><small style={{display:"block"}}>{finding.detail}</small></li>)}</ul>
  </div>}
 </details>;
}
