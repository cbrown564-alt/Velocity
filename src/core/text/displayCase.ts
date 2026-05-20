const SMALL_WORDS = new Set(['by', 'and', 'or', 'of', 'in', 'to', 'a', 'an', 'the']);

function capitalizeWord(word: string, isFirst: boolean): string {
  const lower = word.toLowerCase();
  if (!isFirst && SMALL_WORDS.has(lower)) return lower;
  if (!word) return word;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function titleCaseSegment(segment: string): string {
  const trimmed = segment.trim();
  if (!trimmed) return segment;
  const words = trimmed.split(/\s+/);
  return words.map((word, i) => capitalizeWord(word, i === 0)).join(' ');
}

/**
 * Slide titles: Title Case with "by" as a connector (UXP-010).
 * Preserves hierarchy separators " > " from multi-row variables.
 */
export function toTitleCase(text: string): string {
  if (!text || text === 'New Slide') return text;

  const byIndex = text.toLowerCase().lastIndexOf(' by ');
  if (byIndex >= 0) {
    const left = text.slice(0, byIndex);
    const right = text.slice(byIndex + 4);
    return `${titleCaseParts(left)} by ${titleCaseSegment(right)}`;
  }

  return titleCaseParts(text);
}

function titleCaseParts(text: string): string {
  return text
    .split(' > ')
    .map((part) => titleCaseSegment(part))
    .join(' > ');
}

/** Axis headers in tables: UI caps (display only; CSS may also uppercase). */
export function toUiCaps(text: string): string {
  return text.trim().toUpperCase();
}
