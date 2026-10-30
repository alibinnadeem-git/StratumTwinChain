// Phrases and drawn footprints from a PDF sheet's text layer (docs/SPATIAL_SOURCE_FIDELITY_PLAN.md, Phase 20).
//
// pdf.js returns one item per text run, so a two-line label ("ELEC." over "PANEL", 11 of them on E-4 of the
// golden fixture) arrives as two unrelated words and a classifier sees a bare "PANEL". Phrases join runs on
// one baseline and short centred lines stacked directly on top of each other.
//
// A designator on a plan usually sits on or inside the symbol it names: HP1 and HL under the filled bars
// that are the panels, DIST / MS1 / P/S inside the boxes of the MS1 lineup (30" and 36" wide at the printed
// 1/8" scale, as on E-2's elevation). findDrawnFootprint returns that rectangle so the equipment is placed
// on its symbol and a label can be told apart from a note.
//
// Coordinates are the parser's sheet plane (long edge 20 units, y up). A text item is anchored at the start
// of its baseline; its direction is in sheet coordinates.

export type SheetBox={x0:number;y0:number;x1:number;y1:number};
export type SheetTextItem={text:string;x:number;y:number;dirX:number;dirY:number;span:number;size:number};
export type TextPhrase={text:string;box:SheetBox;size:number;dirX:number;dirY:number;lines:number;anchorX:number;anchorY:number};
export type FootprintRect=SheetBox&{filled:boolean};
export type DrawnFootprint=SheetBox&{filled:boolean;relation:"CONTAINS_LABEL"|"BESIDE_LABEL";gap:number};

type Line={text:string;start:{x:number;y:number};dir:{x:number;y:number};span:number;size:number};

const dot=(a:{x:number;y:number},b:{x:number;y:number})=>a.x*b.x+a.y*b.y;
const sub=(a:{x:number;y:number},b:{x:number;y:number})=>({x:a.x-b.x,y:a.y-b.y});
const sameDirection=(a:Line,b:Line)=>dot(a.dir,b.dir)>.995;
const similarSize=(a:number,b:number,ratio:number)=>Math.max(a,b)/Math.max(Math.min(a,b),1e-9)<=ratio;
// Letters sit between -0.2 and 0.8 of the font size around the baseline.
const DESCENT=.2,ASCENT=.8;

function lineBox(line:Line):SheetBox{
  const normal={x:-line.dir.y,y:line.dir.x},end={x:line.start.x+line.dir.x*line.span,y:line.start.y+line.dir.y*line.span};
  const corners=[line.start,end].flatMap(point=>[-DESCENT,ASCENT].map(k=>({x:point.x+normal.x*line.size*k,y:point.y+normal.y*line.size*k})));
  const xs=corners.map(point=>point.x),ys=corners.map(point=>point.y);
  return{x0:Math.min(...xs),y0:Math.min(...ys),x1:Math.max(...xs),y1:Math.max(...ys)};
}
const union=(a:SheetBox,b:SheetBox):SheetBox=>({x0:Math.min(a.x0,b.x0),y0:Math.min(a.y0,b.y0),x1:Math.max(a.x1,b.x1),y1:Math.max(a.y1,b.y1)});

// Runs on one baseline whose gap is under 0.8 of the font size are one line. Runs are grouped by direction,
// then into rows by baseline, then joined left to right along the row.
function joinRuns(items:SheetTextItem[]):Line[]{
  const runs:Line[]=items.filter(item=>item.text.trim()&&item.size>0).map(item=>{
    const length=Math.hypot(item.dirX,item.dirY)||1;
    return{text:item.text.trim(),start:{x:item.x,y:item.y},dir:{x:item.dirX/length,y:item.dirY/length},span:Math.max(0,item.span),size:item.size};
  });
  const byDirection=new Map<string,Line[]>();
  for(const run of runs){const key=`${run.dir.x.toFixed(2)},${run.dir.y.toFixed(2)}`;byDirection.set(key,[...(byDirection.get(key)||[]),run])}
  const lines:Line[]=[];
  for(const group of byDirection.values()){
    const normal={x:-group[0].dir.y,y:group[0].dir.x},along=group[0].dir;
    const sorted=[...group].sort((a,b)=>dot(a.start,normal)-dot(b.start,normal));
    const rows:Line[][]=[];
    for(const run of sorted){
      const row=rows[rows.length-1];
      if(row&&Math.abs(dot(run.start,normal)-dot(row[0].start,normal))<=.35*row[0].size)row.push(run);else rows.push([run]);
    }
    for(const row of rows){
      row.sort((a,b)=>dot(a.start,along)-dot(b.start,along));
      let current=row[0];
      for(const run of row.slice(1)){
        const gap=dot(sub(run.start,current.start),along)-current.span;
        if(similarSize(current.size,run.size,1.25)&&gap>=-.2*current.size&&gap<=.8*current.size){
          current={...current,text:`${current.text} ${run.text}`,span:dot(sub(run.start,current.start),along)+run.span,size:Math.max(current.size,run.size)};
        }else{lines.push(current);current=run}
      }
      lines.push(current);
    }
  }
  return lines;
}

