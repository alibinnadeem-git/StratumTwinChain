/** Keep independently extracted document coordinate systems separate. */
export function sameSourceFrame(
  a: {source: string; floor?: string; meta?: Record<string, unknown>},
  b: {source: string; floor?: string; meta?: Record<string, unknown>},
) {
  const sourceA = a.meta?.sourceSha256 ?? a.source;
  const sourceB = b.meta?.sourceSha256 ?? b.source;
  return sourceA === sourceB && a.floor === b.floor && a.meta?.page === b.meta?.page;
}

/** Parser-local identifiers are only unique inside their original document. */
export function scopeSourceEntities<T extends {id: string; meta?: Record<string, unknown>}>(
  entities: T[], digest: string,
): T[] {
  return entities.map(entity => ({
    ...entity,
    id: `${digest}:${entity.id}`,
    meta: {...entity.meta, sourceSha256: digest},
  }));
}


const PDF_FLOOR_ORDINALS:Record<string,number>={
  FIRST:1,SECOND:2,THIRD:3,FOURTH:4,FIFTH:5,SIXTH:6,SEVENTH:7,EIGHTH:8,NINTH:9,TENTH:10,
};
const PDF_PLAN_CONTEXT=/\b(?:PLAN|ELECTRICAL|POWER|LIGHTING|ARCHITECTURAL|MECHANICAL|PLUMBING|FIRE|TELECOM|TELECOMMUNICATIONS)\b/i;

function pdfFloorHint(value:string):string|null{
  const text=value.replace(/\s+/g,' ').trim().toUpperCase();
  if(!text)return null;
  if(/^ROOF(?:\s+(?:PLAN|ELECTRICAL|POWER|LIGHTING|MECHANICAL|ARCHITECTURAL))?$/.test(text))return'ROOF';
  if(/^GROUND(?:\s+FLOOR)?(?:\s*[-–—:]\s*.+|\s+PLAN)?$/.test(text))return'L1';

  const numeric=text.match(/^(?:PROPOSED |EXISTING |NEW )?(?:LEVEL|LVL|FLOOR)\s*[-#:]?\s*(\d{1,2})\b(.*)$/);
  if(numeric){
    const remainder=numeric[2].trim();
    if(!remainder||PDF_PLAN_CONTEXT.test(remainder))return`L${Number(numeric[1])}`;
  }

  const ordinal=text.match(/^(FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH)\s+FLOOR\b(.*)$/);
  if(ordinal){
    const remainder=ordinal[2].trim();
    if(!remainder||PDF_PLAN_CONTEXT.test(remainder))return`L${PDF_FLOOR_ORDINALS[ordinal[1]]}`;
  }
  return null;
}

/** Resolve a PDF page floor only when all source-grounded title hints agree. */
export function inferPdfPageFloor(items:string[]){
  const hints=new Set(items.map(pdfFloorHint).filter((value):value is string=>Boolean(value)));
  return hints.size===1?[...hints][0]:'UNRESOLVED';
}
