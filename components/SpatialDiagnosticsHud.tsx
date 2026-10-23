"use client";

import {useEffect,useMemo,useState} from "react";
import {
  isSpatialDiagEnabled,
  readSpatialDiag,
  SPATIAL_DIAG_EVENT,
  SPATIAL_DIAG_FLAG_KEY,
  type SpatialDiagEvent,
  type SpatialDiagStage,
} from "@/lib/spatial-diagnostics";

// Dev-only observability panel for the Spatial render pipeline. Gated by isSpatialDiagEnabled()
// (dev build, or localStorage['stratum_spatial_diag']==='1'), so production users never see it.
// Reads the diagnostics ring buffer and reflects it live; never participates in the render itself.

const STAGE_ORDER:SpatialDiagStage[]=["parse","worker","z","compile","persist","project","render"];
const STAGE_LABEL:Record<SpatialDiagStage,string>={parse:"Parse",worker:"Worker",z:"Z",compile:"Compile",persist:"Persist",project:"Project",render:"Render"};
const LEVEL_COLOR:Record<string,string>={info:"#8fd0ff",warn:"#ffc35a",error:"#ff6a60"};

export default function SpatialDiagnosticsHud({renderStatus,mode}:{renderStatus?:string;mode?:string}){
  const [enabled,setEnabled]=useState(false);
  const [events,setEvents]=useState<SpatialDiagEvent[]>([]);
  const [open,setOpen]=useState(true);
  const [copied,setCopied]=useState(false);

  useEffect(()=>{
    const evaluate=()=>setEnabled(isSpatialDiagEnabled());
    evaluate();
    const refresh=()=>setEvents(readSpatialDiag());
    refresh();
    const onDiag=()=>{evaluate();refresh()};
    const onStorage=(event:StorageEvent)=>{if(!event.key||event.key===SPATIAL_DIAG_FLAG_KEY)evaluate()};
    window.addEventListener(SPATIAL_DIAG_EVENT,onDiag);
    window.addEventListener("storage",onStorage);
    return()=>{window.removeEventListener(SPATIAL_DIAG_EVENT,onDiag);window.removeEventListener("storage",onStorage)};
  },[]);

  const health=useMemo(()=>{
    const map=new Map<SpatialDiagStage,{info:number;warn:number;error:number;last?:SpatialDiagEvent}>();
    for(const stage of STAGE_ORDER)map.set(stage,{info:0,warn:0,error:0});
    for(const event of events){
      const bucket=map.get(event.stage);if(!bucket)continue;
      bucket[event.level]++;bucket.last=event;
    }
    return map;
  },[events]);

  const problems=useMemo(()=>events.filter(event=>event.level!=="info").length,[events]);

  if(!enabled)return null;

  const copy=async()=>{
    try{await navigator.clipboard.writeText(JSON.stringify(readSpatialDiag(),null,2));setCopied(true);setTimeout(()=>setCopied(false),1500)}catch{}
  };

  const recent=events.slice(-60).reverse();

  return <div data-testid="spatial-diagnostics-hud" style={{position:"absolute",left:12,bottom:12,zIndex:60,width:open?"min(380px,calc(100% - 24px))":"auto",maxHeight:"62%",display:"flex",flexDirection:"column",background:"rgba(4,13,20,.95)",border:`1px solid ${problems?"#8a5a1f":"#245069"}`,borderRadius:12,boxShadow:"0 8px 28px rgba(0,0,0,.45)",pointerEvents:"auto",fontSize:11,color:"#cfe6f2"}}>
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderBottom:open?"1px solid #17334a":"0"}}>
      <strong style={{letterSpacing:".06em",color:problems?"#ffc35a":"#7fd0a0"}}>PIPELINE DIAG</strong>
      <span style={{color:"#6f8da0"}}>{renderStatus||""}{mode?` · ${mode}`:""}</span>
      <span style={{marginLeft:"auto",color:problems?"#ffc35a":"#6f8da0"}}>{problems?`${problems} issue${problems===1?"":"s"}`:"ok"} · {events.length} ev</span>
      <button type="button" onClick={()=>setOpen(value=>!value)} style={btn}>{open?"▾":"▸"}</button>
    </div>
    {open&&<>
      <div style={{display:"flex",flexWrap:"wrap",gap:4,padding:"8px 10px",borderBottom:"1px solid #17334a"}}>
        {STAGE_ORDER.map(stage=>{
          const bucket=health.get(stage)!;
          const tone=bucket.error?"#ff6a60":bucket.warn?"#ffc35a":bucket.info?"#2d7252":"#17334a";
          const touched=bucket.info||bucket.warn||bucket.error;
          return <span key={stage} title={`${STAGE_LABEL[stage]} · ${bucket.info} info / ${bucket.warn} warn / ${bucket.error} error${bucket.last?` · last: ${bucket.last.code}`:""}`} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 7px",borderRadius:7,border:`1px solid ${tone}`,opacity:touched?1:.4}}>
            <span style={{width:7,height:7,borderRadius:"50%",background:tone}}/>{STAGE_LABEL[stage]}{bucket.warn||bucket.error?` ${bucket.warn+bucket.error}`:""}
          </span>;
        })}
      </div>
      <div style={{overflow:"auto",padding:"6px 10px",display:"grid",gap:4}}>
        {recent.length===0&&<span style={{color:"#6f8da0"}}>No pipeline events yet. Import a source and open Spatial.</span>}
        {recent.map(event=><div key={event.id} style={{display:"grid",gridTemplateColumns:"auto 1fr auto",gap:8,alignItems:"baseline",lineHeight:1.35}}>
          <span style={{color:"#6f8da0",textTransform:"uppercase",fontSize:9}}>{STAGE_LABEL[event.stage]}</span>
          <span style={{color:LEVEL_COLOR[event.level]||"#cfe6f2"}}><b>{event.code}</b>{event.message?` — ${event.message}`:""}{event.counts?` ${Object.entries(event.counts).map(([k,v])=>`${k}:${v}`).join(" ")}`:""}</span>
          <span style={{color:"#6f8da0"}}>{event.durationMs!==undefined?`${event.durationMs}ms`:""}</span>
        </div>)}
      </div>
      <div style={{display:"flex",gap:6,padding:"8px 10px",borderTop:"1px solid #17334a"}}>
        <button type="button" onClick={copy} style={btn}>{copied?"Copied":"Copy JSON"}</button>
        <span style={{marginLeft:"auto",color:"#6f8da0",alignSelf:"center"}}>__STRATUM_SPATIAL_DIAG</span>
      </div>
    </>}
  </div>;
}

const btn:React.CSSProperties={background:"#0c2030",color:"#cfe6f2",border:"1px solid #28465f",borderRadius:7,padding:"3px 9px",cursor:"pointer",fontSize:11};