// Two short lines of the same size, one directly above the other and centred on it, read as one label
// ("ELEC." over "PANEL"). Long lines are notes and stay apart.
const STACKABLE_CHARACTERS=14;
function stackable(top:Line,bottom:Line){
  if(!sameDirection(top,bottom)||!similarSize(top.size,bottom.size,1.15))return false;
  if(top.text.length>STACKABLE_CHARACTERS||bottom.text.length>STACKABLE_CHARACTERS)return false;
  const normal={x:-top.dir.y,y:top.dir.x},offset=sub(top.start,bottom.start);
  const rise=dot(offset,normal);
  if(rise<.9*top.size||rise>1.7*top.size)return false;
  const centreTop=dot(top.start,top.dir)+top.span/2,centreBottom=dot(bottom.start,top.dir)+bottom.span/2;
  return Math.abs(centreTop-centreBottom)<=.5*Math.max(top.span,bottom.span);
}

export function assembleTextPhrases(items:SheetTextItem[]):TextPhrase[]{
  const lines=joinRuns(items);
  const used=new Set<number>(),phrases:TextPhrase[]=[];
  const order=lines.map((line,index)=>({line,index})).sort((a,b)=>dot(b.line.start,{x:-b.line.dir.y,y:b.line.dir.x})-dot(a.line.start,{x:-a.line.dir.y,y:a.line.dir.x}));
  for(const {line,index} of order){
    if(used.has(index))continue;
    used.add(index);
    const below=order.find(other=>!used.has(other.index)&&stackable(line,other.line));
    if(below)used.add(below.index);
    const box=below?union(lineBox(line),lineBox(below.line)):lineBox(line);
    phrases.push({text:below?`${line.text} ${below.line.text}`:line.text,box,size:line.size,dirX:line.dir.x,dirY:line.dir.y,lines:below?2:1,anchorX:line.start.x,anchorY:line.start.y});
  }
  return phrases;
}

// An axis-aligned rectangle drawn as a closed path: four distinct corners on its bounding box.
export function rectangleFromPolygon(vertices:Array<{x:number;y:number}>):SheetBox|null{
  if(vertices.length<4)return null;
  const xs=vertices.map(point=>point.x),ys=vertices.map(point=>point.y);
  const box={x0:Math.min(...xs),y0:Math.min(...ys),x1:Math.max(...xs),y1:Math.max(...ys)};
  const tolerance=Math.max(1e-4,.02*Math.min(box.x1-box.x0,box.y1-box.y0));
  if(box.x1-box.x0<=tolerance||box.y1-box.y0<=tolerance)return null;
  const onCorner=(point:{x:number;y:number})=>(Math.abs(point.x-box.x0)<=tolerance||Math.abs(point.x-box.x1)<=tolerance)&&(Math.abs(point.y-box.y0)<=tolerance||Math.abs(point.y-box.y1)<=tolerance);
  if(!vertices.every(onCorner))return null;
  const corners=new Set(vertices.map(point=>`${Math.abs(point.x-box.x0)<=tolerance?0:1}${Math.abs(point.y-box.y0)<=tolerance?0:1}`));
  return corners.size===4?box:null;
}

// Every rectangle drawn on a sheet: closed rectangular paths, plus solid-filled rectangles that CAD exports
// as two filled triangles sharing a diagonal (how HP1 and HL are drawn on E-4 of the golden fixture).
export function drawnRectangles(polygons:Array<{vertices:Array<{x:number;y:number}>;filled?:boolean}>):FootprintRect[]{
  const out:FootprintRect[]=[];
  const key=(point:{x:number;y:number})=>`${point.x.toFixed(4)},${point.y.toFixed(4)}`;
  const triangles:Array<Array<{x:number;y:number}>>=[];
  for(const polygon of polygons){
    const rect=rectangleFromPolygon(polygon.vertices);
    if(rect){out.push({...rect,filled:polygon.filled===true});continue}
    if(polygon.filled!==true)continue;
    const distinct=[...new Map(polygon.vertices.map(point=>[key(point),point])).values()];
    if(distinct.length===3)triangles.push(distinct);
  }
  const byEdge=new Map<string,number[]>();
  triangles.forEach((triangle,index)=>{for(let i=0;i<3;i++){const edge=[key(triangle[i]),key(triangle[(i+1)%3])].sort().join("|");byEdge.set(edge,[...(byEdge.get(edge)||[]),index])}});
  const paired=new Set<number>();
  for(const indices of byEdge.values()){
    if(indices.length!==2||paired.has(indices[0])||paired.has(indices[1]))continue;
    const corners=[...new Map([...triangles[indices[0]],...triangles[indices[1]]].map(point=>[key(point),point])).values()];
    const rect=corners.length===4?rectangleFromPolygon(corners):null;
    if(rect){out.push({...rect,filled:true});paired.add(indices[0]);paired.add(indices[1])}
  }
  return out;
}

