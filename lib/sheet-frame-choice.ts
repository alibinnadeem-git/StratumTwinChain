// Which sheet frame "Auto-safe sheet isolation" opens on. Model and Review views are about physical
// placement, so they open on a plan (the one drawing the most identified equipment), never on a one-line
// diagram while a plan exists: one-line positions are page layout, not distances. (On the golden fixture
// the one-line drew two switchboards 12.6 m apart; the floor plan puts them 3.6 m apart.) The Electrical
// view keeps the one-line first, since that is what it shows.

export type SheetFrameChoice={key:string;planType:string};

export function chooseAutoSheetFrame(frames:SheetFrameChoice[],mode:string,instancesByFrame:ReadonlyMap<string,number>):string|null{
  if(frames.length<=1)return null;
  if(mode==="ELECTRICAL"){
    const preferred=frames.find(frame=>frame.planType==="SLD")||frames.find(frame=>/ELECTRICAL|UTILITY|LOW_VOLTAGE/.test(frame.planType))||frames.find(frame=>frame.planType!=="RASTER_DRAWING");
    return(preferred||frames[0]).key;
  }
  const plans=frames.filter(frame=>frame.planType!=="SLD"&&frame.planType!=="RASTER_DRAWING");
  if(plans.length){
    // Ties keep frame order (source, then page), so the earliest plan with the most equipment wins.
    let best=plans[0];
    for(const frame of plans)if((instancesByFrame.get(frame.key)||0)>(instancesByFrame.get(best.key)||0))best=frame;
    return best.key;
  }
  return(frames.find(frame=>frame.planType!=="RASTER_DRAWING")||frames[0]).key;
}
