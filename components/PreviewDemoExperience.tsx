"use client";
import Link from "next/link";
import CompiledGraphViewer from "@/components/CompiledGraphViewer";
import {PREVIEW_DEMO_GRAPH} from "@/lib/preview-synthetic-twin";
/** The whole preview-only view is excluded by webpack alias in production. */
export default function PreviewDemoExperience(){
 return <section id="spatial-demo-model" aria-label="DEMO synthetic preview twin">
  <div className="notice" role="status" style={{marginBottom:12,borderColor:"#6d5795"}}>
   <strong>DEMO / SYNTHETIC · PREVIEW ONLY · READ-ONLY</strong>
   <span>Fictional electrical drawing, not real source evidence. Three illustrated Z tiers; no physical truth, verified assets, takeoffs, measurements, reports or exports.</span>
   <div className="button-row" style={{marginTop:10}}><Link className="action" href="/import">Upload real drawings</Link></div>
  </div>
  <CompiledGraphViewer registeredAssets={[]} demoGraph={PREVIEW_DEMO_GRAPH}/>
 </section>;
}
