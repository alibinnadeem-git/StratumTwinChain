// Phase 21 (docs/SPATIAL_SOURCE_FIDELITY_PLAN.md): equipment placed, turned and, at a reviewed drawing scale,
// sized from its drawn symbol.
//
// Phase 20 (lib/equipment-roster.ts) records the rectangle each recognised piece of equipment is drawn as
// (meta.drawnFootprint) and, for a switchboard, its whole lineup (meta.lineupFootprint), both in sheet units.
// That rectangle is where the equipment sits and which way its long side runs. Its length and depth are only
// metres once a person has confirmed the sheet's printed scale (Apply drawing scale, lib/pdf-metric-frame.ts,
// which multiplies x/y by metricFrameMetersPerSheetUnit about the sheet origin); until then the size stays
// the library's nominal size, as the Spatial banner says. Height is never drawn on a plan, so it stays the
// library's. On the golden fixture the MS1 lineup becomes 102" × 20" (DIST 36" | MS1 30" | P/S 36"), the
// widths on E-2's service elevation.

type Box={x0:number;y0:number;x1:number;y1:number};
export type DrawnSymbolGeometry={
  centerX:number;centerY:number;
  // Long and short side in world units: metres when metric, sheet units otherwise.
  longSide:number;shortSide:number;
  // 0 when the long side runs along sheet x, 90 along sheet y.
  rotationDegrees:0|90;
  metric:boolean;metersPerSheetUnit:number|null;
  lineup:boolean;sections:string[];
};

// A drawn depth below this is a line weight, not an enclosure.
const MIN_DEPTH_METERS=.05;

function box(value:unknown):Box|null{
  const candidate=value as Partial<Box>|null|undefined;
  if(!candidate)return null;
  const out={x0:Number(candidate.x0),y0:Number(candidate.y0),x1:Number(candidate.x1),y1:Number(candidate.y1)};
  return [out.x0,out.y0,out.x1,out.y1].every(Number.isFinite)&&out.x1>out.x0&&out.y1>out.y0?out:null;
}

export function drawnSymbolGeometry(entity:{meta?:Record<string,unknown>}):DrawnSymbolGeometry|null{
  const meta=entity.meta||{};
  const lineup=box(meta.lineupFootprint),drawn=lineup||box(meta.drawnFootprint);
  if(!drawn)return null;
  const units=String((meta.drawnFootprint as {units?:unknown}|undefined)?.units||"SHEET");
  if(units!=="SHEET")return null;
  const scale=Number(meta.metricFrameMetersPerSheetUnit),metric=Number.isFinite(scale)&&scale>0;
  const k=metric?scale:1,width=drawn.x1-drawn.x0,height=drawn.y1-drawn.y0;
  return{
    centerX:(drawn.x0+drawn.x1)/2*k,centerY:(drawn.y0+drawn.y1)/2*k,
    longSide:Math.max(width,height)*k,shortSide:Math.min(width,height)*k,
    rotationDegrees:width>=height?0:90,metric,metersPerSheetUnit:metric?scale:null,
    lineup:Boolean(lineup),sections:Array.isArray(meta.lineupSections)?meta.lineupSections.map(String):[],
  };
}

// Plan size in metres from the drawn symbol, only at a reviewed scale. The caller keeps the library height.
export function drawnPlanDimensions(entity:{meta?:Record<string,unknown>}){
  const geometry=drawnSymbolGeometry(entity);
  if(!geometry?.metric)return null;
  const inches=(meters:number)=>Math.round(meters/.0254);
  return{
    width:geometry.longSide,depth:Math.max(MIN_DEPTH_METERS,geometry.shortSide),
    source:`Drawn ${geometry.lineup?`lineup ${geometry.sections.join(" | ")}`:"symbol"} at the reviewed drawing scale (${geometry.metersPerSheetUnit!.toFixed(3)} m per sheet unit): ${inches(geometry.longSide)}" × ${inches(geometry.shortSide)}"; height from the component library`,
  };
}
