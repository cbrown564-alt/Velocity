/**
 * User-facing upload / load progress copy (STAB-UI-E Phase 4 — Confidence Builder).
 */

import type { LoadProgressState } from '../store/slices/dataSlice';

const SUPPORTED_EXTENSIONS = new Set(['sav', 'csv', 'arrow']);

export type UploadFormatError = {
  title: string;
  message: string;
  duration?: number;
};

/** Map engine phase + message to stage headline for the uploading overlay. */
export function getLoadStageHeadline(progress: LoadProgressState | null): string {
  if (!progress) return 'Preparing analysis engine…';

  const msg = progress.message?.trim();
  if (msg) {
    if (/complete|ready/i.test(msg)) return 'Ready';
    if (/parse|metadata|variable/i.test(msg)) return 'Parsing variables…';
    if (/row|insert|index|load/i.test(msg)) return 'Building index…';
    if (/read|start/i.test(msg)) return 'Reading file…';
    return msg;
  }

  switch (progress.phase) {
    case 'parsing':
      return 'Parsing variables…';
    case 'inserting':
      return 'Building index…';
    case 'complete':
      return 'Ready';
    default:
      return 'Reading file…';
  }
}

export function getUploadFormatError(fileName: string): UploadFormatError | null {
  const ext = fileName.toLowerCase().split('.').pop() ?? '';

  if (SUPPORTED_EXTENSIONS.has(ext)) return null;

  if (ext === 'xlsx' || ext === 'xls') {
    return {
      title: 'Excel needs CSV first',
      message: 'Save your spreadsheet as CSV (File → Save As → CSV), then upload the .csv file here.',
      duration: 8000,
    };
  }

  if (ext === 'json' || ext === 'parquet' || ext === 'tsv') {
    return {
      title: `Unsupported .${ext} file`,
      message: 'Velocity currently supports .SAV, .CSV, and .Arrow survey files.',
      duration: 6000,
    };
  }

  return {
    title: 'Unsupported file type',
    message: `Use .SAV, .CSV, or .Arrow. (“.${ext || 'unknown'}” is not supported.)`,
    duration: 6000,
  };
}

export function formatUploadFailure(err: unknown, fileName: string): UploadFormatError {
  const raw = err instanceof Error ? err.message : String(err ?? 'Unknown error');
  const normalized = raw.toLowerCase();

  if (
    normalized.includes('access handle') ||
    normalized.includes('another open access handle') ||
    normalized.includes('writable stream')
  ) {
    return {
      title: 'Dataset open elsewhere',
      message: 'This dataset may be open in another Velocity tab. Switch to that tab or close it, then try again.',
      duration: 8000,
    };
  }

  if (normalized.includes('quota') || normalized.includes('storage')) {
    return {
      title: 'Not enough local storage',
      message: 'Free browser storage or remove older workspace datasets, then retry your upload.',
      duration: 8000,
    };
  }

  return {
    title: `Could not load ${fileName}`,
    message: raw.length > 200 ? `${raw.slice(0, 200)}…` : raw,
    duration: 8000,
  };
}