function boxGap(a:SheetBox,b:SheetBox){
  return Math.hypot(Math.max(0,a.x0-b.x1,b.x0-a.x1),Math.max(0,a.y0-b.y1,b.y0-a.y1));
}
const contains=(outer:SheetBox,inner:SheetBox,tolerance:number)=>inner.x0>=outer.x0-tolerance&&inner.y0>=outer.y0-tolerance&&inner.x1<=outer.x1+tolerance&&inner.y1<=outer.y1+tolerance;
const overlapArea=(a:SheetBox,b:SheetBox)=>Math.max(0,Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0))*Math.max(0,Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0));

// The rectangle a short label names. A box around the label (a lineup section) wins; otherwise the
// nearest rectangle within 1.2 font sizes that the label does not overlap, filled first (a panel bar).
// Rectangles are limited to symbol size relative to the lettering, so rooms and borders never qualify.
export function findDrawnFootprint(phrase:TextPhrase,rects:FootprintRect[]):DrawnFootprint|null{
  const size=phrase.size,minSide=.3*size,maxSide=15*size,labelArea=Math.max((phrase.box.x1-phrase.box.x0)*(phrase.box.y1-phrase.box.y0),1e-9);
  let inside:DrawnFootprint|null=null,beside:DrawnFootprint|null=null;
  for(const rect of rects){
    const width=rect.x1-rect.x0,height=rect.y1-rect.y0;
    if(Math.min(width,height)<minSide||Math.max(width,height)>maxSide)continue;
    if(contains(rect,phrase.box,.1*size)){
      if(!inside||width*height<(inside.x1-inside.x0)*(inside.y1-inside.y0))inside={...rect,relation:"CONTAINS_LABEL",gap:0};
      continue;
    }
    if(overlapArea(rect,phrase.box)>.15*labelArea||Math.max(width,height)<1.5*size)continue;
    const gap=boxGap(rect,phrase.box);
    if(gap>1.2*size)continue;
    if(!beside||(rect.filled&&!beside.filled)||(rect.filled===beside.filled&&gap<beside.gap))beside={...rect,relation:"BESIDE_LABEL",gap};
  }
  return inside||beside;
}

// The parser keeps every drawing page's phrases on one non-spatial record per page ("pdf-text-layer"), so
// later passes (the project roster, label work) can read the page's words without re-parsing the PDF.
// Rounded and short-keyed to keep a 9-sheet set to a few hundred KB.
export type CompactTextPhrase={t:string;b:[number,number,number,number];s:number;d:[number,number];n:number;f?:[number,number,number,number,number,number];fl?:string;fr?:string};
const r4=(value:number)=>Math.round(value*1e4)/1e4;
export function compactTextPhrase(phrase:TextPhrase,footprint:DrawnFootprint|null,frame:{floor?:string|null;id?:string|null}|null):CompactTextPhrase{
  return{t:phrase.text,b:[r4(phrase.box.x0),r4(phrase.box.y0),r4(phrase.box.x1),r4(phrase.box.y1)],s:r4(phrase.size),d:[Math.round(phrase.dirX*100)/100,Math.round(phrase.dirY*100)/100],n:phrase.lines,
    ...(footprint?{f:[r4(footprint.x0),r4(footprint.y0),r4(footprint.x1),r4(footprint.y1),footprint.filled?1:0,footprint.relation==="CONTAINS_LABEL"?1:0] as [number,number,number,number,number,number]}:{}),
    ...(frame?.floor?{fl:frame.floor}:{}),...(frame?.id?{fr:frame.id}:{})};
}
export function footprintOf(phrase:CompactTextPhrase):DrawnFootprint|null{
  if(!phrase.f)return null;
  const [x0,y0,x1,y1,filled,contains]=phrase.f;
  return{x0,y0,x1,y1,filled:filled===1,relation:contains===1?"CONTAINS_LABEL":"BESIDE_LABEL",gap:0};
}
// Phrases longer than this are notes; only labels get a footprint search.
export const FOOTPRINT_PHRASE_MAX_CHARACTERS=16;

// Two boxes of a lineup share a side: touching edges and most of the side in common.
export function sharesSide(a:SheetBox,b:SheetBox,tolerance:number){
  const verticalOverlap=Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0),horizontalOverlap=Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0);
  const sideBySide=(Math.abs(a.x1-b.x0)<=tolerance||Math.abs(b.x1-a.x0)<=tolerance)&&verticalOverlap>=.5*Math.min(a.y1-a.y0,b.y1-b.y0);
  const stacked=(Math.abs(a.y1-b.y0)<=tolerance||Math.abs(b.y1-a.y0)<=tolerance)&&horizontalOverlap>=.5*Math.min(a.x1-a.x0,b.x1-b.x0);
  return sideBySide||stacked;
}
