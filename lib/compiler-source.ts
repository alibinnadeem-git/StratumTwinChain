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
