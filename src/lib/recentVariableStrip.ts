/** Max resident chips in the thin recent & pinned strip (DESIGN-CONV-C). */
export const MAX_RECENT_STRIP_ITEMS = 8;

export function buildStripVariableIds(
  pinnedIds: readonly string[] | undefined,
  recentIds: readonly string[] | undefined,
  max = MAX_RECENT_STRIP_ITEMS,
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of pinnedIds ?? []) {
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= max) return result;
  }
  for (const id of recentIds ?? []) {
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= max) return result;
  }
  return result;
}

export function touchRecentVariableIds(
  recentIds: readonly string[],
  id: string,
  max = MAX_RECENT_STRIP_ITEMS,
): string[] {
  return [id, ...recentIds.filter((existing) => existing !== id)].slice(0, max);
}
